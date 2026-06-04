import { describe, it, expect } from 'vitest';
import { fromScores, fromValues } from './results';
import type { ScoreState } from './scoring';

const scoreState = (totals: Record<string, number>): ScoreState => ({ totals, log: [] });

describe('fromValues', () => {
  it('ranks highest-first by default with a clear winner', () => {
    const r = fromValues({ a: 3, b: 7, c: 1 });
    expect(r.standings).toEqual([
      { subjectId: 'b', rank: 1, total: 7, isWinner: true },
      { subjectId: 'a', rank: 2, total: 3, isWinner: false },
      { subjectId: 'c', rank: 3, total: 1, isWinner: false },
    ]);
    expect(r.winners).toEqual(['b']);
    expect(r.outcome).toEqual({ kind: 'winner', subjectId: 'b' });
    expect(r.note).toBeUndefined();
  });

  it('supports lowerWins (lowest total wins)', () => {
    const r = fromValues({ a: 3, b: 7, c: 1 }, { lowerWins: true });
    expect(r.standings.map((s) => s.subjectId)).toEqual(['c', 'a', 'b']);
    expect(r.standings.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(r.winners).toEqual(['c']);
    expect(r.outcome).toEqual({ kind: 'winner', subjectId: 'c' });
  });

  it('uses competition ranking: ties share a rank and the next rank skips', () => {
    // a & b tie at 5 (rank 1,1), c at 2 should be rank 3 (rank 2 skipped).
    const r = fromValues({ a: 5, b: 5, c: 2 });
    expect(r.standings).toEqual([
      { subjectId: 'a', rank: 1, total: 5, isWinner: true },
      { subjectId: 'b', rank: 1, total: 5, isWinner: true },
      { subjectId: 'c', rank: 3, total: 2, isWinner: false },
    ]);
    expect(r.winners).toEqual(['a', 'b']);
    expect(r.outcome).toEqual({ kind: 'tie', subjectIds: ['a', 'b'] });
  });

  it('skips the correct number of ranks for a mid-pack tie', () => {
    // 10, then 5 & 5 (rank 2,2), then 1 at rank 4 (rank 3 skipped).
    const r = fromValues({ w: 10, x: 5, y: 5, z: 1 });
    expect(r.standings.map((s) => s.rank)).toEqual([1, 2, 2, 4]);
    expect(r.winners).toEqual(['w']);
    expect(r.outcome).toEqual({ kind: 'winner', subjectId: 'w' });
  });

  it('breaks ties stably by insertion order of the values keys', () => {
    const r1 = fromValues({ first: 5, second: 5 });
    expect(r1.winners).toEqual(['first', 'second']);
    const r2 = fromValues({ second: 5, first: 5 });
    expect(r2.winners).toEqual(['second', 'first']);
  });

  it('treats a single subject as the sole winner', () => {
    const r = fromValues({ only: 0 });
    expect(r.standings).toEqual([{ subjectId: 'only', rank: 1, total: 0, isWinner: true }]);
    expect(r.winners).toEqual(['only']);
    expect(r.outcome).toEqual({ kind: 'winner', subjectId: 'only' });
  });

  it('reports noContest for an empty map', () => {
    const r = fromValues({});
    expect(r.standings).toEqual([]);
    expect(r.winners).toEqual([]);
    expect(r.outcome).toEqual({ kind: 'noContest' });
  });

  it('reports a full tie when every subject is equal', () => {
    const r = fromValues({ a: 4, b: 4, c: 4 });
    expect(r.standings.map((s) => s.rank)).toEqual([1, 1, 1]);
    expect(r.standings.every((s) => s.isWinner)).toBe(true);
    expect(r.winners).toEqual(['a', 'b', 'c']);
    expect(r.outcome).toEqual({ kind: 'tie', subjectIds: ['a', 'b', 'c'] });
  });

  it('handles negative and zero values correctly', () => {
    const r = fromValues({ a: -5, b: 0, c: -1 });
    expect(r.standings.map((s) => s.subjectId)).toEqual(['b', 'c', 'a']);
    expect(r.winners).toEqual(['b']);
  });

  it('is deterministic: equal inputs produce deeply-equal results', () => {
    const input = { p: 2, q: 9, r: 9, s: 1 };
    expect(fromValues(input)).toEqual(fromValues(input));
  });

  it('does not mutate the input values object', () => {
    const input = { a: 1, b: 2 };
    const snapshot = { ...input };
    fromValues(input);
    expect(input).toEqual(snapshot);
  });

  it('with lowerWins, the tie group still uses the best-rank and skips after', () => {
    // lowest wins: 1 & 1 tie at rank 1,1; 3 at rank 3 (rank 2 skipped).
    const r = fromValues({ a: 1, b: 1, c: 3 }, { lowerWins: true });
    expect(r.standings.map((s) => s.rank)).toEqual([1, 1, 3]);
    expect(r.winners).toEqual(['a', 'b']);
  });

  it('treats lowerWins:false the same as the default', () => {
    const input = { a: 3, b: 1, c: 2 };
    expect(fromValues(input, { lowerWins: false })).toEqual(fromValues(input));
  });
});

describe('fromScores', () => {
  it('delegates to the totals map of the ScoreState', () => {
    const s = scoreState({ a: 1, b: 4, c: 4 });
    const r = fromScores(s);
    expect(r.standings).toEqual([
      { subjectId: 'b', rank: 1, total: 4, isWinner: true },
      { subjectId: 'c', rank: 1, total: 4, isWinner: true },
      { subjectId: 'a', rank: 3, total: 1, isWinner: false },
    ]);
    expect(r.outcome).toEqual({ kind: 'tie', subjectIds: ['b', 'c'] });
  });

  it('honors lowerWins through to the result', () => {
    const s = scoreState({ a: 1, b: 4, c: 4 });
    const r = fromScores(s, { lowerWins: true });
    expect(r.winners).toEqual(['a']);
    expect(r.outcome).toEqual({ kind: 'winner', subjectId: 'a' });
  });

  it('reports noContest for an empty ScoreState', () => {
    const r = fromScores(scoreState({}));
    expect(r.outcome).toEqual({ kind: 'noContest' });
    expect(r.standings).toEqual([]);
    expect(r.winners).toEqual([]);
  });

  it('does not mutate the ScoreState totals', () => {
    const s = scoreState({ a: 2, b: 5 });
    const snapshot = JSON.parse(JSON.stringify(s));
    fromScores(s);
    expect(s).toEqual(snapshot);
  });
});
