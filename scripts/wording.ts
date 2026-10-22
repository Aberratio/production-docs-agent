/**
 * Wording guard: the shipped app, its documents and its docs present a finished tool, so the word
 * "demo" (and variants such as "demonstration") must not appear anywhere a person can read it.
 * Used by `scripts/check-wording.ts` (CI, after the build) and unit-tested in tests/wording.test.ts.
 */
const FORBIDDEN = /demo/gi;

/** Words that start with the letters but mean something else ("demote" is an Excel function). */
const ALLOWED_FROM_MATCH = /^demo(graph|t)/i;

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
    if (
      ALLOWED_FROM_MATCH.test(text.slice(at, end)) ||
      ALLOWED_TOKEN.test(text.slice(start, end))
    ) {
      continue;
    }
    hits.push({
      line: text.slice(0, at).split('\n').length,
      excerpt: text.slice(Math.max(0, at - 30), end + 30).replace(/\s+/g, ' '),
    });
  }
  return hits;
}
