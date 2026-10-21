import { describe, expect, it } from 'vitest';
import { reviewExtraction, type ReviewItem } from '../src/domain/review';
import { absent, cleanOrder, cleanReport, ORDER_TEXT, REPORT_TEXT, sure } from './helpers/builders';

function flagged(items: ReviewItem[]) {
  return Object.fromEntries(
    items.filter((i) => i.needsReview).map((i) => [i.path, i.issues.map((x) => x.code)]),
  );
}

function reviewOrder(mutate: (o: ReturnType<typeof cleanOrder>) => void, text = ORDER_TEXT) {
  const data = cleanOrder();
  mutate(data);
  return reviewExtraction({ kind: 'purchase_order', data }, text);
}

function reviewReport(mutate: (r: ReturnType<typeof cleanReport>) => void, text = REPORT_TEXT) {
  const data = cleanReport();
  mutate(data);
  return reviewExtraction({ kind: 'quality_report', data }, text);
}

describe('reviewExtraction — purchase orders', () => {
  it('passes a clean, consistent order with nothing to review', () => {
    expect(flagged(reviewOrder(() => undefined))).toEqual({});
  });

  it('lists every header and line field in a stable order with labels', () => {
    const items = reviewOrder(() => undefined);
    expect(items.map((i) => i.path).slice(0, 3)).toEqual([
      'order_number',
      'order_date',
      'customer_name',
    ]);
    expect(items.map((i) => i.path)).toContain('lines.1.unit_price');
    expect(items.find((i) => i.path === 'lines.0.quantity')?.label).toBe('Line 1 · quantity');
  });

  it('flags a missing required field instead of filling it', () => {
    expect(flagged(reviewOrder((o) => (o.delivery_date = absent())))).toEqual({
      delivery_date: ['missing'],
    });
  });

  it('does not flag a missing optional field', () => {
    expect(flagged(reviewOrder((o) => (o.contact_person = absent())))).toEqual({});
  });

  it('flags a missing total only when the document states none — total is optional', () => {
    expect(flagged(reviewOrder((o) => (o.total_net = absent())))).toEqual({});
  });

  it('flags any value the model was not sure about, carrying its reason', () => {
    const items = reviewOrder((o) => {
      o.lines[0]!.quantity = {
        value: 10,
        confidence: 'medium',
        source_text: '10',
        note: 'Approximate quantity ("ok.").',
      };
    });
    const item = items.find((i) => i.path === 'lines.0.quantity');
    expect(item?.needsReview).toBe(true);
    expect(item?.issues).toEqual([{ code: 'uncertain', message: 'Approximate quantity ("ok.").' }]);
  });

  it('gives an uncertain value without a note a generic reason', () => {
    const items = reviewOrder((o) => (o.currency = { ...sure('PLN'), confidence: 'low' }));
    expect(items.find((i) => i.path === 'currency')?.issues[0]?.message).toMatch(/not sure/i);
  });

  it.each([['2026-13-01'], ['03/11'], ['2026-02-30'], ['2026-11-6']])(
    'flags a date that is not a real ISO date: %s',
    (value) => {
      expect(flagged(reviewOrder((o) => (o.order_date = sure(value, '2026-10-14'))))).toEqual({
        order_date: ['invalid'],
      });
    },
  );

  it.each([[0], [-5], [2.5]])(
    'flags a quantity in pieces that is not a positive integer: %s',
    (q) => {
      // The changed quantity also breaks the stated total (45.00), which is reported separately.
      expect(flagged(reviewOrder((o) => (o.lines[0]!.quantity = sure(q, '10'))))).toEqual({
        'lines.0.quantity': ['invalid'],
        total_net: ['inconsistent'],
      });
    },
  );

  it('allows a fractional quantity in a non-piece unit', () => {
    const items = reviewOrder((o) => {
      o.lines[0]!.quantity = sure(2.5, '10');
      o.lines[0]!.unit = sure('kg', 'szt.');
      o.lines[0]!.unit_price = sure(10, '2,50');
    });
    expect(flagged(items)).toEqual({});
  });

  it('flags a negative price', () => {
    expect(flagged(reviewOrder((o) => (o.lines[1]!.unit_price = sure(-5, '5,00'))))).toMatchObject({
      'lines.1.unit_price': ['invalid'],
    });
  });

  it('flags a value whose quoted source is not in the document (possible hallucination)', () => {
    expect(flagged(reviewOrder((o) => (o.payment_terms = sure('przelew 60 dni'))))).toEqual({
      payment_terms: ['not_in_document'],
    });
  });

  it('matches quotes across line breaks, table pipes and non-breaking spaces', () => {
    const text = ORDER_TEXT.replace('Razem netto: 45,00 PLN', 'Razem netto:\n45,00 PLN');
    expect(flagged(reviewOrder((o) => (o.total_net = sure(45, '45,00 PLN')), text))).toEqual({});
    expect(
      flagged(reviewOrder((o) => (o.lines[0]!.unit = sure('szt.', '10 szt.')), ORDER_TEXT)),
    ).toEqual({});
  });

  it('flags a delivery date earlier than the order date', () => {
    const items = reviewOrder((o) => (o.delivery_date = sure('2026-10-01', '2026-11-06')));
    expect(flagged(items)).toEqual({ delivery_date: ['inconsistent'] });
  });

  it('flags a stated total that does not match the sum of the lines', () => {
    const items = reviewOrder((o) => (o.total_net = sure(46, '45,00 PLN')));
    expect(flagged(items)).toEqual({ total_net: ['inconsistent'] });
    expect(items.find((i) => i.path === 'total_net')?.issues[0]?.message).toContain('45.00');
  });

  it('tolerates rounding below one grosz when comparing the total', () => {
    expect(flagged(reviewOrder((o) => (o.total_net = sure(45.004, '45,00 PLN'))))).toEqual({});
  });

  it('skips the total check when a line price is missing (already flagged on its own)', () => {
    expect(flagged(reviewOrder((o) => (o.lines[1]!.unit_price = absent())))).toEqual({
      'lines.1.unit_price': ['missing'],
    });
  });

  it('flags an order without any lines', () => {
    expect(flagged(reviewOrder((o) => (o.lines = [])))).toEqual({ lines: ['missing'] });
  });

  it('reports several issues on one field together', () => {
    const items = reviewOrder(
      (o) =>
        (o.delivery_date = {
          value: '2026-10-01',
          confidence: 'low',
          source_text: '2026-11-06',
          note: 'Two dates in the document.',
        }),
    );
    expect(flagged(items)).toEqual({ delivery_date: ['uncertain', 'inconsistent'] });
  });
});

describe('reviewExtraction — quality reports', () => {
  it('passes a clean, consistent report', () => {
    expect(flagged(reviewReport(() => undefined))).toEqual({});
  });

  it('flags acceptance when nonconforming parts exceed the acceptance number', () => {
    const items = reviewReport((r) => (r.nonconforming_qty = sure(3, 'niezgodnych: 1')));
    expect(flagged(items)).toEqual({ decision: ['inconsistent'] });
  });

  it('accepts exactly at the acceptance number (boundary)', () => {
    const items = reviewReport((r) => (r.nonconforming_qty = sure(2, 'niezgodnych: 1')));
    expect(flagged(items)).toEqual({});
  });

  it('does not question a rejection with many defects', () => {
    const items = reviewReport((r) => {
      r.nonconforming_qty = sure(9, 'niezgodnych: 1');
      r.decision = sure('rejected' as const, 'PRZYJĘTO');
    });
    expect(flagged(items)).toEqual({});
  });

  it('flags more nonconforming parts than inspected', () => {
    const items = reviewReport((r) => {
      r.nonconforming_qty = sure(81, 'niezgodnych: 1');
      r.decision = sure('rejected' as const, 'PRZYJĘTO');
    });
    expect(flagged(items)).toEqual({ nonconforming_qty: ['inconsistent'] });
  });

  it('flags a missing decision and batch rather than inferring them', () => {
    const items = reviewReport((r) => {
      r.decision = absent();
      r.batch_number = absent();
    });
    expect(flagged(items)).toEqual({ batch_number: ['missing'], decision: ['missing'] });
  });

  it('allows a zero defect count', () => {
    const items = reviewReport((r) => (r.nonconforming_qty = sure(0, 'niezgodnych: 1')));
    expect(flagged(items)).toEqual({});
  });

  it('flags a fractional piece count', () => {
    const items = reviewReport((r) => (r.inspected_qty = sure(80.5, 'skontrolowanych: 80')));
    expect(flagged(items)).toEqual({ inspected_qty: ['invalid'] });
  });
});
