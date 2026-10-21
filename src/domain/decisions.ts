import { formatProblem, type FieldType, type Issue, type ReviewItem } from './review';

/** What a human did with one field in the review panel. */
export type Decision = { action: 'approve' } | { action: 'correct'; value: string };

/** Human decisions keyed by review path (`delivery_date`, `lines.0.quantity`). */
export type Decisions = Readonly<Record<string, Decision>>;

export type ResolvedStatus = 'auto' | 'approved' | 'corrected' | 'needs_review';

export interface ResolvedField {
  path: string;
  label: string;
  type: FieldType;
  /** The value that goes to the ERP; null while a human has not decided on a flagged field. */
  value: unknown;
  /** What the model proposed (shown to the reviewer, never exported unapproved). */
  proposed: unknown;
  status: ResolvedStatus;
  issues: Issue[];
}

export type ParseResult = { ok: true; value: string | number } | { ok: false; error: string };

/** Parses a human-typed amount, accepting Polish "1 234,50" and plain "1234.5". */
function parseNumber(input: string): number | null {
  const compact = input.trim().replace(/[\s ]/g, '');
  if (!/^-?\d+([.,]\d+)?$/.test(compact)) return null;
  return Number(compact.replace(',', '.'));
}

/** Parses and validates a human correction against the field's type. */
export function parseCorrection(type: FieldType, input: string, unit?: unknown): ParseResult {
  let value: string | number | null;
  if (type === 'money' || type === 'quantity' || type === 'count') {
    value = parseNumber(input);
    if (value === null) return { ok: false, error: 'Enter a number, e.g. 1 234,50.' };
  } else {
    value = input.trim();
  }
  const problem = formatProblem(type, value, unit);
  return problem ? { ok: false, error: problem } : { ok: true, value };
}

function unitFor(items: readonly ReviewItem[], path: string): unknown {
  const m = /^lines\.(\d+)\.quantity$/.exec(path);
  return m ? items.find((i) => i.path === `lines.${m[1]}.unit`)?.field.value : undefined;
}

/** Returns why a decision cannot be applied, or null when it can. */
export function validateDecision(
  item: ReviewItem,
  decision: Decision,
  items: readonly ReviewItem[] = [item],
): string | null {
  if (decision.action === 'approve') {
    return item.field.value === null ? 'Nothing to approve — enter the correct value.' : null;
  }
  const parsed = parseCorrection(item.type, decision.value, unitFor(items, item.path));
  return parsed.ok ? null : parsed.error;
}

/**
 * Combines the automatic review with human decisions into the values that may reach the ERP.
 * A flagged field without a valid decision resolves to null: the system never exports a guess.
 */
export function resolveFields(items: readonly ReviewItem[], decisions: Decisions): ResolvedField[] {
  return items.map((item) => {
    const base = {
      path: item.path,
      label: item.label,
      type: item.type,
      proposed: item.field.value,
      issues: item.issues,
    };
    const decision = decisions[item.path];
    if (decision?.action === 'approve' && item.field.value !== null) {
      return { ...base, value: item.field.value, status: 'approved' as const };
    }
    if (decision?.action === 'correct') {
      const parsed = parseCorrection(item.type, decision.value, unitFor(items, item.path));
      if (parsed.ok) return { ...base, value: parsed.value, status: 'corrected' as const };
    }
    if (item.needsReview) return { ...base, value: null, status: 'needs_review' as const };
    return { ...base, value: item.field.value, status: 'auto' as const };
  });
}
