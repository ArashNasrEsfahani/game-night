// src/games/dowr/logic.ts — PURE game logic for Dowr.
// A FAST, CONTINUOUS timed relay. N players in N/2 teams of two. The phone races around the
// teams: one member describes a word (without saying it) while their teammate guesses. A
// stopwatch runs the whole time. The instant the teammate gets it, tap "Got it!" — the time
// that team spent is banked and the NEXT team's word appears immediately (no handoff screens).
// A bomb fuse runs each word; if it blows first, the team eats the elapsed time plus a penalty.
// Changing a word also costs penalty time. After every team has had `rounds` turns, the team
// with the LOWEST total time wins.
//
// Timing lives in the SCREEN (refs), not here: the view measures each segment against the wall
// clock and passes `segmentMs` in the ADVANCE action, so this reducer stays pure and the match
// survives a resume without the clock "jumping". State only ever holds banked totals.
import type { ColorToken, GameConfig, GameStateBase } from '../../sdk/types';
import type { DeckState } from '../../engine/deck';
import * as deck from '../../engine/deck';
import * as rng from '../../engine/rng';
import { buildPool } from './deck';
import { readOptions } from './config';
import type { DowrOptions } from './config';

export type DowrPhase = 'playing' | 'gameOver' | 'error';
export type TurnEndReason = 'guessed' | 'bomb' | 'deckExhausted';

export interface DowrTeam {
  id: string;
  name: string;
  color: ColorToken;
  /** Exactly two member player ids. */
  memberIds: string[];
}

export interface TurnRecord {
  turnNo: number;
  round: number; // 0-based
  teamId: string;
  describerId: string;
  guesserId: string;
  segmentMs: number;
  changes: number;
  changePenaltyMs: number;
  bombPenaltyMs: number;
  totalMs: number; // what was added to the team's total this turn
  reason: TurnEndReason;
  solved: boolean;
}

export interface DowrState extends GameStateBase {
  phase: DowrPhase;
  options: DowrOptions;
  teams: DowrTeam[];
  playerNames: Record<string, string>;
  deck: DeckState<string>;
  /** Global 0-based turn counter. team = teams[turnNo % teams.length]. */
  turnNo: number;
  totalTurns: number;
  currentCardId: string | null;
  /** Bomb fuse for the current word (ms) — jittered when surpriseBomb is on. */
  fuseMs: number;
  /** Word changes on the current word (reset each turn). */
  turnChanges: number;
  /** Accumulated change penalty for the current turn (ms), banked on ADVANCE. */
  changePenaltyMs: number;
  /** teamId → cumulative time in ms (lower is better). */
  totals: Record<string, number>;
  /** Transient: set to 'bomb' for one render so the view can flash; cleared via CLEAR_FLASH. */
  flash: 'bomb' | null;
  history: TurnRecord[];
  lastRecord: TurnRecord | null;
  errorCode: 'EMPTY_DECK' | 'NEED_TEAMS' | null;
}

export type DowrAction =
  | { type: 'ADVANCE'; reason: 'guessed' | 'bomb'; segmentMs: number; seed: number }
  | { type: 'CHANGE_WORD'; seed: number }
  | { type: 'END_TIME'; segmentMs: number }
  | { type: 'END_GAME' }
  | { type: 'CLEAR_FLASH' }
  | { type: 'RESET' };

const TEAM_COLORS: ColorToken[] = ['rose', 'sky', 'lime', 'gold', 'violet', 'teal'];

/** The fuse for a turn: the configured length, jittered down to 60–100% when surpriseBomb is on. */
function computeFuseMs(o: DowrOptions, seed: number): number {
  if (!o.surpriseBomb) return o.fuseSeconds * 1000;
  const lo = Math.max(10, Math.round(o.fuseSeconds * 0.6));
  return rng.int(lo, o.fuseSeconds, seed) * 1000;
}

function drawCard(d: DeckState<string>, seed: number): { deck: DeckState<string>; cardId: string | null } {
  const r = deck.draw(d, 1, seed);
  return { deck: r.deck, cardId: r.drawn[0] ?? null };
}

/* ─────────────────────────  Turn participants (derived)  ───────────────────────── */

export const teamForTurn = (s: DowrState, turnNo: number): DowrTeam =>
  s.teams[turnNo % s.teams.length];
export const roundForTurn = (s: DowrState, turnNo: number): number =>
  Math.floor(turnNo / s.teams.length);
export const currentTeam = (s: DowrState): DowrTeam => teamForTurn(s, s.turnNo);
/** Within a team the describer alternates between its two members each round. */
export const describerPlayerId = (s: DowrState): string => {
  const team = currentTeam(s);
  return team.memberIds[roundForTurn(s, s.turnNo) % 2];
};
export const guesserPlayerId = (s: DowrState): string => {
  const team = currentTeam(s);
  return team.memberIds[(roundForTurn(s, s.turnNo) + 1) % 2];
};

function makeRecord(
  s: DowrState,
  reason: TurnEndReason,
  segmentMs: number,
  changePenaltyMs: number,
  bombPenaltyMs: number,
): TurnRecord {
  return {
    turnNo: s.turnNo,
    round: roundForTurn(s, s.turnNo),
    teamId: currentTeam(s).id,
    describerId: describerPlayerId(s),
    guesserId: guesserPlayerId(s),
    segmentMs,
    changes: s.turnChanges,
    changePenaltyMs,
    bombPenaltyMs,
    totalMs: segmentMs + changePenaltyMs + bombPenaltyMs,
    reason,
    solved: reason === 'guessed',
  };
}

export function createInitialState(config: GameConfig, seed: number): DowrState {
  const options = readOptions(config);
  const players = config.players;
  const playerNames: Record<string, string> = {};
  players.forEach((p) => {
    playerNames[p.id] = p.name;
  });

  const supplied = config.teams?.teams ?? [];
  const teams: DowrTeam[] =
    supplied.length > 0
      ? supplied.map((t, i) => ({
          id: t.id as string,
          name:
            typeof t.name === 'string'
              ? t.name
              : t.name
                ? (t.name[config.lang] ?? t.name.en)
                : `Team ${i + 1}`,
          color: TEAM_COLORS[i % TEAM_COLORS.length],
          memberIds: (t.memberIds as string[]).slice(0, 2),
        }))
      : Array.from({ length: Math.floor(players.length / 2) }, (_, i) => ({
          id: `t${i}`,
          name: `Team ${i + 1}`,
          color: TEAM_COLORS[i % TEAM_COLORS.length],
          memberIds: [players[2 * i].id as string, players[2 * i + 1].id as string],
        }));

  const pool = buildPool(options);
  let deckState = deck.create(
    pool.map((c) => c.id),
    seed,
  );
  const validTeams = teams.length >= 2 && teams.every((t) => t.memberIds.length === 2);
  const emptyDeck = pool.length === 0;

  const totals: Record<string, number> = {};
  teams.forEach((t) => (totals[t.id] = 0));

  let currentCardId: string | null = null;
  let fuseMs = options.fuseSeconds * 1000;
  if (!emptyDeck && validTeams) {
    const r = drawCard(deckState, seed);
    deckState = r.deck;
    currentCardId = r.cardId;
    fuseMs = computeFuseMs(options, rng.deriveSeed(seed, 7));
  }

  return {
    v: 2,
    phase: emptyDeck || !validTeams ? 'error' : 'playing',
    finished: false,
    options,
    teams,
    playerNames,
    deck: deckState,
    turnNo: 0,
    totalTurns: teams.length * options.rounds,
    currentCardId,
    fuseMs,
    turnChanges: 0,
    changePenaltyMs: 0,
    totals,
    flash: null,
    history: [],
    lastRecord: null,
    errorCode: emptyDeck ? 'EMPTY_DECK' : !validTeams ? 'NEED_TEAMS' : null,
  };
}

export function reducer(state: DowrState, action: DowrAction): DowrState {
  const s = state;
  switch (action.type) {
    case 'ADVANCE': {
      if (s.phase !== 'playing' || s.currentCardId === null) return s;
      const timeMode = s.options.endMode === 'time';
      const team = currentTeam(s);
      const segmentMs = Math.max(0, Math.min(action.segmentMs, s.fuseMs));
      // In time mode the win condition is "most words", so artificial time penalties don't apply —
      // a team only ever banks the real seconds it held the phone (which the shared clock counts down).
      const bombPenaltyMs = !timeMode && action.reason === 'bomb' ? s.options.bombPenaltySeconds * 1000 : 0;
      const changePenaltyMs = timeMode ? 0 : s.changePenaltyMs;
      const addMs = segmentMs + changePenaltyMs + bombPenaltyMs;
      const record = makeRecord(s, action.reason, segmentMs, changePenaltyMs, bombPenaltyMs);
      const totals = { ...s.totals, [team.id]: (s.totals[team.id] ?? 0) + addMs };
      const consumed = deck.discard(s.deck, s.currentCardId);
      const nextTurnNo = s.turnNo + 1;
      const common = {
        ...s,
        totals,
        history: [...s.history, record],
        lastRecord: record,
        flash: action.reason === 'bomb' ? ('bomb' as const) : null,
        turnChanges: 0,
        changePenaltyMs: 0,
      };
      const elapsedMs = Object.values(totals).reduce((a, b) => a + b, 0);
      const over = timeMode
        ? elapsedMs >= s.options.timeLimitSeconds * 1000
        : nextTurnNo >= s.totalTurns;
      if (over) {
        return { ...common, phase: 'gameOver', finished: true, deck: consumed, currentCardId: null };
      }
      const { deck: d, cardId } = drawCard(consumed, action.seed);
      if (cardId === null) {
        return { ...common, phase: 'gameOver', finished: true, deck: consumed, currentCardId: null };
      }
      return {
        ...common,
        deck: d,
        currentCardId: cardId,
        turnNo: nextTurnNo,
        fuseMs: computeFuseMs(s.options, action.seed),
      };
    }
    case 'CHANGE_WORD': {
      if (s.phase !== 'playing' || s.currentCardId === null) return s;
      const discarded = deck.discard(s.deck, s.currentCardId);
      const { deck: d, cardId } = drawCard(discarded, action.seed);
      if (cardId === null) return s; // nothing to swap to; keep the current word
      return {
        ...s,
        deck: d,
        currentCardId: cardId,
        turnChanges: s.turnChanges + 1,
        changePenaltyMs: s.changePenaltyMs + s.options.changePenaltySeconds * 1000,
      };
    }
    case 'END_TIME': {
      // The shared clock ran out mid-word (time mode only): bank the real seconds spent on the
      // in-progress word (no solve credited) and end the match. Most words guessed wins.
      if (s.phase !== 'playing' || s.options.endMode !== 'time') return s;
      const team = currentTeam(s);
      const segmentMs = Math.max(0, action.segmentMs);
      const totals = { ...s.totals, [team.id]: (s.totals[team.id] ?? 0) + segmentMs };
      return {
        ...s,
        totals,
        phase: 'gameOver',
        finished: true,
        currentCardId: null,
        flash: null,
        turnChanges: 0,
        changePenaltyMs: 0,
      };
    }
    case 'END_GAME': {
      // Manual end: lock the match where it stands and show the results-so-far. The in-progress
      // word's live segment is intentionally NOT banked (mirrors ToD's END_GAME, which doesn't
      // resolve the current turn). Standings/winners derive purely from the banked totals + history,
      // so the Results screen renders fine from this mid-game end.
      if (s.phase !== 'playing') return s;
      return {
        ...s,
        phase: 'gameOver',
        finished: true,
        currentCardId: null,
        flash: null,
        turnChanges: 0,
        changePenaltyMs: 0,
      };
    }
    case 'CLEAR_FLASH': {
      if (!s.flash) return s;
      return { ...s, flash: null };
    }
    case 'RESET':
      return s; // no-op; "play again" is host-driven (re-creates with a fresh seed)
    default:
      return s;
  }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

export const currentRound = (s: DowrState): number => roundForTurn(s, s.turnNo) + 1;
export const describerName = (s: DowrState): string => s.playerNames[describerPlayerId(s)] ?? '';
export const guesserName = (s: DowrState): string => s.playerNames[guesserPlayerId(s)] ?? '';
export const isLastTurn = (s: DowrState): boolean => s.turnNo >= s.totalTurns - 1;

/** Words a team has solved (endMode 'time' win metric). */
export const teamWords = (s: DowrState, teamId: string): number =>
  s.history.reduce((n, r) => n + (r.teamId === teamId && r.solved ? 1 : 0), 0);
/** Total game time consumed so far (sum of every team's banked seconds). */
export const elapsedMs = (s: DowrState): number =>
  Object.values(s.totals).reduce((a, b) => a + b, 0);
export const timeLimitMs = (s: DowrState): number => s.options.timeLimitSeconds * 1000;
/** Seconds left on the shared clock (endMode 'time'); pass the live in-progress segment. */
export const timeRemainingMs = (s: DowrState, liveSegmentMs = 0): number =>
  Math.max(0, timeLimitMs(s) - elapsedMs(s) - liveSegmentMs);

export interface DowrStanding {
  subjectId: string;
  label: string;
  color?: ColorToken;
  totalMs: number;
  words: number;
  rank: number;
}

/** Standings. Turns mode: fastest total time first (ties share rank). Time mode: most words
 *  first, ties broken by lower time. */
export function selectStandings(s: DowrState): DowrStanding[] {
  const timeMode = s.options.endMode === 'time';
  const rows = s.teams.map((t) => ({
    subjectId: t.id,
    label: t.name,
    color: t.color,
    totalMs: s.totals[t.id] ?? 0,
    words: teamWords(s, t.id),
  }));
  rows.sort((a, b) => (timeMode ? b.words - a.words || a.totalMs - b.totalMs : a.totalMs - b.totalMs));
  let rank = 0;
  let prevKey: string | null = null;
  return rows.map((row, i) => {
    const key = timeMode ? `${row.words}|${row.totalMs}` : `${row.totalMs}`;
    if (prevKey === null || key !== prevKey) {
      rank = i + 1;
      prevKey = key;
    }
    return { ...row, rank };
  });
}

/** The winning team(s). Turns mode: lowest total time. Time mode: most words (ties → fastest). */
export function selectWinners(s: DowrState): string[] {
  if (s.teams.length === 0) return [];
  if (s.options.endMode === 'time') {
    const max = Math.max(...s.teams.map((t) => teamWords(s, t.id)));
    const top = s.teams.filter((t) => teamWords(s, t.id) === max);
    if (top.length <= 1) return top.map((t) => t.id);
    const min = Math.min(...top.map((t) => s.totals[t.id] ?? 0));
    return top.filter((t) => (s.totals[t.id] ?? 0) === min).map((t) => t.id);
  }
  const min = Math.min(...s.teams.map((t) => s.totals[t.id] ?? 0));
  return s.teams.filter((t) => (s.totals[t.id] ?? 0) === min).map((t) => t.id);
}
