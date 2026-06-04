// src/games/heads-up/logic.ts — PURE logic. No clock/RNG/IO; seconds/seeds arrive via action payloads.
import type { ColorToken, GameConfig, GameStateBase } from '../../sdk/types';
import { shuffle } from '../../engine/rng';
import { mergedPool } from './content';
import { readOptions } from './config';
import type { HeadsUpMode } from './config';

export type HeadsUpPhase = 'handoff' | 'countdown' | 'playing' | 'roundEnd' | 'finished' | 'error';
export type InputMode = 'motion' | 'button';

export interface Participant {
  id: string;
  kind: 'player' | 'team';
  name: string;
  color?: ColorToken;
  memberIds: string[];
  guesserCursor: number;
}

export interface RoundEntry {
  cardKey: string;
  result: 'got' | 'passed';
}

export interface RoundResult {
  participantId: string;
  guesserId: string;
  roundIndex: number;
  entries: RoundEntry[];
  got: number;
  passed: number;
}

export interface HeadsUpState extends GameStateBase {
  phase: HeadsUpPhase;
  mode: HeadsUpMode;
  participants: Participant[];
  turnIndex: number;
  roundOfParticipant: Record<string, number>;
  totalRoundsPerParticipant: number;
  playerNames: Record<string, string>;
  cardPool: string[];
  deck: string[];
  deckCursor: number;
  currentCardId: string | null;
  flash: null | 'got' | 'passed';
  currentEntries: RoundEntry[];
  roundSeconds: number;
  secondsLeft: number;
  countdownLeft: number;
  rounds: RoundResult[];
  inputMode: InputMode;
  passPenalty: 0 | 1;
  recycleDeck: boolean;
  matchOver: boolean;
  errorCode: 'EMPTY_DECK' | 'NOT_ENOUGH_PLAYERS' | null;
}

export type HeadsUpAction =
  | { type: 'CONFIRM_READY' }
  | { type: 'COUNTDOWN_TICK' }
  | { type: 'TICK'; secondsLeft: number }
  | { type: 'MARK_GOT'; seed: number }
  | { type: 'MARK_PASS'; seed: number }
  | { type: 'CLEAR_FLASH' }
  | { type: 'TIME_UP' }
  | { type: 'NEXT_PARTICIPANT'; seed: number }
  | { type: 'SET_INPUT_MODE'; mode: InputMode };

const TEAM_COLORS: ColorToken[] = ['rose', 'sky', 'lime', 'gold'];

export const guesserId = (p: Participant): string =>
  p.memberIds.length ? p.memberIds[p.guesserCursor % p.memberIds.length] : '';
export const currentParticipant = (s: HeadsUpState): Participant | undefined =>
  s.participants[s.turnIndex];

function advanceCard(
  deck: string[],
  cursor: number,
  recycle: boolean,
  seed: number,
): { deck: string[]; deckCursor: number; currentCardId: string | null } {
  let nextCursor = cursor + 1;
  let nextDeck = deck;
  if (nextCursor >= deck.length) {
    if (recycle && deck.length > 0) {
      nextDeck = shuffle(deck, seed);
      nextCursor = 0;
    } else {
      return { deck, deckCursor: nextCursor, currentCardId: null };
    }
  }
  return { deck: nextDeck, deckCursor: nextCursor, currentCardId: nextDeck[nextCursor] ?? null };
}

export function createInitialState(config: GameConfig, seed: number): HeadsUpState {
  const options = readOptions(config);
  const playerNames: Record<string, string> = {};
  config.players.forEach((p) => {
    playerNames[p.id] = p.name;
  });

  let participants: Participant[];
  if (options.mode === 'teams') {
    const teamList = config.teams?.teams ?? [];
    participants = teamList.map((t, i) => ({
      id: t.id as string,
      kind: 'team',
      name:
        typeof t.name === 'string' ? t.name : (t.name?.[config.lang] ?? t.name?.en ?? `Team ${i + 1}`),
      color: TEAM_COLORS[i % TEAM_COLORS.length],
      memberIds: t.memberIds.map((id) => id as string),
      guesserCursor: 0,
    }));
  } else {
    participants = config.players.map((p) => ({
      id: p.id as string,
      kind: 'player',
      name: p.name,
      color: p.color,
      memberIds: [p.id as string],
      guesserCursor: 0,
    }));
  }

  const cardPool = mergedPool(options.deckIds);
  const deck = shuffle(cardPool, seed);
  const roundOfParticipant: Record<string, number> = {};
  participants.forEach((p) => (roundOfParticipant[p.id] = 0));

  const badTeams = options.mode === 'teams' && participants.some((p) => p.memberIds.length < 2);
  const errorCode: HeadsUpState['errorCode'] =
    participants.length < 2 || badTeams
      ? 'NOT_ENOUGH_PLAYERS'
      : cardPool.length === 0
        ? 'EMPTY_DECK'
        : null;

  return {
    v: 1,
    phase: errorCode ? 'error' : 'handoff',
    finished: false,
    mode: options.mode,
    participants,
    turnIndex: 0,
    roundOfParticipant,
    totalRoundsPerParticipant: options.rounds,
    playerNames,
    cardPool,
    deck,
    deckCursor: 0,
    currentCardId: null,
    flash: null,
    currentEntries: [],
    roundSeconds: options.roundSeconds,
    secondsLeft: options.roundSeconds,
    countdownLeft: 3,
    rounds: [],
    inputMode: options.motionEnabled ? 'motion' : 'button',
    passPenalty: options.passPenalty,
    recycleDeck: options.recycleDeck,
    matchOver: false,
    errorCode,
  };
}

function mark(s: HeadsUpState, result: 'got' | 'passed', seed: number): HeadsUpState {
  if (s.phase !== 'playing' || s.currentCardId === null) return s;
  const entries: RoundEntry[] = [...s.currentEntries, { cardKey: s.currentCardId, result }];
  const adv = advanceCard(s.deck, s.deckCursor, s.recycleDeck, seed);
  return { ...s, currentEntries: entries, flash: result, ...adv };
}

export function reducer(state: HeadsUpState, action: HeadsUpAction): HeadsUpState {
  const s = state;
  switch (action.type) {
    case 'CONFIRM_READY': {
      if (s.phase !== 'handoff') return s;
      return { ...s, phase: 'countdown', countdownLeft: 3 };
    }
    case 'COUNTDOWN_TICK': {
      if (s.phase !== 'countdown') return s;
      const countdownLeft = s.countdownLeft - 1;
      if (countdownLeft > 0) return { ...s, countdownLeft };
      return {
        ...s,
        phase: 'playing',
        countdownLeft: 0,
        secondsLeft: s.roundSeconds,
        currentEntries: [],
        deckCursor: 0,
        currentCardId: s.deck[0] ?? null,
      };
    }
    case 'TICK': {
      if (s.phase !== 'playing') return s;
      return { ...s, secondsLeft: Math.max(0, action.secondsLeft) };
    }
    case 'MARK_GOT':
      return mark(s, 'got', action.seed);
    case 'MARK_PASS':
      return mark(s, 'passed', action.seed);
    case 'CLEAR_FLASH': {
      if (s.flash === null) return s;
      return { ...s, flash: null };
    }
    case 'TIME_UP': {
      if (s.phase !== 'playing') return s;
      const p = s.participants[s.turnIndex];
      const got = s.currentEntries.filter((e) => e.result === 'got').length;
      const passed = s.currentEntries.filter((e) => e.result === 'passed').length;
      const result: RoundResult = {
        participantId: p.id,
        guesserId: guesserId(p),
        roundIndex: s.roundOfParticipant[p.id] ?? 0,
        entries: s.currentEntries,
        got,
        passed,
      };
      return {
        ...s,
        phase: 'roundEnd',
        flash: null,
        currentCardId: null,
        rounds: [...s.rounds, result],
        roundOfParticipant: { ...s.roundOfParticipant, [p.id]: (s.roundOfParticipant[p.id] ?? 0) + 1 },
      };
    }
    case 'NEXT_PARTICIPANT': {
      if (s.phase !== 'roundEnd') return s;
      const allDone = s.participants.every(
        (p) => (s.roundOfParticipant[p.id] ?? 0) >= s.totalRoundsPerParticipant,
      );
      if (allDone) {
        return { ...s, phase: 'finished', matchOver: true, finished: true };
      }
      const participants = s.participants.map((p, i) =>
        i === s.turnIndex ? { ...p, guesserCursor: p.guesserCursor + 1 } : p,
      );
      const turnIndex = (s.turnIndex + 1) % s.participants.length;
      return {
        ...s,
        participants,
        turnIndex,
        phase: 'handoff',
        deck: shuffle(s.cardPool, action.seed),
        deckCursor: 0,
        currentCardId: null,
        currentEntries: [],
        flash: null,
        countdownLeft: 3,
        secondsLeft: s.roundSeconds,
      };
    }
    case 'SET_INPUT_MODE':
      return { ...s, inputMode: action.mode };
    default:
      return s;
  }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

export const score = (got: number, passed: number, penalty: 0 | 1): number => got - passed * penalty;

export interface HeadsUpStanding {
  participantId: string;
  got: number;
  passed: number;
  score: number;
  rank: number;
}

export function standings(s: HeadsUpState): HeadsUpStanding[] {
  const totals: Record<string, { got: number; passed: number }> = {};
  s.participants.forEach((p) => (totals[p.id] = { got: 0, passed: 0 }));
  s.rounds.forEach((r) => {
    totals[r.participantId].got += r.got;
    totals[r.participantId].passed += r.passed;
  });
  const order = new Map(s.participants.map((p, i) => [p.id, i]));
  const rows = s.participants
    .map((p) => ({
      participantId: p.id,
      got: totals[p.id].got,
      passed: totals[p.id].passed,
      score: score(totals[p.id].got, totals[p.id].passed, s.passPenalty),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.got - a.got ||
        (order.get(a.participantId)! - order.get(b.participantId)!),
    );
  let rank = 0;
  let prev = NaN;
  return rows.map((r, i) => {
    if (r.score !== prev) {
      rank = i + 1;
      prev = r.score;
    }
    return { ...r, rank };
  });
}

export function computeWinners(s: HeadsUpState): string[] {
  return standings(s)
    .filter((r) => r.rank === 1)
    .map((r) => r.participantId);
}

export const participantName = (s: HeadsUpState, id: string): string =>
  s.participants.find((p) => p.id === id)?.name ?? id;
