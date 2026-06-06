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
  adjacent: number; // 1..8 neighbouring mines (every safe cell borders at least one)
  revealed: boolean;
  revealedBy: string | null; // seat id, for tint + score attribution
  /** A rare "burst" square: tapping it opens a small cluster of safe squares at once. */
  burst: boolean;
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
 *  GUARANTEE every safe square borders at least one mine — no 0-clue squares — by greedily adding a
 *  few covering mines where needed. Pure & deterministic for a given seed (so the actual mine count
 *  may end up a little above the requested one). */
function placeMines(board: Cell[], cols: number, rows: number, mines: number, seed: number): Cell[] {
  const n = cols * rows;
  const order = shuffle(Array.from({ length: n }, (_, i) => i), seed);
  const mineSet = new Set<number>(order.slice(0, Math.max(1, Math.min(mines, n - 1))));
  const covered = (i: number) => mineSet.has(i) || neighbors(i, cols, rows).some((j) => mineSet.has(j));
  for (const i of order) {
    if (covered(i)) continue;
    // Place a mine on the spot (self or a neighbour) that newly covers the most squares.
    const candidates = [i, ...neighbors(i, cols, rows)].filter((j) => !mineSet.has(j));
    let best = candidates[0];
    let bestGain = -1;
    for (const cand of candidates) {
      const gain = [cand, ...neighbors(cand, cols, rows)].filter((k) => !covered(k)).length;
      if (gain > bestGain) {
        bestGain = gain;
        best = cand;
      }
    }
    mineSet.add(best);
  }
  // Pick a few (not many) safe squares to be "burst" tiles that open a cluster when tapped.
  const safe = order.filter((i) => !mineSet.has(i));
  const burstCount = Math.min(safe.length, Math.max(1, Math.round(n / 30)));
  const burstSet = new Set(safe.slice(0, burstCount));
  return board.map((cell) => {
    const mine = mineSet.has(cell.index);
    const adjacent = mine ? 0 : neighbors(cell.index, cols, rows).filter((j) => mineSet.has(j)).length;
    return { ...cell, mine, adjacent, burst: !mine && burstSet.has(cell.index) };
  });
}

/** Reveal a bounded cluster of safe squares around a burst tile (flood through safe cells, stopping
 *  at mines, capped so it opens "a bunch" without clearing the whole board). */
function revealBurst(board: Cell[], start: number, cols: number, rows: number, seatId: string): Cell[] {
  const CAP = 10;
  const b = board.map((c) => ({ ...c }));
  const queue = [start];
  const seen = new Set<number>([start]);
  let opened = 0;
  while (queue.length && opened < CAP) {
    const i = queue.shift()!;
    const cell = b[i];
    if (cell.mine || cell.revealed) continue;
    cell.revealed = true;
    cell.revealedBy = seatId;
    opened++;
    for (const j of neighbors(i, cols, rows)) {
      if (!seen.has(j) && !b[j].mine && !b[j].revealed) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return b;
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

// Distinct, vivid colours so each player's turn (background) and found mines read as their own.
const SEAT_PALETTE: ColorToken[] = ['rose', 'sky', 'lime', 'grape'];

export function createInitialState(config: GameConfig, _seed: number): MinesweeperState {
  const options = readOptions(config);
  const { cols, rows, mines } = options;
  const n = cols * rows;

  const seats: MineSeat[] = config.players.map((p, i) => ({
    id: p.id as string,
    name: p.name,
    color: p.color ?? SEAT_PALETTE[i % SEAT_PALETTE.length],
    score: 0,
  }));

  const board: Cell[] = Array.from({ length: n }, (_, index) => ({
    index,
    mine: false,
    adjacent: 0,
    revealed: false,
    revealedBy: null,
    burst: false,
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

// Actual mines may exceed the requested count (coverage fill), so count from the board once placed.
const minesLeftToFind = (s: MinesweeperState): number =>
  (s.minesPlaced ? s.board.filter((c) => c.mine).length : s.options.mines) - foundCount(s.board);

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

      if (cell.mine) {
        const nextBoard = board.map((c) =>
          c.index === action.index ? { ...c, revealed: true, revealedBy: seatId } : c,
        );
        const seats = base.seats.map((se, i) => (i === ai ? { ...se, score: se.score + 1 } : se));
        return afterPick({ ...base, board: nextBoard, seats, flash: { type: 'found', index: action.index } }, true);
      }
      // Safe square: a burst tile opens a cluster, an ordinary tile opens just itself. Either way it
      // reveals only safe squares (mines stay hidden) and passes the turn.
      const nextBoard = cell.burst
        ? revealBurst(board, action.index, base.cols, base.rows, seatId)
        : board.map((c) => (c.index === action.index ? { ...c, revealed: true, revealedBy: seatId } : c));
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
