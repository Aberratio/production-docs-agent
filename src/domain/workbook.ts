import type { ResolvedField } from './decisions.ts';
import type { SheetSpec } from './export.ts';
import { ORDER_COLUMNS, QUALITY_COLUMNS, toErpRecord, toSheetRows, type Cell } from './mapping.ts';
import type { Extraction } from './schema.ts';

export const REVIEW_COLUMNS = [
  'source_document',
  'field',
  'label',
  'status',
  'proposed',
  'final',
  'issues',
] as const;

export interface WorkbookEntry {
  documentId: string;
  extraction: Extraction;
  fields: readonly ResolvedField[];
}

const cell = (v: unknown): Cell => (typeof v === 'string' || typeof v === 'number' ? v : null);

/** Sheets for the "all documents" export: ERP rows plus an audit log of human review. */
export function buildWorkbookSheets(entries: readonly WorkbookEntry[]): SheetSpec[] {
  const records = entries.map((e) => toErpRecord(e.documentId, e.extraction, e.fields));
  const rows = (type: string) =>
    records.filter((r) => r.record_type === type).flatMap((r) => toSheetRows(r));
  const log = entries.flatMap((e) =>
    e.fields
      .filter((f) => f.status !== 'auto')
      .map((f) => ({
        source_document: e.documentId,
        field: f.path,
        label: f.label,
        status: f.status,
        proposed: cell(f.proposed),
        final: cell(f.value),
        issues: f.issues.map((i) => `${i.code}: ${i.message}`).join(' | '),
      })),
  );
  return [
    { name: 'orders', columns: ORDER_COLUMNS, rows: rows('sales_order') },
    { name: 'quality', columns: QUALITY_COLUMNS, rows: rows('quality_inspection') },
    { name: 'review_log', columns: REVIEW_COLUMNS, rows: log },
  ];
}
