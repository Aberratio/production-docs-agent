import * as XLSX from 'xlsx';
import type { Cell, SheetRow } from './mapping';

/** Text a spreadsheet would execute as a formula when the CSV is opened (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV field per RFC 4180; text that would run as a formula gets a leading apostrophe. */
export function csvCell(value: Cell): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvOptions {
  /** Prefix a UTF-8 byte order mark so Excel detects the encoding (Polish diacritics). */
  bom?: boolean;
}

export function toCsv(
  columns: readonly string[],
  rows: readonly Partial<SheetRow>[],
  options: CsvOptions = {},
): string {
  const lines = [
    columns.map((c) => csvCell(c)).join(','),
    ...rows.map((row) => columns.map((c) => csvCell(row[c] ?? null)).join(',')),
  ];
  return `${options.bom ? '﻿' : ''}${lines.join('\r\n')}\r\n`;
}

export interface SheetSpec {
  name: string;
  columns: readonly string[];
  rows: readonly Partial<SheetRow>[];
}

/** An .xlsx workbook with one sheet per spec. Text cells stay text — nothing becomes a formula. */
export function toXlsx(sheets: readonly SheetSpec[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa = [
      [...sheet.columns],
      ...sheet.rows.map((row) => sheet.columns.map((c) => row[c] ?? null)),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = sheet.columns.map((c) => ({ wch: Math.max(10, c.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  const out: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true });
  return new Uint8Array(out);
}
