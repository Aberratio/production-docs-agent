import type {
  ExtractedField,
  Extraction,
  PurchaseOrderExtraction,
  QualityReportExtraction,
} from './schema.ts';
import { english, t, type Msg } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/en.ts';

/**
 * Deterministic review of a model extraction. The model may say it is unsure; this layer never
 * trusts it to say so — it re-checks every value against rules a reviewer would apply by hand and
 * flags anything that needs a human. Nothing here fills in or corrects a value.
 */

export type IssueCode = 'missing' | 'uncertain' | 'invalid' | 'not_in_document' | 'inconsistent';

export interface Issue {
  code: IssueCode;
  /** The reason, rendered in the reader's language by the UI. */
  msg: Msg;
  /** The same reason in English (exports and comparisons). */
  message: string;
}

export const msg = (key: MessageKey, params?: Msg['params']): Msg =>
  params ? { key, params } : { key };

export const issue = (code: IssueCode, reason: Msg): Issue => ({
  code,
  msg: reason,
  message: english(reason),
});

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

export type LabelScope = 'purchase_order' | 'line' | 'quality_report';

/** Dictionary key of a field's label; its English text is the label in exports. */
export const labelKey = (scope: LabelScope, key: string): MessageKey =>
  `field.${scope}.${key}` as MessageKey;

const specs =
  (scope: LabelScope) =>
  (key: string, type: FieldType, required = true): FieldSpec => ({
    key,
    label: t('en', labelKey(scope, key)),
    type,
    required,
  });

const orderField = specs('purchase_order');
const lineField = specs('line');
const reportField = specs('quality_report');

export const ORDER_FIELDS: readonly FieldSpec[] = [
  orderField('order_number', 'text'),
  orderField('order_date', 'date'),
  orderField('customer_name', 'text'),
  orderField('contact_person', 'text', false),
  orderField('delivery_date', 'date'),
  orderField('delivery_address', 'text'),
  orderField('currency', 'text'),
  orderField('payment_terms', 'text', false),
  orderField('total_net', 'money', false),
];

export const LINE_FIELDS: readonly FieldSpec[] = [
  lineField('item_code', 'text'),
  lineField('description', 'text'),
  lineField('quantity', 'quantity'),
  lineField('unit', 'text'),
  lineField('unit_price', 'money'),
];

export const REPORT_FIELDS: readonly FieldSpec[] = [
  reportField('report_number', 'text'),
  reportField('report_date', 'date'),
  reportField('item_code', 'text'),
  reportField('batch_number', 'text'),
  reportField('order_reference', 'text', false),
  reportField('inspected_qty', 'count'),
  reportField('acceptance_number', 'count', false),
  reportField('nonconforming_qty', 'count'),
  reportField('defect_description', 'text', false),
  reportField('decision', 'decision'),
  reportField('inspector', 'text', false),
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
export function formatProblem(type: FieldType, value: unknown, unit?: unknown): Msg | null {
  switch (type) {
    case 'text':
      return typeof value === 'string' && value.trim() !== '' ? null : msg('rule.text');
    case 'date':
      return isIsoDate(value) ? null : msg('rule.date', { value: String(value) });
    case 'money':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? null
        : msg('rule.money');
    case 'count':
      return Number.isInteger(value) && (value as number) >= 0 ? null : msg('rule.count');
    case 'quantity':
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
        return msg('rule.quantity');
      return isPieceUnit(unit) && !Number.isInteger(value) ? msg('rule.quantityWhole') : null;
    case 'decision':
      return typeof value === 'string' && DECISIONS.has(value) ? null : msg('rule.decision');
  }
}

function fieldIssues(
  f: ExtractedField,
  s: FieldSpec,
  normalizedDoc: string,
  unit?: unknown,
): Issue[] {
  const issues: Issue[] = [];
  // The model's own note, when it wrote one, is the most specific reason.
  const noteOr = (fallback: Msg): Msg =>
    f.note ? msg('issue.modelNote', { note: f.note }) : fallback;
  if (f.value === null) {
    if (s.required) {
      issues.push(issue('missing', noteOr(msg('issue.missing'))));
    } else if (f.confidence !== 'high') {
      // Optional, but the model saw something it could not resolve — a human should look.
      issues.push(issue('uncertain', noteOr(msg('issue.unreadable'))));
    }
    return issues;
  }
  if (f.confidence !== 'high') {
    issues.push(issue('uncertain', noteOr(msg(`issue.unsure.${f.confidence}`))));
  }
  const notation = notationProblem(s.type, f.source_text);
  if (notation && !issues.some((i) => i.code === 'uncertain')) {
    issues.push(issue('uncertain', notation));
  }
  const problem = formatProblem(s.type, f.value, unit);
  if (problem) issues.push(issue('invalid', problem));
  const quote = f.source_text?.trim() ?? '';
  if (quote === '') {
    issues.push(issue('not_in_document', msg('issue.noQuote')));
  } else if (!normalizedDoc.includes(normalizeForMatch(quote))) {
    issues.push(issue('not_in_document', msg('issue.quoteMissing', { quote })));
  }
  return issues;
}

const ISO_DATE_IN_TEXT = /\b\d{4}-\d{2}-\d{2}\b/;
const DATE_IN_TEXT = /\b(\d{1,2})([./-])(\d{1,2})(?:\2(\d{2,4}))?(?!\d)/;
// Approximate counts in Polish and English documents: "ok." (about) and its unabbreviated form,
// "ca.", "approx", "about", "circa", the Polish "kilk…" words ("a few", "a dozen or so") and "~".
const APPROXIMATE = /(?:^|[^\p{L}])(?:ok\.|oko\u0142o|ca\.|approx|about|circa|kilk)|~/iu;

/**
 * Re-reads the quoted source for notations a value should never be trusted from, whatever
 * confidence the model reports: a date without a year or with swappable day and month, or an
 * approximate count.
 */
export function notationProblem(type: FieldType, source: string | null): Msg | null {
  if (!source) return null;
  if (type === 'date') {
    if (ISO_DATE_IN_TEXT.test(source)) return null;
    const m = DATE_IN_TEXT.exec(source);
    if (!m) return null;
    if (!m[4]) return msg('notation.noYear', { date: m[0] });
    if (m[2] === '/' && Number(m[1]) <= 12 && Number(m[3]) <= 12) {
      return msg('notation.swappable', { date: m[0] });
    }
    return null;
  }
  if ((type === 'quantity' || type === 'count') && APPROXIMATE.test(source)) {
    return msg('notation.approximate', { source });
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
      label: t('en', labelKey('purchase_order', LINES_PLACEHOLDER)),
      type: 'text',
      required: true,
      field: { value: null, confidence: 'low', source_text: null, note: null },
      issues: [issue('missing', msg('issue.noLines'))],
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
          t('en', 'field.line.label', { n: i + 1, field: s.label }),
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
  const add = (path: string, reason: Msg) =>
    out.push({ path, issue: issue('inconsistent', reason) });

  if (paths.includes('report_number')) {
    const inspected = numberAt(valueAt('inspected_qty'));
    const bad = numberAt(valueAt('nonconforming_qty'));
    const ac = numberAt(valueAt('acceptance_number'));
    if (inspected !== null && bad !== null && bad > inspected) {
      add('nonconforming_qty', msg('cross.overInspected', { bad, inspected }));
    }
    if (valueAt('decision') === 'accepted' && bad !== null && ac !== null && bad > ac) {
      add('decision', msg('cross.acceptedOverAc', { bad, ac }));
    }
    return out;
  }

  const ordered = valueAt('order_date');
  const delivery = valueAt('delivery_date');
  if (isIsoDate(ordered) && isIsoDate(delivery) && delivery < ordered) {
    add('delivery_date', msg('cross.deliveryBeforeOrder', { delivery, ordered }));
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
        msg('cross.totalMismatch', { total: total.toFixed(2), sum: sum.toFixed(2) }),
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
