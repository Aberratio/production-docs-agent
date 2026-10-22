import type { DocumentKind } from '../domain/schema.ts';

export type DocumentFormat = 'pdf' | 'email';

export interface SampleDocument {
  id: string;
  kind: DocumentKind;
  format: DocumentFormat;
}

/**
 * The fictional sample corpus. Every company, person, address and number is invented; domains use
 * the reserved `.example` TLD. Source text lives in `documents/<id>.txt`; PDFs are generated from
 * it by `npm run docs:generate` into `public/documents/<id>.pdf`. Each document's title and what it
 * exercises are UI text, in the dictionaries under `docs.<id>.title` / `docs.<id>.scenario`.
 */
export const DOCUMENTS: readonly SampleDocument[] = [
  { id: 'po-001', kind: 'purchase_order', format: 'pdf' },
  { id: 'po-002', kind: 'purchase_order', format: 'email' },
  { id: 'po-003', kind: 'purchase_order', format: 'pdf' },
  { id: 'po-004', kind: 'purchase_order', format: 'pdf' },
  { id: 'po-005', kind: 'purchase_order', format: 'email' },
  { id: 'qr-001', kind: 'quality_report', format: 'pdf' },
  { id: 'qr-002', kind: 'quality_report', format: 'pdf' },
  { id: 'qr-003', kind: 'quality_report', format: 'email' },
];

export function findDocument(id: string): SampleDocument | undefined {
  return DOCUMENTS.find((d) => d.id === id);
}
