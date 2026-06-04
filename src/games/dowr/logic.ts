// src/games/dowr/logic.ts — PURE game logic for Dowr. No clock/RNG/IO; seeds/now arrive in payloads.
import type { ColorToken, GameConfig, GameStateBase, PlayerId } from '../../sdk/types';
import type { DeckState } from '../../engine/deck';
import type { ScoreState } from '../../engine/scoring';
import type { TurnOrderState } from '../../engine/turnOrder';
import type { RevealGateState } from '../../engine/revealGate';
import type { TimerState } from '../../engine/timer';
import * as deck from '../../engine/deck';
import * as scoring from '../../engine/scoring';
import * as turnOrder from '../../engine/turnOrder';
import * as revealGate from '../../engine/revealGate';
import * as timer from '../../engine/timer';
import * as phaseMachine from '../../engine/phaseMachine';
import * as results from '../../engine/results';
import { asPlayerId } from '../../engine/ids';
import { buildPool } from './deck';
import { readOptions } from './config';
import type { DowrOptions } from './config';

export type DowrPhase =
  | 'roundIntro'
  | 'reveal'
  | 'describing'
  | 'turnSummary'
  | 'gameOver'
  | 'error';

export type TurnEndReason = 'timeExpired' | 'deckExhausted' | 'manualEnd';

export interface TurnEvent {
  cardId: string;
  result: 'correct' | 'skip';
}

export interface TurnRecord {
  turnIndex: number;
  round: number;
  describerSeat: number;
  describerPlayerId: string;
  scorerId: string;
  correct: number;
  skipped: number;
  delta: number;
  endReason: TurnEndReason;
}

export interface DowrState extends GameStateBase {
  phase: DowrPhase;
  options: DowrOptions;
  seatCount: number;
  playerIds: string[];
  playerNames: Record<string, string>;
  /** seat index → scorerId (teamId in teams mode, playerId in solo mode). */
  seatToScorer: string[];
  scorerIds: string[];
  scorerLabels: Record<string, string>;
  scorerColors: Record<string, ColorToken | undefined>;
  deck: DeckState<string>;
  turn: TurnOrderState;
  gate: RevealGateState;
  clock: TimerState;
  currentCardId: string | null;
  turnCorrect: number;
  turnSkipped: number;
  turnEvents: TurnEvent[];
  lastTurnEndReason: TurnEndReason | null;
  history: TurnRecord[];
  score: ScoreState;
  errorCode: 'EMPTY_DECK' | null;
}

export type DowrAction =
  | { type: 'BEGIN_TURN' }
  | { type: 'REVEAL' }
  | { type: 'START_DESCRIBE'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'CORRECT' }
  | { type: 'SKIP' }
  | { type: 'END_TURN_EARLY'; now: number }
  | { type: 'NEXT_TURN'; seed: number }
  | { type: 'RESET' };

const MACHINE = phaseMachine.defineMachine<DowrPhase>({
  initial: 'roundIntro',
  nodes: {
    roundIntro: { id: 'roundIntro', to: ['reveal', 'error'] },
    reveal: { id: 'reveal', to: ['describing', 'turnSummary'] },
    describing: { id: 'describing', to: ['turnSummary'] },
    turnSummary: { id: 'turnSummary', to: ['roundIntro', 'gameOver'] },
    gameOver: { id: 'gameOver', to: [], terminal: true },
    error: { id: 'error', to: [], terminal: true },
  },
});

const TEAM_COLORS: ColorToken[] = ['rose', 'sky', 'lime', 'gold', 'violet'];

function drawNext(d: DeckState<string>): { deck: DeckState<string>; cardId: string | null } {
  if (deck.remaining(d) <= 0) return { deck: d, cardId: null };
  const r = deck.draw(d, 1, 0);
  return { deck: r.deck, cardId: r.drawn[0] ?? null };
}

function finalizeTurn(s: DowrState, reason: TurnEndReason, now: number): DowrState {
  const seat = s.turn.index;
  const scorerId = s.seatToScorer[seat];
  const delta = s.turnCorrect - (s.options.skipPenalty ? s.turnSkipped : 0);
  const record: TurnRecord = {
    turnIndex: s.history.length,
    round: s.turn.round + 1,
    describerSeat: seat,
    describerPlayerId: s.playerIds[seat],
    scorerId,
    correct: s.turnCorrect,
    skipped: s.turnSkipped,
    delta,
    endReason: reason,
  };
  return {
    ...s,
    phase: 'turnSummary',
    currentCardId: null,
    lastTurnEndReason: reason,
    history: [...s.history, record],
    score: scoring.add(s.score, scorerId, delta, reason, now),
    clock: timer.pause(s.clock, now),
  };
}

export function createInitialState(config: GameConfig, seed: number): DowrState {
  const options = readOptions(config);
  const players = config.players;
  const seatCount = players.length;
  const playerIds = players.map((p) => p.id as string);
  const playerNames: Record<string, string> = {};
  players.forEach((p) => {
    playerNames[p.id] = p.name;
  });

  const teamsMode = options.mode === 'teams';
  const teamList = teamsMode ? (config.teams?.teams ?? []) : [];

  const seatToScorer = players.map((p) => {
    if (teamsMode) {
      const team = teamList.find((t) => t.memberIds.includes(p.id));
      return team ? (team.id as string) : (p.id as string);
    }
    return p.id as string;
  });

  const scorerIds = teamsMode ? teamList.map((t) => t.id as string) : playerIds;
  const scorerLabels: Record<string, string> = {};
  const scorerColors: Record<string, ColorToken | undefined> = {};
  if (teamsMode) {
    teamList.forEach((t, i) => {
      const nm =
        typeof t.name === 'string'
          ? t.name
          : t.name
            ? (t.name[config.lang] ?? t.name.en)
            : `Team ${i + 1}`;
      scorerLabels[t.id] = nm;
      scorerColors[t.id] = TEAM_COLORS[i % TEAM_COLORS.length];
    });
  } else {
    players.forEach((p) => {
      scorerLabels[p.id] = p.name;
      scorerColors[p.id] = p.color;
    });
  }

  const pool = buildPool(options);
  const deckState = deck.create(
    pool.map((c) => c.id),
    seed,
  );
  const turn = turnOrder.init(playerIds as unknown as PlayerId[], 'circular', seed);
  const empty = pool.length === 0 || seatCount < 1;

  return {
    v: 1,
    phase: empty ? 'error' : 'roundIntro',
    finished: false,
    options,
    seatCount,
    playerIds,
    playerNames,
    seatToScorer,
    scorerIds,
    scorerLabels,
    scorerColors,
    deck: deckState,
    turn,
    gate: revealGate.init([]),
    clock: timer.create('countdown', options.timerSeconds * 1000),
    currentCardId: null,
    turnCorrect: 0,
    turnSkipped: 0,
    turnEvents: [],
    lastTurnEndReason: null,
    history: [],
    score: scoring.create(scorerIds),
    errorCode: pool.length === 0 ? 'EMPTY_DECK' : null,
  };
}

export function reducer(state: DowrState, action: DowrAction): DowrState {
  const s = state;
  switch (action.type) {
    case 'BEGIN_TURN': {
      if (s.phase !== 'roundIntro') return s;
      const describerId = s.playerIds[s.turn.index];
      const base: DowrState = {
        ...s,
        turnCorrect: 0,
        turnSkipped: 0,
        turnEvents: [],
        lastTurnEndReason: null,
        gate: revealGate.init([asPlayerId(describerId)]),
        clock: timer.create('countdown', s.options.timerSeconds * 1000),
      };
      const { deck: d, cardId } = drawNext(base.deck);
      if (cardId === null) {
        return finalizeTurn({ ...base, currentCardId: null }, 'deckExhausted', 0);
      }
      return {
        ...base,
        deck: d,
        currentCardId: cardId,
        phase: phaseMachine.go(MACHINE, s.phase, 'reveal'),
      };
    }
    case 'REVEAL': {
      if (s.phase !== 'reveal') return s;
      return { ...s, gate: revealGate.reveal(s.gate) };
    }
    case 'START_DESCRIBE': {
      if (s.phase !== 'reveal') return s;
      return {
        ...s,
        phase: phaseMachine.go(MACHINE, s.phase, 'describing'),
        clock: timer.start(
          timer.create('countdown', s.options.timerSeconds * 1000),
          action.now,
        ),
      };
    }
    case 'TICK': {
      if (s.phase !== 'describing') return s;
      const clock = timer.tick(s.clock, action.now);
      if (timer.isExpired(clock, action.now)) {
        return finalizeTurn({ ...s, clock }, 'timeExpired', action.now);
      }
      return { ...s, clock };
    }
    case 'CORRECT': {
      if (s.phase !== 'describing' || s.currentCardId === null) return s;
      const turnEvents: TurnEvent[] = [
        ...s.turnEvents,
        { cardId: s.currentCardId, result: 'correct' },
      ];
      const turnCorrect = s.turnCorrect + 1;
      const { deck: d, cardId } = drawNext(s.deck);
      if (cardId === null) {
        return finalizeTurn(
          { ...s, turnCorrect, turnEvents, deck: d, currentCardId: null },
          'deckExhausted',
          0,
        );
      }
      return { ...s, turnCorrect, turnEvents, deck: d, currentCardId: cardId };
    }
    case 'SKIP': {
      if (s.phase !== 'describing' || s.currentCardId === null) return s;
      const turnEvents: TurnEvent[] = [
        ...s.turnEvents,
        { cardId: s.currentCardId, result: 'skip' },
      ];
      const turnSkipped = s.turnSkipped + 1;
      const { deck: d, cardId } = drawNext(s.deck);
      if (cardId === null) {
        return finalizeTurn(
          { ...s, turnSkipped, turnEvents, deck: d, currentCardId: null },
          'deckExhausted',
          0,
        );
      }
      return { ...s, turnSkipped, turnEvents, deck: d, currentCardId: cardId };
    }
    case 'END_TURN_EARLY': {
      if (s.phase !== 'describing') return s;
      return finalizeTurn(s, 'manualEnd', action.now);
    }
    case 'NEXT_TURN': {
      if (s.phase !== 'turnSummary') return s;
      const turn = turnOrder.next(s.turn, action.seed);
      if (turn.round >= s.options.rounds) {
        return { ...s, turn, phase: 'gameOver', finished: true };
      }
      return {
        ...s,
        turn,
        phase: 'roundIntro',
        currentCardId: null,
        turnCorrect: 0,
        turnSkipped: 0,
        turnEvents: [],
        lastTurnEndReason: null,
      };
    }
    case 'RESET':
      return s; // no-op; "play again" is host-driven (re-creates with a fresh seed)
    default:
      return s;
  }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

export const describerSeat = (s: DowrState): number => s.turn.index;
export const describerPlayerId = (s: DowrState): string => s.playerIds[s.turn.index];
export const currentRound = (s: DowrState): number => s.turn.round + 1;
export const totalTurns = (s: DowrState): number => s.options.rounds * s.seatCount;
export const isLastTurn = (s: DowrState): boolean =>
  s.turn.round === s.options.rounds - 1 && s.turn.index === s.seatCount - 1;
export const selectStandings = (s: DowrState) => results.fromScores(s.score).standings;
export const selectWinners = (s: DowrState): string[] => results.fromScores(s.score).winners;
export const selectResult = (s: DowrState) => results.fromScores(s.score);
