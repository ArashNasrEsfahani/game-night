// src/engine/voting.ts — pure voting primitive. No React/DOM/I/O/clock/RNG runtime.
// State is plain JSON (arrays + record objects). Ops never mutate input; functions are total.
import type { PlayerId } from '../sdk/types';

/** What the ballots point at: free-form option strings or player ids. */
export type VoteTarget = 'option' | 'player';

/**
 * A single vote. `choices` are the legal targets (option strings, or candidate player-id strings).
 * `ballots` maps a voter id -> the choice id they picked. `voters` is the eligible electorate.
 */
export interface VoteState {
  target: VoteTarget;
  choices: string[];
  ballots: Record<string, string>;
  voters: PlayerId[];
  open: boolean;
}

/** Open a vote over free-form option strings. Duplicates in inputs are de-duplicated. */
export function openOption(choices: string[], voters: PlayerId[]): VoteState {
  return {
    target: 'option',
    choices: dedupe(choices),
    ballots: {},
    voters: dedupeIds(voters),
    open: true,
  };
}

/** Open a vote where each candidate is a player; choices = candidate id strings. */
export function openPlayer(candidates: PlayerId[], voters: PlayerId[]): VoteState {
  return {
    target: 'player',
    choices: dedupe(candidates as readonly string[] as string[]),
    ballots: {},
    voters: dedupeIds(voters),
    open: true,
  };
}

/**
 * Record `voterId`'s vote for `choiceId`. Re-voting overwrites the prior ballot.
 * No-op (returns input unchanged) if the vote is closed, the voter is not eligible,
 * or the choice is not a valid option.
 */
export function cast(s: VoteState, voterId: PlayerId, choiceId: string): VoteState {
  if (!s.open) return s;
  if (!s.voters.includes(voterId)) return s;
  if (!s.choices.includes(choiceId)) return s;
  if (s.ballots[voterId] === choiceId) return s; // already identical -> no-op
  return {
    ...s,
    ballots: { ...s.ballots, [voterId]: choiceId },
  };
}

/** Remove `voterId`'s ballot. No-op if they had not voted. */
export function retract(s: VoteState, voterId: PlayerId): VoteState {
  if (!(voterId in s.ballots)) return s;
  const ballots: Record<string, string> = {};
  for (const key of Object.keys(s.ballots)) {
    if (key !== (voterId as string)) ballots[key] = s.ballots[key];
  }
  return { ...s, ballots };
}

/** Close the vote so no further ballots can be cast. Idempotent. */
export function close(s: VoteState): VoteState {
  if (!s.open) return s;
  return { ...s, open: false };
}

/** Count votes per choice. Every choice appears (0 if unvoted). */
export function tally(s: VoteState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const choice of s.choices) counts[choice] = 0;
  for (const voter of Object.keys(s.ballots)) {
    const choice = s.ballots[voter];
    // Only count ballots whose choice is still a valid option.
    if (choice in counts) counts[choice] += 1;
  }
  return counts;
}

/**
 * Choices with the maximum count. >1 entry means a tie. Order follows `choices` order.
 * Returns [] only when there are no choices at all.
 */
export function winners(s: VoteState): string[] {
  if (s.choices.length === 0) return [];
  const counts = tally(s);
  let max = -1;
  for (const choice of s.choices) {
    const c = counts[choice] ?? 0;
    if (c > max) max = c;
  }
  const result: string[] = [];
  for (const choice of s.choices) {
    if ((counts[choice] ?? 0) === max) result.push(choice);
  }
  return result;
}

/** True when every eligible voter has cast a ballot. Vacuously true with no voters. */
export function allVoted(s: VoteState): boolean {
  for (const voter of s.voters) {
    if (!(voter in s.ballots)) return false;
  }
  return true;
}

/** Fraction of eligible voters who have voted, in [0,1]. 0 when there are no voters. */
export function turnout(s: VoteState): number {
  if (s.voters.length === 0) return 0;
  let voted = 0;
  for (const voter of s.voters) {
    if (voter in s.ballots) voted += 1;
  }
  return voted / s.voters.length;
}

/* ─────────────────────────  internal helpers  ───────────────────────── */

function dedupe(items: readonly string[]): string[] {
  const seen: Record<string, true> = {};
  const out: string[] = [];
  for (const item of items) {
    if (!seen[item]) {
      seen[item] = true;
      out.push(item);
    }
  }
  return out;
}

function dedupeIds(items: readonly PlayerId[]): PlayerId[] {
  const seen: Record<string, true> = {};
  const out: PlayerId[] = [];
  for (const item of items) {
    const key = item as string;
    if (!seen[key]) {
      seen[key] = true;
      out.push(item);
    }
  }
  return out;
}
