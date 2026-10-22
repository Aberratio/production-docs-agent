/**
 * Wording guard: the shipped app, its documents and its docs present a finished tool, so the word
 * "demo" (and variants such as "demonstration") must not appear anywhere a person can read it.
 * Used by `scripts/check-wording.ts` (CI, after the build) and unit-tested in tests/wording.test.ts.
 */
const FORBIDDEN = /demo/gi;

/**
 * Whole words that contain the letters but mean something else. Only DEMOTE, the Excel function
 * name in the bundled spreadsheet library; add a word here only when it actually ships.
 */
const ALLOWED_WORDS = new Set(['demote']);

/** Identifiers that only contain the letters, e.g. zod's `ZodEmoji` in the bundled JavaScript. */
const ALLOWED_TOKEN = /dEmoji/;

export interface WordingHit {
  line: number;
  excerpt: string;
}

export function findForbiddenWording(text: string): WordingHit[] {
  const hits: WordingHit[] = [];
  const isWord = (i: number) => /\w/.test(text[i] ?? '');
  for (const match of text.matchAll(FORBIDDEN)) {
    const at = match.index;
    let start = at;
    while (start > 0 && isWord(start - 1)) start--;
    let end = at + match[0].length;
    while (end < text.length && isWord(end)) end++;
    const word = text.slice(start, end);
    if (ALLOWED_WORDS.has(word.toLowerCase()) || ALLOWED_TOKEN.test(word)) {
      continue;
    }
    hits.push({
      line: text.slice(0, at).split('\n').length,
      excerpt: text.slice(Math.max(0, at - 30), end + 30).replace(/\s+/g, ' '),
    });
  }
  return hits;
}
