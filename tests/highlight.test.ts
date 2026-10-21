import { describe, expect, it } from 'vitest';
import { matchQuote } from '../src/ui/highlight.ts';

describe('matchQuote', () => {
  const lines = ['Data: 2026-10-14', 'Termin dostawy: 2026-11-06', '1 WAL-20 400 szt.'];

  it('returns the lines containing the quote, ignoring case and whitespace runs', () => {
    expect(matchQuote(lines, 'termin  dostawy:')).toEqual({ lines: [1], groups: [] });
  });

  it('matches a quote written with table pipes against a table row', () => {
    expect(matchQuote(lines, '| 400 |')).toEqual({ lines: [2], groups: [] });
  });

  it('falls back to the enclosing groups for a quote spanning lines', () => {
    const groups = ['Data: 2026-10-14 Termin dostawy: 2026-11-06', '1 WAL-20 400 szt.'];
    expect(matchQuote(lines, '2026-10-14\nTermin', groups)).toEqual({ lines: [], groups: [0] });
  });

  it('returns nothing for an empty or absent quote', () => {
    expect(matchQuote(lines, null)).toEqual({ lines: [], groups: [] });
    expect(matchQuote(lines, '  ')).toEqual({ lines: [], groups: [] });
  });
});
