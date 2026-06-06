// src/games/minesweeper/logic.ts — PURE logic. No clock/RNG/IO; the mine-layout seed arrives in the
// first REVEAL action (first-click safety), keeping the reducer deterministic and side-effect free.
import type { ColorToken, GameConfig, GameStateBase } from '../../sdk/types';
import { shuffle } from '../../engine/rng';
import { readOptions } from './config';
import type { MinesweeperOptions } from './config';

export type MinePhase = 'playing' | 'gameOver';
export type WinReason = 'swept' | 'lastSurvivor' | 'soloWin' | 'soloLoss' | null;

export interface Cell {
  index: number;
  mine: boolean;
  adjacent: number; // 0..8 neighbouring mines (computed once mines are placed)
  revealed: boolean;
  flagged: boolean;
  revealedBy: string | null; // seat id, for tint + score attribution
  exploded: boolean; // a detonated mine renders as a boom, not a flag
}

export interface MineSeat {
  id: string;
  name: string;
  color?: ColorToken;
  score: number; // safe cells personally revealed
  lives: number;
  eliminated: boolean;
}

export interface MinesweeperState extends GameStateBase {
  phase: MinePhase;
  options: MinesweeperOptions;
  cols: number;
  rows: number;
  board: Cell[];
  minesPlaced: boolean; // false until the first reveal seeds the layout
  seats: MineSeat[];
  turnNo: number; // active seat = first non-eliminated at/after turnNo
  safeRemaining: number; // safe cells not yet revealed; 0 = swept
  flash: { type: 'boom' | 'safe' | 'win'; index?: number } | null;
  winnerIds: string[];
  winReason: WinReason;
  errorCode: 'BAD_BOARD' | null;
}

export type MinesweeperAction =
  | { type: 'REVEAL'; index: number; seed: number } // seed only consumed on the first reveal
  | { type: 'FLAG'; index: number }
  | { type: 'CHORD'; index: number }
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

/** Place `mines` mines avoiding the first click's 3×3, then compute every cell's adjacency. Pure. */
function placeMines(
  board: Cell[],
  cols: number,
  rows: number,
  mines: number,
  firstIndex: number,
  seed: number,
): Cell[] {
  const n = cols * rows;
  const forbidden = new Set<number>([firstIndex, ...neighbors(firstIndex, cols, rows)]);
  const candidates: number[] = [];
  for (let i = 0; i < n; i++) if (!forbidden.has(i)) candidates.push(i);
  const mineIdx = new Set(shuffle(candidates, seed).slice(0, mines));
  return board.map((cell) => {
    const mine = mineIdx.has(cell.index);
    const adjacent = mine
      ? 0
      : neighbors(cell.index, cols, rows).filter((j) => mineIdx.has(j)).length;
    return { ...cell, mine, adjacent };
  });
}

/** Flood-reveal from a safe cell: opens the connected zero-region + its numbered border. Returns a
 *  NEW board and the count of newly-revealed safe cells (for scoring + safeRemaining). */
function floodReveal(
  board: Cell[],
  start: number,
  cols: number,
  rows: number,
  seatId: string,
): { board: Cell[]; count: number } {
  const b = board.map((c) => ({ ...c }));
  let count = 0;
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    const cell = b[i];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    cell.revealedBy = seatId;
    count++;
    if (cell.adjacent === 0) {
      for (const j of neighbors(i, cols, rows)) {
        if (!b[j].revealed && !b[j].flagged) stack.push(j);
      }
    }
  }
  return { board: b, count };
}

const activeSeatIndex = (seats: MineSeat[], turnNo: number): number => {
  const n = seats.length;
  let idx = ((turnNo % n) + n) % n;
  for (let k = 0; k < n; k++) {
    if (!seats[idx].eliminated) return idx;
    idx = (idx + 1) % n;
  }
  return idx;
};

const nextTurn = (seats: MineSeat[], turnNo: number): number => {
  const n = seats.length;
  for (let t = turnNo + 1; t <= turnNo + n; t++) {
    const idx = ((t % n) + n) % n;
    if (!seats[idx].eliminated) return t;
  }
  return turnNo;
};

export const activeSeat = (s: MinesweeperState): MineSeat =>
  s.seats[activeSeatIndex(s.seats, s.turnNo)];

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
    lives: options.lives,
    eliminated: false,
  }));

  const board: Cell[] = Array.from({ length: n }, (_, index) => ({
    index,
    mine: false,
    adjacent: 0,
    revealed: false,
    flagged: false,
    revealedBy: null,
    exploded: false,
  }));

  const errorCode: MinesweeperState['errorCode'] =
    seats.length < 1 || seats.length > 4 || n < 16 || mines > n - 9 || mines < 1 ? 'BAD_BOARD' : null;

  return {
    v: 1,
    phase: errorCode ? 'gameOver' : 'playing',
    finished: false,
    options,
    cols,
    rows,
    board,
    minesPlaced: false,
    seats,
    turnNo: 0,
    safeRemaining: n - mines,
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

/** Decide whether the just-applied move ends the game; otherwise pass the turn. */
function concludeTurn(s: MinesweeperState): MinesweeperState {
  const solo = s.seats.length === 1;
  if (solo) {
    const seat = s.seats[0];
    if (s.safeRemaining === 0) return finish(s, 'soloWin', [seat.id]);
    if (seat.eliminated) return finish(s, 'soloLoss', []);
    return { ...s, turnNo: nextTurn(s.seats, s.turnNo) };
  }
  if (s.safeRemaining === 0) return finish(s, 'swept', winnersByScore(s.seats));
  const alive = s.seats.filter((se) => !se.eliminated);
  if (alive.length <= 1) {
    return finish(s, 'lastSurvivor', alive.length === 1 ? [alive[0].id] : winnersByScore(s.seats));
  }
  return { ...s, turnNo: nextTurn(s.seats, s.turnNo) };
}

/** Highest score wins; ties broken by fewest lives lost, then shared. */
function winnersByScore(seats: MineSeat[]): string[] {
  const best = Math.max(...seats.map((s) => s.score));
  const top = seats.filter((s) => s.score === best);
  const fewestLost = Math.min(...top.map((s) => s.eliminated ? 1 : 0));
  const winners = top.filter((s) => (s.eliminated ? 1 : 0) === fewestLost);
  return (winners.length ? winners : top).map((s) => s.id);
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
        board = placeMines(s.board, s.cols, s.rows, s.options.mines, action.index, action.seed);
        base = { ...s, board, minesPlaced: true };
      }
      const cell = board[action.index];
      if (!cell || cell.revealed || cell.flagged) return s; // illegal → no-op (same ref)
      const ai = activeSeatIndex(base.seats, base.turnNo);
      const seatId = base.seats[ai].id;

      if (cell.mine) {
        const nextBoard = board.map((c) =>
          c.index === action.index ? { ...c, revealed: true, exploded: true, revealedBy: seatId } : c,
        );
        const seats = base.seats.map((se, i) =>
          i === ai ? { ...se, lives: se.lives - 1, eliminated: se.lives - 1 <= 0 } : se,
        );
        return concludeTurn({
          ...base,
          board: nextBoard,
          seats,
          flash: { type: 'boom', index: action.index },
        });
      }

      const { board: fb, count } = floodReveal(board, action.index, s.cols, s.rows, seatId);
      const seats = base.seats.map((se, i) => (i === ai ? { ...se, score: se.score + count } : se));
      return concludeTurn({
        ...base,
        board: fb,
        seats,
        safeRemaining: base.safeRemaining - count,
        flash: { type: 'safe', index: action.index },
      });
    }

    case 'FLAG': {
      if (s.phase !== 'playing') return s;
      const cell = s.board[action.index];
      if (!cell || cell.revealed) return s;
      const board = s.board.map((c) => (c.index === action.index ? { ...c, flagged: !c.flagged } : c));
      return { ...s, board };
    }

    case 'CHORD': {
      if (s.phase !== 'playing' || !s.minesPlaced) return s;
      const cell = s.board[action.index];
      if (!cell || !cell.revealed || cell.mine || cell.adjacent === 0) return s;
      const nbs = neighbors(action.index, s.cols, s.rows);
      const flags = nbs.filter((j) => s.board[j].flagged).length;
      if (flags !== cell.adjacent) return s;
      const targets = nbs.filter((j) => !s.board[j].flagged && !s.board[j].revealed);
      if (targets.length === 0) return s;

      const ai = activeSeatIndex(s.seats, s.turnNo);
      const seatId = s.seats[ai].id;
      let board = s.board;
      let seats = s.seats;
      let safeRemaining = s.safeRemaining;
      let boom = false;
      for (const j of targets) {
        const c = board[j];
        if (c.revealed || c.flagged) continue;
        if (c.mine) {
          board = board.map((x) =>
            x.index === j ? { ...x, revealed: true, exploded: true, revealedBy: seatId } : x,
          );
          seats = seats.map((se, i) =>
            i === ai ? { ...se, lives: se.lives - 1, eliminated: se.lives - 1 <= 0 } : se,
          );
          boom = true;
        } else {
          const { board: fb, count } = floodReveal(board, j, s.cols, s.rows, seatId);
          board = fb;
          safeRemaining -= count;
          seats = seats.map((se, i) => (i === ai ? { ...se, score: se.score + count } : se));
        }
      }
      return concludeTurn({
        ...s,
        board,
        seats,
        safeRemaining,
        flash: { type: boom ? 'boom' : 'safe', index: action.index },
      });
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

export const flagsPlaced = (s: MinesweeperState): number => s.board.filter((c) => c.flagged).length;
export const minesLeft = (s: MinesweeperState): number => s.options.mines - flagsPlaced(s);
export const isSolo = (s: MinesweeperState): boolean => s.seats.length === 1;
export const seatName = (s: MinesweeperState, id: string): string =>
  s.seats.find((se) => se.id === id)?.name ?? id;
