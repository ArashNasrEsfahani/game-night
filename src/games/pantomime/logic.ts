// src/games/pantomime/logic.ts — PURE game logic for Pantomime. No clock/RNG/IO; now/seed arrive in payloads.
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
import type { PantomimeOptions } from './config';

export type PantomimePhase =
  | 'handoff' // "Pass the phone to <Actor> of <Team>"
  | 'reveal' // gate closed: actor taps to privately read the prompt
  | 'acting' // prompt revealed, timer running, team guessing
  | 'turnEnd' // turn over: show turn summary
  | 'results' // game over
  | 'error'; // bad config / empty pool (never reachable from a valid Setup)

export type TurnEndReason = 'timeExpired' | 'deckExhausted' | 'manualEnd';

export interface TurnEvent {
  promptId: string;
  result: 'correct' | 'skip';
}

export interface PantomimeTeamState {
  teamId: string;
  name: string;
  color?: ColorToken;
  playerIds: string[];
  /** Index into playerIds of who acts on this team's NEXT turn. */
  actorCursor: number;
  correctCount: number;
  skipCount: number;
}

export interface PantomimeTurnRecord {
  turnIndex: number; // global, 0-based
  roundIndex: number; // 0-based
  teamId: string;
  actorId: string;
  correct: number;
  skipped: number;
  endReason: TurnEndReason;
  promptIds: string[]; // resolved this turn (correct + skipped)
}

export interface PantomimeState extends GameStateBase {
  phase: PantomimePhase;
  options: PantomimeOptions;
  playerNames: Record<string, string>;
  /** Teams in fixed turn order. */
  teams: PantomimeTeamState[];
  /** Turn order over teamIds (index = active team, round = completed cycles). */
  turn: TurnOrderState;
  deck: DeckState<string>;
  currentPromptId: string | null;
  gate: RevealGateState;
  clock: TimerState;
  turnCorrect: number;
  turnSkipped: number;
  turnEvents: TurnEvent[];
  lastTurnEndReason: TurnEndReason | null;
  history: PantomimeTurnRecord[];
  score: ScoreState; // keyed by teamId
  /** Set when a target-score end condition fires; the round still finishes (fairness). */
  endRequested: boolean;
  winnerTeamIds: string[];
  errorCode: 'EMPTY_DECK' | 'BAD_TEAMS' | null;
}

export type PantomimeAction =
  | { type: 'HANDOFF_READY' }
  | { type: 'REVEAL' }
  | { type: 'START_ACTING'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'CORRECT' }
  | { type: 'SKIP' }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'END_TURN_EARLY'; now: number }
  | { type: 'NEXT_TURN'; seed: number }
  | { type: 'RESET' };

const MACHINE = phaseMachine.defineMachine<PantomimePhase>({
  initial: 'handoff',
  nodes: {
    handoff: { id: 'handoff', to: ['reveal', 'turnEnd'] },
    reveal: { id: 'reveal', to: ['acting', 'turnEnd'] },
    acting: { id: 'acting', to: ['turnEnd'] },
    turnEnd: { id: 'turnEnd', to: ['handoff', 'results'] },
    results: { id: 'results', to: [], terminal: true },
    error: { id: 'error', to: [], terminal: true },
  },
});

const TEAM_COLORS: ColorToken[] = ['rose', 'sky', 'lime', 'gold'];

/** Seed used for in-game deck reshuffles. Deterministic (initial shuffle uses the host seed). */
const DRAW_SEED = 0;

function drawNext(d: DeckState<string>): { deck: DeckState<string>; promptId: string | null } {
  const r = deck.draw(d, 1, DRAW_SEED);
  return { deck: r.deck, promptId: r.drawn[0] ?? null };
}

function updateTeam(
  teams: PantomimeTeamState[],
  index: number,
  patch: (t: PantomimeTeamState) => PantomimeTeamState,
): PantomimeTeamState[] {
  return teams.map((t, i) => (i === index ? patch(t) : t));
}

export const activeTeam = (s: PantomimeState): PantomimeTeamState => s.teams[s.turn.index];
export const actorId = (s: PantomimeState): string => {
  const team = s.teams[s.turn.index];
  return team ? team.playerIds[team.actorCursor] : '';
};
export const actorName = (s: PantomimeState): string => s.playerNames[actorId(s)] ?? '';

function finalizeTurn(s: PantomimeState, reason: TurnEndReason, now: number): PantomimeState {
  const team = s.teams[s.turn.index];
  // Return any unresolved current prompt to the draw pile (not counted, not lost).
  let d = s.deck;
  if (s.currentPromptId !== null) {
    d = { ...s.deck, drawPile: [...s.deck.drawPile, s.currentPromptId] };
  }
  const record: PantomimeTurnRecord = {
    turnIndex: s.history.length,
    roundIndex: s.turn.round,
    teamId: team.teamId,
    actorId: team.playerIds[team.actorCursor],
    correct: s.turnCorrect,
    skipped: s.turnSkipped,
    endReason: reason,
    promptIds: s.turnEvents.map((e) => e.promptId),
  };
  return {
    ...s,
    phase: 'turnEnd',
    deck: d,
    currentPromptId: null,
    lastTurnEndReason: reason,
    history: [...s.history, record],
    clock: timer.pause(s.clock, now),
  };
}

export function createInitialState(config: GameConfig, seed: number): PantomimeState {
  const options = readOptions(config);
  const players = config.players;
  const playerNames: Record<string, string> = {};
  players.forEach((p) => {
    playerNames[p.id] = p.name;
  });

  const teamList = config.teams?.teams ?? [];
  const teams: PantomimeTeamState[] = teamList.map((t, i) => ({
    teamId: t.id as string,
    name:
      typeof t.name === 'string'
        ? t.name
        : t.name
          ? (t.name[config.lang] ?? t.name.en)
          : `Team ${i + 1}`,
    color: TEAM_COLORS[i % TEAM_COLORS.length],
    playerIds: t.memberIds.map((id) => id as string),
    actorCursor: 0,
    correctCount: 0,
    skipCount: 0,
  }));

  const pool = buildPool(options);
  const deckState = deck.create(
    pool.map((p) => p.id),
    seed,
  );
  const teamIds = teams.map((t) => t.teamId);
  const turn = turnOrder.init(teamIds as unknown as PlayerId[], 'circular', seed);

  const badTeams = teams.length < 2 || teams.some((t) => t.playerIds.length < 2);
  const empty = pool.length === 0;
  const errorCode: PantomimeState['errorCode'] = badTeams
    ? 'BAD_TEAMS'
    : empty
      ? 'EMPTY_DECK'
      : null;

  return {
    v: 1,
    phase: errorCode ? 'error' : 'handoff',
    finished: false,
    options,
    playerNames,
    teams,
    turn,
    deck: deckState,
    currentPromptId: null,
    gate: revealGate.init([]),
    clock: timer.create('countdown', options.roundSeconds * 1000),
    turnCorrect: 0,
    turnSkipped: 0,
    turnEvents: [],
    lastTurnEndReason: null,
    history: [],
    score: scoring.create(teamIds),
    endRequested: false,
    winnerTeamIds: [],
    errorCode,
  };
}

export function reducer(state: PantomimeState, action: PantomimeAction): PantomimeState {
  const s = state;
  switch (action.type) {
    case 'HANDOFF_READY': {
      if (s.phase !== 'handoff') return s;
      const base: PantomimeState = {
        ...s,
        turnCorrect: 0,
        turnSkipped: 0,
        turnEvents: [],
        lastTurnEndReason: null,
        gate: revealGate.init([asPlayerId(actorId(s))]),
        clock: timer.create('countdown', s.options.roundSeconds * 1000),
      };
      const { deck: d, promptId } = drawNext(base.deck);
      if (promptId === null) {
        return finalizeTurn({ ...base, currentPromptId: null }, 'deckExhausted', 0);
      }
      return {
        ...base,
        deck: d,
        currentPromptId: promptId,
        phase: phaseMachine.go(MACHINE, s.phase, 'reveal'),
      };
    }
    case 'REVEAL': {
      if (s.phase !== 'reveal') return s;
      return { ...s, gate: revealGate.reveal(s.gate) };
    }
    case 'START_ACTING': {
      if (s.phase !== 'reveal') return s;
      return {
        ...s,
        phase: phaseMachine.go(MACHINE, s.phase, 'acting'),
        clock: timer.start(
          timer.create('countdown', s.options.roundSeconds * 1000),
          action.now,
        ),
      };
    }
    case 'TICK': {
      if (s.phase !== 'acting') return s;
      const clock = timer.tick(s.clock, action.now);
      if (timer.isExpired(clock, action.now)) {
        return finalizeTurn({ ...s, clock }, 'timeExpired', action.now);
      }
      return clock === s.clock ? s : { ...s, clock };
    }
    case 'CORRECT': {
      if (s.phase !== 'acting' || s.currentPromptId === null) return s;
      const teamIdx = s.turn.index;
      const teamId = s.teams[teamIdx].teamId;
      const turnEvents: TurnEvent[] = [
        ...s.turnEvents,
        { promptId: s.currentPromptId, result: 'correct' },
      ];
      const teams = updateTeam(s.teams, teamIdx, (t) => ({
        ...t,
        correctCount: t.correctCount + 1,
      }));
      const score = scoring.add(s.score, teamId, 1, 'correct', 0);
      const endRequested =
        s.endRequested ||
        (s.options.endMode === 'targetScore' &&
          scoring.total(score, teamId) >= s.options.targetScore);
      const discarded = deck.discard(s.deck, s.currentPromptId);
      const { deck: d, promptId } = drawNext(discarded);
      const next: PantomimeState = {
        ...s,
        teams,
        score,
        endRequested,
        turnCorrect: s.turnCorrect + 1,
        turnEvents,
      };
      if (promptId === null) {
        return finalizeTurn({ ...next, deck: d, currentPromptId: null }, 'deckExhausted', 0);
      }
      return { ...next, deck: d, currentPromptId: promptId };
    }
    case 'SKIP': {
      if (s.phase !== 'acting' || s.currentPromptId === null) return s;
      // Skip-cap guard: no-op once the cap is reached (unless unlimited).
      if (s.options.maxSkipsPerTurn !== -1 && s.turnSkipped >= s.options.maxSkipsPerTurn) {
        return s;
      }
      const teamIdx = s.turn.index;
      const teamId = s.teams[teamIdx].teamId;
      const turnEvents: TurnEvent[] = [
        ...s.turnEvents,
        { promptId: s.currentPromptId, result: 'skip' },
      ];
      const teams = updateTeam(s.teams, teamIdx, (t) => ({ ...t, skipCount: t.skipCount + 1 }));
      let score = s.score;
      if (s.options.skipPenalty && scoring.total(score, teamId) > 0) {
        score = scoring.add(score, teamId, -1, 'skipPenalty', 0);
      }
      const discarded = deck.discard(s.deck, s.currentPromptId);
      const { deck: d, promptId } = drawNext(discarded);
      const next: PantomimeState = {
        ...s,
        teams,
        score,
        turnSkipped: s.turnSkipped + 1,
        turnEvents,
      };
      if (promptId === null) {
        return finalizeTurn({ ...next, deck: d, currentPromptId: null }, 'deckExhausted', 0);
      }
      return { ...next, deck: d, currentPromptId: promptId };
    }
    case 'PAUSE': {
      if (s.phase !== 'acting') return s;
      return { ...s, clock: timer.pause(s.clock, action.now) };
    }
    case 'RESUME': {
      if (s.phase !== 'acting') return s;
      return { ...s, clock: timer.start(s.clock, action.now) };
    }
    case 'END_TURN_EARLY': {
      if (s.phase !== 'acting') return s;
      return finalizeTurn(s, 'manualEnd', action.now);
    }
    case 'NEXT_TURN': {
      if (s.phase !== 'turnEnd') return s;
      const playedIdx = s.turn.index;
      const teams = updateTeam(s.teams, playedIdx, (t) => ({
        ...t,
        actorCursor: t.playerIds.length ? (t.actorCursor + 1) % t.playerIds.length : 0,
      }));
      const turn = turnOrder.next(s.turn, action.seed);
      const roundComplete = turn.index === 0; // wrapped back to the first team
      const finish =
        s.options.endMode === 'rounds'
          ? turn.round >= s.options.totalRounds
          : s.endRequested && roundComplete;
      if (finish) {
        const res = results.fromScores(s.score);
        return {
          ...s,
          teams,
          turn,
          phase: 'results',
          finished: true,
          winnerTeamIds: res.winners,
        };
      }
      return {
        ...s,
        teams,
        turn,
        phase: phaseMachine.go(MACHINE, s.phase, 'handoff'),
        currentPromptId: null,
        turnCorrect: 0,
        turnSkipped: 0,
        turnEvents: [],
        lastTurnEndReason: null,
        gate: revealGate.init([]),
        clock: timer.create('countdown', s.options.roundSeconds * 1000),
      };
    }
    case 'RESET':
      return s; // no-op; "play again" is host-driven (re-creates with a fresh seed)
    default:
      return s;
  }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

export const currentRound = (s: PantomimeState): number => s.turn.round + 1;
export const skipsLeft = (s: PantomimeState): number =>
  s.options.maxSkipsPerTurn === -1 ? Infinity : s.options.maxSkipsPerTurn - s.turnSkipped;
export const selectStandings = (s: PantomimeState) => results.fromScores(s.score).standings;
export const selectWinners = (s: PantomimeState): string[] => results.fromScores(s.score).winners;
export const teamLabel = (s: PantomimeState, teamId: string): string =>
  s.teams.find((t) => t.teamId === teamId)?.name ?? teamId;
export const teamColor = (s: PantomimeState, teamId: string): ColorToken | undefined =>
  s.teams.find((t) => t.teamId === teamId)?.color;
