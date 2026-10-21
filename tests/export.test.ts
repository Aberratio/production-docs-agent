import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { csvCell, toCsv, toXlsx } from '../src/domain/export.ts';

describe('csvCell — RFC 4180 escaping', () => {
  it.each([
    ['plain', 'plain'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
    ['cr\rhere', '"cr\rhere"'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it('writes numbers with a dot and no thousands separator', () => {
    expect(csvCell(1234.5)).toBe('1234.5');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(-3)).toBe('-3');
  });

  it('writes null as an empty cell', () => {
    expect(csvCell(null)).toBe('');
  });

  it.each([['=SUM(A1)'], ['+48 600'], ['-cmd'], ['@foo'], ['\tx']])(
    'neutralises a text cell that a spreadsheet would run as a formula: %j',
    (input) => {
      expect(csvCell(input).replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );
});

describe('toCsv', () => {
  const columns = ['id', 'name', 'qty'] as const;

  it('writes a header and one CRLF-terminated record per row, in column order', () => {
    const csv = toCsv(columns, [
      { qty: 2, name: 'Wałek, fi 20', id: 'A' },
      { id: 'B', name: null, qty: 0.5 },
    ]);
    expect(csv).toBe('id,name,qty\r\nA,"Wałek, fi 20",2\r\nB,,0.5\r\n');
  });

  it('writes only the header for no rows', () => {
    expect(toCsv(columns, [])).toBe('id,name,qty\r\n');
  });

  it('prefixes a UTF-8 byte order mark when asked, so Excel shows Polish letters', () => {
    expect(toCsv(columns, [], { bom: true }).startsWith('﻿id')).toBe(true);
  });

  it('treats a missing key as an empty cell', () => {
    expect(toCsv(columns, [{ id: 'C' }])).toBe('id,name,qty\r\nC,,\r\n');
  });
});

describe('toXlsx', () => {
  it('writes named sheets with header row and typed cells that read back unchanged', () => {
    const bytes = toXlsx([
      {
        name: 'orders',
        columns: ['order_number', 'quantity', 'note'],
        rows: [{ order_number: 'ZK/1', quantity: 400, note: null }],
      },
      { name: 'review', columns: ['path'], rows: [{ path: 'delivery_date' }] },
    ]);
    const wb = XLSX.read(bytes, { type: 'array' });
    expect(wb.SheetNames).toEqual(['orders', 'review']);
    const orders = wb.Sheets['orders']!;
    expect(orders['A1']?.v).toBe('order_number');
    expect(orders['A2']?.v).toBe('ZK/1');
    expect(orders['B2']).toMatchObject({ t: 'n', v: 400 });
    expect(orders['C2']).toBeUndefined();
    expect(XLSX.utils.sheet_to_json(wb.Sheets['review']!)).toEqual([{ path: 'delivery_date' }]);
  });

  it('keeps a formula-looking text as text, not a formula', () => {
    const bytes = toXlsx([{ name: 's', columns: ['x'], rows: [{ x: '=1+1' }] }]);
    const cell = XLSX.read(bytes, { type: 'array' }).Sheets['s']!['A2'];
    expect(cell?.f).toBeUndefined();
    expect(cell?.v).toBe('=1+1');
  });
});
