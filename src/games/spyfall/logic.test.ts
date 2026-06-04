import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerSeat } from '../../sdk/types';
import { asPlayerId } from '../../engine/ids';
import { createInitialState, reducer, standings, computeWinners } from './logic';
import type { SpyfallState } from './logic';
import { DEFAULT_OPTIONS } from './config';
import type { SpyfallOptions } from './config';
import { LOCATION_BY_ID, validateContent } from './content';

const seat = (id: string): PlayerSeat => ({ id: asPlayerId(id), name: id.toUpperCase() });
const ids5 = ['a', 'b', 'c', 'd', 'e'];

function makeConfig(options: Partial<SpyfallOptions> = {}, ids = ids5): GameConfig {
  return {
    players: ids.map(seat),
    options: { ...DEFAULT_OPTIONS, totalRounds: 1, ...options },
    lang: 'en',
  };
}

function reveal(s: SpyfallState): SpyfallState {
  for (let i = 0; i < s.playerIds.length; i++) s = reducer(s, { type: 'REVEAL_NEXT' });
  return s; // now qa
}
function toVoting(s: SpyfallState): SpyfallState {
  s = reveal(s);
  s = reducer(s, { type: 'CALL_VOTE', accuserId: '', nomineeId: '' });
  return reducer(s, { type: 'OPEN_VOTING' });
}
function castAll(s: SpyfallState, target: (id: string) => string | null): SpyfallState {
  for (const id of s.playerIds) s = reducer(s, { type: 'CAST_VOTE', voterId: id, targetId: target(id) });
  return reducer(s, { type: 'LOCK_VOTES' });
}

describe('spyfall content', () => {
  it('ships valid bilingual content', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('spyfall createInitialState & assignment', () => {
  it('assigns one spy, roles for non-spies, deterministically', () => {
    const s = createInitialState(makeConfig(), 42);
    expect(s.phase).toBe('reveal');
    expect(Object.values(s.totals)).toEqual([0, 0, 0, 0, 0]);
    expect(s.round.spyIds).toHaveLength(1);
    const spy = s.round.spyIds[0];
    expect(s.round.cards[spy].isSpy).toBe(true);
    expect(s.round.cards[spy].roleId).toBeUndefined();
    const loc = LOCATION_BY_ID[s.round.locationId];
    s.playerIds.filter((id) => id !== spy).forEach((id) => {
      const card = s.round.cards[id];
      expect(card.isSpy).toBe(false);
      expect(loc.roles.some((r) => r.id === card.roleId)).toBe(true);
    });
    expect(s.playerIds).toContain(s.round.firstAskerId);
    expect(createInitialState(makeConfig(), 42).round).toEqual(s.round);
  });

  it('recycles roles when there are more non-spies than roles', () => {
    const ids12 = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const s = createInitialState(makeConfig({ spyCount: 1 }, ids12), 3);
    const roleIds = s.playerIds
      .filter((id) => id !== s.round.spyIds[0])
      .map((id) => s.round.cards[id].roleId);
    expect(roleIds).toHaveLength(11);
    expect(new Set(roleIds).size).toBeLessThan(11); // recycled duplicates
  });

  it('errors when there cannot be 2 non-spies', () => {
    const s = createInitialState(makeConfig({ spyCount: 1 }, ['a', 'b']), 1);
    expect(s.phase).toBe('error');
  });
});

describe('spyfall phases', () => {
  it('reveal advances to qa; accusation transitions', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reveal(s);
    expect(s.phase).toBe('qa');
    s = reducer(s, { type: 'CALL_VOTE', accuserId: 'a', nomineeId: 'b' });
    expect(s.phase).toBe('accusation');
    s = reducer(s, { type: 'CANCEL_VOTE' });
    expect(s.phase).toBe('qa');
    expect(reducer(s, { type: 'TIMER_EXPIRED' }).phase).toBe('accusation');
  });

  it('records and overwrites votes including abstain', () => {
    let s = toVoting(createInitialState(makeConfig(), 1));
    s = reducer(s, { type: 'CAST_VOTE', voterId: 'a', targetId: 'b' });
    expect(s.round.votes.a).toBe('b');
    s = reducer(s, { type: 'CAST_VOTE', voterId: 'a', targetId: null });
    expect(s.round.votes.a).toBeNull();
  });
});

describe('spyfall resolution', () => {
  it('catches the spy when voted out: non-spies +1, accuser bonus', () => {
    let s = createInitialState(makeConfig(), 7);
    const spy = s.round.spyIds[0];
    const accuser = s.playerIds.find((id) => id !== spy)!;
    s = reveal(s);
    s = reducer(s, { type: 'CALL_VOTE', accuserId: accuser, nomineeId: spy });
    s = reducer(s, { type: 'OPEN_VOTING' });
    s = castAll(s, () => spy); // everyone votes the spy
    expect(s.phase).toBe('roundEnd');
    expect(s.round.outcome).toBe('spyCaught');
    s.playerIds.filter((id) => id !== spy).forEach((id) => {
      const expected = id === accuser ? 2 : 1; // +1 catch (+1 accuser bonus)
      expect(s.round.roundScores[id]).toBe(expected);
    });
    expect(s.round.roundScores[spy]).toBe(0);
  });

  it('spy survives a wrong vote and can guess for bonus (stacks to +4)', () => {
    let s = createInitialState(makeConfig(), 7);
    const spy = s.round.spyIds[0];
    const scapegoat = s.playerIds.find((id) => id !== spy)!;
    s = toVoting(s);
    s = castAll(s, () => scapegoat); // out an innocent
    expect(s.phase).toBe('spyGuess'); // spy still in play
    expect(s.round.votedOutId).toBe(scapegoat);
    s = reducer(s, { type: 'SPY_GUESS', spyId: spy, locationId: s.round.locationId });
    expect(s.round.outcome).toBe('spyGuessedRight');
    expect(s.round.roundScores[spy]).toBe(4); // +2 survive, +2 guess
    expect(s.totals[spy]).toBe(4);
  });

  it('spy survives and skips the guess: +2', () => {
    let s = createInitialState(makeConfig(), 7);
    const spy = s.round.spyIds[0];
    const scapegoat = s.playerIds.find((id) => id !== spy)!;
    s = toVoting(s);
    s = castAll(s, () => scapegoat);
    s = reducer(s, { type: 'SKIP_SPY_GUESS' });
    expect(s.round.outcome).toBe('spySurvived');
    expect(s.round.roundScores[spy]).toBe(2);
  });

  it('no majority sends the spy to a guess (spy survives the vote)', () => {
    let s = createInitialState(makeConfig(), 7);
    s = toVoting(s);
    s = castAll(s, (id) => id); // everyone votes themselves -> no majority
    expect(s.round.votedOutId).toBeNull();
    expect(s.phase).toBe('spyGuess');
  });

  it('skips the guess phase when guessing is disabled', () => {
    let s = createInitialState(makeConfig({ allowSpyGuess: false }), 7);
    const spy = s.round.spyIds[0];
    const scapegoat = s.playerIds.find((id) => id !== spy)!;
    s = toVoting(s);
    s = castAll(s, () => scapegoat);
    expect(s.phase).toBe('roundEnd');
    expect(s.round.outcome).toBe('spySurvived');
  });
});

describe('spyfall rounds', () => {
  it('ends the match after the configured rounds', () => {
    let s = createInitialState(makeConfig({ totalRounds: 1 }), 7);
    const spy = s.round.spyIds[0];
    s = toVoting(s);
    s = castAll(s, () => spy);
    s = reducer(s, { type: 'NEXT_ROUND', seed: 1 });
    expect(s.phase).toBe('matchEnd');
    expect(s.finished).toBe(true);
    expect(standings(s)[0].rank).toBe(1);
    expect(computeWinners(s).length).toBeGreaterThanOrEqual(1);
  });

  it('starts a fresh round and avoids repeating the location', () => {
    let s = createInitialState(makeConfig({ totalRounds: 2 }), 7);
    const firstLoc = s.round.locationId;
    const spy = s.round.spyIds[0];
    s = toVoting(s);
    s = castAll(s, () => spy);
    s = reducer(s, { type: 'NEXT_ROUND', seed: 12345 });
    expect(s.phase).toBe('reveal');
    expect(s.round.index).toBe(1);
    expect(s.round.locationId).not.toBe(firstLoc);
  });

  it('does not mutate input (purity)', () => {
    const s = reveal(createInitialState(makeConfig(), 1));
    const snap = structuredClone(s);
    reducer(s, { type: 'CALL_VOTE', accuserId: 'a', nomineeId: 'b' });
    expect(s).toEqual(snap);
  });
});
