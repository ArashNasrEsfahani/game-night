// src/engine/results.ts — pure evaluation of a finished match into standings + outcome.
// Turns a final ScoreState (or an arbitrary subject->value map) into ranked standings and a
// localized-headline-friendly `outcome`. No React/DOM/I/O, no clock, no RNG — fully deterministic.

import type { LocalizedString } from '../sdk/types';
import type { ScoreState } from './scoring';

export interface Standing {
  subjectId: string;
  rank: number; // 1-based rank; ties share a rank
  total: number;
  isWinner: boolean;
}

export interface MatchResult {
  standings: Standing[];
  winners: string[];
  outcome:
    | { kind: 'winner'; subjectId: string }
    | { kind: 'tie'; subjectIds: string[] }
    | { kind: 'noContest' };
  note?: LocalizedString;
}

/**
 * Build standings from an arbitrary subject->value map for non-score games.
 *
 * Ranking is *competition ranking*: subjects are ordered best-first (highest value, or
 * lowest when `opts.lowerWins`), ties share a rank, and the next distinct value skips the
 * appropriate number of ranks (1,1,3 …). Order among tied subjects is stable: it follows the
 * insertion order of `values`' keys. `winners` is every subject sharing rank 1.
 *
 * Edge cases: an empty map yields `outcome:{kind:'noContest'}`, empty standings/winners.
 */
export function fromValues(
  values: Record<string, number>,
  opts?: { lowerWins?: boolean },
): MatchResult {
  const lowerWins = opts?.lowerWins === true;

  // Preserve insertion order as the stable tie-break, then sort by value (best first).
  const entries = Object.keys(values).map((subjectId, order) => ({
    subjectId,
    total: values[subjectId],
    order,
  }));

  entries.sort((a, b) => {
    if (a.total !== b.total) {
      return lowerWins ? a.total - b.total : b.total - a.total;
    }
    return a.order - b.order; // stable: earlier-inserted subject first
  });

  const standings: Standing[] = [];
  const winners: string[] = [];
  let currentRank = 0; // last assigned rank
  let prevTotal: number | undefined;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    // First entry, or a different total than the previous one, starts a new (skipping) rank.
    if (prevTotal === undefined || e.total !== prevTotal) {
      currentRank = i + 1; // competition ranking: rank = 1-based position of first in the tie group
      prevTotal = e.total;
    }
    const isWinner = currentRank === 1;
    standings.push({
      subjectId: e.subjectId,
      rank: currentRank,
      total: e.total,
      isWinner,
    });
    if (isWinner) winners.push(e.subjectId);
  }

  let outcome: MatchResult['outcome'];
  if (winners.length === 0) {
    outcome = { kind: 'noContest' };
  } else if (winners.length === 1) {
    outcome = { kind: 'winner', subjectId: winners[0] };
  } else {
    outcome = { kind: 'tie', subjectIds: winners.slice() };
  }

  return { standings, winners, outcome };
}

/** Standard score-based evaluation; highest total wins (or lowest if `opts.lowerWins`). */
export function fromScores(score: ScoreState, opts?: { lowerWins?: boolean }): MatchResult {
  return fromValues(score.totals, opts);
}
