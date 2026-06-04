// src/games/would-you-rather/logic.ts — PURE logic. No clock/RNG/IO; seed via createInitialState.
import type { ColorToken, GameConfig, GameStateBase } from '../../sdk/types';
import { shuffle } from '../../engine/rng';
import { poolFor } from './content';
import { readOptions } from './config';
import type { WyrOptions } from './config';

export type WyrPhase = 'prompt' | 'collecting' | 'reveal' | 'results' | 'error';
export type Side = 'A' | 'B';
export type Majority = Side | 'tie';

export interface RoundRecord {
  itemId: string;
  countA: number;
  countB: number;
  majority: Majority;
  choices: Record<string, Side>;
}

export interface WyrState extends GameStateBase {
  phase: WyrPhase;
  options: WyrOptions;
  order: string[];
  index: number;
  total: number;
  playerIds: string[];
  playerNames: Record<string, string>;
  playerColors: Record<string, ColorToken | undefined>;
  choices: Record<string, Side>;
  quickCounts: { A: number; B: number } | null;
  handoffIndex: number;
  current: { countA: number; countB: number; majority: Majority } | null;
  history: RoundRecord[];
  scores: Record<string, number>;
  errorCode: 'EMPTY_DECK' | 'NOT_ENOUGH_PLAYERS' | null;
}

export type WyrAction =
  | { type: 'BEGIN_COLLECTION' }
  | { type: 'CHOOSE'; playerId: string; side: Side }
  | { type: 'UNDO_CHOICE'; playerId: string }
  | { type: 'ADVANCE_HANDOFF' }
  | { type: 'SET_QUICK_COUNTS'; A: number; B: number }
  | { type: 'REVEAL' }
  | { type: 'NEXT' }
  | { type: 'SKIP' };

function zeroScores(playerIds: string[]): Record<string, number> {
  const scores: Record<string, number> = {};
  playerIds.forEach((id) => (scores[id] = 0));
  return scores;
}

function tallyOf(s: WyrState): { countA: number; countB: number } {
  if (s.options.mode === 'quick') {
    return { countA: s.quickCounts?.A ?? 0, countB: s.quickCounts?.B ?? 0 };
  }
  let countA = 0;
  let countB = 0;
  Object.values(s.choices).forEach((side) => (side === 'A' ? countA++ : countB++));
  return { countA, countB };
}

const majorityOf = (countA: number, countB: number): Majority =>
  countA > countB ? 'A' : countB > countA ? 'B' : 'tie';

function applyRoundPoints(
  base: Record<string, number>,
  options: WyrOptions,
  choices: Record<string, Side>,
  majority: Majority,
): Record<string, number> {
  if (!options.awardMajorityPoints || options.mode === 'quick') return base;
  const scores = { ...base };
  for (const [pid, side] of Object.entries(choices)) {
    const win = majority === 'tie' ? options.tieCountsForBoth : side === majority;
    if (win) scores[pid] = (scores[pid] ?? 0) + 1;
  }
  return scores;
}

function recomputeScores(
  playerIds: string[],
  options: WyrOptions,
  history: RoundRecord[],
): Record<string, number> {
  let scores = zeroScores(playerIds);
  for (const r of history) scores = applyRoundPoints(scores, options, r.choices, r.majority);
  return scores;
}

export function createInitialState(config: GameConfig, seed: number): WyrState {
  const options = readOptions(config);
  const playerIds = config.players.map((p) => p.id as string);
  const playerNames: Record<string, string> = {};
  const playerColors: Record<string, ColorToken | undefined> = {};
  config.players.forEach((p) => {
    playerNames[p.id] = p.name;
    playerColors[p.id] = p.color;
  });

  const pool = shuffle(
    poolFor(options.deckId, options.maxIntensity).map((it) => it.id),
    seed,
  );
  const total = Math.min(options.roundLength, pool.length);
  const order = pool.slice(0, total);

  const errorCode: WyrState['errorCode'] =
    playerIds.length < 2 ? 'NOT_ENOUGH_PLAYERS' : order.length === 0 ? 'EMPTY_DECK' : null;

  return {
    v: 1,
    phase: errorCode ? 'error' : 'prompt',
    finished: false,
    options,
    order,
    index: 0,
    total,
    playerIds,
    playerNames,
    playerColors,
    choices: {},
    quickCounts: null,
    handoffIndex: 0,
    current: null,
    history: [],
    scores: zeroScores(playerIds),
    errorCode,
  };
}

function clearRound(): Pick<WyrState, 'choices' | 'quickCounts' | 'handoffIndex' | 'current'> {
  return { choices: {}, quickCounts: null, handoffIndex: 0, current: null };
}

export function reducer(state: WyrState, action: WyrAction): WyrState {
  const s = state;
  switch (action.type) {
    case 'BEGIN_COLLECTION': {
      if (s.phase !== 'prompt') return s;
      return { ...s, phase: 'collecting', choices: {}, quickCounts: null, handoffIndex: 0 };
    }
    case 'CHOOSE': {
      if (s.phase !== 'collecting' || s.options.mode !== 'vote') return s;
      if (!s.playerIds.includes(action.playerId)) return s;
      return { ...s, choices: { ...s.choices, [action.playerId]: action.side } };
    }
    case 'UNDO_CHOICE': {
      if (s.phase !== 'collecting') return s;
      if (!(action.playerId in s.choices)) return s;
      const choices = { ...s.choices };
      delete choices[action.playerId];
      return { ...s, choices };
    }
    case 'ADVANCE_HANDOFF': {
      if (s.phase !== 'collecting' || s.options.mode !== 'vote') return s;
      return { ...s, handoffIndex: Math.min(s.handoffIndex + 1, s.playerIds.length) };
    }
    case 'SET_QUICK_COUNTS': {
      if (s.phase !== 'collecting' || s.options.mode !== 'quick') return s;
      return { ...s, quickCounts: { A: Math.max(0, action.A), B: Math.max(0, action.B) } };
    }
    case 'REVEAL': {
      if (s.phase !== 'collecting') return s;
      const { countA, countB } = tallyOf(s);
      const majority = majorityOf(countA, countB);
      const scores = applyRoundPoints(s.scores, s.options, s.choices, majority);
      return { ...s, phase: 'reveal', current: { countA, countB, majority }, scores };
    }
    case 'NEXT': {
      if (s.phase !== 'reveal') return s;
      const cur = s.current ?? { countA: 0, countB: 0, majority: 'tie' as Majority };
      const record: RoundRecord = {
        itemId: s.order[s.index],
        countA: cur.countA,
        countB: cur.countB,
        majority: cur.majority,
        choices: { ...s.choices },
      };
      const history = [...s.history, record];
      const index = s.index + 1;
      const done = index >= s.total || index >= s.order.length;
      return {
        ...s,
        ...clearRound(),
        history,
        index,
        phase: done ? 'results' : 'prompt',
        finished: done,
      };
    }
    case 'SKIP': {
      if (s.phase !== 'prompt' && s.phase !== 'collecting' && s.phase !== 'reveal') return s;
      const index = s.index + 1;
      const done = index >= s.total || index >= s.order.length;
      const scores = recomputeScores(s.playerIds, s.options, s.history); // roll back this round
      return {
        ...s,
        ...clearRound(),
        index,
        scores,
        phase: done ? 'results' : 'prompt',
        finished: done,
      };
    }
    default:
      return s;
  }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

export const currentItemId = (s: WyrState): string | null => s.order[s.index] ?? null;
export const currentVoterId = (s: WyrState): string | null =>
  s.options.mode === 'vote' && s.handoffIndex < s.playerIds.length
    ? s.playerIds[s.handoffIndex]
    : null;
export const everyoneVoted = (s: WyrState): boolean => s.handoffIndex >= s.playerIds.length;

export interface WyrStanding {
  id: string;
  score: number;
  rank: number;
}

export function standings(s: WyrState): WyrStanding[] {
  const order = new Map(s.playerIds.map((id, i) => [id, i]));
  const sorted = [...s.playerIds].sort(
    (a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0) || (order.get(a)! - order.get(b)!),
  );
  let rank = 0;
  let prev = NaN;
  return sorted.map((id, i) => {
    const sc = s.scores[id] ?? 0;
    if (sc !== prev) {
      rank = i + 1;
      prev = sc;
    }
    return { id, score: sc, rank };
  });
}

export function computeWinners(s: WyrState): string[] {
  if (!s.options.awardMajorityPoints || s.options.mode === 'quick') return [];
  return standings(s)
    .filter((r) => r.rank === 1 && r.score > 0)
    .map((r) => r.id);
}

export function sideWins(s: WyrState): { A: number; B: number } {
  let A = 0;
  let B = 0;
  s.history.forEach((r) => {
    if (r.majority === 'A') A++;
    else if (r.majority === 'B') B++;
  });
  return { A, B };
}
