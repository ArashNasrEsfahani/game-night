// src/games/most-likely-to/logic.ts — PURE logic. No clock/RNG/IO; seed via createInitialState / action payload.
import type { ColorToken, GameConfig, GameStateBase } from '../../sdk/types';
import { shuffle, pick } from '../../engine/rng';
import { getPool } from './content';
import { readOptions } from './config';
import type { MltOptions } from './config';

export type MltPhase = 'prompt' | 'voting' | 'reveal' | 'finished' | 'error';

export type VoteTally = Record<string, number>;

export interface MltRound {
  index: number;
  promptId: string;
  tally: VoteTally;
  winnerIds: string[];
  wasTie: boolean;
}

export interface MltState extends GameStateBase {
  phase: MltPhase;
  options: MltOptions;
  pool: string[]; // full shuffled prompt-id pool
  orderedPromptIds: string[]; // the prompts actually played
  poolNextIndex: number; // next unused pool index (for SKIP)
  playerIds: string[];
  playerNames: Record<string, string>;
  playerColors: Record<string, ColorToken | undefined>;
  currentRound: number;
  activeVoterIndex: number | null;
  pendingVotes: Record<string, string>; // voterId -> targetId (never surfaced)
  rounds: MltRound[];
  scores: Record<string, number>; // round wins
  rawVotes: Record<string, number>; // total votes received
  errorCode: 'EMPTY_DECK' | 'NOT_ENOUGH_PLAYERS' | null;
}

export type MltAction =
  | { type: 'BEGIN_VOTING' }
  | { type: 'CAST_VOTE'; voterId: string; targetId: string }
  | { type: 'UNDO_LAST_VOTE' }
  | { type: 'SUBMIT_VOTES'; tally?: VoteTally; seed: number }
  | { type: 'NEXT_ROUND' }
  | { type: 'SKIP_PROMPT' }
  | { type: 'END_GAME' };

export function createInitialState(config: GameConfig, seed: number): MltState {
  const options = readOptions(config);
  const playerIds = config.players.map((p) => p.id as string);
  const playerNames: Record<string, string> = {};
  const playerColors: Record<string, ColorToken | undefined> = {};
  config.players.forEach((p) => {
    playerNames[p.id] = p.name;
    playerColors[p.id] = p.color;
  });

  const pool = shuffle(
    getPool({ deckId: options.deckId, intensity: options.intensity }).map((p) => p.id),
    seed,
  );
  const orderedPromptIds = pool.slice(0, Math.min(options.roundCount, pool.length));

  const scores: Record<string, number> = {};
  const rawVotes: Record<string, number> = {};
  playerIds.forEach((id) => {
    scores[id] = 0;
    rawVotes[id] = 0;
  });

  const errorCode: MltState['errorCode'] =
    playerIds.length < 3 ? 'NOT_ENOUGH_PLAYERS' : orderedPromptIds.length === 0 ? 'EMPTY_DECK' : null;

  return {
    v: 1,
    phase: errorCode ? 'error' : 'prompt',
    finished: false,
    options,
    pool,
    orderedPromptIds,
    poolNextIndex: orderedPromptIds.length,
    playerIds,
    playerNames,
    playerColors,
    currentRound: 0,
    activeVoterIndex: null,
    pendingVotes: {},
    rounds: [],
    scores,
    rawVotes,
    errorCode,
  };
}

function buildTally(s: MltState, payload?: VoteTally): VoteTally {
  const tally: VoteTally = {};
  s.playerIds.forEach((id) => {
    tally[id] = 0;
  });
  if (s.options.votingStyle === 'simultaneous') {
    s.playerIds.forEach((id) => {
      tally[id] = Math.max(0, Math.round(payload?.[id] ?? 0));
    });
  } else {
    Object.values(s.pendingVotes).forEach((target) => {
      if (target in tally) tally[target] += 1;
    });
  }
  return tally;
}

export function reducer(state: MltState, action: MltAction): MltState {
  const s = state;
  switch (action.type) {
    case 'BEGIN_VOTING': {
      if (s.phase !== 'prompt') return s;
      return {
        ...s,
        phase: 'voting',
        pendingVotes: {},
        activeVoterIndex: s.options.votingStyle === 'pass-device' ? 0 : null,
      };
    }
    case 'CAST_VOTE': {
      if (s.phase !== 'voting' || s.options.votingStyle !== 'pass-device') return s;
      if (s.activeVoterIndex === null) return s;
      if (s.playerIds[s.activeVoterIndex] !== action.voterId) return s;
      const pendingVotes = { ...s.pendingVotes };
      if (!(action.targetId === action.voterId && !s.options.allowSelfVote)) {
        if (s.playerIds.includes(action.targetId)) pendingVotes[action.voterId] = action.targetId;
      }
      return { ...s, pendingVotes, activeVoterIndex: s.activeVoterIndex + 1 };
    }
    case 'UNDO_LAST_VOTE': {
      if (s.phase !== 'voting' || s.options.votingStyle !== 'pass-device') return s;
      if (s.activeVoterIndex === null || s.activeVoterIndex <= 0) return s;
      const idx = s.activeVoterIndex - 1;
      const pendingVotes = { ...s.pendingVotes };
      delete pendingVotes[s.playerIds[idx]];
      return { ...s, pendingVotes, activeVoterIndex: idx };
    }
    case 'SUBMIT_VOTES': {
      if (s.phase !== 'voting') return s;
      const tally = buildTally(s, action.tally);
      let max = 0;
      s.playerIds.forEach((id) => {
        if (tally[id] > max) max = tally[id];
      });
      const topPlayers = max > 0 ? s.playerIds.filter((id) => tally[id] === max) : [];
      const wasTie = topPlayers.length > 1;
      const winnerIds =
        wasTie && s.options.tieBreak === 'random' ? [pick(topPlayers, action.seed)] : topPlayers;

      const scores = { ...s.scores };
      winnerIds.forEach((id) => {
        scores[id] = (scores[id] ?? 0) + 1;
      });
      const rawVotes = { ...s.rawVotes };
      s.playerIds.forEach((id) => {
        rawVotes[id] = (rawVotes[id] ?? 0) + tally[id];
      });
      const round: MltRound = {
        index: s.currentRound,
        promptId: s.orderedPromptIds[s.currentRound],
        tally,
        winnerIds,
        wasTie,
      };
      return {
        ...s,
        phase: 'reveal',
        pendingVotes: {},
        activeVoterIndex: null,
        rounds: [...s.rounds, round],
        scores,
        rawVotes,
      };
    }
    case 'NEXT_ROUND': {
      if (s.phase !== 'reveal') return s;
      if (s.currentRound + 1 < s.orderedPromptIds.length) {
        return { ...s, phase: 'prompt', currentRound: s.currentRound + 1 };
      }
      return { ...s, phase: 'finished', finished: true };
    }
    case 'SKIP_PROMPT': {
      if (s.phase !== 'prompt') return s;
      if (s.poolNextIndex >= s.pool.length) return s;
      const orderedPromptIds = s.orderedPromptIds.slice();
      orderedPromptIds[s.currentRound] = s.pool[s.poolNextIndex];
      return { ...s, orderedPromptIds, poolNextIndex: s.poolNextIndex + 1 };
    }
    case 'END_GAME': {
      // End the match now and lock in the standings from the rounds played so far.
      if (s.phase === 'finished' || s.phase === 'error') return s;
      return { ...s, phase: 'finished', finished: true, pendingVotes: {}, activeVoterIndex: null };
    }
    default:
      return s;
  }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

export const currentPromptId = (s: MltState): string | null =>
  s.orderedPromptIds[s.currentRound] ?? null;
export const currentVoterId = (s: MltState): string | null =>
  s.activeVoterIndex !== null ? (s.playerIds[s.activeVoterIndex] ?? null) : null;
export const allVoted = (s: MltState): boolean =>
  s.activeVoterIndex !== null && s.activeVoterIndex >= s.playerIds.length;

export interface MltStanding {
  id: string;
  score: number;
  rawVotes: number;
  rank: number;
}

export function rankPlayers(s: MltState): MltStanding[] {
  const order = new Map(s.playerIds.map((id, i) => [id, i]));
  const sorted = [...s.playerIds].sort((a, b) => {
    const ds = (s.scores[b] ?? 0) - (s.scores[a] ?? 0);
    if (ds) return ds;
    const dv = (s.rawVotes[b] ?? 0) - (s.rawVotes[a] ?? 0);
    if (dv) return dv;
    return (order.get(a) ?? 0) - (order.get(b) ?? 0);
  });
  let rank = 0;
  let prevKey = '';
  return sorted.map((id, i) => {
    const key = `${s.scores[id] ?? 0}|${s.rawVotes[id] ?? 0}`;
    if (key !== prevKey) {
      rank = i + 1;
      prevKey = key;
    }
    return { id, score: s.scores[id] ?? 0, rawVotes: s.rawVotes[id] ?? 0, rank };
  });
}

export function computeOverallWinners(s: MltState): string[] {
  const ranked = rankPlayers(s);
  return ranked.filter((r) => r.rank === 1).map((r) => r.id);
}
