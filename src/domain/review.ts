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
  const problem = formatProblem(s.type, f.value, unit);
  if (problem) issues.push({ code: 'invalid', message: problem });
  if (f.source_text !== null && !normalizedDoc.includes(normalizeForMatch(f.source_text))) {
    issues.push({
      code: 'not_in_document',
      message: `Quoted source "${f.source_text}" does not appear in the document.`,
    });
  }
  return issues;
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

function addIssue(items: ReviewItem[], path: string, issue: Issue): void {
  const target = items.find((i) => i.path === path);
  if (target) target.issues.push(issue);
}

const num = (f: ExtractedField): number | null => (typeof f.value === 'number' ? f.value : null);

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
      path: 'lines',
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

  const ordered = data.order_date.value;
  const delivery = data.delivery_date.value;
  if (isIsoDate(ordered) && isIsoDate(delivery) && delivery < ordered) {
    addIssue(items, 'delivery_date', {
      code: 'inconsistent',
      message: `Delivery date ${delivery} is before the order date ${ordered}.`,
    });
  }

  const total = num(data.total_net);
  const lineTotals = data.lines.map((l) => {
    const q = num(l.quantity);
    const p = num(l.unit_price);
    return q !== null && p !== null ? q * p : null;
  });
  if (total !== null && lineTotals.length > 0 && lineTotals.every((t) => t !== null)) {
    const sum = (lineTotals as number[]).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - total) >= 0.005) {
      addIssue(items, 'total_net', {
        code: 'inconsistent',
        message: `Stated total ${total.toFixed(2)} differs from the sum of the lines ${sum.toFixed(2)}.`,
      });
    }
  }
  return items;
}

function reviewReport(data: QualityReportExtraction, doc: string): ReviewItem[] {
  const rec = data as unknown as Record<string, ExtractedField>;
  const items = REPORT_FIELDS.map((s) => item(s.key, s.label, s, fieldOf(rec, s.key), doc));
  const inspected = num(data.inspected_qty);
  const bad = num(data.nonconforming_qty);
  const ac = num(data.acceptance_number);
  if (inspected !== null && bad !== null && bad > inspected) {
    addIssue(items, 'nonconforming_qty', {
      code: 'inconsistent',
      message: `${bad} nonconforming parts out of ${inspected} inspected.`,
    });
  }
  if (data.decision.value === 'accepted' && bad !== null && ac !== null && bad > ac) {
    addIssue(items, 'decision', {
      code: 'inconsistent',
      message: `Batch accepted although ${bad} nonconforming parts exceed the acceptance number ${ac}.`,
    });
  }
  return items;
}

export function reviewExtraction(extraction: Extraction, documentText: string): ReviewItem[] {
  const doc = normalizeForMatch(documentText);
  const items =
    extraction.kind === 'purchase_order'
      ? reviewOrder(extraction.data, doc)
      : reviewReport(extraction.data, doc);
  for (const i of items) i.needsReview = i.issues.length > 0;
  return items;
}
