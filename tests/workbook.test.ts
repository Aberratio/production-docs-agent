import { describe, expect, it } from 'vitest';
import { resolveFields } from '../src/domain/decisions.ts';
import { reviewExtraction } from '../src/domain/review.ts';
import { buildWorkbookSheets, REVIEW_COLUMNS } from '../src/domain/workbook.ts';
import type { Extraction } from '../src/domain/schema.ts';
import { absent, cleanOrder, cleanReport, ORDER_TEXT, REPORT_TEXT } from './fixtures/builders.ts';

function entry(documentId: string, extraction: Extraction, text: string, decisions = {}) {
  return {
    documentId,
    extraction,
    fields: resolveFields(reviewExtraction(extraction, text), decisions),
  };
}

describe('buildWorkbookSheets', () => {
  const order = cleanOrder();
  order.delivery_date = absent();
  const entries = [
    entry('po-a', { kind: 'purchase_order', data: order }, ORDER_TEXT, {
      order_number: { action: 'correct', value: 'ZK/9' },
    }),
    entry('qr-a', { kind: 'quality_report', data: cleanReport() }, REPORT_TEXT),
  ];

  it('writes orders, quality and review sheets in that order', () => {
    expect(buildWorkbookSheets(entries).map((s) => s.name)).toEqual([
      'orders',
      'quality',
      'review_log',
    ]);
  });

  it('puts each order line and each inspection on its own row', () => {
    const [orders, quality] = buildWorkbookSheets(entries);
    expect(orders?.rows).toHaveLength(2);
    expect(orders?.rows[0]).toMatchObject({ order_number: 'ZK/9', delivery_date: null });
    expect(quality?.rows).toEqual([expect.objectContaining({ report_number: 'RKJ/1' })]);
  });

  it('logs every field a human must or did decide, with what the model proposed', () => {
    const log = buildWorkbookSheets(entries)[2];
    expect(log?.columns).toEqual([...REVIEW_COLUMNS]);
    expect(log?.rows).toEqual([
      {
        source_document: 'po-a',
        field: 'order_number',
        label: 'Order number',
        status: 'corrected',
        proposed: 'ZK/1',
        final: 'ZK/9',
        issues: '',
      },
      {
        source_document: 'po-a',
        field: 'delivery_date',
        label: 'Delivery date',
        status: 'needs_review',
        proposed: null,
        final: null,
        issues: 'missing: Not stated in the document.',
      },
    ]);
  });
});
