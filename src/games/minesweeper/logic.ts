// src/games/minesweeper/logic.ts — PURE logic. No clock/RNG/IO; the mine-layout seed arrives in the
// first REVEAL action, keeping the reducer deterministic and side-effect free.
//
// This is "reverse Minesweeper": the mines are the PRIZES. On your turn you tap a square —
//   • a MINE → you found one (+1) and you get to tap again (reward),
//   • a SAFE square → it reveals a number clue (how many mines touch it) and your turn passes.
// Nothing explodes; there are no lives. The game ends when every mine has been found, and whoever
// found the most wins. The number clues are the deduction heart of Minesweeper, now used to *hunt*.
import type { ColorToken, GameConfig, GameStateBase } from '../../sdk/types';
import { shuffle } from '../../engine/rng';
import { readOptions } from './config';
import type { MinesweeperOptions } from './config';

export type MinePhase = 'playing' | 'gameOver';
export type WinReason = 'allFound' | 'soloWin' | null;

export interface Cell {
  index: number;
  mine: boolean;
  adjacent: number; // 0..8 neighbouring mines (computed once mines are placed)
  revealed: boolean;
  revealedBy: string | null; // seat id, for tint + score attribution
}

export interface MineSeat {
  id: string;
  name: string;
  color?: ColorToken;
  score: number; // mines personally found
}

export interface MinesweeperState extends GameStateBase {
  phase: MinePhase;
  options: MinesweeperOptions;
  cols: number;
  rows: number;
  board: Cell[];
  minesPlaced: boolean; // false until the first reveal seeds the layout
  seats: MineSeat[];
  turnNo: number; // active seat = turnNo modulo seat count
  flash: { type: 'found' | 'safe' | 'win'; index?: number } | null;
  winnerIds: string[];
  winReason: WinReason;
  errorCode: 'BAD_BOARD' | null;
}

export type MinesweeperAction =
  | { type: 'REVEAL'; index: number; seed: number } // seed only consumed on the first reveal
  | { type: 'CLEAR_FLASH' };

/* ─────────────────────────  Pure board helpers  ───────────────────────── */

export function neighbors(index: number, cols: number, rows: number): number[] {
  const r = Math.floor(index / cols);
  const c = index % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc);
    }
  return out;
}

/** Scatter `mines` mines anywhere on the board (a mine is a prize, so no first-click safety), then
 *  compute every safe cell's adjacency. Pure & deterministic for a given seed. */
function placeMines(board: Cell[], cols: number, rows: number, mines: number, seed: number): Cell[] {
  const n = cols * rows;
  const all = Array.from({ length: n }, (_, i) => i);
  const mineIdx = new Set(shuffle(all, seed).slice(0, mines));
  return board.map((cell) => {
    const mine = mineIdx.has(cell.index);
    const adjacent = mine ? 0 : neighbors(cell.index, cols, rows).filter((j) => mineIdx.has(j)).length;
    return { ...cell, mine, adjacent };
  });
}

const activeSeatIndex = (seats: MineSeat[], turnNo: number): number => {
  const n = seats.length;
  return ((turnNo % n) + n) % n;
};

export const activeSeat = (s: MinesweeperState): MineSeat =>
  s.seats[activeSeatIndex(s.seats, s.turnNo)];

export const foundCount = (board: Cell[]): number => board.filter((c) => c.mine && c.revealed).length;

function revealAll(board: Cell[]): Cell[] {
  return board.map((c) => (c.revealed ? c : { ...c, revealed: true }));
}

/* ─────────────────────────  Lifecycle  ───────────────────────── */

export function createInitialState(config: GameConfig, _seed: number): MinesweeperState {
  const options = readOptions(config);
  const { cols, rows, mines } = options;
  const n = cols * rows;

  const seats: MineSeat[] = config.players.map((p) => ({
    id: p.id as string,
    name: p.name,
    color: p.color,
    score: 0,
  }));

  const board: Cell[] = Array.from({ length: n }, (_, index) => ({
    index,
    mine: false,
    adjacent: 0,
    revealed: false,
    revealedBy: null,
  }));

  // Need at least one safe cell so there are clues to read.
  const errorCode: MinesweeperState['errorCode'] =
    seats.length < 1 || seats.length > 4 || n < 16 || mines >= n || mines < 1 ? 'BAD_BOARD' : null;

  return {
    v: 2,
    phase: errorCode ? 'gameOver' : 'playing',
    finished: false,
    options,
    cols,
    rows,
    board,
    minesPlaced: false,
    seats,
    turnNo: 0,
    flash: null,
    winnerIds: [],
    winReason: null,
    errorCode,
  };
}

const finish = (s: MinesweeperState, reason: WinReason, winnerIds: string[]): MinesweeperState => ({
  ...s,
  phase: 'gameOver',
  finished: true,
  winReason: reason,
  winnerIds,
  flash: { type: 'win' },
  board: revealAll(s.board),
});

/** Highest score (most mines found) wins; ties are shared. */
function winnersByScore(seats: MineSeat[]): string[] {
  const best = Math.max(...seats.map((s) => s.score));
  return seats.filter((s) => s.score === best).map((s) => s.id);
}

const minesLeftToFind = (s: MinesweeperState): number => s.options.mines - foundCount(s.board);

/** After a tap: end the game if every mine is found; otherwise a mine keeps the turn (reward) and a
 *  safe square passes it. Solo always keeps going (no one to pass to). */
function afterPick(s: MinesweeperState, foundMine: boolean): MinesweeperState {
  if (minesLeftToFind(s) === 0) {
    const solo = s.seats.length === 1;
    return finish(s, solo ? 'soloWin' : 'allFound', solo ? [s.seats[0].id] : winnersByScore(s.seats));
  }
  if (s.seats.length === 1 || foundMine) return s; // solo, or a found mine → same player taps again
  return { ...s, turnNo: s.turnNo + 1 }; // a safe square passes the turn
}

/* ─────────────────────────  Reducer  ───────────────────────── */

export function reducer(state: MinesweeperState, action: MinesweeperAction): MinesweeperState {
  const s = state;
  switch (action.type) {
    case 'REVEAL': {
      if (s.phase !== 'playing') return s;
      let board = s.board;
      let base = s;
      if (!s.minesPlaced) {
        board = placeMines(s.board, s.cols, s.rows, s.options.mines, action.seed);
        base = { ...s, board, minesPlaced: true };
      }
      const cell = board[action.index];
      if (!cell || cell.revealed) return s; // illegal → no-op (same ref)
      const ai = activeSeatIndex(base.seats, base.turnNo);
      const seatId = base.seats[ai].id;

      const nextBoard = board.map((c) =>
        c.index === action.index ? { ...c, revealed: true, revealedBy: seatId } : c,
      );

      if (cell.mine) {
        const seats = base.seats.map((se, i) => (i === ai ? { ...se, score: se.score + 1 } : se));
        return afterPick({ ...base, board: nextBoard, seats, flash: { type: 'found', index: action.index } }, true);
      }
      return afterPick({ ...base, board: nextBoard, flash: { type: 'safe', index: action.index } }, false);
    }

    case 'CLEAR_FLASH': {
      if (s.flash === null) return s;
      return { ...s, flash: null };
    }

    default:
      return s;
  }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

export interface MineStanding extends MineSeat {
  rank: number;
}

export function standings(s: MinesweeperState): MineStanding[] {
  const order = new Map(s.seats.map((se, i) => [se.id, i]));
  const sorted = [...s.seats].sort(
    (a, b) => b.score - a.score || order.get(a.id)! - order.get(b.id)!,
  );
  let rank = 0;
  let prev = NaN;
  return sorted.map((se, i) => {
    if (se.score !== prev) {
      rank = i + 1;
      prev = se.score;
    }
    return { ...se, rank };
  });
}

export const minesLeft = (s: MinesweeperState): number => minesLeftToFind(s);
export const isSolo = (s: MinesweeperState): boolean => s.seats.length === 1;
export const seatName = (s: MinesweeperState, id: string): string =>
  s.seats.find((se) => se.id === id)?.name ?? id;
