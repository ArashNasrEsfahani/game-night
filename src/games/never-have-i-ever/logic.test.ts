import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerSeat } from '../../sdk/types';
import { asPlayerId } from '../../engine/ids';
import { createInitialState, reducer, rankPlayers, computeWinners } from './logic';
import type { NhieState } from './logic';
import { DEFAULT_OPTIONS } from './config';
import type { NhieOptions } from './config';
import { validateContent } from './content';

const seat = (id: string): PlayerSeat => ({ id: asPlayerId(id), name: id.toUpperCase() });

function makeConfig(options: Partial<NhieOptions> = {}, ids = ['a', 'b', 'c']): GameConfig {
  return {
    players: ids.map(seat),
    options: {
      ...DEFAULT_OPTIONS,
      intensities: ['classic', 'spicy', 'wild'],
      deckSize: 50,
      ...options,
    },
    lang: 'en',
  };
}

const POOL = 18; // 7 classic + 6 spicy + 5 wild

/** Play one sequential round; `haves` = ids that confess. */
function playRound(s: NhieState, haves: string[]): NhieState {
  s = reducer(s, { type: 'START_ANSWERING' });
  const queue = s.answering!.queue;
  for (const id of queue) {
    s = reducer(s, { type: 'ANSWER', playerId: id, hasDone: haves.includes(id) });
    s = reducer(s, { type: 'PASS_TO_NEXT' });
  }
  return reducer(s, { type: 'RESOLVE_ROUND' });
}

describe('nhie content', () => {
  it('ships valid bilingual content', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('nhie createInitialState', () => {
  it('builds players and a clamped, deterministic deck', () => {
    const a = createInitialState(makeConfig({ startingLives: 3 }), 42);
    expect(a.phase).toBe('statement');
    expect(a.players).toHaveLength(3);
    expect(a.players.every((p) => p.lives === 3 && p.haveCount === 0 && !p.eliminated)).toBe(true);
    expect(a.drawOrder.length).toBe(POOL); // deckSize 50 clamped to 18
    expect(a.currentStatementId).toBe(a.drawOrder[0]);
    expect(a.drawIndex).toBe(0);
    expect(a.roundIndex).toBe(0);
    const b = createInitialState(makeConfig({ startingLives: 3 }), 42);
    expect(a.drawOrder).toEqual(b.drawOrder);
    const c = createInitialState(makeConfig({ startingLives: 3 }), 7);
    expect(a.drawOrder).not.toEqual(c.drawOrder);
  });

  it('clamps deckSize to available', () => {
    const s = createInitialState(makeConfig({ deckSize: 5 }), 1);
    expect(s.drawOrder).toHaveLength(5);
  });

  it('flags too few players as error', () => {
    const s = createInitialState(makeConfig({}, ['a', 'b']), 1);
    expect(s.phase).toBe('error');
    expect(s.errorCode).toBe('NOT_ENOUGH_PLAYERS');
  });
});

describe('nhie answering (sequential)', () => {
  it('START_ANSWERING builds the alive queue', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'START_ANSWERING' });
    expect(s.phase).toBe('answering');
    expect(s.answering).toEqual({ queue: ['a', 'b', 'c'], cursor: 0, answers: {} });
  });

  it('ANSWER records without advancing; guards wrong player; overwrites on re-tap', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'START_ANSWERING' });
    s = reducer(s, { type: 'ANSWER', playerId: 'a', hasDone: true });
    expect(s.answering!.answers).toEqual({ a: true });
    expect(s.answering!.cursor).toBe(0);
    const wrong = reducer(s, { type: 'ANSWER', playerId: 'b', hasDone: true });
    expect(wrong).toBe(s); // not at cursor → no-op
    s = reducer(s, { type: 'ANSWER', playerId: 'a', hasDone: false });
    expect(s.answering!.answers).toEqual({ a: false });
  });

  it('PASS_TO_NEXT advances and is a no-op past the end', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'START_ANSWERING' });
    s = reducer(s, { type: 'PASS_TO_NEXT' });
    s = reducer(s, { type: 'PASS_TO_NEXT' });
    s = reducer(s, { type: 'PASS_TO_NEXT' });
    expect(s.answering!.cursor).toBe(3);
    expect(reducer(s, { type: 'PASS_TO_NEXT' })).toBe(s);
  });
});

describe('nhie answering (honor)', () => {
  it('SET_HONOR_HAVES stores haves and filters non-participants', () => {
    let s = createInitialState(makeConfig({ revealMode: 'honor' }), 1);
    s = reducer(s, { type: 'START_ANSWERING' });
    s = reducer(s, { type: 'SET_HONOR_HAVES', playerIds: ['a', 'zzz'] });
    expect(s.answering!.answers).toEqual({ a: true });
  });
});

describe('nhie resolve (classic)', () => {
  it('each confessor loses a life and gains a haveCount', () => {
    let s = createInitialState(makeConfig({ startingLives: 3 }), 1);
    s = playRound(s, ['a', 'b']);
    expect(s.phase).toBe('reveal');
    const a = s.players.find((p) => p.id === 'a')!;
    const c = s.players.find((p) => p.id === 'c')!;
    expect(a.lives).toBe(2);
    expect(a.haveCount).toBe(1);
    expect(c.lives).toBe(3);
    expect(c.haveCount).toBe(0);
    expect(s.rounds).toHaveLength(1);
    expect(s.rounds[0].haveIds.sort()).toEqual(['a', 'b']);
  });

  it('hitting 0 lives eliminates the player', () => {
    let s = createInitialState(makeConfig({ startingLives: 1 }, ['a', 'b', 'c', 'd']), 1);
    s = playRound(s, ['a']);
    const a = s.players.find((p) => p.id === 'a')!;
    expect(a.eliminated).toBe(true);
    expect(a.eliminatedAtRound).toBe(0);
    expect(s.lastResult!.newlyEliminated).toEqual(['a']);
  });

  it('empty confessions change nothing', () => {
    let s = createInitialState(makeConfig({ startingLives: 3 }), 1);
    s = playRound(s, []);
    expect(s.players.every((p) => p.lives === 3 && p.haveCount === 0)).toBe(true);
    expect(s.rounds[0].haveIds).toEqual([]);
    expect(s.phase).toBe('reveal');
  });

  it('ends when one player remains', () => {
    let s = createInitialState(makeConfig({ startingLives: 1 }), 1);
    s = playRound(s, ['a', 'b']); // a, b out; c alive
    expect(s.finished).toBe(true);
    expect(s.winnerIds).toEqual(['c']);
  });
});

describe('nhie resolve (points)', () => {
  it('accrues haveCount without elimination and ends at deckSize', () => {
    let s = createInitialState(makeConfig({ mode: 'points', deckSize: 2 }), 1);
    s = playRound(s, ['a']); // round 0
    expect(s.players.find((p) => p.id === 'a')!.haveCount).toBe(1);
    expect(s.players.every((p) => !p.eliminated)).toBe(true);
    expect(s.finished).toBe(false);
    s = reducer(s, { type: 'NEXT_STATEMENT' });
    s = playRound(s, ['b']); // round 1 -> deckSize reached
    expect(s.finished).toBe(true);
    expect(s.winnerIds).toEqual(['c']); // fewest confessions
  });
});

describe('nhie advancement', () => {
  it('NEXT_STATEMENT advances the deck and round', () => {
    let s = createInitialState(makeConfig({ startingLives: 5 }), 1);
    s = playRound(s, ['a']);
    const before = s.drawIndex;
    s = reducer(s, { type: 'NEXT_STATEMENT' });
    expect(s.phase).toBe('statement');
    expect(s.drawIndex).toBe(before + 1);
    expect(s.roundIndex).toBe(1);
    expect(s.currentStatementId).toBe(s.drawOrder[before + 1]);
    expect(s.lastResult).toBeNull();
  });

  it('SKIP_STATEMENT advances the deck but not the round', () => {
    let s = createInitialState(makeConfig({ startingLives: 5 }), 1);
    s = reducer(s, { type: 'SKIP_STATEMENT' });
    expect(s.drawIndex).toBe(1);
    expect(s.roundIndex).toBe(0);
    expect(s.players.every((p) => p.haveCount === 0)).toBe(true);
  });

  it('END_GAME finishes immediately', () => {
    let s = createInitialState(makeConfig({ startingLives: 5 }), 1);
    s = reducer(s, { type: 'END_GAME' });
    expect(s.phase).toBe('results');
    expect(s.finished).toBe(true);
  });
});

describe('nhie selectors', () => {
  it('computeWinners returns ties in points mode', () => {
    let s = createInitialState(makeConfig({ mode: 'points', deckSize: 2 }), 1);
    s = playRound(s, ['a']);
    s = reducer(s, { type: 'NEXT_STATEMENT' });
    s = playRound(s, ['a']); // a has 2, b & c have 0
    expect(computeWinners(s).sort()).toEqual(['b', 'c']);
  });

  it('rankPlayers orders points ascending by confessions', () => {
    let s = createInitialState(makeConfig({ mode: 'points', deckSize: 3 }), 1);
    s = playRound(s, ['a', 'b']);
    const ranked = rankPlayers(s);
    expect(ranked[0].id).toBe('c'); // 0 confessions, best
  });

  it('does not mutate input (purity)', () => {
    let s = createInitialState(makeConfig({ startingLives: 3 }), 1);
    s = reducer(s, { type: 'START_ANSWERING' });
    const snapshot = structuredClone(s);
    reducer(s, { type: 'ANSWER', playerId: 'a', hasDone: true });
    expect(s).toEqual(snapshot);
  });
});
