import { normalizeForMatch } from '../domain/review';

export interface QuoteMatch {
  /** Indices of single lines (paragraph lines, table rows) containing the quote. */
  lines: number[];
  /** Indices of larger blocks, used only when the quote spans several lines. */
  groups: number[];
}

/**
 * Finds where a field's quoted source sits in the rendered document, using the same normalisation
 * as the review's "quote is in the document" check.
 */
export function matchQuote(
  lineTexts: readonly string[],
  quote: string | null,
  groupTexts: readonly string[] = [],
): QuoteMatch {
  const q = quote === null ? '' : normalizeForMatch(quote);
  if (q === '') return { lines: [], groups: [] };
  const hits = (texts: readonly string[]) =>
    texts.flatMap((t, i) => (normalizeForMatch(t).includes(q) ? [i] : []));
  const lines = hits(lineTexts);
  return lines.length ? { lines, groups: [] } : { lines: [], groups: hits(groupTexts) };
}
