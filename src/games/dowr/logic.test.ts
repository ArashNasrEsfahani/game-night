import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerSeat } from '../../sdk/types';
import { asPlayerId, asTeamId } from '../../engine/ids';
import * as deckEngine from '../../engine/deck';
import {
  createInitialState,
  reducer,
  describerSeat,
  currentRound,
  totalTurns,
  isLastTurn,
  selectStandings,
  selectWinners,
} from './logic';
import type { DowrAction, DowrState } from './logic';
import { DEFAULT_OPTIONS, normalizeOptions } from './config';
import type { DowrOptions } from './config';
import { buildPool, validateContent } from './deck';

const seat = (i: number): PlayerSeat => ({ id: asPlayerId(`p${i}`), name: `P${i}` });

function soloConfig(n: number, opts: Partial<DowrOptions> = {}): GameConfig {
  return {
    players: Array.from({ length: n }, (_, i) => seat(i)),
    lang: 'en',
    options: { ...DEFAULT_OPTIONS, mode: 'solo', ...opts },
  };
}

function teamsConfig(n: number, opts: Partial<DowrOptions> = {}): GameConfig {
  const players = Array.from({ length: n }, (_, i) => seat(i));
  const teams = {
    mode: 'manual' as const,
    teams: Array.from({ length: n / 2 }, (_, i) => ({
      id: asTeamId(`t${i}`),
      name: `T${i}`,
      memberIds: [players[2 * i].id, players[2 * i + 1].id],
    })),
  };
  return { players, teams, lang: 'en', options: { ...DEFAULT_OPTIONS, mode: 'teams', ...opts } };
}

const withDeck = (s: DowrState, ids: string[]): DowrState => ({
  ...s,
  deck: deckEngine.create(ids, 0),
});
const fold = (s: DowrState, actions: DowrAction[]): DowrState =>
  actions.reduce((acc, a) => reducer(acc, a), s);
const toDescribing = (s: DowrState): DowrState =>
  fold(s, [{ type: 'BEGIN_TURN' }, { type: 'START_DESCRIBE', now: 1000 }]);

describe('content & deck', () => {
  it('validateContent reports no problems', () => {
    expect(validateContent()).toEqual([]);
  });
  it('buildPool filters by category', () => {
    const pool = buildPool({ ...DEFAULT_OPTIONS, categories: ['food'], difficulty: 'random' });
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((c) => c.category === 'food')).toBe(true);
  });
  it('buildPool filters by difficulty; random keeps all', () => {
    const hard = buildPool({ ...DEFAULT_OPTIONS, difficulty: 'hard' });
    expect(hard.every((c) => c.difficulty === 'hard')).toBe(true);
    const all = buildPool({ ...DEFAULT_OPTIONS, difficulty: 'random' });
    expect(all.length).toBeGreaterThan(hard.length);
  });
});

describe('normalizeOptions', () => {
  it('clamps rounds, coerces timer, fixes categories & difficulty', () => {
    const n = normalizeOptions({
      rounds: 99,
      timerSeconds: 45 as DowrOptions['timerSeconds'],
      categories: [],
      difficulty: 'bogus' as DowrOptions['difficulty'],
    });
    expect(n.rounds).toBe(10);
    expect(n.timerSeconds).toBe(60);
    expect(n.categories.length).toBe(5);
    expect(n.difficulty).toBe('random');
  });
});

describe('createInitialState', () => {
  it('solo: scorers are players, all at 0, phase roundIntro', () => {
    const s = createInitialState(soloConfig(3), 1);
    expect(s.seatToScorer).toEqual(['p0', 'p1', 'p2']);
    expect(s.scorerIds).toEqual(['p0', 'p1', 'p2']);
    expect(s.score.totals).toEqual({ p0: 0, p1: 0, p2: 0 });
    expect(s.phase).toBe('roundIntro');
    expect(s.finished).toBe(false);
  });
  it('teams: seats map to team ids', () => {
    const s = createInitialState(teamsConfig(4), 1);
    expect(s.seatToScorer).toEqual(['t0', 't0', 't1', 't1']);
    expect(s.scorerIds).toEqual(['t0', 't1']);
    expect(s.score.totals).toEqual({ t0: 0, t1: 0 });
  });
  it('empty roster → error phase', () => {
    const s = createInitialState(soloConfig(0), 1);
    expect(s.phase).toBe('error');
  });
});

describe('turn flow', () => {
  it('BEGIN_TURN serves a card and enters reveal', () => {
    const s = reducer(createInitialState(soloConfig(2), 1), { type: 'BEGIN_TURN' });
    expect(s.phase).toBe('reveal');
    expect(s.currentCardId).not.toBeNull();
  });
  it('REVEAL opens the gate', () => {
    const s = fold(createInitialState(soloConfig(2), 1), [
      { type: 'BEGIN_TURN' },
      { type: 'REVEAL' },
    ]);
    expect(s.gate.phase).toBe('revealed');
  });
  it('START_DESCRIBE enters describing with a running clock', () => {
    const s = toDescribing(createInitialState(soloConfig(2), 1));
    expect(s.phase).toBe('describing');
    expect(s.clock.running).toBe(true);
  });
  it('TICK before expiry stays describing; expiry finalizes (timeExpired)', () => {
    const d = toDescribing(createInitialState(soloConfig(2), 1));
    const mid = reducer(d, { type: 'TICK', now: 1000 + 10_000 });
    expect(mid.phase).toBe('describing');
    const done = reducer(d, { type: 'TICK', now: 1000 + 60_000 + 1 });
    expect(done.phase).toBe('turnSummary');
    expect(done.lastTurnEndReason).toBe('timeExpired');
  });
  it('CORRECT scores and serves the next card', () => {
    const d = toDescribing(createInitialState(soloConfig(2), 1));
    const c = reducer(d, { type: 'CORRECT' });
    expect(c.turnCorrect).toBe(1);
    expect(c.turnEvents.at(-1)).toEqual({ cardId: expect.any(String), result: 'correct' });
    expect(c.phase).toBe('describing');
  });
  it('SKIP increments skipped', () => {
    const d = toDescribing(createInitialState(soloConfig(2), 1));
    const c = reducer(d, { type: 'SKIP' });
    expect(c.turnSkipped).toBe(1);
  });
  it('BEGIN_TURN on an empty deck finalizes deckExhausted with delta 0', () => {
    const s = withDeck(createInitialState(soloConfig(2), 1), []);
    const out = reducer(s, { type: 'BEGIN_TURN' });
    expect(out.phase).toBe('turnSummary');
    expect(out.lastTurnEndReason).toBe('deckExhausted');
    expect(out.history.at(-1)?.delta).toBe(0);
  });
  it('running out of cards mid-turn finalizes deckExhausted', () => {
    const s = withDeck(createInitialState(soloConfig(2), 1), ['only-one']);
    const out = fold(s, [
      { type: 'BEGIN_TURN' },
      { type: 'START_DESCRIBE', now: 0 },
      { type: 'CORRECT' },
    ]);
    expect(out.phase).toBe('turnSummary');
    expect(out.lastTurnEndReason).toBe('deckExhausted');
    expect(out.score.totals.p0).toBe(1);
  });
});

describe('scoring', () => {
  it('skip is free when skipPenalty is off', () => {
    const d = toDescribing(createInitialState(soloConfig(2, { skipPenalty: false }), 1));
    const out = fold(d, [
      { type: 'CORRECT' },
      { type: 'CORRECT' },
      { type: 'SKIP' },
      { type: 'END_TURN_EARLY', now: 5000 },
    ]);
    expect(out.history.at(-1)?.delta).toBe(2);
    expect(out.score.totals.p0).toBe(2);
  });
  it('skip costs −1 when skipPenalty is on (score can go negative)', () => {
    const d = toDescribing(createInitialState(soloConfig(2, { skipPenalty: true }), 1));
    const out = fold(d, [
      { type: 'CORRECT' },
      { type: 'SKIP' },
      { type: 'SKIP' },
      { type: 'END_TURN_EARLY', now: 5000 },
    ]);
    expect(out.history.at(-1)?.delta).toBe(-1);
    expect(out.score.totals.p0).toBe(-1);
  });
  it('teams: both teammates accumulate into the same team', () => {
    let s = createInitialState(teamsConfig(2), 1);
    s = fold(toDescribing(s), [{ type: 'CORRECT' }, { type: 'CORRECT' }, { type: 'END_TURN_EARLY', now: 1 }]);
    s = reducer(s, { type: 'NEXT_TURN', seed: 1 });
    s = fold(toDescribing(s), [{ type: 'CORRECT' }, { type: 'END_TURN_EARLY', now: 1 }]);
    expect(s.score.totals.t0).toBe(3);
  });
});

describe('turn pointer & rounds', () => {
  it('NEXT_TURN advances and resets fields', () => {
    let s = createInitialState(soloConfig(3, { rounds: 2 }), 1);
    s = fold(toDescribing(s), [{ type: 'CORRECT' }, { type: 'END_TURN_EARLY', now: 1 }]);
    expect(describerSeat(s)).toBe(0);
    s = reducer(s, { type: 'NEXT_TURN', seed: 1 });
    expect(s.phase).toBe('roundIntro');
    expect(describerSeat(s)).toBe(1);
    expect(s.turnCorrect).toBe(0);
  });
  it('selectors track a full N=2, rounds=1 walkthrough then gameOver', () => {
    let s = createInitialState(soloConfig(2, { rounds: 1 }), 1);
    expect(totalTurns(s)).toBe(2);
    expect(currentRound(s)).toBe(1);
    expect(isLastTurn(s)).toBe(false);
    s = fold(toDescribing(s), [{ type: 'END_TURN_EARLY', now: 1 }]); // seat 0
    s = reducer(s, { type: 'NEXT_TURN', seed: 1 }); // → seat 1
    expect(describerSeat(s)).toBe(1);
    expect(isLastTurn(s)).toBe(true);
    s = fold(toDescribing(s), [{ type: 'END_TURN_EARLY', now: 1 }]); // seat 1
    s = reducer(s, { type: 'NEXT_TURN', seed: 1 }); // → gameOver
    expect(s.phase).toBe('gameOver');
    expect(s.finished).toBe(true);
  });
});

describe('selectors / win', () => {
  it('selectStandings sorts desc and selectWinners returns the leader', () => {
    let s = createInitialState(soloConfig(2, { rounds: 1 }), 1);
    s = fold(toDescribing(s), [{ type: 'CORRECT' }, { type: 'CORRECT' }, { type: 'END_TURN_EARLY', now: 1 }]); // p0 = 2
    s = reducer(s, { type: 'NEXT_TURN', seed: 1 });
    s = fold(toDescribing(s), [{ type: 'CORRECT' }, { type: 'END_TURN_EARLY', now: 1 }]); // p1 = 1
    const standings = selectStandings(s);
    expect(standings[0].subjectId).toBe('p0');
    expect(selectWinners(s)).toEqual(['p0']);
  });
  it('a tie returns multiple winners', () => {
    let s = createInitialState(soloConfig(2, { rounds: 1 }), 1);
    s = fold(toDescribing(s), [{ type: 'CORRECT' }, { type: 'END_TURN_EARLY', now: 1 }]);
    s = reducer(s, { type: 'NEXT_TURN', seed: 1 });
    s = fold(toDescribing(s), [{ type: 'CORRECT' }, { type: 'END_TURN_EARLY', now: 1 }]);
    expect(selectWinners(s).sort()).toEqual(['p0', 'p1']);
  });
});

describe('guards & purity', () => {
  it('actions in the wrong phase return state unchanged', () => {
    const s = createInitialState(soloConfig(2), 1);
    expect(reducer(s, { type: 'CORRECT' })).toBe(s);
    expect(reducer(s, { type: 'TICK', now: 1 })).toBe(s);
  });
  it('RESET is a no-op', () => {
    const s = createInitialState(soloConfig(2), 1);
    expect(reducer(s, { type: 'RESET' })).toBe(s);
  });
  it('does not mutate a frozen input state', () => {
    const d = toDescribing(createInitialState(soloConfig(2), 1));
    Object.freeze(d);
    const after = reducer(d, { type: 'CORRECT' });
    expect(after).not.toBe(d);
    expect(after.turnCorrect).toBe(1);
    expect(d.turnCorrect).toBe(0);
  });
});
