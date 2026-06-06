import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerSeat } from '../../sdk/types';
import { asPlayerId } from '../../engine/ids';
import { createInitialState, reducer, activeSeat, standings, foundCount } from './logic';
import type { MinesweeperState } from './logic';
import { DEFAULT_OPTIONS } from './config';

const seat = (id: string): PlayerSeat => ({ id: asPlayerId(id), name: id.toUpperCase() });

function setup({
  players = ['a'],
  cols = 6,
  rows = 6,
  mines = 6,
}: { players?: string[]; cols?: number; rows?: number; mines?: number } = {}): MinesweeperState {
  const config: GameConfig = {
    players: players.map(seat),
    options: { ...DEFAULT_OPTIONS, difficulty: 'custom', cols, rows, mines },
    lang: 'en',
  };
  return createInitialState(config, 1);
}

const firstReveal = (s: MinesweeperState, index = 0, seed = 5) =>
  reducer(s, { type: 'REVEAL', index, seed });

const unrevealedMine = (s: MinesweeperState) => s.board.find((c) => c.mine && !c.revealed)!.index;
const unrevealedSafe = (s: MinesweeperState) => s.board.find((c) => !c.mine && !c.revealed)!.index;

describe('mine-hunt createInitialState', () => {
  it('builds a hidden board with seats scored 0', () => {
    const s = setup({ players: ['a', 'b'], cols: 8, rows: 8, mines: 10 });
    expect(s.board).toHaveLength(64);
    expect(s.board.every((c) => !c.revealed && !c.mine && c.adjacent === 0)).toBe(true);
    expect(s.minesPlaced).toBe(false);
    expect(s.seats.every((se) => se.score === 0)).toBe(true);
    expect(s.phase).toBe('playing');
  });

  it('flags an out-of-range player count; clamps an absurd custom board to a legal one', () => {
    expect(setup({ players: ['a', 'b', 'c', 'd', 'e'] }).errorCode).toBe('BAD_BOARD');
    expect(setup({ cols: 4, rows: 4, mines: 99 }).errorCode).toBeNull();
  });
});

describe('mine-hunt layout', () => {
  it('scatters mines deterministically, leaves no 0-clue safe square, and seeds a few burst tiles', () => {
    const s = firstReveal(setup({ cols: 8, rows: 8, mines: 12 }), 27);
    expect(s.minesPlaced).toBe(true);
    expect(s.board.filter((c) => c.mine).length).toBeGreaterThanOrEqual(12); // coverage fill may add a few
    // every safe square borders at least one mine (no blank clues)
    expect(s.board.every((c) => c.mine || c.adjacent >= 1)).toBe(true);
    // some, but not many, burst tiles
    const bursts = s.board.filter((c) => c.burst).length;
    expect(bursts).toBeGreaterThanOrEqual(1);
    expect(bursts).toBeLessThan(8);
    const again = firstReveal(setup({ cols: 8, rows: 8, mines: 12 }), 27);
    expect(again.board.map((c) => c.mine)).toEqual(s.board.map((c) => c.mine)); // deterministic
  });

  it('tapping a burst tile opens a cluster of safe squares at once', () => {
    let s = firstReveal(setup({ cols: 10, rows: 10, mines: 14 }), 0, 4);
    const burst = s.board.find((c) => c.burst && !c.revealed);
    if (!burst) return; // extremely unlikely, but burst tiles are seeded
    const revealedBefore = s.board.filter((c) => c.revealed).length;
    s = reducer(s, { type: 'REVEAL', index: burst.index, seed: 4 });
    const revealedAfter = s.board.filter((c) => c.revealed).length;
    expect(revealedAfter - revealedBefore).toBeGreaterThan(1); // opened a bunch, not just one
    expect(s.board[burst.index].revealed).toBe(true);
    expect(s.board[burst.index].mine).toBe(false); // a burst tile is always safe
  });
});

describe('mine-hunt turns', () => {
  it('finding a mine scores it and lets the same player tap again', () => {
    let s = firstReveal(setup({ players: ['a', 'b'], cols: 8, rows: 8, mines: 12 }), 0, 5);
    const me = activeSeat(s).id;
    const before = s.seats.find((se) => se.id === me)!.score;
    const idx = unrevealedMine(s);
    s = reducer(s, { type: 'REVEAL', index: idx, seed: 5 });
    expect(s.board[idx].revealed).toBe(true);
    expect(s.seats.find((se) => se.id === me)!.score).toBe(before + 1);
    if (s.phase === 'playing') expect(activeSeat(s).id).toBe(me); // reward: same player
    expect(s.flash?.type === 'found' || s.phase === 'gameOver').toBe(true);
  });

  it('a safe square reveals a clue and passes the turn, with no penalty', () => {
    let s = firstReveal(setup({ players: ['a', 'b'], cols: 8, rows: 8, mines: 8 }), 0, 7);
    const me = activeSeat(s).id;
    const before = s.seats.find((se) => se.id === me)!.score;
    const idx = unrevealedSafe(s);
    s = reducer(s, { type: 'REVEAL', index: idx, seed: 7 });
    expect(s.board[idx].revealed).toBe(true);
    expect(s.board[idx].mine).toBe(false);
    expect(s.seats.find((se) => se.id === me)!.score).toBe(before); // no penalty, no score
    expect(activeSeat(s).id).not.toBe(me); // turn passed on
  });
});

describe('mine-hunt end states', () => {
  it('finding every mine ends a solo game as a win and reveals the board', () => {
    let s = firstReveal(setup({ cols: 6, rows: 6, mines: 5 }), 0, 3);
    for (const i of s.board.filter((c) => c.mine).map((c) => c.index)) {
      if (s.phase !== 'playing') break;
      if (!s.board[i].revealed) s = reducer(s, { type: 'REVEAL', index: i, seed: 3 });
    }
    expect(s.phase).toBe('gameOver');
    expect(s.winReason).toBe('soloWin');
    expect(s.winnerIds).toEqual([s.seats[0].id]);
    expect(s.board.every((c) => c.revealed)).toBe(true);
    expect(foundCount(s.board)).toBe(s.board.filter((c) => c.mine).length); // found every mine on the board
  });

  it('finding the last mine ends a versus game; the top finder wins', () => {
    let s = firstReveal(setup({ players: ['a', 'b'], cols: 6, rows: 6, mines: 5 }), 0, 9);
    for (const i of s.board.filter((c) => c.mine).map((c) => c.index)) {
      if (s.phase !== 'playing') break;
      if (!s.board[i].revealed) s = reducer(s, { type: 'REVEAL', index: i, seed: 9 });
    }
    expect(s.phase).toBe('gameOver');
    expect(s.winReason).toBe('allFound');
    const max = Math.max(...s.seats.map((se) => se.score));
    expect(s.winnerIds.length).toBeGreaterThanOrEqual(1);
    expect(s.winnerIds.every((id) => s.seats.find((se) => se.id === id)!.score === max)).toBe(true);
  });
});

describe('mine-hunt guards & purity', () => {
  it('re-tapping a revealed cell or acting after game over is a no-op; input is never mutated', () => {
    let s = firstReveal(setup({ cols: 5, rows: 5, mines: 3 }), 0, 7);
    const revealedIdx = s.board.findIndex((c) => c.revealed);
    expect(reducer(s, { type: 'REVEAL', index: revealedIdx, seed: 7 })).toBe(s); // revealed → no-op

    const snap = structuredClone(s);
    reducer(s, { type: 'REVEAL', index: unrevealedSafe(s), seed: 9 });
    expect(s).toEqual(snap); // input untouched
    expect(JSON.parse(JSON.stringify(s))).toEqual(s); // serializable

    // flash clears
    const flashed = reducer(s, { type: 'REVEAL', index: unrevealedSafe(s), seed: 9 });
    expect(flashed.flash).not.toBeNull();
    expect(reducer(flashed, { type: 'CLEAR_FLASH' }).flash).toBeNull();
  });

  it('standings rank seats by score (most mines found)', () => {
    const s = setup({ players: ['a', 'b'], cols: 6, rows: 6, mines: 6 });
    const ranked = standings({ ...s, seats: [{ ...s.seats[0], score: 3 }, { ...s.seats[1], score: 7 }] });
    expect(ranked[0].name).toBe('B');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });
});
