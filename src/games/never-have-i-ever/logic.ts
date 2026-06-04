// src/games/never-have-i-ever/logic.ts — PURE logic. No clock/RNG/IO; seed arrives via createInitialState.
import type { GameConfig, GameStateBase } from '../../sdk/types';
import { shuffle } from '../../engine/rng';
import { getDeck } from './content';
import { readOptions } from './config';
import type { NhieOptions } from './config';

export type NhiePhase = 'statement' | 'answering' | 'reveal' | 'results' | 'error';

export interface PlayerRuntime {
  id: string;
  lives: number; // classic: starts at startingLives; points: 0 (unused)
  haveCount: number;
  eliminated: boolean;
  eliminatedAtRound?: number;
}

export interface RoundRecord {
  index: number;
  statementId: string;
  haveIds: string[];
  participantIds: string[];
}

export interface NhieState extends GameStateBase {
  phase: NhiePhase;
  options: NhieOptions;
  playerIds: string[];
  playerNames: Record<string, string>;
  drawOrder: string[];
  drawIndex: number;
  currentStatementId: string | null;
  players: PlayerRuntime[];
  answering: { queue: string[]; cursor: number; answers: Record<string, boolean> } | null;
  rounds: RoundRecord[];
  roundIndex: number;
  lastResult: {
    haveIds: string[];
    livesLost: Record<string, number>;
    newlyEliminated: string[];
  } | null;
  winnerIds: string[];
  errorCode: 'EMPTY_DECK' | 'NOT_ENOUGH_PLAYERS' | null;
}

export type NhieAction =
  | { type: 'START_ANSWERING' }
  | { type: 'ANSWER'; playerId: string; hasDone: boolean }
  | { type: 'PASS_TO_NEXT' }
  | { type: 'SET_HONOR_HAVES'; playerIds: string[] }
  | { type: 'RESOLVE_ROUND' }
  | { type: 'NEXT_STATEMENT' }
  | { type: 'SKIP_STATEMENT' }
  | { type: 'END_GAME' };

export function createInitialState(config: GameConfig, seed: number): NhieState {
  const options = readOptions(config);
  const playerIds = config.players.map((p) => p.id as string);
  const playerNames: Record<string, string> = {};
  config.players.forEach((p) => {
    playerNames[p.id] = p.name;
  });

  const pool = getDeck({ intensities: options.intensities });
  const shuffled = shuffle(
    pool.map((s) => s.id),
    seed,
  );
  const drawOrder = shuffled.slice(0, Math.min(options.deckSize, shuffled.length));

  const players: PlayerRuntime[] = playerIds.map((id) => ({
    id,
    lives: options.mode === 'classic' ? options.startingLives : 0,
    haveCount: 0,
    eliminated: false,
  }));

  const errorCode: NhieState['errorCode'] =
    playerIds.length < 3 ? 'NOT_ENOUGH_PLAYERS' : drawOrder.length === 0 ? 'EMPTY_DECK' : null;

  return {
    v: 1,
    phase: errorCode ? 'error' : 'statement',
    finished: false,
    options,
    playerIds,
    playerNames,
    drawOrder,
    drawIndex: 0,
    currentStatementId: drawOrder[0] ?? null,
    players,
    answering: null,
    rounds: [],
    roundIndex: 0,
    lastResult: null,
    winnerIds: [],
    errorCode,
  };
}

const aliveIds = (s: NhieState): string[] =>
  s.players.filter((p) => !p.eliminated).map((p) => p.id);

export function computeWinners(state: NhieState): string[] {
  const { players } = state;
  if (state.options.mode === 'points') {
    const min = Math.min(...players.map((p) => p.haveCount));
    return players.filter((p) => p.haveCount === min).map((p) => p.id);
  }
  // classic
  const alive = players.filter((p) => !p.eliminated);
  if (alive.length >= 1) {
    const maxLives = Math.max(...alive.map((p) => p.lives));
    const top = alive.filter((p) => p.lives === maxLives);
    const minHaves = Math.min(...top.map((p) => p.haveCount));
    return top.filter((p) => p.haveCount === minHaves).map((p) => p.id);
  }
  // everyone eliminated
  const maxRound = Math.max(...players.map((p) => p.eliminatedAtRound ?? -1));
  const latest = players.filter((p) => (p.eliminatedAtRound ?? -1) === maxRound);
  const minHaves = Math.min(...latest.map((p) => p.haveCount));
  return latest.filter((p) => p.haveCount === minHaves).map((p) => p.id);
}

export function rankPlayers(state: NhieState): PlayerRuntime[] {
  const players = [...state.players];
  if (state.options.mode === 'points') {
    return players.sort((a, b) => a.haveCount - b.haveCount);
  }
  return players.sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (!a.eliminated) return b.lives - a.lives || a.haveCount - b.haveCount;
    return (
      (b.eliminatedAtRound ?? -1) - (a.eliminatedAtRound ?? -1) || a.haveCount - b.haveCount
    );
  });
}

function applyGameOverIfAny(state: NhieState): NhieState {
  let over = false;
  if (state.options.mode === 'classic') {
    over = aliveIds(state).length <= 1;
  } else {
    over = state.roundIndex + 1 >= state.drawOrder.length;
  }
  if (!over) return state;
  return { ...state, finished: true, winnerIds: computeWinners(state) };
}

function advanceStatement(state: NhieState): NhieState {
  const drawIndex = state.drawIndex + 1;
  if (drawIndex >= state.drawOrder.length) {
    return {
      ...state,
      phase: 'results',
      finished: true,
      winnerIds: computeWinners(state),
    };
  }
  return {
    ...state,
    phase: 'statement',
    drawIndex,
    currentStatementId: state.drawOrder[drawIndex],
    answering: null,
    lastResult: null,
  };
}

export function reducer(state: NhieState, action: NhieAction): NhieState {
  const s = state;
  switch (action.type) {
    case 'START_ANSWERING': {
      if (s.phase !== 'statement') return s;
      const queue = s.options.revealMode === 'sequential' ? aliveIds(s) : [];
      return { ...s, phase: 'answering', answering: { queue, cursor: 0, answers: {} } };
    }
    case 'ANSWER': {
      if (s.phase !== 'answering' || !s.answering) return s;
      if (s.answering.queue[s.answering.cursor] !== action.playerId) return s;
      return {
        ...s,
        answering: {
          ...s.answering,
          answers: { ...s.answering.answers, [action.playerId]: action.hasDone },
        },
      };
    }
    case 'PASS_TO_NEXT': {
      if (s.phase !== 'answering' || !s.answering) return s;
      const cursor = Math.min(s.answering.cursor + 1, s.answering.queue.length);
      if (cursor === s.answering.cursor) return s;
      return { ...s, answering: { ...s.answering, cursor } };
    }
    case 'SET_HONOR_HAVES': {
      if (s.phase !== 'answering' || !s.answering) return s;
      const alive = new Set(aliveIds(s));
      const answers: Record<string, boolean> = {};
      action.playerIds.forEach((id) => {
        if (alive.has(id)) answers[id] = true;
      });
      return { ...s, answering: { ...s.answering, answers } };
    }
    case 'RESOLVE_ROUND': {
      if (s.phase !== 'answering' || !s.answering) return s;
      const answers = s.answering.answers;
      const haveIds = Object.keys(answers).filter((id) => answers[id] === true);
      const participantIds = aliveIds(s);
      const livesLost: Record<string, number> = {};
      const newlyEliminated: string[] = [];
      const players = s.players.map((p) => {
        if (!haveIds.includes(p.id) || p.eliminated) return p;
        const haveCount = p.haveCount + 1;
        if (s.options.mode === 'classic') {
          const lives = p.lives - 1;
          livesLost[p.id] = 1;
          const eliminated = lives <= 0;
          if (eliminated) newlyEliminated.push(p.id);
          return {
            ...p,
            haveCount,
            lives,
            eliminated,
            eliminatedAtRound: eliminated ? s.roundIndex : p.eliminatedAtRound,
          };
        }
        return { ...p, haveCount };
      });
      const round: RoundRecord = {
        index: s.roundIndex,
        statementId: s.currentStatementId ?? '',
        haveIds,
        participantIds,
      };
      const next: NhieState = {
        ...s,
        players,
        rounds: [...s.rounds, round],
        answering: null,
        lastResult: { haveIds, livesLost, newlyEliminated },
        phase: 'reveal',
      };
      return applyGameOverIfAny(next);
    }
    case 'NEXT_STATEMENT': {
      if (s.phase !== 'reveal') return s;
      if (s.finished) return { ...s, phase: 'results' };
      return { ...advanceStatement(s), roundIndex: s.roundIndex + 1 };
    }
    case 'SKIP_STATEMENT': {
      if (s.phase !== 'statement' && s.phase !== 'reveal') return s;
      return advanceStatement(s); // no roundIndex change
    }
    case 'END_GAME': {
      if (s.phase === 'results') return s;
      return { ...s, phase: 'results', finished: true, winnerIds: computeWinners(s) };
    }
    default:
      return s;
  }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

export const currentHolder = (s: NhieState): string | null =>
  s.answering && s.options.revealMode === 'sequential'
    ? (s.answering.queue[s.answering.cursor] ?? null)
    : null;
export const allAnswered = (s: NhieState): boolean =>
  !!s.answering && s.answering.cursor >= s.answering.queue.length;
export const honorHaveCount = (s: NhieState): number =>
  s.answering ? Object.values(s.answering.answers).filter(Boolean).length : 0;
