/**
 * Language guard: the repository is written in English — code, comments, docs, tests, scripts.
 * Polish is allowed only where it is content rather than prose: the Polish UI dictionary, the
 * sample documents and what is derived from them (recordings, generated copies, test fixtures).
 * Used by `scripts/check-language.ts` (CI) and unit-tested in tests/language.test.ts.
 */

/** The Polish letters with diacritics (upper and lower case). */
const POLISH_LETTERS =
  /[\u0104\u0105\u0106\u0107\u0118\u0119\u0141\u0142\u0143\u0144\u00d3\u00f3\u015a\u015b\u0179\u017a\u017b\u017c]/u;

/** Paths (prefixes) where Polish text is content, with the reason it is allowed. */
export const POLISH_ALLOWED: readonly { prefix: string; why: string }[] = [
  { prefix: 'src/i18n/pl.ts', why: 'Polish UI dictionary' },
  { prefix: 'src/i18n/recorded-notes.pl.ts', why: 'Polish UI text for the recorded model notes' },
  { prefix: 'documents/', why: 'sample documents (Polish purchase orders and reports)' },
  { prefix: 'public/documents/', why: 'copies of the sample documents served by the app' },
  { prefix: 'recordings/', why: 'recorded runs quoting the sample documents' },
  { prefix: 'tests/fixtures/', why: 'sample values taken from the Polish documents' },
];

/** Binary files: nothing to read. */
const BINARY = /\.(png|jpe?g|gif|ico|webp|pdf|woff2?|ttf|xlsx)$/i;

export function isLanguageChecked(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  if (BINARY.test(normalized)) return false;
  return !POLISH_ALLOWED.some(({ prefix }) => normalized.startsWith(prefix));
}

export interface LanguageHit {
  line: number;
  excerpt: string;
}

export function findPolishText(text: string): LanguageHit[] {
  return text
    .split('\n')
    .flatMap((line, i) =>
      POLISH_LETTERS.test(line) ? [{ line: i + 1, excerpt: line.trim().slice(0, 120) }] : [],
    );
}
