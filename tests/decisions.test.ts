import { describe, expect, it } from 'vitest';
import { parseCorrection, resolveFields, validateDecision } from '../src/domain/decisions';
import { reviewExtraction } from '../src/domain/review';
import { absent, cleanOrder, ORDER_TEXT, sure } from './helpers/builders';

function items(mutate: (o: ReturnType<typeof cleanOrder>) => void = () => undefined) {
  const data = cleanOrder();
  mutate(data);
  return reviewExtraction({ kind: 'purchase_order', data }, ORDER_TEXT);
}

const byPath = <T extends { path: string }>(list: T[], path: string) =>
  list.find((x) => x.path === path)!;

describe('resolveFields — what reaches the ERP', () => {
  it('passes values that needed no review straight through', () => {
    const r = byPath(resolveFields(items(), {}), 'order_number');
    expect(r).toMatchObject({ value: 'ZK/1', status: 'auto' });
  });

  it('withholds a flagged value until a human decides — never exports a guess', () => {
    const list = items(
      (o) => (o.currency = { ...sure('PLN'), confidence: 'low', note: 'Unclear' }),
    );
    const r = byPath(resolveFields(list, {}), 'currency');
    expect(r).toMatchObject({ value: null, status: 'needs_review', proposed: 'PLN' });
  });

  it('uses the model value once a human approves it', () => {
    const list = items((o) => (o.currency = { ...sure('PLN'), confidence: 'low' }));
    const r = byPath(resolveFields(list, { currency: { action: 'approve' } }), 'currency');
    expect(r).toMatchObject({ value: 'PLN', status: 'approved' });
  });

  it('uses the corrected value and marks it as corrected', () => {
    const list = items((o) => (o.delivery_date = absent()));
    const r = byPath(
      resolveFields(list, { delivery_date: { action: 'correct', value: '2026-11-20' } }),
      'delivery_date',
    );
    expect(r).toMatchObject({ value: '2026-11-20', status: 'corrected' });
  });

  it('lets a human override a value that needed no review', () => {
    const r = byPath(
      resolveFields(items(), { order_number: { action: 'correct', value: 'ZK/2' } }),
      'order_number',
    );
    expect(r).toMatchObject({ value: 'ZK/2', status: 'corrected' });
  });

  it('keeps a missing optional field empty without asking for review', () => {
    const r = byPath(
      resolveFields(
        items((o) => (o.contact_person = absent())),
        {},
      ),
      'contact_person',
    );
    expect(r).toMatchObject({ value: null, status: 'auto' });
  });

  it('ignores a correction that does not parse — the field stays open', () => {
    const list = items((o) => (o.delivery_date = absent()));
    const r = byPath(
      resolveFields(list, { delivery_date: { action: 'correct', value: '03/11' } }),
      'delivery_date',
    );
    expect(r).toMatchObject({ value: null, status: 'needs_review' });
  });

  it('checks a quantity correction against the line unit', () => {
    const list = items((o) => (o.lines[0]!.quantity = absent()));
    const resolve = (value: string) =>
      byPath(
        resolveFields(list, { 'lines.0.quantity': { action: 'correct', value } }),
        'lines.0.quantity',
      );
    expect(resolve('2,5')).toMatchObject({ value: null, status: 'needs_review' });
    expect(resolve('12')).toMatchObject({ value: 12, status: 'corrected' });
  });

  it('ignores an approval of a missing value (nothing to approve)', () => {
    const list = items((o) => (o.delivery_date = absent()));
    const r = byPath(
      resolveFields(list, { delivery_date: { action: 'approve' } }),
      'delivery_date',
    );
    expect(r).toMatchObject({ value: null, status: 'needs_review' });
  });
});

describe('resolveFields — re-checks after human edits', () => {
  it('re-opens a total that a corrected quantity no longer matches', () => {
    const r = resolveFields(items(), { 'lines.0.quantity': { action: 'correct', value: '12' } });
    expect(byPath(r, 'total_net')).toMatchObject({ status: 'needs_review', value: null });
    expect(byPath(r, 'total_net').issues.map((i) => i.code)).toEqual(['inconsistent']);
  });

  it('closes again once the human approves the total', () => {
    const r = resolveFields(items(), {
      'lines.0.quantity': { action: 'correct', value: '12' },
      total_net: { action: 'approve' },
    });
    expect(byPath(r, 'total_net')).toMatchObject({ status: 'approved', value: 45 });
  });

  it('re-opens an untouched delivery date that a corrected order date contradicts', () => {
    const r = resolveFields(items(), { order_date: { action: 'correct', value: '2026-12-01' } });
    expect(byPath(r, 'delivery_date')).toMatchObject({ status: 'needs_review', value: null });
  });
});

describe('validateDecision', () => {
  it('refuses to approve a value that fails its format check', () => {
    const list = items((o) => (o.order_date = sure('03/11', '2026-10-14')));
    const item = byPath(list, 'order_date');
    expect(validateDecision(item, { action: 'approve' })).toMatch(/YYYY-MM-DD/);
    expect(
      byPath(resolveFields(list, { order_date: { action: 'approve' } }), 'order_date'),
    ).toMatchObject({
      status: 'needs_review',
      value: null,
    });
  });

  it('does not let the missing-lines placeholder be approved or corrected', () => {
    const list = items((o) => (o.lines = []));
    const item = byPath(list, 'lines');
    expect(validateDecision(item, { action: 'correct', value: 'x' })).not.toBeNull();
    expect(
      byPath(resolveFields(list, { lines: { action: 'correct', value: 'x' } }), 'lines'),
    ).toMatchObject({
      status: 'needs_review',
    });
  });

  it('refuses to approve a missing value', () => {
    const item = byPath(
      items((o) => (o.delivery_date = absent())),
      'delivery_date',
    );
    expect(validateDecision(item, { action: 'approve' })).toMatch(/correct/i);
  });

  it('accepts approval of a present value', () => {
    const item = byPath(items(), 'order_date');
    expect(validateDecision(item, { action: 'approve' })).toBeNull();
  });

  it('checks a quantity correction against the unit on the same line', () => {
    const list = items();
    const item = byPath(list, 'lines.0.quantity');
    expect(validateDecision(item, { action: 'correct', value: '2,5' }, list)).toMatch(/whole/);
    expect(validateDecision(item, { action: 'correct', value: '3' }, list)).toBeNull();
  });

  it('rejects a correction that does not parse', () => {
    const item = byPath(items(), 'order_date');
    expect(validateDecision(item, { action: 'correct', value: '03/11' })).toMatch(/YYYY-MM-DD/);
  });
});

describe('parseCorrection — human input', () => {
  it.each([
    ['money', '1 234,50', 1234.5],
    ['money', '1234.5', 1234.5],
    ['money', '0', 0],
    ['quantity', '500', 500],
    ['count', '12', 12],
    ['date', '2026-11-03', '2026-11-03'],
    ['text', '  Magazyn A  ', 'Magazyn A'],
    ['decision', 'rejected', 'rejected'],
  ] as const)('parses %s "%s"', (type, input, expected) => {
    expect(parseCorrection(type, input)).toEqual({ ok: true, value: expected });
  });

  it.each([
    ['money', 'abc'],
    ['money', '-3'],
    ['quantity', '0'],
    ['count', '1.5'],
    ['date', '3.11.2026'],
    ['text', '   '],
    ['decision', 'maybe'],
  ] as const)('rejects %s "%s"', (type, input) => {
    expect(parseCorrection(type, input).ok).toBe(false);
  });

  it('rejects a fractional quantity in pieces but allows it in kilograms', () => {
    expect(parseCorrection('quantity', '2,5', 'szt.').ok).toBe(false);
    expect(parseCorrection('quantity', '2,5', 'kg')).toEqual({ ok: true, value: 2.5 });
  });
});
