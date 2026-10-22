import {
  crossFieldIssues,
  formatProblem,
  issue,
  LINES_PLACEHOLDER,
  msg,
  type FieldType,
  type Issue,
  type ReviewItem,
} from './review.ts';
import type { Msg } from '../i18n/index.ts';

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

export type ParseResult = { ok: true; value: string | number } | { ok: false; error: Msg };

/** Parses a human-typed amount, accepting Polish "1 234,50" and plain "1234.5". */
function parseNumber(input: string): number | null {
  const compact = input.trim().replace(/[\s ]/g, '');
  if (!/^-?\d+([.,]\d+)?$/.test(compact)) return null;
  return Number(compact.replace(',', '.'));
}

/** Parses and validates a human correction against the field's type. */
export function parseCorrection(type: FieldType, input: string, unit?: unknown): ParseResult {
  let value: string | number | null;
  if (type === 'money' || type === 'quantity' || type === 'count') {
    value = parseNumber(input);
    if (value === null) return { ok: false, error: msg('rule.number') };
  } else {
    value = input.trim();
  }
  const problem = formatProblem(type, value, unit);
  return problem ? { ok: false, error: problem } : { ok: true, value };
}

/** The unit a line's quantity is measured in: the human's correction if any, else the model's. */
function unitFor(items: readonly ReviewItem[], path: string, decisions: Decisions = {}): unknown {
  const m = /^lines\.(\d+)\.quantity$/.exec(path);
  if (!m) return undefined;
  const unitPath = `lines.${m[1]}.unit`;
  const corrected = decisions[unitPath];
  if (corrected?.action === 'correct') return corrected.value.trim();
  return items.find((i) => i.path === unitPath)?.field.value;
}

/** Returns why a decision cannot be applied, or null when it can. */
export function validateDecision(
  item: ReviewItem,
  decision: Decision,
  items: readonly ReviewItem[] = [item],
  decisions: Decisions = {},
): Msg | null {
  if (item.path === LINES_PLACEHOLDER) return msg('decision.linesPlaceholder');
  const unit = unitFor(items, item.path, decisions);
  if (decision.action === 'approve') {
    if (item.field.value === null) return msg('decision.nothingToApprove');
    return formatProblem(item.type, item.field.value, unit);
  }
  const parsed = parseCorrection(item.type, decision.value, unit);
  return parsed.ok ? null : parsed.error;
}

const reopen = (field: ResolvedField, issue: Issue) =>
  Object.assign(field, { status: 'needs_review', value: null, issues: [...field.issues, issue] });

/**
 * Combines the automatic review with human decisions into the values that may reach the ERP.
 * A flagged field without a valid decision resolves to null: the system never exports a guess.
 * The rules that span fields then run again on the resolved values:
 * - a line quantity is re-checked against its (possibly corrected) unit;
 * - a cross-field contradiction re-opens an automatically accepted field, and a human correction
 *   that introduces a new contradiction; an explicit approval stands (e.g. a concession).
 */
export function resolveFields(items: readonly ReviewItem[], decisions: Decisions): ResolvedField[] {
  const resolved = items.map((item): ResolvedField => {
    const base = {
      path: item.path,
      label: item.label,
      type: item.type,
      proposed: item.field.value,
      issues: item.issues,
    };
    const decision = decisions[item.path];
    if (decision && validateDecision(item, decision, items, decisions) === null) {
      if (decision.action === 'approve') {
        return { ...base, value: item.field.value, status: 'approved' };
      }
      const unit = unitFor(items, item.path, decisions);
      const parsed = parseCorrection(item.type, decision.value, unit);
      if (parsed.ok) return { ...base, value: parsed.value, status: 'corrected' };
    }
    if (item.needsReview) return { ...base, value: null, status: 'needs_review' };
    return { ...base, value: item.field.value, status: 'auto' };
  });

  const byPath = new Map(resolved.map((f) => [f.path, f]));
  for (const field of resolved) {
    if (field.type !== 'quantity' || field.value === null || field.status === 'corrected') continue;
    const problem = formatProblem('quantity', field.value, unitFor(items, field.path, decisions));
    if (problem) reopen(field, issue('invalid', problem));
  }
  for (const { path, issue } of crossFieldIssues([...byPath.keys()], (p) => byPath.get(p)?.value)) {
    const field = byPath.get(path);
    if (!field || field.status === 'needs_review') continue;
    // An approval accepts the value as shown; a correction must not introduce a new contradiction.
    const alreadyShown = field.issues.some((i) => i.message === issue.message);
    if (field.status === 'auto' || (field.status === 'corrected' && !alreadyShown)) {
      reopen(field, issue);
    }
  }
  return resolved;
}
