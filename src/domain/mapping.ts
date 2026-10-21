import type { ResolvedField } from './decisions.ts';
import type { Extraction } from './schema.ts';

/**
 * Mapping from resolved fields to simple "ERP" records (plain JSON) and to flat spreadsheet rows.
 * Only resolved values are used — anything still awaiting review is null and listed as open.
 */

export interface ReviewSummary {
  status: 'ready' | 'needs_review';
  open_fields: string[];
  corrected_fields: string[];
  approved_fields: string[];
}

export interface SalesOrderLine {
  line_no: number;
  item_code: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  line_net: number | null;
}

export interface SalesOrderRecord {
  record_type: 'sales_order';
  source_document: string;
  order_number: string | null;
  order_date: string | null;
  customer_name: string | null;
  contact_person: string | null;
  delivery_date: string | null;
  delivery_address: string | null;
  currency: string | null;
  payment_terms: string | null;
  total_net: number | null;
  lines: SalesOrderLine[];
  review: ReviewSummary;
}

export interface QualityRecord {
  record_type: 'quality_inspection';
  source_document: string;
  report_number: string | null;
  report_date: string | null;
  item_code: string | null;
  batch_number: string | null;
  order_reference: string | null;
  inspected_qty: number | null;
  acceptance_number: number | null;
  nonconforming_qty: number | null;
  defect_description: string | null;
  decision: string | null;
  inspector: string | null;
  review: ReviewSummary;
}

export type ErpRecord = SalesOrderRecord | QualityRecord;

export const ORDER_COLUMNS = [
  'source_document',
  'order_number',
  'order_date',
  'customer_name',
  'contact_person',
  'delivery_date',
  'delivery_address',
  'currency',
  'payment_terms',
  'line_no',
  'item_code',
  'description',
  'quantity',
  'unit',
  'unit_price',
  'line_net',
  'total_net',
  'review_status',
  'open_fields',
] as const;

export const QUALITY_COLUMNS = [
  'source_document',
  'report_number',
  'report_date',
  'item_code',
  'batch_number',
  'order_reference',
  'inspected_qty',
  'acceptance_number',
  'nonconforming_qty',
  'defect_description',
  'decision',
  'inspector',
  'review_status',
  'open_fields',
] as const;

export type Cell = string | number | null;
export type SheetRow = Record<string, Cell>;

function summarize(fields: readonly ResolvedField[]): ReviewSummary {
  const paths = (status: ResolvedField['status']) =>
    fields.filter((f) => f.status === status).map((f) => f.path);
  const open = paths('needs_review');
  return {
    status: open.length === 0 ? 'ready' : 'needs_review',
    open_fields: open,
    corrected_fields: paths('corrected'),
    approved_fields: paths('approved'),
  };
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const cents = (v: number): number => Math.round(v * 100) / 100;

export function toErpRecord(
  documentId: string,
  extraction: Extraction,
  fields: readonly ResolvedField[],
): ErpRecord {
  const get = (path: string): unknown => fields.find((f) => f.path === path)?.value ?? null;
  const review = summarize(fields);

  if (extraction.kind === 'quality_report') {
    return {
      record_type: 'quality_inspection',
      source_document: documentId,
      report_number: str(get('report_number')),
      report_date: str(get('report_date')),
      item_code: str(get('item_code')),
      batch_number: str(get('batch_number')),
      order_reference: str(get('order_reference')),
      inspected_qty: num(get('inspected_qty')),
      acceptance_number: num(get('acceptance_number')),
      nonconforming_qty: num(get('nonconforming_qty')),
      defect_description: str(get('defect_description')),
      decision: str(get('decision')),
      inspector: str(get('inspector')),
      review,
    };
  }

  const lines = extraction.data.lines.map((_, i): SalesOrderLine => {
    const quantity = num(get(`lines.${i}.quantity`));
    const unitPrice = num(get(`lines.${i}.unit_price`));
    return {
      line_no: i + 1,
      item_code: str(get(`lines.${i}.item_code`)),
      description: str(get(`lines.${i}.description`)),
      quantity,
      unit: str(get(`lines.${i}.unit`)),
      unit_price: unitPrice,
      line_net: quantity !== null && unitPrice !== null ? cents(quantity * unitPrice) : null,
    };
  });
  return {
    record_type: 'sales_order',
    source_document: documentId,
    order_number: str(get('order_number')),
    order_date: str(get('order_date')),
    customer_name: str(get('customer_name')),
    contact_person: str(get('contact_person')),
    delivery_date: str(get('delivery_date')),
    delivery_address: str(get('delivery_address')),
    currency: str(get('currency')),
    payment_terms: str(get('payment_terms')),
    total_net: num(get('total_net')),
    lines,
    review,
  };
}

/** Flattens a record into spreadsheet rows: one per order line, one per inspection. */
export function toSheetRows(record: ErpRecord): SheetRow[] {
  const reviewCells = {
    review_status: record.review.status,
    open_fields: record.review.open_fields.join('; '),
  };
  if (record.record_type === 'quality_inspection') {
    const { record_type: _type, review: _review, ...fields } = record;
    return [{ ...fields, ...reviewCells }];
  }
  const header = {
    source_document: record.source_document,
    order_number: record.order_number,
    order_date: record.order_date,
    customer_name: record.customer_name,
    contact_person: record.contact_person,
    delivery_date: record.delivery_date,
    delivery_address: record.delivery_address,
    currency: record.currency,
    payment_terms: record.payment_terms,
  };
  const emptyLine: Omit<SalesOrderLine, 'line_no'> & { line_no: number | null } = {
    line_no: null,
    item_code: null,
    description: null,
    quantity: null,
    unit: null,
    unit_price: null,
    line_net: null,
  };
  const lines = record.lines.length > 0 ? record.lines : [emptyLine];
  return lines.map((line) => ({
    ...header,
    ...line,
    total_net: record.total_net,
    ...reviewCells,
  }));
}
