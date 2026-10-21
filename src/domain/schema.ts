import { z } from 'zod';

/**
 * Extraction schemas — the exact shape Claude must return (structured output) and the shape of the
 * recorded runs in `recordings/`. Every value is wrapped in an {@link ExtractedField} so the model
 * can say "I am not sure" instead of guessing: `value` stays null when the document does not say,
 * `confidence` is below "high" when the reading is ambiguous, and `note` explains why.
 *
 * Structured outputs need every key present, so optionality is expressed with `.nullable()`.
 */
export const Confidence = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof Confidence>;

function field<T extends z.ZodType>(value: T) {
  return z.object({
    value: value.nullable(),
    confidence: Confidence,
    /** Verbatim fragment of the document the value was read from; null when nothing was found. */
    source_text: z.string().nullable(),
    /** Why the value is uncertain or missing; null when confidence is high. */
    note: z.string().nullable(),
  });
}

const text = field(z.string());
/** ISO calendar date (YYYY-MM-DD), only when the document states it unambiguously. */
const date = field(z.string());
const number = field(z.number());

export const OrderLine = z.object({
  item_code: text,
  description: text,
  quantity: number,
  unit: text,
  unit_price: number,
});
export type OrderLine = z.infer<typeof OrderLine>;

export const PurchaseOrderExtraction = z.object({
  order_number: text,
  order_date: date,
  customer_name: text,
  contact_person: text,
  delivery_date: date,
  delivery_address: text,
  currency: text,
  payment_terms: text,
  total_net: number,
  lines: z.array(OrderLine),
});
export type PurchaseOrderExtraction = z.infer<typeof PurchaseOrderExtraction>;

export const Decision = z.enum(['accepted', 'rejected', 'conditional']);
export type Decision = z.infer<typeof Decision>;

export const QualityReportExtraction = z.object({
  report_number: text,
  report_date: date,
  item_code: text,
  batch_number: text,
  order_reference: text,
  inspected_qty: number,
  acceptance_number: number,
  nonconforming_qty: number,
  defect_description: text,
  decision: field(Decision),
  inspector: text,
});
export type QualityReportExtraction = z.infer<typeof QualityReportExtraction>;

export type DocumentKind = 'purchase_order' | 'quality_report';

export type Extraction =
  | { kind: 'purchase_order'; data: PurchaseOrderExtraction }
  | { kind: 'quality_report'; data: QualityReportExtraction };

export interface ExtractedField<T = unknown> {
  value: T | null;
  confidence: Confidence;
  source_text: string | null;
  note: string | null;
}

export const schemaFor = {
  purchase_order: PurchaseOrderExtraction,
  quality_report: QualityReportExtraction,
} as const;

/** Validates raw model or file output against the schema for `kind`; null when it does not fit. */
export function parseExtraction(kind: DocumentKind, raw: unknown): Extraction | null {
  if (kind === 'purchase_order') {
    const r = PurchaseOrderExtraction.safeParse(raw);
    return r.success ? { kind, data: r.data } : null;
  }
  const r = QualityReportExtraction.safeParse(raw);
  return r.success ? { kind, data: r.data } : null;
}
