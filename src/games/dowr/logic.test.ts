import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerSeat } from '../../sdk/types';
import { asPlayerId, asTeamId } from '../../engine/ids';
import * as deckEngine from '../../engine/deck';
import {
  createInitialState,
  reducer,
  currentTeam,
  currentRound,
  describerPlayerId,
  guesserPlayerId,
  isLastTurn,
  selectStandings,
  selectWinners,
} from './logic';
import type { DowrAction, DowrState } from './logic';
import { DEFAULT_OPTIONS, normalizeOptions } from './config';
import type { DowrOptions } from './config';
import { buildPool, validateContent } from './deck';

const seat = (i: number): PlayerSeat => ({ id: asPlayerId(`p${i}`), name: `P${i}` });

/** Teams config, N players paired in seat order, surprise bomb OFF (deterministic fuse). */
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
  return {
    players,
    teams,
    lang: 'en',
    options: { ...DEFAULT_OPTIONS, surpriseBomb: false, ...opts },
  };
}

const advance = (
  s: DowrState,
  segmentMs: number,
  reason: 'guessed' | 'bomb' = 'guessed',
  seed = 1,
): DowrState => reducer(s, { type: 'ADVANCE', reason, segmentMs, seed } as DowrAction);

describe('content & deck', () => {
  it('validateContent reports no problems', () => {
    expect(validateContent()).toEqual([]);
  });
  it('buildPool filters by category', () => {
    const pool = buildPool({ ...DEFAULT_OPTIONS, categories: ['food'], difficulty: 'random' });
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((c) => c.category === 'food')).toBe(true);
  });
});

describe('normalizeOptions', () => {
  it('clamps rounds and coerces bomb settings to allowed choices', () => {
    const n = normalizeOptions({
      rounds: 99,
      fuseSeconds: 17 as DowrOptions['fuseSeconds'],
      bombPenaltySeconds: 999,
      changePenaltySeconds: 7,
      categories: [],
      difficulty: 'bogus' as DowrOptions['difficulty'],
    });
    expect(n.rounds).toBe(8);
    expect(n.fuseSeconds).toBe(DEFAULT_OPTIONS.fuseSeconds);
    expect(n.bombPenaltySeconds).toBe(DEFAULT_OPTIONS.bombPenaltySeconds);
    expect(n.changePenaltySeconds).toBe(DEFAULT_OPTIONS.changePenaltySeconds);
    expect(n.categories.length).toBe(5);
    expect(n.difficulty).toBe('random');
  });
  it('keeps valid choices', () => {
    const n = normalizeOptions({ fuseSeconds: 45, bombPenaltySeconds: 30, changePenaltySeconds: 0 });
    expect(n.fuseSeconds).toBe(45);
    expect(n.bombPenaltySeconds).toBe(30);
    expect(n.changePenaltySeconds).toBe(0);
  });
});

describe('createInitialState', () => {
  it('starts in playing with a served word and zeroed totals', () => {
    const s = createInitialState(teamsConfig(4), 1);
    expect(s.teams.map((t) => t.id)).toEqual(['t0', 't1']);
    expect(s.teams[0].memberIds).toEqual(['p0', 'p1']);
    expect(s.phase).toBe('playing');
    expect(s.currentCardId).not.toBeNull();
    expect(s.totals).toEqual({ t0: 0, t1: 0 });
    expect(s.totalTurns).toBe(2 * DEFAULT_OPTIONS.rounds);
    expect(s.finished).toBe(false);
  });
  it('fewer than two teams → error phase', () => {
    const s = createInitialState(teamsConfig(2), 1);
    expect(s.phase).toBe('error');
    expect(s.errorCode).toBe('NEED_TEAMS');
  });
});

describe('turn participants', () => {
  it('describer alternates between teammates each round', () => {
    let s = createInitialState(teamsConfig(4, { rounds: 2 }), 1);
    expect(currentTeam(s).id).toBe('t0');
    expect(describerPlayerId(s)).toBe('p0');
    expect(guesserPlayerId(s)).toBe('p1');
    s = advance(s, 1000); // → t1, round 0
    expect(currentTeam(s).id).toBe('t1');
    expect(describerPlayerId(s)).toBe('p2');
    s = advance(s, 1000); // → t0, round 1
    expect(currentTeam(s).id).toBe('t0');
    expect(describerPlayerId(s)).toBe('p1'); // swapped
    expect(guesserPlayerId(s)).toBe('p0');
  });
});

describe('advancing (the fast relay)', () => {
  it('a correct guess banks the segment time and serves the next team immediately', () => {
    let s = createInitialState(teamsConfig(4), 1);
    const firstWord = s.currentCardId;
    s = advance(s, 5000);
    expect(s.phase).toBe('playing');
    expect(s.totals.t0).toBe(5000);
    expect(s.turnNo).toBe(1);
    expect(currentTeam(s).id).toBe('t1');
    expect(s.currentCardId).not.toBeNull();
    expect(s.lastRecord?.solved).toBe(true);
    expect(firstWord).toBeTruthy();
  });
  it('segment time is capped at the fuse', () => {
    let s = createInitialState(teamsConfig(4, { fuseSeconds: 30 }), 1);
    s = advance(s, 999_999);
    expect(s.totals.t0).toBe(30_000);
  });
  it('a bomb banks the fuse plus the bomb penalty and flags a flash', () => {
    let s = createInitialState(teamsConfig(4, { fuseSeconds: 30, bombPenaltySeconds: 20 }), 1);
    s = advance(s, 30_000, 'bomb');
    expect(s.totals.t0).toBe(50_000);
    expect(s.lastRecord?.reason).toBe('bomb');
    expect(s.flash).toBe('bomb');
  });
  it('CLEAR_FLASH clears the flash', () => {
    let s = createInitialState(teamsConfig(4, { fuseSeconds: 30 }), 1);
    s = advance(s, 30_000, 'bomb');
    s = reducer(s, { type: 'CLEAR_FLASH' });
    expect(s.flash).toBeNull();
  });
});

describe('changing words', () => {
  it('CHANGE_WORD swaps the card and accrues a penalty banked on the next advance', () => {
    let s = createInitialState(teamsConfig(4, { changePenaltySeconds: 5 }), 1);
    s = reducer(s, { type: 'CHANGE_WORD', seed: 99 });
    expect(s.turnChanges).toBe(1);
    expect(s.changePenaltyMs).toBe(5000);
    s = advance(s, 10_000); // 10s described + 5s change penalty
    expect(s.totals.t0).toBe(15_000);
    expect(s.turnChanges).toBe(0); // reset for the next turn
  });
  it('reshuffles so a one-card deck never runs dry on a change', () => {
    let s = createInitialState(teamsConfig(4), 1);
    s = { ...s, deck: { drawPile: [], discardPile: ['only'] }, currentCardId: 'x' };
    s = reducer(s, { type: 'CHANGE_WORD', seed: 7 });
    expect(s.currentCardId).not.toBeNull();
    expect(s.phase).toBe('playing');
  });
});

describe('rounds & game end', () => {
  it('ends after every team has had its turns; lowest time wins', () => {
    let s = createInitialState(teamsConfig(4, { rounds: 1 }), 1);
    expect(s.totalTurns).toBe(2);
    expect(currentRound(s)).toBe(1);
    expect(isLastTurn(s)).toBe(false);
    s = advance(s, 5000); // t0 = 5s → t1
    expect(currentTeam(s).id).toBe('t1');
    expect(isLastTurn(s)).toBe(true);
    s = advance(s, 9000); // t1 = 9s → gameOver
    expect(s.phase).toBe('gameOver');
    expect(s.finished).toBe(true);
    expect(selectStandings(s)[0].subjectId).toBe('t0');
    expect(selectWinners(s)).toEqual(['t0']);
  });
  it('equal totals tie', () => {
    let s = createInitialState(teamsConfig(4, { rounds: 1 }), 1);
    s = advance(s, 5000);
    s = advance(s, 5000);
    expect(selectWinners(s).sort()).toEqual(['t0', 't1']);
    expect(selectStandings(s).every((r) => r.rank === 1)).toBe(true);
  });
});

describe('guards & purity', () => {
  it('ADVANCE after game over is a no-op', () => {
    let s = createInitialState(teamsConfig(4, { rounds: 1 }), 1);
    s = advance(s, 1000);
    s = advance(s, 1000); // gameOver
    expect(reducer(s, { type: 'ADVANCE', reason: 'guessed', segmentMs: 1, seed: 1 })).toBe(s);
  });
  it('RESET is a no-op', () => {
    const s = createInitialState(teamsConfig(4), 1);
    expect(reducer(s, { type: 'RESET' })).toBe(s);
  });
  it('does not mutate a frozen input state', () => {
    const s = createInitialState(teamsConfig(4), 1);
    Object.freeze(s);
    Object.freeze(s.totals);
    const after = advance(s, 3000);
    expect(after).not.toBe(s);
    expect(after.totals.t0).toBe(3000);
    expect(s.totals.t0).toBe(0);
  });
});
