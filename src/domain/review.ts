import type {
  ExtractedField,
  Extraction,
  PurchaseOrderExtraction,
  QualityReportExtraction,
} from './schema';

/**
 * Deterministic review of a model extraction. The model may say it is unsure; this layer never
 * trusts it to say so — it re-checks every value against rules a reviewer would apply by hand and
 * flags anything that needs a human. Nothing here fills in or corrects a value.
 */

export type IssueCode = 'missing' | 'uncertain' | 'invalid' | 'not_in_document' | 'inconsistent';

export interface Issue {
  code: IssueCode;
  message: string;
}

/** How a value is validated and how a human correction is parsed. */
export type FieldType = 'text' | 'date' | 'quantity' | 'count' | 'money' | 'decision';

export interface ReviewItem {
  /** Dot path into the extraction, e.g. `lines.0.quantity`. */
  path: string;
  label: string;
  type: FieldType;
  required: boolean;
  field: ExtractedField;
  issues: Issue[];
  needsReview: boolean;
}

interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
}

const spec = (key: string, label: string, type: FieldType, required = true): FieldSpec => ({
  key,
  label,
  type,
  required,
});

export const ORDER_FIELDS: readonly FieldSpec[] = [
  spec('order_number', 'Order number', 'text'),
  spec('order_date', 'Order date', 'date'),
  spec('customer_name', 'Customer', 'text'),
  spec('contact_person', 'Contact person', 'text', false),
  spec('delivery_date', 'Delivery date', 'date'),
  spec('delivery_address', 'Delivery address', 'text'),
  spec('currency', 'Currency', 'text'),
  spec('payment_terms', 'Payment terms', 'text', false),
  spec('total_net', 'Total net', 'money', false),
];

export const LINE_FIELDS: readonly FieldSpec[] = [
  spec('item_code', 'item code', 'text'),
  spec('description', 'description', 'text'),
  spec('quantity', 'quantity', 'quantity'),
  spec('unit', 'unit', 'text'),
  spec('unit_price', 'unit price', 'money'),
];

export const REPORT_FIELDS: readonly FieldSpec[] = [
  spec('report_number', 'Report number', 'text'),
  spec('report_date', 'Inspection date', 'date'),
  spec('item_code', 'Item code', 'text'),
  spec('batch_number', 'Batch', 'text'),
  spec('order_reference', 'Order reference', 'text', false),
  spec('inspected_qty', 'Inspected (pcs)', 'count'),
  spec('acceptance_number', 'Acceptance number (Ac)', 'count', false),
  spec('nonconforming_qty', 'Nonconforming (pcs)', 'count'),
  spec('defect_description', 'Defect description', 'text', false),
  spec('decision', 'Decision', 'decision'),
  spec('inspector', 'Inspector', 'text', false),
];

const PIECE_UNITS = new Set(['szt', 'szt.', 'sztuk', 'pcs', 'pcs.', 'pc', 'pc.', 'pieces', 'ea']);
const DECISIONS = new Set(['accepted', 'rejected', 'conditional']);

export function isPieceUnit(unit: unknown): boolean {
  return typeof unit === 'string' && PIECE_UNITS.has(unit.trim().toLowerCase());
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Normalises text for quote matching: case, table pipes, and any run of whitespace (line breaks
 * and non-breaking spaces included — `\s` matches U+00A0 and U+202F).
 */
export function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Format rule for one value; returns a reason when the value is unusable as-is. */
export function formatProblem(type: FieldType, value: unknown, unit?: unknown): string | null {
  switch (type) {
    case 'text':
      return typeof value === 'string' && value.trim() !== '' ? null : 'Expected non-empty text.';
    case 'date':
      return isIsoDate(value)
        ? null
        : `"${String(value)}" is not an unambiguous date (YYYY-MM-DD).`;
    case 'money':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? null
        : 'Expected an amount of zero or more.';
    case 'count':
      return Number.isInteger(value) && (value as number) >= 0
        ? null
        : 'Expected a whole number of pieces.';
    case 'quantity':
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
        return 'Expected a quantity greater than zero.';
      return isPieceUnit(unit) && !Number.isInteger(value)
        ? 'Quantity in pieces must be a whole number.'
        : null;
    case 'decision':
      return typeof value === 'string' && DECISIONS.has(value)
        ? null
        : 'Expected accepted, rejected or conditional.';
  }
}

function fieldIssues(
  f: ExtractedField,
  s: FieldSpec,
  normalizedDoc: string,
  unit?: unknown,
): Issue[] {
  const issues: Issue[] = [];
  if (f.value === null) {
    if (s.required) {
      issues.push({
        code: 'missing',
        message: f.note ?? 'Required, but not found in the document.',
      });
    } else if (f.confidence !== 'high') {
      // Optional, but the model saw something it could not resolve — a human should look.
      issues.push({
        code: 'uncertain',
        message: f.note ?? 'The document mentions this value but it could not be read.',
      });
    }
    return issues;
  }
  if (f.confidence !== 'high') {
    issues.push({
      code: 'uncertain',
      message: f.note ?? `The model was not sure about this value (${f.confidence} confidence).`,
    });
  }
  const notation = notationProblem(s.type, f.source_text);
  if (notation && !issues.some((i) => i.code === 'uncertain')) {
    issues.push({ code: 'uncertain', message: notation });
  }
  const problem = formatProblem(s.type, f.value, unit);
  if (problem) issues.push({ code: 'invalid', message: problem });
  const quote = f.source_text?.trim() ?? '';
  if (quote === '') {
    issues.push({
      code: 'not_in_document',
      message: 'No source quote — this value cannot be traced to the document.',
    });
  } else if (!normalizedDoc.includes(normalizeForMatch(quote))) {
    issues.push({
      code: 'not_in_document',
      message: `Quoted source "${quote}" does not appear in the document.`,
    });
  }
  return issues;
}

const ISO_DATE_IN_TEXT = /\b\d{4}-\d{2}-\d{2}\b/;
const DATE_IN_TEXT = /\b(\d{1,2})([./-])(\d{1,2})(?:\2(\d{2,4}))?(?!\d)/;
// "ok." / "około" / "ca." / "approx" / "about" / "circa" / "kilka…" / "kilkanaście…" / "~"
const APPROXIMATE = /(?:^|[^\p{L}])(?:ok\.|około|ca\.|approx|about|circa|kilk)|~/iu;

/**
 * Re-reads the quoted source for notations a value should never be trusted from, whatever
 * confidence the model reports: a date without a year or with swappable day and month, or an
 * approximate count.
 */
export function notationProblem(type: FieldType, source: string | null): string | null {
  if (!source) return null;
  if (type === 'date') {
    if (ISO_DATE_IN_TEXT.test(source)) return null;
    const m = DATE_IN_TEXT.exec(source);
    if (!m) return null;
    if (!m[4]) return `"${m[0]}" has no year — the year was assumed.`;
    if (m[2] === '/' && Number(m[1]) <= 12 && Number(m[3]) <= 12) {
      return `"${m[0]}" could be read as day and month either way round.`;
    }
    return null;
  }
  if ((type === 'quantity' || type === 'count') && APPROXIMATE.test(source)) {
    return `"${source}" is an approximation, not an exact count.`;
  }
  return null;
}

function item(
  path: string,
  label: string,
  s: FieldSpec,
  f: ExtractedField,
  normalizedDoc: string,
  unit?: unknown,
): ReviewItem {
  const issues = fieldIssues(f, s, normalizedDoc, unit);
  return { path, label, type: s.type, required: s.required, field: f, issues, needsReview: false };
}

const numberAt = (v: unknown): number | null => (typeof v === 'number' ? v : null);

function fieldOf(record: Record<string, ExtractedField>, key: string): ExtractedField {
  const f = record[key];
  if (!f) throw new Error(`Extraction is missing the "${key}" field.`);
  return f;
}

function reviewOrder(data: PurchaseOrderExtraction, doc: string): ReviewItem[] {
  const rec = data as unknown as Record<string, ExtractedField>;
  const items = ORDER_FIELDS.map((s) => item(s.key, s.label, s, fieldOf(rec, s.key), doc));
  if (data.lines.length === 0) {
    items.push({
      path: LINES_PLACEHOLDER,
      label: 'Order lines',
      type: 'text',
      required: true,
      field: { value: null, confidence: 'low', source_text: null, note: null },
      issues: [{ code: 'missing', message: 'No order lines found in the document.' }],
      needsReview: false,
    });
  }
  data.lines.forEach((line, i) => {
    const lrec = line as unknown as Record<string, ExtractedField>;
    for (const s of LINE_FIELDS) {
      const unit = line.unit.value;
      items.push(
        item(
          `lines.${i}.${s.key}`,
          `Line ${i + 1} · ${s.label}`,
          s,
          fieldOf(lrec, s.key),
          doc,
          unit,
        ),
      );
    }
  });
  return items;
}

function reviewReport(data: QualityReportExtraction, doc: string): ReviewItem[] {
  const rec = data as unknown as Record<string, ExtractedField>;
  return REPORT_FIELDS.map((s) => item(s.key, s.label, s, fieldOf(rec, s.key), doc));
}

/** Path of the pseudo-field shown when an order has no lines; it can only be fixed at the source. */
export const LINES_PLACEHOLDER = 'lines';

export interface CrossFieldIssue {
  path: string;
  issue: Issue;
}

/**
 * Rules that compare fields with each other. They run on the model's values during review, and
 * again on the human-resolved values (decisions.ts), so a correction cannot quietly create a
 * contradiction in a field nobody looked at.
 */
export function crossFieldIssues(
  paths: readonly string[],
  valueAt: (path: string) => unknown,
): CrossFieldIssue[] {
  const out: CrossFieldIssue[] = [];
  const add = (path: string, message: string) =>
    out.push({ path, issue: { code: 'inconsistent', message } });

  if (paths.includes('report_number')) {
    const inspected = numberAt(valueAt('inspected_qty'));
    const bad = numberAt(valueAt('nonconforming_qty'));
    const ac = numberAt(valueAt('acceptance_number'));
    if (inspected !== null && bad !== null && bad > inspected) {
      add('nonconforming_qty', `${bad} nonconforming parts out of ${inspected} inspected.`);
    }
    if (valueAt('decision') === 'accepted' && bad !== null && ac !== null && bad > ac) {
      add(
        'decision',
        `Batch accepted although ${bad} nonconforming parts exceed the acceptance number ${ac}.`,
      );
    }
    return out;
  }

  const ordered = valueAt('order_date');
  const delivery = valueAt('delivery_date');
  if (isIsoDate(ordered) && isIsoDate(delivery) && delivery < ordered) {
    add('delivery_date', `Delivery date ${delivery} is before the order date ${ordered}.`);
  }
  const lineCount = paths.filter((p) => /^lines\.\d+\.quantity$/.test(p)).length;
  const total = numberAt(valueAt('total_net'));
  const lineTotals = Array.from({ length: lineCount }, (_, i) => {
    const q = numberAt(valueAt(`lines.${i}.quantity`));
    const p = numberAt(valueAt(`lines.${i}.unit_price`));
    return q !== null && p !== null ? q * p : null;
  });
  if (total !== null && lineTotals.length > 0 && lineTotals.every((t) => t !== null)) {
    const sum = (lineTotals as number[]).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - total) >= 0.005) {
      add(
        'total_net',
        `Stated total ${total.toFixed(2)} differs from the sum of the lines ${sum.toFixed(2)}.`,
      );
    }
  }
  return out;
}

export function reviewExtraction(extraction: Extraction, documentText: string): ReviewItem[] {
  const doc = normalizeForMatch(documentText);
  const items =
    extraction.kind === 'purchase_order'
      ? reviewOrder(extraction.data, doc)
      : reviewReport(extraction.data, doc);
  const byPath = new Map(items.map((i) => [i.path, i]));
  const cross = crossFieldIssues([...byPath.keys()], (p) => byPath.get(p)?.field.value ?? null);
  for (const { path, issue } of cross) byPath.get(path)?.issues.push(issue);
  for (const i of items) i.needsReview = i.issues.length > 0;
  return items;
}
