import { describe, expect, it } from 'vitest';
import { resolveFields } from '../src/domain/decisions.ts';
import {
  ORDER_COLUMNS,
  QUALITY_COLUMNS,
  toErpRecord,
  toSheetRows,
  type QualityRecord,
  type SalesOrderRecord,
} from '../src/domain/mapping.ts';
import { reviewExtraction } from '../src/domain/review.ts';
import type { Extraction } from '../src/domain/schema.ts';
import {
  absent,
  cleanOrder,
  cleanReport,
  ORDER_TEXT,
  REPORT_TEXT,
  sure,
} from './helpers/builders.ts';

function map(extraction: Extraction, text: string, decisions = {}) {
  const resolved = resolveFields(reviewExtraction(extraction, text), decisions);
  return toErpRecord('doc-1', extraction, resolved);
}

describe('toErpRecord — sales orders', () => {
  it('maps a clean order to a ready sales order with lines and line totals', () => {
    const rec = map({ kind: 'purchase_order', data: cleanOrder() }, ORDER_TEXT) as SalesOrderRecord;
    expect(rec).toEqual({
      record_type: 'sales_order',
      source_document: 'doc-1',
      order_number: 'ZK/1',
      order_date: '2026-10-14',
      customer_name: 'Odlewnia Fikcyjna Sp. z o.o.',
      contact_person: 'Jan Przykładowy',
      delivery_date: '2026-11-06',
      delivery_address: 'Magazyn B',
      currency: 'PLN',
      payment_terms: 'przelew 30 dni',
      total_net: 45,
      lines: [
        {
          line_no: 1,
          item_code: 'WAL-20',
          description: 'Wałek',
          quantity: 10,
          unit: 'szt.',
          unit_price: 2.5,
          line_net: 25,
        },
        {
          line_no: 2,
          item_code: 'TUL-35',
          description: 'Tuleja',
          quantity: 4,
          unit: 'szt.',
          unit_price: 5,
          line_net: 20,
        },
      ],
      review: { status: 'ready', open_fields: [], corrected_fields: [], approved_fields: [] },
    });
  });

  it('leaves unresolved fields empty and lists them as open', () => {
    const data = cleanOrder();
    data.delivery_date = absent();
    data.lines[0]!.quantity = { ...sure(10, '10'), confidence: 'low', note: 'approx.' };
    const rec = map({ kind: 'purchase_order', data }, ORDER_TEXT) as SalesOrderRecord;
    expect(rec.delivery_date).toBeNull();
    expect(rec.lines[0]).toMatchObject({ quantity: null, line_net: null });
    expect(rec.review).toEqual({
      status: 'needs_review',
      open_fields: ['delivery_date', 'lines.0.quantity'],
      corrected_fields: [],
      approved_fields: [],
    });
  });

  it('becomes ready once every open field is approved or corrected', () => {
    const data = cleanOrder();
    data.delivery_date = absent();
    data.lines[0]!.quantity = { ...sure(10, '10'), confidence: 'low', note: 'approx.' };
    const rec = map({ kind: 'purchase_order', data }, ORDER_TEXT, {
      delivery_date: { action: 'correct', value: '2026-11-30' },
      'lines.0.quantity': { action: 'approve' },
    }) as SalesOrderRecord;
    expect(rec.delivery_date).toBe('2026-11-30');
    expect(rec.lines[0]?.line_net).toBe(25);
    expect(rec.review).toEqual({
      status: 'ready',
      open_fields: [],
      corrected_fields: ['delivery_date'],
      approved_fields: ['lines.0.quantity'],
    });
  });

  it('rounds line totals to cents', () => {
    const data = cleanOrder();
    data.lines[0]!.quantity = sure(3, '10');
    data.lines[0]!.unit_price = sure(0.335, '2,50');
    data.total_net = absent();
    const rec = map({ kind: 'purchase_order', data }, ORDER_TEXT, {
      'lines.0.quantity': { action: 'approve' },
      'lines.0.unit_price': { action: 'approve' },
    }) as SalesOrderRecord;
    expect(rec.lines[0]?.line_net).toBe(1.01);
  });
});

describe('toErpRecord — quality inspections', () => {
  it('maps a clean report to a ready inspection record', () => {
    const rec = map({ kind: 'quality_report', data: cleanReport() }, REPORT_TEXT) as QualityRecord;
    expect(rec).toEqual({
      record_type: 'quality_inspection',
      source_document: 'doc-1',
      report_number: 'RKJ/1',
      report_date: '2026-10-15',
      item_code: 'WAL-20',
      batch_number: 'P-1',
      order_reference: 'ZK/1',
      inspected_qty: 80,
      acceptance_number: 2,
      nonconforming_qty: 1,
      defect_description: 'rysa',
      decision: 'accepted',
      inspector: 'Piotr Próbny',
      review: { status: 'ready', open_fields: [], corrected_fields: [], approved_fields: [] },
    });
  });

  it('withholds a contradictory decision', () => {
    const data = cleanReport();
    data.nonconforming_qty = sure(5, 'niezgodnych: 1');
    const rec = map({ kind: 'quality_report', data }, REPORT_TEXT) as QualityRecord;
    expect(rec.decision).toBeNull();
    expect(rec.review.open_fields).toEqual(['decision']);
  });
});

describe('toSheetRows', () => {
  it('flattens an order to one row per line with the header repeated', () => {
    const rec = map({ kind: 'purchase_order', data: cleanOrder() }, ORDER_TEXT);
    const rows = toSheetRows(rec);
    expect(rows).toHaveLength(2);
    expect(Object.keys(rows[0]!)).toEqual([...ORDER_COLUMNS]);
    expect(rows[1]).toMatchObject({
      order_number: 'ZK/1',
      line_no: 2,
      item_code: 'TUL-35',
      line_net: 20,
      total_net: 45,
      review_status: 'ready',
      open_fields: '',
    });
  });

  it('still emits one row for an order without lines so the gap is visible', () => {
    const data = cleanOrder();
    data.lines = [];
    data.total_net = absent();
    const rows = toSheetRows(map({ kind: 'purchase_order', data }, ORDER_TEXT));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      line_no: null,
      review_status: 'needs_review',
      open_fields: 'lines',
    });
  });

  it('flattens an inspection record to a single row', () => {
    const rows = toSheetRows(map({ kind: 'quality_report', data: cleanReport() }, REPORT_TEXT));
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!)).toEqual([...QUALITY_COLUMNS]);
    expect(rows[0]).toMatchObject({ batch_number: 'P-1', decision: 'accepted' });
  });
});
