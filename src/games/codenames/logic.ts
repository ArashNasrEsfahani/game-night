// src/games/codenames/logic.ts — PURE logic. No clock/RNG/IO; seed via createInitialState / action payloads.
import type { GameConfig, GameStateBase, LocalizedString } from '../../sdk/types';
import { shuffle, int, deriveSeed } from '../../engine/rng';
import { mergedPool } from './content';
import type { WordEntry } from './content';
import { readOptions } from './config';
import type { CodenamesMode } from './config';

export type TeamId = 'teamA' | 'teamB';
export type CardRole = 'teamA' | 'teamB' | 'neutral' | 'assassin';

export type CodenamesPhase =
  | 'orientation'
  | 'spymasterHandoff'
  | 'clue'
  | 'guesserHandoff'
  | 'guessing'
  | 'turnEnd'
  | 'gameOver'
  | 'error';

export interface BoardCell {
  index: number;
  word: LocalizedString;
  wordId: string;
  role: CardRole;
  revealed: boolean;
}

export interface ClueRecord {
  team: TeamId;
  count: number;
  guessesAllowed: number;
  guessesMade: number;
}

export interface TeamMeta {
  name: string;
  spymasterId: string;
  memberIds: string[];
}

export type GuessOutcome = 'correct' | 'wrongTeam' | 'neutral' | 'assassin';
export type TurnEndReason = 'guessedWrong' | 'usedAllGuesses' | 'stopped' | 'timeUp' | null;

export interface CodenamesState extends GameStateBase {
  phase: CodenamesPhase;
  mode: CodenamesMode;
  turnSeconds: number;
  allowBonusGuess: boolean;
  board: BoardCell[];
  /** Quarter-turns (0–3) the first team rotated the random key before play. */
  orientation: number;
  startingTeam: TeamId;
  currentTeam: TeamId;
  remaining: Record<TeamId, number>;
  activeClue: ClueRecord | null;
  clueLog: ClueRecord[];
  lastReveal: { cellIndex: number; role: CardRole; outcome: GuessOutcome } | null;
  turnEndReason: TurnEndReason;
  winner: TeamId | null;
  loser: TeamId | null;
  winReason: 'clearedWords' | 'opponentHitAssassin' | null;
  teamMeta: Record<TeamId, TeamMeta>;
  playerNames: Record<string, string>;
  boardSerial: number;
  errorCode: 'BAD_TEAMS' | 'SMALL_POOL' | null;
}

export type CodenamesAction =
  | { type: 'CHOOSE_ORIENTATION'; rotation: number }
  | { type: 'REVEAL_KEY_TO_SPYMASTER' }
  | { type: 'GIVE_CLUE'; count: number }
  | { type: 'HANDOFF_TO_GUESSERS' }
  | { type: 'GUESS_CELL'; cellIndex: number }
  | { type: 'STOP_GUESSING' }
  | { type: 'TIMER_EXPIRED' }
  | { type: 'ADVANCE_TURN' };

const other = (t: TeamId): TeamId => (t === 'teamA' ? 'teamB' : 'teamA');

function keyComposition(start: TeamId): CardRole[] {
  return [
    ...Array<CardRole>(9).fill(start),
    ...Array<CardRole>(8).fill(other(start)),
    ...Array<CardRole>(7).fill('neutral'),
    'assassin',
  ];
}

const BOARD_N = 5;

/** Rotate a 25-length, row-major role grid clockwise by `k` quarter-turns. The WORDS never move
 *  (they're fixed on the table) — only the key (roles) rotates, exactly like turning a key card. */
export function rotateRoles(roles: CardRole[], k: number): CardRole[] {
  const turns = ((Math.round(k) % 4) + 4) % 4;
  let out = roles.slice();
  for (let t = 0; t < turns; t++) {
    const next: CardRole[] = new Array(BOARD_N * BOARD_N);
    for (let r = 0; r < BOARD_N; r++)
      for (let c = 0; c < BOARD_N; c++) next[r * BOARD_N + c] = out[(BOARD_N - 1 - c) * BOARD_N + r];
    out = next;
  }
  return out;
}

export function generateBoard(pool: WordEntry[], start: TeamId, seed: number): BoardCell[] {
  const words = shuffle(pool, seed).slice(0, 25);
  const roles = shuffle(keyComposition(start), deriveSeed(seed, 1));
  return words.map((w, i) => ({
    index: i,
    word: w.text,
    wordId: w.id,
    role: roles[i],
    revealed: false,
  }));
}

function teamName(raw: LocalizedString | string | undefined, lang: 'en' | 'fa', fallback: string): string {
  if (!raw) return fallback;
  if (typeof raw === 'string') return raw;
  return raw[lang] ?? raw.en ?? fallback;
}

export function createInitialState(config: GameConfig, seed: number): CodenamesState {
  const options = readOptions(config);
  const playerNames: Record<string, string> = {};
  config.players.forEach((p) => {
    playerNames[p.id] = p.name;
  });

  const teams = config.teams?.teams ?? [];
  const pool = mergedPool(options.packIds);
  const badTeams = teams.length !== 2 || teams.some((t) => t.memberIds.length < 2);
  const errorCode: CodenamesState['errorCode'] = badTeams
    ? 'BAD_TEAMS'
    : pool.length < 25
      ? 'SMALL_POOL'
      : null;

  const a = teams[0];
  const b = teams[1];
  const teamMeta: Record<TeamId, TeamMeta> = {
    teamA: {
      name: teamName(a?.name, config.lang, 'Red'),
      spymasterId: (a?.memberIds[0] as string) ?? '',
      memberIds: (a?.memberIds ?? []).map((id) => id as string),
    },
    teamB: {
      name: teamName(b?.name, config.lang, 'Blue'),
      spymasterId: (b?.memberIds[0] as string) ?? '',
      memberIds: (b?.memberIds ?? []).map((id) => id as string),
    },
  };

  const start: TeamId =
    options.startingTeam === 'random'
      ? int(0, 1, seed) === 0
        ? 'teamA'
        : 'teamB'
      : options.startingTeam;

  const board = errorCode ? [] : generateBoard(pool, start, seed);

  return {
    v: 2,
    phase: errorCode ? 'error' : options.chooseOrientation ? 'orientation' : 'spymasterHandoff',
    finished: false,
    mode: options.mode,
    turnSeconds: options.turnSeconds,
    allowBonusGuess: options.allowBonusGuess,
    board,
    orientation: 0,
    startingTeam: start,
    currentTeam: start,
    remaining: { teamA: start === 'teamA' ? 9 : 8, teamB: start === 'teamB' ? 9 : 8 },
    activeClue: null,
    clueLog: [],
    lastReveal: null,
    turnEndReason: null,
    winner: null,
    loser: null,
    winReason: null,
    teamMeta,
    playerNames,
    boardSerial: 0,
    errorCode,
  };
}

function applyGuess(s: CodenamesState, cellIndex: number): CodenamesState {
  const cell = s.board[cellIndex];
  if (!cell || cell.revealed || !s.activeClue) return s;

  const board = s.board.map((c) => (c.index === cellIndex ? { ...c, revealed: true } : c));
  const activeClue: ClueRecord = { ...s.activeClue, guessesMade: s.activeClue.guessesMade + 1 };
  const outcome: GuessOutcome =
    cell.role === s.currentTeam
      ? 'correct'
      : cell.role === 'assassin'
        ? 'assassin'
        : cell.role === 'neutral'
          ? 'neutral'
          : 'wrongTeam';

  const remaining = { ...s.remaining };
  if (cell.role === 'teamA' || cell.role === 'teamB') remaining[cell.role] -= 1;

  const base: CodenamesState = {
    ...s,
    board,
    activeClue,
    remaining,
    lastReveal: { cellIndex, role: cell.role, outcome },
  };

  if (outcome === 'assassin') {
    return {
      ...base,
      phase: 'gameOver',
      finished: true,
      loser: s.currentTeam,
      winner: other(s.currentTeam),
      winReason: 'opponentHitAssassin',
    };
  }
  if (outcome === 'correct') {
    if (remaining[s.currentTeam] === 0) {
      return { ...base, phase: 'gameOver', finished: true, winner: s.currentTeam, winReason: 'clearedWords' };
    }
    if (activeClue.guessesMade >= activeClue.guessesAllowed) {
      return { ...base, phase: 'turnEnd', turnEndReason: 'usedAllGuesses' };
    }
    return base; // keep guessing
  }
  // wrongTeam or neutral
  const owner: CardRole = cell.role;
  if ((owner === 'teamA' || owner === 'teamB') && remaining[owner] === 0) {
    return { ...base, phase: 'gameOver', finished: true, winner: owner, winReason: 'clearedWords' };
  }
  return { ...base, phase: 'turnEnd', turnEndReason: 'guessedWrong' };
}

export function reducer(state: CodenamesState, action: CodenamesAction): CodenamesState {
  const s = state;
  switch (action.type) {
    case 'CHOOSE_ORIENTATION': {
      if (s.phase !== 'orientation') return s;
      const turns = ((Math.round(action.rotation) % 4) + 4) % 4;
      const rotated = rotateRoles(s.board.map((c) => c.role), turns);
      const board = s.board.map((c, i) => ({ ...c, role: rotated[i] }));
      return { ...s, board, orientation: turns, phase: 'spymasterHandoff' };
    }
    case 'REVEAL_KEY_TO_SPYMASTER': {
      if (s.phase !== 'spymasterHandoff') return s;
      return { ...s, phase: 'clue' };
    }
    case 'GIVE_CLUE': {
      if (s.phase !== 'clue') return s;
      const max = s.remaining[s.currentTeam];
      const count = Math.min(Math.max(0, Math.round(action.count)), max);
      const guessesAllowed = count === 0 ? max : count + (s.allowBonusGuess ? 1 : 0);
      const clue: ClueRecord = { team: s.currentTeam, count, guessesAllowed, guessesMade: 0 };
      return { ...s, phase: 'guesserHandoff', activeClue: clue, clueLog: [...s.clueLog, clue] };
    }
    case 'HANDOFF_TO_GUESSERS': {
      if (s.phase !== 'guesserHandoff') return s;
      return { ...s, phase: 'guessing' };
    }
    case 'GUESS_CELL': {
      if (s.phase !== 'guessing') return s;
      return applyGuess(s, action.cellIndex);
    }
    case 'STOP_GUESSING': {
      if (s.phase !== 'guessing' || !s.activeClue || s.activeClue.guessesMade < 1) return s;
      return { ...s, phase: 'turnEnd', turnEndReason: 'stopped' };
    }
    case 'TIMER_EXPIRED': {
      if (s.phase !== 'guessing') return s;
      return { ...s, phase: 'turnEnd', turnEndReason: 'timeUp' };
    }
    case 'ADVANCE_TURN': {
      if (s.phase !== 'turnEnd') return s;
      return {
        ...s,
        phase: 'spymasterHandoff',
        currentTeam: other(s.currentTeam),
        activeClue: null,
        lastReveal: null,
        turnEndReason: null,
      };
    }
    default:
      return s;
  }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

export const currentSpymasterId = (s: CodenamesState): string =>
  s.teamMeta[s.currentTeam].spymasterId;
export const currentTeamName = (s: CodenamesState): string => s.teamMeta[s.currentTeam].name;
export const guessesLeft = (s: CodenamesState): number =>
  s.activeClue ? Math.max(0, s.activeClue.guessesAllowed - s.activeClue.guessesMade) : 0;
