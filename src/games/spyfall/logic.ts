// src/games/spyfall/logic.ts — PURE logic. No clock/RNG/IO; seeds via createInitialState / action payloads.
import type { ColorToken, GameConfig, GameStateBase } from '../../sdk/types';
import { shuffle, int, deriveSeed } from '../../engine/rng';
import { buildCatalog } from './content';
import type { SpyfallLocation } from './content';
import { readOptions } from './config';
import type { SpyfallOptions } from './config';

export type SpyfallPhase =
  | 'reveal'
  | 'qa'
  | 'accusation'
  | 'voting'
  | 'spyGuess'
  | 'roundEnd'
  | 'matchEnd'
  | 'error';

export type RoundOutcome = 'spyCaught' | 'spySurvived' | 'spyGuessedRight' | 'spyGuessedWrong';

export interface SecretCard {
  isSpy: boolean;
  roleId?: string;
  locationId: string;
}

export interface RoundState {
  index: number;
  locationId: string;
  spyIds: string[];
  cards: Record<string, SecretCard>;
  firstAskerId: string;
  nomineeId: string | null;
  accuserId: string | null;
  votes: Record<string, string | null>;
  votedOutId: string | null;
  noMajority: boolean;
  spyGuessLocationId: string | null;
  spyGuessById: string | null;
  outcome: RoundOutcome | null;
  roundScores: Record<string, number>;
}

export interface SpyfallState extends GameStateBase {
  phase: SpyfallPhase;
  options: SpyfallOptions;
  playerIds: string[];
  playerNames: Record<string, string>;
  playerColors: Record<string, ColorToken | undefined>;
  catalogIds: string[];
  totals: Record<string, number>;
  round: RoundState;
  roundHistory: RoundState[];
  revealCursor: number;
  errorCode: 'EMPTY_CATALOG' | 'BAD_PLAYERS' | null;
}

export type SpyfallAction =
  | { type: 'REVEAL_NEXT' }
  | { type: 'CALL_VOTE'; accuserId: string; nomineeId: string }
  | { type: 'TIMER_EXPIRED' }
  | { type: 'CANCEL_VOTE' }
  | { type: 'OPEN_VOTING' }
  | { type: 'CAST_VOTE'; voterId: string; targetId: string | null }
  | { type: 'LOCK_VOTES' }
  | { type: 'SPY_GUESS'; spyId: string; locationId: string }
  | { type: 'SKIP_SPY_GUESS' }
  | { type: 'NEXT_ROUND'; seed: number };

const POINTS = { perNonSpyOnCatch: 1, accuserBonus: 1, perSpyOnSurvive: 2, perSpyOnGuess: 2 };

function assignRound(
  playerIds: string[],
  spyCount: number,
  catalog: SpyfallLocation[],
  index: number,
  seed: number,
  avoidLocationId: string | null,
): RoundState {
  let locIdx = int(0, catalog.length - 1, deriveSeed(seed, 2));
  if (catalog[locIdx]?.id === avoidLocationId && catalog.length > 1) {
    locIdx = (locIdx + 1) % catalog.length;
  }
  const location = catalog[locIdx];
  const shuffled = shuffle(playerIds, seed);
  const spyIds = shuffled.slice(0, spyCount);
  const nonSpies = shuffled.slice(spyCount);
  const rolePool = shuffle(location.roles, deriveSeed(seed, 1));
  const cards: Record<string, SecretCard> = {};
  spyIds.forEach((p) => {
    cards[p] = { isSpy: true, locationId: location.id };
  });
  nonSpies.forEach((p, i) => {
    cards[p] = { isSpy: false, roleId: rolePool[i % rolePool.length].id, locationId: location.id };
  });
  return {
    index,
    locationId: location.id,
    spyIds,
    cards,
    firstAskerId: shuffled[0],
    nomineeId: null,
    accuserId: null,
    votes: {},
    votedOutId: null,
    noMajority: false,
    spyGuessLocationId: null,
    spyGuessById: null,
    outcome: null,
    roundScores: {},
  };
}

export function createInitialState(config: GameConfig, seed: number): SpyfallState {
  const options = readOptions(config);
  const playerIds = config.players.map((p) => p.id as string);
  const playerNames: Record<string, string> = {};
  const playerColors: Record<string, ColorToken | undefined> = {};
  config.players.forEach((p) => {
    playerNames[p.id] = p.name;
    playerColors[p.id] = p.color;
  });

  const catalog = buildCatalog(options.enabledPackIds);
  const totals: Record<string, number> = {};
  playerIds.forEach((id) => (totals[id] = 0));

  const badPlayers = playerIds.length < 3 || playerIds.length - options.spyCount < 2;
  const errorCode: SpyfallState['errorCode'] = badPlayers
    ? 'BAD_PLAYERS'
    : catalog.length === 0
      ? 'EMPTY_CATALOG'
      : null;

  const round = errorCode
    ? assignRoundEmpty()
    : assignRound(playerIds, options.spyCount, catalog, 0, seed, null);

  return {
    v: 1,
    phase: errorCode ? 'error' : 'reveal',
    finished: false,
    options,
    playerIds,
    playerNames,
    playerColors,
    catalogIds: catalog.map((l) => l.id),
    totals,
    round,
    roundHistory: [],
    revealCursor: 0,
    errorCode,
  };
}

function assignRoundEmpty(): RoundState {
  return {
    index: 0,
    locationId: '',
    spyIds: [],
    cards: {},
    firstAskerId: '',
    nomineeId: null,
    accuserId: null,
    votes: {},
    votedOutId: null,
    noMajority: false,
    spyGuessLocationId: null,
    spyGuessById: null,
    outcome: null,
    roundScores: {},
  };
}

function tallyVotes(votes: Record<string, string | null>, playerIds: string[]): string | null {
  const counts: Record<string, number> = {};
  Object.values(votes).forEach((t) => {
    if (t) counts[t] = (counts[t] ?? 0) + 1;
  });
  const threshold = playerIds.length / 2;
  let result: string | null = null;
  for (const id of playerIds) {
    if ((counts[id] ?? 0) > threshold) result = id;
  }
  return result;
}

function resolveRound(state: SpyfallState): SpyfallState {
  const r = state.round;
  const nonSpies = state.playerIds.filter((id) => !r.spyIds.includes(id));
  const votedSpy = r.votedOutId != null && r.spyIds.includes(r.votedOutId);
  const guessRight = r.spyGuessLocationId != null && r.spyGuessLocationId === r.locationId;
  const outcome: RoundOutcome = guessRight
    ? 'spyGuessedRight'
    : r.spyGuessLocationId != null
      ? 'spyGuessedWrong'
      : votedSpy
        ? 'spyCaught'
        : 'spySurvived';

  const roundScores: Record<string, number> = {};
  state.playerIds.forEach((id) => (roundScores[id] = 0));
  if (votedSpy) {
    nonSpies.forEach((id) => (roundScores[id] += POINTS.perNonSpyOnCatch));
    if (r.accuserId && r.nomineeId === r.votedOutId) roundScores[r.accuserId] += POINTS.accuserBonus;
  }
  r.spyIds.forEach((id) => {
    if (id !== r.votedOutId) roundScores[id] += POINTS.perSpyOnSurvive;
  });
  if (guessRight) r.spyIds.forEach((id) => (roundScores[id] += POINTS.perSpyOnGuess));

  const totals = { ...state.totals };
  state.playerIds.forEach((id) => (totals[id] = (totals[id] ?? 0) + roundScores[id]));
  const resolvedRound: RoundState = { ...r, outcome, roundScores };
  return {
    ...state,
    phase: 'roundEnd',
    round: resolvedRound,
    totals,
    roundHistory: [...state.roundHistory, resolvedRound],
  };
}

export function reducer(state: SpyfallState, action: SpyfallAction): SpyfallState {
  const s = state;
  switch (action.type) {
    case 'REVEAL_NEXT': {
      if (s.phase !== 'reveal') return s;
      const cursor = s.revealCursor + 1;
      if (cursor >= s.playerIds.length) return { ...s, phase: 'qa', revealCursor: cursor };
      return { ...s, revealCursor: cursor };
    }
    case 'CALL_VOTE': {
      if (s.phase !== 'qa') return s;
      return {
        ...s,
        phase: 'accusation',
        round: { ...s.round, accuserId: action.accuserId, nomineeId: action.nomineeId },
      };
    }
    case 'TIMER_EXPIRED': {
      if (s.phase !== 'qa') return s;
      return { ...s, phase: 'accusation', round: { ...s.round, accuserId: null, nomineeId: null } };
    }
    case 'CANCEL_VOTE': {
      if (s.phase !== 'accusation') return s;
      return { ...s, phase: 'qa', round: { ...s.round, accuserId: null, nomineeId: null } };
    }
    case 'OPEN_VOTING': {
      if (s.phase !== 'accusation') return s;
      return { ...s, phase: 'voting', round: { ...s.round, votes: {} } };
    }
    case 'CAST_VOTE': {
      if (s.phase !== 'voting') return s;
      return {
        ...s,
        round: { ...s.round, votes: { ...s.round.votes, [action.voterId]: action.targetId } },
      };
    }
    case 'LOCK_VOTES': {
      if (s.phase !== 'voting') return s;
      const votedOutId = tallyVotes(s.round.votes, s.playerIds);
      const round = { ...s.round, votedOutId, noMajority: votedOutId === null };
      const spiesInPlay = round.spyIds.filter((id) => id !== votedOutId);
      const withVote: SpyfallState = { ...s, round };
      if (s.options.allowSpyGuess && spiesInPlay.length > 0) {
        return { ...withVote, phase: 'spyGuess' };
      }
      return resolveRound(withVote);
    }
    case 'SPY_GUESS': {
      if (s.phase !== 'spyGuess') return s;
      if (s.round.spyGuessLocationId !== null) return s; // first guess wins
      const round = { ...s.round, spyGuessLocationId: action.locationId, spyGuessById: action.spyId };
      return resolveRound({ ...s, round });
    }
    case 'SKIP_SPY_GUESS': {
      if (s.phase !== 'spyGuess') return s;
      return resolveRound(s);
    }
    case 'NEXT_ROUND': {
      if (s.phase !== 'roundEnd') return s;
      if (s.round.index + 1 >= s.options.totalRounds) {
        return { ...s, phase: 'matchEnd', finished: true };
      }
      const catalog = buildCatalog(s.options.enabledPackIds);
      const round = assignRound(
        s.playerIds,
        s.options.spyCount,
        catalog,
        s.round.index + 1,
        action.seed,
        s.round.locationId,
      );
      return { ...s, phase: 'reveal', revealCursor: 0, round };
    }
    default:
      return s;
  }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

export const currentRevealPlayerId = (s: SpyfallState): string | null =>
  s.playerIds[s.revealCursor] ?? null;

export interface SpyfallStanding {
  id: string;
  score: number;
  rank: number;
}

export function standings(s: SpyfallState): SpyfallStanding[] {
  const order = new Map(s.playerIds.map((id, i) => [id, i]));
  const sorted = [...s.playerIds].sort(
    (a, b) => (s.totals[b] ?? 0) - (s.totals[a] ?? 0) || (order.get(a)! - order.get(b)!),
  );
  let rank = 0;
  let prev = NaN;
  return sorted.map((id, i) => {
    const sc = s.totals[id] ?? 0;
    if (sc !== prev) {
      rank = i + 1;
      prev = sc;
    }
    return { id, score: sc, rank };
  });
}

export function computeWinners(s: SpyfallState): string[] {
  return standings(s)
    .filter((r) => r.rank === 1)
    .map((r) => r.id);
}
