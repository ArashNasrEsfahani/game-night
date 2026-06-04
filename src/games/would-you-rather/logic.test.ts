import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerSeat } from '../../sdk/types';
import { asPlayerId } from '../../engine/ids';
import { createInitialState, reducer, standings, computeWinners } from './logic';
import type { Side, WyrState } from './logic';
import { DEFAULT_OPTIONS } from './config';
import type { WyrOptions } from './config';
import { validateContent } from './content';

const seat = (id: string): PlayerSeat => ({ id: asPlayerId(id), name: id.toUpperCase() });

function makeConfig(options: Partial<WyrOptions> = {}, ids = ['p1', 'p2', 'p3']): GameConfig {
  return {
    players: ids.map(seat),
    options: {
      ...DEFAULT_OPTIONS,
      deckId: 'classic',
      maxIntensity: 'spicy',
      roundLength: 3,
      awardMajorityPoints: true,
      ...options,
    },
    lang: 'en',
  };
}

const POOL = 14;

function voteRound(s: WyrState, choices: Record<string, Side>): WyrState {
  s = reducer(s, { type: 'BEGIN_COLLECTION' });
  for (const id of s.playerIds) {
    s = reducer(s, { type: 'CHOOSE', playerId: id, side: choices[id] });
    s = reducer(s, { type: 'ADVANCE_HANDOFF' });
  }
  return reducer(s, { type: 'REVEAL' });
}

describe('wyr content', () => {
  it('ships valid bilingual content', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('wyr createInitialState', () => {
  it('builds a clamped deterministic order with zeroed scores', () => {
    const a = createInitialState(makeConfig(), 42);
    expect(a.phase).toBe('prompt');
    expect(a.order).toHaveLength(3);
    expect(a.total).toBe(3);
    expect(Object.values(a.scores)).toEqual([0, 0, 0]);
    expect(createInitialState(makeConfig(), 42).order).toEqual(a.order);
    expect(createInitialState(makeConfig(), 7).order).not.toEqual(a.order);
  });

  it('plays the whole deck for a large roundLength and flags too few players', () => {
    expect(createInitialState(makeConfig({ roundLength: 999 }), 1).order).toHaveLength(POOL);
    expect(createInitialState(makeConfig({}, ['p1']), 1).phase).toBe('error');
  });
});

describe('wyr collecting (vote)', () => {
  it('BEGIN_COLLECTION moves to collecting; out of phase no-op', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'BEGIN_COLLECTION' });
    expect(s.phase).toBe('collecting');
    expect(reducer(s, { type: 'BEGIN_COLLECTION' })).toBe(s);
  });

  it('CHOOSE records and overwrites; UNDO removes; quick-mode CHOOSE no-op', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'BEGIN_COLLECTION' });
    s = reducer(s, { type: 'CHOOSE', playerId: 'p1', side: 'A' });
    expect(s.choices).toEqual({ p1: 'A' });
    s = reducer(s, { type: 'CHOOSE', playerId: 'p1', side: 'B' });
    expect(s.choices).toEqual({ p1: 'B' });
    s = reducer(s, { type: 'UNDO_CHOICE', playerId: 'p1' });
    expect(s.choices).toEqual({});

    let q = createInitialState(makeConfig({ mode: 'quick' }), 1);
    q = reducer(q, { type: 'BEGIN_COLLECTION' });
    expect(reducer(q, { type: 'CHOOSE', playerId: 'p1', side: 'A' })).toBe(q);
  });

  it('ADVANCE_HANDOFF clamps at the player count', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'BEGIN_COLLECTION' });
    for (let i = 0; i < 5; i++) s = reducer(s, { type: 'ADVANCE_HANDOFF' });
    expect(s.handoffIndex).toBe(3);
  });

  it('SET_QUICK_COUNTS clamps negatives', () => {
    let s = createInitialState(makeConfig({ mode: 'quick' }), 1);
    s = reducer(s, { type: 'BEGIN_COLLECTION' });
    s = reducer(s, { type: 'SET_QUICK_COUNTS', A: -3, B: 2 });
    expect(s.quickCounts).toEqual({ A: 0, B: 2 });
  });
});

describe('wyr reveal & scoring', () => {
  it('tallies a clear majority and awards points to that side', () => {
    let s = createInitialState(makeConfig(), 1);
    s = voteRound(s, { p1: 'A', p2: 'A', p3: 'B' });
    expect(s.current).toEqual({ countA: 2, countB: 1, majority: 'A' });
    expect(s.scores).toEqual({ p1: 1, p2: 1, p3: 0 });
  });

  it('tie counts for everyone only when enabled', () => {
    const both = voteRound(createInitialState(makeConfig({ tieCountsForBoth: true }, ['p1', 'p2']), 1), { p1: 'A', p2: 'B' });
    expect(both.current!.majority).toBe('tie');
    expect(both.scores).toEqual({ p1: 1, p2: 1 });
    const neither = voteRound(createInitialState(makeConfig({ tieCountsForBoth: false }, ['p1', 'p2']), 1), { p1: 'A', p2: 'B' });
    expect(neither.scores).toEqual({ p1: 0, p2: 0 });
  });

  it('awards no points when scoring is off', () => {
    let s = createInitialState(makeConfig({ awardMajorityPoints: false }), 1);
    s = voteRound(s, { p1: 'A', p2: 'A', p3: 'B' });
    expect(s.scores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it('quick mode uses entered counts and never moves per-player scores', () => {
    let s = createInitialState(makeConfig({ mode: 'quick' }), 1);
    s = reducer(s, { type: 'BEGIN_COLLECTION' });
    s = reducer(s, { type: 'SET_QUICK_COUNTS', A: 5, B: 2 });
    s = reducer(s, { type: 'REVEAL' });
    expect(s.current).toEqual({ countA: 5, countB: 2, majority: 'A' });
    expect(Object.values(s.scores)).toEqual([0, 0, 0]);
  });
});

describe('wyr advancement', () => {
  it('NEXT records history and advances to results on the last round', () => {
    let s = createInitialState(makeConfig({ roundLength: 2 }), 1);
    s = voteRound(s, { p1: 'A', p2: 'A', p3: 'A' });
    s = reducer(s, { type: 'NEXT' });
    expect(s.phase).toBe('prompt');
    expect(s.history).toHaveLength(1);
    s = voteRound(s, { p1: 'B', p2: 'B', p3: 'B' });
    s = reducer(s, { type: 'NEXT' });
    expect(s.phase).toBe('results');
    expect(s.finished).toBe(true);
    expect(s.history).toHaveLength(2);
  });

  it('SKIP rolls back the current round points', () => {
    let s = createInitialState(makeConfig(), 1);
    s = voteRound(s, { p1: 'A', p2: 'A', p3: 'A' }); // reveal applies +1 each
    expect(s.scores).toEqual({ p1: 1, p2: 1, p3: 1 });
    s = reducer(s, { type: 'SKIP' });
    expect(s.scores).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(s.history).toHaveLength(0);
    expect(s.index).toBe(1);
  });

  it('guards out-of-phase actions', () => {
    const s = createInitialState(makeConfig(), 1);
    expect(reducer(s, { type: 'REVEAL' })).toBe(s); // not collecting
    expect(reducer(s, { type: 'NEXT' })).toBe(s); // not reveal
  });
});

describe('wyr results', () => {
  it('ranks winners and stays pure', () => {
    let s = createInitialState(makeConfig({ roundLength: 2 }), 1);
    s = voteRound(s, { p1: 'A', p2: 'A', p3: 'B' }); // p1,p2 +1
    s = reducer(s, { type: 'NEXT' });
    s = voteRound(s, { p1: 'A', p2: 'B', p3: 'B' }); // p2? majority B -> p2,p3 +1
    s = reducer(s, { type: 'NEXT' });
    expect(s.phase).toBe('results');
    const ranked = standings(s);
    expect(ranked[0].rank).toBe(1);
    expect(computeWinners(s).length).toBeGreaterThanOrEqual(1);

    const before = createInitialState(makeConfig(), 1);
    const snap = structuredClone(before);
    reducer(before, { type: 'BEGIN_COLLECTION' });
    expect(before).toEqual(snap);
  });
});
