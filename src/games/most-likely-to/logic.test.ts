import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerSeat } from '../../sdk/types';
import { asPlayerId } from '../../engine/ids';
import {
  createInitialState,
  reducer,
  rankPlayers,
  computeOverallWinners,
  currentVoterId,
} from './logic';
import type { MltState } from './logic';
import { DEFAULT_OPTIONS } from './config';
import type { MltOptions } from './config';
import { getPool, validateContent } from './content';

const seat = (id: string): PlayerSeat => ({ id: asPlayerId(id), name: id.toUpperCase() });

function makeConfig(options: Partial<MltOptions> = {}, ids = ['a', 'b', 'c', 'd']): GameConfig {
  return {
    players: ids.map(seat),
    options: { ...DEFAULT_OPTIONS, deckId: 'classic', intensity: 'spicy', roundCount: 8, ...options },
    lang: 'en',
  };
}

const POOL = getPool({ deckId: 'classic', intensity: 'spicy' }).length; // classic deck, all intensities

/** Cast a full pass-device round: targets maps voterId -> targetId. */
function voteRound(s: MltState, targets: Record<string, string>, seed = 1): MltState {
  s = reducer(s, { type: 'BEGIN_VOTING' });
  for (const id of s.playerIds) {
    s = reducer(s, { type: 'CAST_VOTE', voterId: id, targetId: targets[id] });
  }
  return reducer(s, { type: 'SUBMIT_VOTES', seed });
}

describe('mlt content', () => {
  it('ships valid bilingual content', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('mlt createInitialState', () => {
  it('builds a clamped, deterministic order and zeroed scores', () => {
    const a = createInitialState(makeConfig(), 42);
    expect(a.phase).toBe('prompt');
    expect(a.orderedPromptIds).toHaveLength(8);
    expect(Object.values(a.scores)).toEqual([0, 0, 0, 0]);
    const b = createInitialState(makeConfig(), 42);
    expect(a.orderedPromptIds).toEqual(b.orderedPromptIds);
    const c = createInitialState(makeConfig(), 7);
    expect(a.orderedPromptIds).not.toEqual(c.orderedPromptIds);
  });

  it('clamps roundCount to the pool and flags too few players', () => {
    expect(createInitialState(makeConfig({ roundCount: 99 }), 1).orderedPromptIds).toHaveLength(
      Math.min(99, POOL),
    );
    expect(createInitialState(makeConfig({}, ['a', 'b']), 1).phase).toBe('error');
  });
});

describe('mlt voting (pass-device)', () => {
  it('BEGIN_VOTING starts the voter sequence', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'BEGIN_VOTING' });
    expect(s.phase).toBe('voting');
    expect(s.activeVoterIndex).toBe(0);
    expect(currentVoterId(s)).toBe('a');
  });

  it('CAST_VOTE records and advances; drops disallowed self-vote; guards wrong voter', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'BEGIN_VOTING' });
    const wrong = reducer(s, { type: 'CAST_VOTE', voterId: 'b', targetId: 'a' });
    expect(wrong).toBe(s); // not the active voter
    s = reducer(s, { type: 'CAST_VOTE', voterId: 'a', targetId: 'b' });
    expect(s.pendingVotes).toEqual({ a: 'b' });
    expect(s.activeVoterIndex).toBe(1);
    s = reducer(s, { type: 'CAST_VOTE', voterId: 'b', targetId: 'b' }); // self-vote, disallowed
    expect(s.pendingVotes).toEqual({ a: 'b' }); // dropped
    expect(s.activeVoterIndex).toBe(2); // still advanced
  });

  it('allows self-vote when enabled', () => {
    let s = createInitialState(makeConfig({ allowSelfVote: true }), 1);
    s = reducer(s, { type: 'BEGIN_VOTING' });
    s = reducer(s, { type: 'CAST_VOTE', voterId: 'a', targetId: 'a' });
    expect(s.pendingVotes).toEqual({ a: 'a' });
  });

  it('UNDO_LAST_VOTE rewinds; no-op when empty', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'BEGIN_VOTING' });
    expect(reducer(s, { type: 'UNDO_LAST_VOTE' })).toBe(s);
    s = reducer(s, { type: 'CAST_VOTE', voterId: 'a', targetId: 'b' });
    s = reducer(s, { type: 'UNDO_LAST_VOTE' });
    expect(s.activeVoterIndex).toBe(0);
    expect(s.pendingVotes).toEqual({});
  });
});

describe('mlt resolution', () => {
  it('scores a single clear winner', () => {
    let s = createInitialState(makeConfig(), 1);
    s = voteRound(s, { a: 'c', b: 'c', c: 'a', d: 'c' }); // c gets 3
    expect(s.phase).toBe('reveal');
    const round = s.rounds[0];
    expect(round.tally.c).toBe(3);
    expect(round.winnerIds).toEqual(['c']);
    expect(round.wasTie).toBe(false);
    expect(s.scores.c).toBe(1);
    expect(s.rawVotes.a).toBe(1);
  });

  it('co-winners on a tie', () => {
    let s = createInitialState(makeConfig({ tieBreak: 'co-winners' }), 1);
    s = voteRound(s, { a: 'c', b: 'c', c: 'a', d: 'a' }); // a:2, c:2
    expect(s.rounds[0].wasTie).toBe(true);
    expect(s.rounds[0].winnerIds.sort()).toEqual(['a', 'c']);
    expect(s.scores.a).toBe(1);
    expect(s.scores.c).toBe(1);
  });

  it('random tiebreak picks exactly one deterministically', () => {
    const targets = { a: 'c', b: 'c', c: 'a', d: 'a' };
    const w1 = voteRound(createInitialState(makeConfig({ tieBreak: 'random' }), 1), targets, 99);
    const w2 = voteRound(createInitialState(makeConfig({ tieBreak: 'random' }), 1), targets, 99);
    expect(w1.rounds[0].winnerIds).toHaveLength(1);
    expect(w1.rounds[0].winnerIds).toEqual(w2.rounds[0].winnerIds);
  });

  it('simultaneous uses the supplied tally; all-zero yields no winner', () => {
    let s = createInitialState(makeConfig({ votingStyle: 'simultaneous' }), 1);
    s = reducer(s, { type: 'BEGIN_VOTING' });
    expect(s.activeVoterIndex).toBeNull();
    s = reducer(s, { type: 'SUBMIT_VOTES', tally: { a: 0, b: 0, c: 0, d: 0 }, seed: 1 });
    expect(s.rounds[0].winnerIds).toEqual([]);
    expect(Object.values(s.scores)).toEqual([0, 0, 0, 0]);
    expect(s.phase).toBe('reveal');
  });
});

describe('mlt advancement', () => {
  it('NEXT_ROUND advances then finishes on the last round', () => {
    let s = createInitialState(makeConfig({ roundCount: 2 }), 1);
    s = voteRound(s, { a: 'b', b: 'a', c: 'a', d: 'a' });
    s = reducer(s, { type: 'NEXT_ROUND' });
    expect(s.phase).toBe('prompt');
    expect(s.currentRound).toBe(1);
    s = voteRound(s, { a: 'b', b: 'a', c: 'a', d: 'a' });
    s = reducer(s, { type: 'NEXT_ROUND' });
    expect(s.phase).toBe('finished');
    expect(s.finished).toBe(true);
  });

  it('SKIP_PROMPT swaps in an unused prompt; no-op when pool exhausted', () => {
    let s = createInitialState(makeConfig({ roundCount: 2 }), 1);
    const before = s.orderedPromptIds[0];
    s = reducer(s, { type: 'SKIP_PROMPT' });
    expect(s.orderedPromptIds[0]).not.toBe(before);
    expect(s.poolNextIndex).toBe(3);
    const full = createInitialState(makeConfig({ roundCount: POOL }), 1);
    expect(reducer(full, { type: 'SKIP_PROMPT' })).toBe(full);
  });
});

describe('mlt ranking', () => {
  it('ranks by wins then raw votes; reports ties', () => {
    let s = createInitialState(makeConfig({ roundCount: 2 }), 1);
    s = voteRound(s, { a: 'c', b: 'c', c: 'a', d: 'c' }); // c wins
    s = reducer(s, { type: 'NEXT_ROUND' });
    s = voteRound(s, { a: 'c', b: 'c', c: 'd', d: 'c' }); // c wins again
    const ranked = rankPlayers(s);
    expect(ranked[0].id).toBe('c');
    expect(computeOverallWinners(s)).toEqual(['c']);
  });

  it('does not mutate input (purity)', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'BEGIN_VOTING' });
    const snapshot = structuredClone(s);
    reducer(s, { type: 'CAST_VOTE', voterId: 'a', targetId: 'b' });
    expect(s).toEqual(snapshot);
  });
});
