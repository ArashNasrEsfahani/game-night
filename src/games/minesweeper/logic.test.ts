import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerSeat } from '../../sdk/types';
import { asPlayerId } from '../../engine/ids';
import {
  createInitialState,
  reducer,
  neighbors,
  activeSeat,
  standings,
} from './logic';
import type { MinesweeperState } from './logic';
import { DEFAULT_OPTIONS } from './config';

const seat = (id: string): PlayerSeat => ({ id: asPlayerId(id), name: id.toUpperCase() });

function setup({
  players = ['a'],
  cols = 6,
  rows = 6,
  mines = 6,
  lives = 1,
}: { players?: string[]; cols?: number; rows?: number; mines?: number; lives?: number } = {}): MinesweeperState {
  const config: GameConfig = {
    players: players.map(seat),
    options: { ...DEFAULT_OPTIONS, difficulty: 'custom', cols, rows, mines, lives },
    lang: 'en',
  };
  return createInitialState(config, 1);
}

const firstReveal = (s: MinesweeperState, index = 0, seed = 5) =>
  reducer(s, { type: 'REVEAL', index, seed });

describe('minesweeper createInitialState', () => {
  it('builds a hidden board with seats scored 0 and lives set', () => {
    const s = setup({ players: ['a', 'b'], cols: 8, rows: 8, mines: 10, lives: 2 });
    expect(s.board).toHaveLength(64);
    expect(s.board.every((c) => !c.revealed && !c.mine && c.adjacent === 0)).toBe(true);
    expect(s.minesPlaced).toBe(false);
    expect(s.safeRemaining).toBe(64 - 10);
    expect(s.seats.every((se) => se.score === 0 && se.lives === 2 && !se.eliminated)).toBe(true);
    expect(s.phase).toBe('playing');
  });

  it('flags an out-of-range player count as an error (custom mines/size are clamped safe)', () => {
    expect(setup({ players: ['a', 'b', 'c', 'd', 'e'] }).errorCode).toBe('BAD_BOARD');
    // normalizeOptions clamps an absurd custom request to a legal board instead of erroring:
    expect(setup({ cols: 4, rows: 4, mines: 99 }).errorCode).toBeNull();
  });
});

describe('minesweeper first-click safety', () => {
  it('places exactly N mines, none in the clicked 3×3, deterministically', () => {
    const s = firstReveal(setup({ cols: 8, rows: 8, mines: 12 }), 27);
    const mines = s.board.filter((c) => c.mine).map((c) => c.index);
    const forbidden = new Set([27, ...neighbors(27, 8, 8)]);
    expect(mines).toHaveLength(12);
    expect(mines.some((i) => forbidden.has(i))).toBe(false);
    const again = firstReveal(setup({ cols: 8, rows: 8, mines: 12 }), 27);
    expect(again.board.map((c) => c.mine)).toEqual(s.board.map((c) => c.mine));
  });

  it('never detonates the first click (property over many seeds)', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s = firstReveal(setup({ cols: 6, rows: 6, mines: 8 }), 14, seed);
      expect(s.board[14].mine).toBe(false);
      expect(s.board[14].adjacent).toBe(0); // 3×3 is mine-free, so the click always opens
    }
  });
});

describe('minesweeper reveal & flood', () => {
  it('floods the opening, scoring every cell to the revealer', () => {
    const s0 = setup({ cols: 7, rows: 7, mines: 7 });
    const s = firstReveal(s0, 0);
    const opened = s0.safeRemaining - s.safeRemaining;
    expect(opened).toBeGreaterThanOrEqual(1);
    expect(s.board.filter((c) => c.revealed)).toHaveLength(opened);
    expect(s.seats[0].score).toBe(opened); // solo revealer keeps the whole cascade
  });

  it('a mine hit costs a life, passes the turn, and does not end a 2-life versus game', () => {
    let s = setup({ players: ['a', 'b'], cols: 7, rows: 7, mines: 8, lives: 2 });
    s = firstReveal(s, 0); // a opens safely → turn passes to b
    const hitter = activeSeat(s);
    const mine = s.board.find((c) => c.mine)!.index;
    s = reducer(s, { type: 'REVEAL', index: mine, seed: 5 });
    expect(s.seats.find((se) => se.id === hitter.id)!.lives).toBe(1);
    expect(s.board[mine].exploded).toBe(true);
    expect(s.phase).toBe('playing');
    expect(activeSeat(s).id).not.toBe(hitter.id); // turn passed on
  });

  it('eliminating the last rival ends the game (lastSurvivor)', () => {
    let s = setup({ players: ['a', 'b'], cols: 7, rows: 7, mines: 10, lives: 1 });
    s = firstReveal(s, 0); // turn → b
    const doomed = activeSeat(s);
    const mine = s.board.find((c) => c.mine)!.index;
    s = reducer(s, { type: 'REVEAL', index: mine, seed: 5 });
    expect(s.phase).toBe('gameOver');
    expect(s.winReason).toBe('lastSurvivor');
    expect(s.winnerIds).not.toContain(doomed.id);
  });
});

describe('minesweeper solo end states', () => {
  it('sweeping every safe cell is a solo win', () => {
    let s = setup({ cols: 6, rows: 6, mines: 5 });
    s = firstReveal(s, 0);
    const safe = s.board.filter((c) => !c.mine).map((c) => c.index);
    for (const i of safe) {
      if (s.phase !== 'playing') break;
      if (!s.board[i].revealed) s = reducer(s, { type: 'REVEAL', index: i, seed: 5 });
    }
    expect(s.phase).toBe('gameOver');
    expect(s.winReason).toBe('soloWin');
    expect(s.winnerIds).toEqual([s.seats[0].id]);
  });

  it('hitting a mine with no lives left is a solo loss and reveals the board', () => {
    let s = setup({ cols: 5, rows: 5, mines: 3, lives: 1 });
    s = firstReveal(s, 12);
    const mine = s.board.find((c) => c.mine)!.index;
    s = reducer(s, { type: 'REVEAL', index: mine, seed: 7 });
    expect(s.phase).toBe('gameOver');
    expect(s.winReason).toBe('soloLoss');
    expect(s.board.every((c) => c.revealed)).toBe(true);
  });
});

describe('minesweeper flag & chord', () => {
  it('FLAG is free (no turn change) and a flagged cell cannot be revealed', () => {
    let s = firstReveal(setup({ cols: 6, rows: 6, mines: 6 }), 0);
    const hidden = s.board.find((c) => !c.revealed && !c.mine)!.index;
    const turnBefore = s.turnNo;
    const f = reducer(s, { type: 'FLAG', index: hidden });
    expect(f.board[hidden].flagged).toBe(true);
    expect(f.turnNo).toBe(turnBefore);
    expect(reducer(f, { type: 'REVEAL', index: hidden, seed: 5 })).toBe(f); // no-op
  });

  it('CHORD clears neighbours when flags match, and is a no-op when they do not', () => {
    let s = firstReveal(setup({ cols: 7, rows: 7, mines: 8 }), 0);
    const num = s.board.find((c) => c.revealed && c.adjacent > 0)!;
    const nbs = neighbors(num.index, 7, 7);
    const mineNbs = nbs.filter((j) => s.board[j].mine);
    const safeHidden = nbs.filter((j) => !s.board[j].mine && !s.board[j].revealed);

    // Mismatch (no flags yet) → no-op
    expect(reducer(s, { type: 'CHORD', index: num.index })).toBe(s);

    for (const j of mineNbs) s = reducer(s, { type: 'FLAG', index: j });
    s = reducer(s, { type: 'CHORD', index: num.index });
    for (const j of safeHidden) expect(s.board[j].revealed).toBe(true);
    expect(s.board.filter((c) => c.exploded)).toHaveLength(0); // correct flags → no boom
  });
});

describe('minesweeper turn order & guards', () => {
  it('turn passing skips eliminated seats', () => {
    let s = setup({ players: ['a', 'b', 'c'], cols: 7, rows: 7, mines: 8, lives: 1 });
    s = firstReveal(s, 0); // a opens → turn b
    // b hits a mine → eliminated; alive a,c → turn moves to c
    const mine = s.board.find((c) => c.mine)!.index;
    s = reducer(s, { type: 'REVEAL', index: mine, seed: 5 });
    expect(s.phase).toBe('playing');
    const elim = s.seats.find((se) => se.eliminated)!;
    expect(elim.name).toBe('B');
    // c then a then it should skip the eliminated B back to C
    const safe = () => s.board.findIndex((c) => !c.revealed && !c.flagged && !c.mine);
    s = reducer(s, { type: 'REVEAL', index: safe(), seed: 5 }); // c
    s = reducer(s, { type: 'REVEAL', index: safe(), seed: 5 }); // a
    if (s.phase === 'playing') expect(activeSeat(s).eliminated).toBe(false);
  });

  it('wrong-phase / illegal actions are no-ops and the reducer never mutates input', () => {
    let s = firstReveal(setup({ cols: 5, rows: 5, mines: 3, lives: 1 }), 0);
    const mine = s.board.find((c) => c.mine)!.index;
    const over = reducer(s, { type: 'REVEAL', index: mine, seed: 5 }); // solo loss
    expect(over.phase).toBe('gameOver');
    expect(reducer(over, { type: 'REVEAL', index: 0, seed: 5 })).toBe(over); // no-op after end

    const snap = structuredClone(s);
    reducer(s, { type: 'REVEAL', index: s.board.findIndex((c) => !c.revealed), seed: 9 });
    expect(s).toEqual(snap); // input untouched
    expect(JSON.parse(JSON.stringify(s))).toEqual(s); // serializable
  });

  it('standings rank seats by score', () => {
    const s = setup({ players: ['a', 'b'], cols: 6, rows: 6, mines: 6, lives: 2 });
    const ranked = standings({ ...s, seats: [{ ...s.seats[0], score: 3 }, { ...s.seats[1], score: 7 }] });
    expect(ranked[0].name).toBe('B');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });
});
