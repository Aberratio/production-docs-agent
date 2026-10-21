import type { DocumentKind } from '../domain/schema';

export type DocumentFormat = 'pdf' | 'email';

export interface DemoDocument {
  id: string;
  kind: DocumentKind;
  format: DocumentFormat;
  title: string;
  /** What makes this document interesting for the demo (shown in the UI). */
  scenario: string;
}

/**
 * The fictional demo corpus. Every company, person, address and number is invented; domains use
 * the reserved `.example` TLD. Source text lives in `documents/<id>.txt`; PDFs are generated from
 * it by `npm run docs:generate` into `public/documents/<id>.pdf`.
 */
export const DOCUMENTS: readonly DemoDocument[] = [
  {
    id: 'po-001',
    kind: 'purchase_order',
    format: 'pdf',
    title: 'Zamówienie ZK/2026/0412',
    scenario: 'Clean purchase order — every field present and consistent.',
  },
  {
    id: 'po-002',
    kind: 'purchase_order',
    format: 'email',
    title: 'E-mail: zamówienie DM-7781',
    scenario: 'Order in an e-mail: "03/11" without a year, "ok. 500 szt.", vague payment terms.',
  },
  {
    id: 'po-003',
    kind: 'purchase_order',
    format: 'pdf',
    title: 'Zamówienie 2026/10/055',
    scenario: 'Missing fields: no delivery date or address, one line without code and price.',
  },
  {
    id: 'po-004',
    kind: 'purchase_order',
    format: 'pdf',
    title: 'Zamówienie ZK/2026/0430',
    scenario: 'Contradictions: quantity vs remark, total vs lines, delivery before order date.',
  },
  {
    id: 'po-005',
    kind: 'purchase_order',
    format: 'email',
    title: 'E-mail: PO 4500-2210 (EN)',
    scenario: 'Clean English order in EUR with dotted European dates.',
  },
  {
    id: 'qr-001',
    kind: 'quality_report',
    format: 'pdf',
    title: 'Raport jakości RKJ/2026/118',
    scenario: 'Clean inspection report — accepted within the acceptance number.',
  },
  {
    id: 'qr-002',
    kind: 'quality_report',
    format: 'pdf',
    title: 'Raport jakości RKJ/2026/121',
    scenario: 'Contradiction: batch accepted although defects exceed the acceptance number.',
  },
  {
    id: 'qr-003',
    kind: 'quality_report',
    format: 'email',
    title: 'E-mail: reklamacja WSP-60',
    scenario: 'Complaint e-mail: no report or batch number, "kilkanaście" defects, no decision.',
  },
];

export function findDocument(id: string): DemoDocument | undefined {
  return DOCUMENTS.find((d) => d.id === id);
}
