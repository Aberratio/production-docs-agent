import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCUMENTS } from '../src/documents/catalog';
import { PDF_DIR, readDocumentText, RECORDINGS_DIR } from '../src/documents/node-io';
import { resolveFields } from '../src/domain/decisions';
import { toCsv } from '../src/domain/export';
import { ORDER_COLUMNS, toErpRecord, toSheetRows } from '../src/domain/mapping';
import { extractionOf, parseRecording, serializeRecording } from '../src/domain/recording';
import { reviewExtraction } from '../src/domain/review';

/**
 * Replays every recorded run over the whole demo corpus. The expected flags below are written from
 * the documents themselves (what a careful reader would refuse to type into the ERP unchecked),
 * not from running the code.
 */
const EXPECTED_FLAGS: Record<string, Record<string, string[]>> = {
  'po-001': {},
  'po-002': {
    order_date: ['uncertain'], // only the e-mail's sent date
    delivery_date: ['uncertain'], // "03/11" — no year, D/M or M/D
    delivery_address: ['uncertain'], // assembled from prose, no postcode
    payment_terms: ['uncertain'], // "standardowo"
    'lines.0.quantity': ['uncertain'], // "ok. 500"
  },
  'po-003': {
    delivery_date: ['missing'], // "do uzgodnienia"
    delivery_address: ['missing'],
    'lines.1.item_code': ['missing'], // dash in the code column
    'lines.1.unit_price': ['missing'], // empty price cell
  },
  'po-004': {
    delivery_date: ['inconsistent'], // 2026-10-12 is before the order date 2026-10-20
    total_net: ['inconsistent'], // 46 560 stated, lines sum to 52 560
    'lines.0.quantity': ['uncertain'], // 1200 in the table vs "łącznie 1 000 szt."
  },
  'po-005': {},
  'qr-001': {},
  'qr-002': {
    decision: ['inconsistent'], // accepted with 6 defects, Ac = 1
  },
  'qr-003': {
    report_number: ['missing'],
    report_date: ['uncertain'], // complaint date, not inspection date
    batch_number: ['missing'], // label has no batch number
    nonconforming_qty: ['missing'], // "kilkanaście"
    decision: ['missing'],
    inspector: ['uncertain'], // customer's QC contact
  },
};

const load = (id: string) => readFileSync(join(RECORDINGS_DIR, `${id}.json`), 'utf8');

function replay(id: string) {
  const recording = parseRecording(JSON.parse(load(id)));
  const extraction = extractionOf(recording);
  const items = reviewExtraction(extraction, readDocumentText(id));
  const record = toErpRecord(id, extraction, resolveFields(items, {}));
  return { recording, extraction, items, record };
}

describe('demo corpus', () => {
  it('has 5–10 documents mixing orders and quality reports, PDFs and e-mails', () => {
    expect(DOCUMENTS.length).toBeGreaterThanOrEqual(5);
    expect(DOCUMENTS.length).toBeLessThanOrEqual(10);
    expect(new Set(DOCUMENTS.map((d) => d.kind))).toEqual(
      new Set(['purchase_order', 'quality_report']),
    );
    expect(new Set(DOCUMENTS.map((d) => d.format))).toEqual(new Set(['pdf', 'email']));
    expect(Object.keys(EXPECTED_FLAGS).sort()).toEqual(DOCUMENTS.map((d) => d.id).sort());
  });

  it.each(DOCUMENTS.map((d) => [d.id, d] as const))(
    '%s has source text, a recording and (for PDFs) a generated PDF',
    (id, doc) => {
      expect(readDocumentText(id).length).toBeGreaterThan(100);
      expect(existsSync(join(RECORDINGS_DIR, `${id}.json`))).toBe(true);
      if (doc.format === 'pdf') expect(existsSync(join(PDF_DIR, `${id}.pdf`))).toBe(true);
    },
  );

  it.each(DOCUMENTS.map((d) => [d.id, d.kind] as const))(
    '%s recording matches the schema, its document and kind',
    (id, kind) => {
      const { recording } = replay(id);
      expect(recording.document_id).toBe(id);
      expect(recording.kind).toBe(kind);
    },
  );

  it.each(DOCUMENTS.map((d) => [d.id] as const))('%s recording is stored canonically', (id) => {
    const raw = load(id);
    expect(serializeRecording(parseRecording(JSON.parse(raw)))).toBe(raw);
  });

  it.each(DOCUMENTS.map((d) => [d.id] as const))(
    '%s flags exactly the fields a careful reader would question',
    (id) => {
      const flagged = Object.fromEntries(
        replay(id)
          .items.filter((i) => i.needsReview)
          .map((i) => [i.path, i.issues.map((x) => x.code)]),
      );
      expect(flagged).toEqual(EXPECTED_FLAGS[id]);
    },
  );

  it.each(DOCUMENTS.map((d) => [d.id] as const))(
    '%s exports nothing that is still awaiting review',
    (id) => {
      const { items, record } = replay(id);
      const open = items.filter((i) => i.needsReview).map((i) => i.path);
      expect(record.review.open_fields).toEqual(open);
      expect(record.review.status).toBe(open.length === 0 ? 'ready' : 'needs_review');
      const json = record as unknown as Record<string, unknown>;
      for (const path of open.filter((p) => !p.includes('.'))) expect(json[path]).toBeNull();
    },
  );

  it('replays deterministically — the same recording gives byte-identical output', () => {
    const run = () =>
      DOCUMENTS.filter((d) => d.kind === 'purchase_order')
        .map((d) => toCsv(ORDER_COLUMNS, toSheetRows(replay(d.id).record)))
        .join('');
    const first = run();
    expect(run()).toBe(first);
    expect(first).toContain('ZK/2026/0412');
  });

  it('uses only fictional contact data (reserved .example domains)', () => {
    for (const d of DOCUMENTS) {
      const emails = readDocumentText(d.id).match(/[\w.+-]+@[\w.-]+/g) ?? [];
      for (const e of emails) expect(e).toMatch(/\.example$/);
    }
  });
});
