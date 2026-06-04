// src/engine/scoring.ts — pure scoring primitive: totals + an append-only event log.
// No React/DOM/I/O/stores/console. No wall clock, no RNG: all clock values arrive as `now`.
// State is plain JSON (record + array). Ops never mutate input — they return new objects.

/** A single scoring delta applied to a subject (a PlayerId or TeamId, as a plain string). */
export interface ScoreEvent {
  subjectId: string;
  /** Signed change applied to the subject's total by this event. */
  delta: number;
  reason?: string;
  /** Clock value supplied by the caller (a number, never read from a runtime clock). */
  at: number;
}

/** Scoreboard: current totals per subject plus the ordered log that produced them. */
export interface ScoreState {
  totals: Record<string, number>;
  log: ScoreEvent[];
}

/** Build an empty scoreboard with every given subject starting at 0. */
export function create(subjectIds: string[]): ScoreState {
  const totals: Record<string, number> = {};
  for (const id of subjectIds) totals[id] = 0;
  return { totals, log: [] };
}

/**
 * Append a ScoreEvent that moves `subjectId` by `delta` and return a NEW state.
 * Unknown subjects are introduced on the fly (starting from 0). A zero delta is a no-op
 * (state returned unchanged) so the log stays meaningful.
 */
export function add(
  s: ScoreState,
  subjectId: string,
  delta: number,
  reason?: string,
  at: number = 0,
): ScoreState {
  if (delta === 0) return s;
  const prev = s.totals[subjectId] ?? 0;
  const event: ScoreEvent = reason === undefined
    ? { subjectId, delta, at }
    : { subjectId, delta, reason, at };
  return {
    totals: { ...s.totals, [subjectId]: prev + delta },
    log: [...s.log, event],
  };
}

/**
 * Set `subjectId`'s total to an absolute `value` and return a NEW state. Recorded in the log
 * as a delta event (value - prior), so undoLast can reverse it like any other event.
 * A no-op set (value already equals the current total) leaves the state unchanged.
 */
export function set(s: ScoreState, subjectId: string, value: number, at: number = 0): ScoreState {
  const prev = s.totals[subjectId] ?? 0;
  const delta = value - prev;
  if (delta === 0) return s;
  const event: ScoreEvent = { subjectId, delta, reason: 'set', at };
  return {
    totals: { ...s.totals, [subjectId]: value },
    log: [...s.log, event],
  };
}

/**
 * Remove the most recent log entry and reverse its effect, returning a NEW state.
 * On an empty log this is a no-op (input returned unchanged).
 */
export function undoLast(s: ScoreState): ScoreState {
  if (s.log.length === 0) return s;
  const last = s.log[s.log.length - 1];
  const prev = s.totals[last.subjectId] ?? 0;
  return {
    totals: { ...s.totals, [last.subjectId]: prev - last.delta },
    log: s.log.slice(0, -1),
  };
}

/** Current total for a subject; 0 if the subject is unknown. */
export function total(s: ScoreState, subjectId: string): number {
  return s.totals[subjectId] ?? 0;
}

/** All subjects ranked by total descending, with a stable tiebreak by subjectId ascending. */
export function standings(s: ScoreState): { subjectId: string; total: number }[] {
  return Object.keys(s.totals)
    .map((subjectId) => ({ subjectId, total: s.totals[subjectId] }))
    .sort((a, b) => (b.total - a.total) || (a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0));
}

/** The subjectId with the highest total (ties broken by subjectId), or undefined if no subjects. */
export function leader(s: ScoreState): string | undefined {
  const ranked = standings(s);
  return ranked.length === 0 ? undefined : ranked[0].subjectId;
}
