import { describe, expect, it } from 'vitest';
import { findPolishText, isLanguageChecked } from '../scripts/language.ts';

describe('language guard', () => {
  // Polish samples are written with escapes so this file passes the guard it tests.
  it.each([
    'Zam\u00f3wienie nr 1',
    '// sprawd\u017a dat\u0119',
    'B\u0141\u0104D',
    "label: 'Pozycja \u017car\u00f3wki'",
  ])('flags %j', (text) => {
    expect(findPolishText(text)).toHaveLength(1);
  });

  it.each(['Purchase order', 'naïve café — 10 × 4 €', 'Zamowienie bez znakow', 'Grüße, señor'])(
    'allows %j',
    (text) => {
      expect(findPolishText(text)).toEqual([]);
    },
  );

  it('reports the line of each hit', () => {
    expect(findPolishText('ok\nok\nza\u017c\u00f3\u0142\u0107').map((h) => h.line)).toEqual([3]);
  });

  it.each([
    ['src/ui/app.ts', true],
    ['README.md', true],
    ['docs/architecture.md', true],
    ['tests/review.test.ts', true],
    ['scripts/generate-documents.ts', true],
    ['src/i18n/en.ts', true],
    ['src/i18n/pl.ts', false],
    ['src/i18n/recorded-notes.pl.ts', false],
    ['documents/po-001.txt', false],
    ['public/documents/po-002.txt', false],
    ['recordings/po-002.json', false],
    ['tests/fixtures/builders.ts', false],
    ['docs/screenshots/app-en.png', false],
    ['src/assets/fonts/x.woff2', false],
  ])('checks %s: %s', (path, checked) => {
    expect(isLanguageChecked(path)).toBe(checked);
  });
});
