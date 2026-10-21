import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DOCUMENTS } from '../src/documents/catalog.ts';
import { PDF_DIR, readDocumentText, RECORDINGS_DIR } from '../src/documents/node-io.ts';
import { resolveFields } from '../src/domain/decisions.ts';
import { toCsv } from '../src/domain/export.ts';
import { recordedRun } from '../src/documents/browser.ts';
import { ORDER_COLUMNS, QUALITY_COLUMNS, toErpRecord, toSheetRows } from '../src/domain/mapping.ts';
import { extractionOf, parseRecording, serializeRecording } from '../src/domain/recording.ts';
import { reviewExtraction } from '../src/domain/review.ts';

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
      // The "open original" copy of an e-mail must be the text the demo reviews.
      if (doc.format === 'email') {
        expect(readFileSync(join(PDF_DIR, `${id}.txt`), 'utf8')).toBe(readDocumentText(id));
      }
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

  it('replays without reading the clock or randomness, so every replay is identical', () => {
    const forbid = (what: string) => () => {
      throw new Error(`replay must not use ${what}`);
    };
    const random = vi.spyOn(Math, 'random').mockImplementation(forbid('Math.random'));
    const now = vi.spyOn(Date, 'now').mockImplementation(forbid('Date.now'));
    try {
      for (const d of DOCUMENTS) {
        const { record } = replay(d.id);
        const columns = d.kind === 'purchase_order' ? ORDER_COLUMNS : QUALITY_COLUMNS;
        expect(toCsv(columns, toSheetRows(record)).length).toBeGreaterThan(0);
      }
    } finally {
      random.mockRestore();
      now.mockRestore();
    }
  });

  it('exports the clean order exactly as the document states it', () => {
    // Expected rows typed from documents/po-001.txt, not produced by the code under test.
    const header = ORDER_COLUMNS.join(',');
    const order =
      'po-001,ZK/2026/0412,2026-10-14,Odlewnia Fikcyjna Sp. z o.o.,Jan Przykładowy,2026-11-06,' +
      '"Magazyn B, ul. Przykładowa 12, 00-000 Testowo",PLN,przelew 30 dni';
    expect(toCsv(ORDER_COLUMNS, toSheetRows(replay('po-001').record))).toBe(
      [
        header,
        `${order},1,WAL-20-H7,"Wałek napędowy fi 20 h7, L=240",400,szt.,38.5,15400,28380,ready,`,
        `${order},2,TUL-35-B,Tuleja brązowa 35x40x30,250,szt.,21.2,5300,28380,ready,`,
        `${order},3,KOL-12-S,Kołnierz stalowy DN50,120,szt.,64,7680,28380,ready,`,
        '',
      ].join('\r\n'),
    );
  });

  it.each(DOCUMENTS.map((d) => [d.id] as const))(
    '%s: the browser bundle replays the same recording as the file on disk',
    (id) => {
      expect(recordedRun(id)).toEqual(parseRecording(JSON.parse(load(id))));
    },
  );

  it('uses only fictional contact data (reserved .example domains)', () => {
    for (const d of DOCUMENTS) {
      const emails = readDocumentText(d.id).match(/[\w.+-]+@[\w.-]+/g) ?? [];
      for (const e of emails) expect(e).toMatch(/\.example$/);
    }
  });
});
