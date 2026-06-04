import { describe, it, expect } from 'vitest';
import {
  emptyTeamSet,
  createTeams,
  assign,
  unassign,
  autoBalance,
  teamOf,
  isComplete,
  type TeamSetState,
} from './teams';
import { asPlayerId, teamIdAt } from './ids';
import { shuffle } from './rng';
import type { PlayerId } from '../sdk/types';

const p = (s: string): PlayerId => asPlayerId(s);

describe('emptyTeamSet', () => {
  it('returns a set with no teams', () => {
    expect(emptyTeamSet()).toEqual({ teams: [] });
  });
  it('returns a fresh object each call (no shared reference)', () => {
    const a = emptyTeamSet();
    const b = emptyTeamSet();
    expect(a).not.toBe(b);
    expect(a.teams).not.toBe(b.teams);
  });
});

describe('createTeams', () => {
  it('creates n empty teams named Team 1..n with indexed ids', () => {
    const s = createTeams(3, teamIdAt);
    expect(s.teams).toEqual([
      { id: 'team-0', name: 'Team 1', memberIds: [] },
      { id: 'team-1', name: 'Team 2', memberIds: [] },
      { id: 'team-2', name: 'Team 3', memberIds: [] },
    ]);
  });
  it('count of 0 yields an empty set', () => {
    expect(createTeams(0, teamIdAt)).toEqual({ teams: [] });
  });
  it('single team', () => {
    const s = createTeams(1, teamIdAt);
    expect(s.teams).toHaveLength(1);
    expect(s.teams[0].name).toBe('Team 1');
  });
  it('clamps negative count to empty', () => {
    expect(createTeams(-5, teamIdAt)).toEqual({ teams: [] });
  });
  it('floors fractional counts', () => {
    expect(createTeams(2.9, teamIdAt).teams).toHaveLength(2);
  });
  it('non-finite count yields empty', () => {
    expect(createTeams(NaN, teamIdAt)).toEqual({ teams: [] });
    expect(createTeams(Infinity, teamIdAt)).toEqual({ teams: [] });
  });
  it('honors a custom makeId', () => {
    const s = createTeams(2, (i) => teamIdAt(i + 10));
    expect(s.teams.map((t) => t.id)).toEqual(['team-10', 'team-11']);
  });
});

describe('assign', () => {
  it('adds a player to the target team', () => {
    const s = createTeams(2, teamIdAt);
    const r = assign(s, teamIdAt(0), p('a'));
    expect(r.teams[0].memberIds).toEqual([p('a')]);
    expect(r.teams[1].memberIds).toEqual([]);
  });
  it('moves a player from one team to another (removes from prior team)', () => {
    let s = createTeams(2, teamIdAt);
    s = assign(s, teamIdAt(0), p('a'));
    const r = assign(s, teamIdAt(1), p('a'));
    expect(r.teams[0].memberIds).toEqual([]);
    expect(r.teams[1].memberIds).toEqual([p('a')]);
  });
  it('does not mutate the input', () => {
    const s = createTeams(2, teamIdAt);
    const snapshot = JSON.parse(JSON.stringify(s));
    assign(s, teamIdAt(0), p('a'));
    expect(s).toEqual(snapshot);
  });
  it('returns a new object', () => {
    const s = createTeams(1, teamIdAt);
    const r = assign(s, teamIdAt(0), p('a'));
    expect(r).not.toBe(s);
  });
  it('no-ops (returns same ref) when target team does not exist', () => {
    const s = createTeams(1, teamIdAt);
    const r = assign(s, teamIdAt(99), p('a'));
    expect(r).toBe(s);
  });
  it('no-ops (returns same ref) when player is already correctly placed', () => {
    let s = createTeams(2, teamIdAt);
    s = assign(s, teamIdAt(0), p('a'));
    const r = assign(s, teamIdAt(0), p('a'));
    expect(r).toBe(s);
  });
  it('appends without duplicating an existing member', () => {
    let s = createTeams(1, teamIdAt);
    s = assign(s, teamIdAt(0), p('a'));
    s = assign(s, teamIdAt(0), p('b'));
    expect(s.teams[0].memberIds).toEqual([p('a'), p('b')]);
  });
  it('preserves order of remaining members after a move out', () => {
    let s = createTeams(2, teamIdAt);
    s = assign(s, teamIdAt(0), p('a'));
    s = assign(s, teamIdAt(0), p('b'));
    s = assign(s, teamIdAt(0), p('c'));
    s = assign(s, teamIdAt(1), p('b'));
    expect(s.teams[0].memberIds).toEqual([p('a'), p('c')]);
    expect(s.teams[1].memberIds).toEqual([p('b')]);
  });
  it('handles assign on an empty team set as a no-op', () => {
    const s = emptyTeamSet();
    const r = assign(s, teamIdAt(0), p('a'));
    expect(r).toBe(s);
  });
});

describe('unassign', () => {
  it('removes a player from its team', () => {
    let s = createTeams(2, teamIdAt);
    s = assign(s, teamIdAt(1), p('a'));
    const r = unassign(s, p('a'));
    expect(r.teams[1].memberIds).toEqual([]);
    expect(teamOf(r, p('a'))).toBeUndefined();
  });
  it('no-ops (returns same ref) when the player is not assigned', () => {
    const s = createTeams(2, teamIdAt);
    const r = unassign(s, p('ghost'));
    expect(r).toBe(s);
  });
  it('no-ops on an empty team set', () => {
    const s = emptyTeamSet();
    expect(unassign(s, p('a'))).toBe(s);
  });
  it('does not mutate the input', () => {
    let s = createTeams(1, teamIdAt);
    s = assign(s, teamIdAt(0), p('a'));
    const snapshot = JSON.parse(JSON.stringify(s));
    unassign(s, p('a'));
    expect(s).toEqual(snapshot);
  });
  it('is idempotent (second unassign is a no-op)', () => {
    let s = createTeams(1, teamIdAt);
    s = assign(s, teamIdAt(0), p('a'));
    const once = unassign(s, p('a'));
    const twice = unassign(once, p('a'));
    expect(twice).toBe(once);
  });
  it('preserves order of remaining members', () => {
    let s = createTeams(1, teamIdAt);
    s = assign(s, teamIdAt(0), p('a'));
    s = assign(s, teamIdAt(0), p('b'));
    s = assign(s, teamIdAt(0), p('c'));
    const r = unassign(s, p('b'));
    expect(r.teams[0].memberIds).toEqual([p('a'), p('c')]);
  });
});

describe('autoBalance', () => {
  const players = [p('a'), p('b'), p('c'), p('d'), p('e')];

  it('creates `count` teams and assigns every player exactly once', () => {
    const s = autoBalance(players, 2, 123, teamIdAt);
    expect(s.teams).toHaveLength(2);
    const all = s.teams.flatMap((t) => t.memberIds);
    expect(all.slice().sort()).toEqual(players.slice().sort());
    // round-robin: 5 across 2 -> sizes 3 and 2
    expect(s.teams.map((t) => t.memberIds.length).sort()).toEqual([2, 3]);
  });

  it('is deterministic for a fixed seed', () => {
    const a = autoBalance(players, 3, 42, teamIdAt);
    const b = autoBalance(players, 3, 42, teamIdAt);
    expect(a).toEqual(b);
  });

  it('different seeds can produce different distributions', () => {
    const a = autoBalance(players, 2, 1, teamIdAt);
    const b = autoBalance(players, 2, 999999, teamIdAt);
    // Not guaranteed different in general, but with these seeds the membership differs.
    expect(a).not.toEqual(b);
  });

  it('matches an explicit shuffle-then-round-robin reference', () => {
    // The contract is: shuffle(seed) then round-robin deal.
    const seed = 7;
    const count = 2;
    const dealt = shuffle(players, seed);
    const expected: PlayerId[][] = Array.from({ length: count }, () => []);
    dealt.forEach((id, i) => expected[i % count].push(id));
    const s = autoBalance(players, count, seed, teamIdAt);
    expect(s.teams.map((t) => t.memberIds)).toEqual(expected);
  });

  it('count of 0 returns an empty set (players dropped)', () => {
    const s = autoBalance(players, 0, 5, teamIdAt);
    expect(s).toEqual({ teams: [] });
  });

  it('negative count returns an empty set', () => {
    expect(autoBalance(players, -2, 5, teamIdAt)).toEqual({ teams: [] });
  });

  it('empty player list yields empty named teams', () => {
    const s = autoBalance([], 3, 5, teamIdAt);
    expect(s.teams).toHaveLength(3);
    expect(s.teams.every((t) => t.memberIds.length === 0)).toBe(true);
    expect(s.teams.map((t) => t.name)).toEqual(['Team 1', 'Team 2', 'Team 3']);
  });

  it('more teams than players leaves some teams empty', () => {
    const s = autoBalance([p('a'), p('b')], 4, 3, teamIdAt);
    expect(s.teams).toHaveLength(4);
    const total = s.teams.reduce((acc, t) => acc + t.memberIds.length, 0);
    expect(total).toBe(2);
    expect(s.teams.filter((t) => t.memberIds.length === 0)).toHaveLength(2);
  });

  it('single player single team', () => {
    const s = autoBalance([p('solo')], 1, 99, teamIdAt);
    expect(s.teams).toHaveLength(1);
    expect(s.teams[0].memberIds).toEqual([p('solo')]);
  });

  it('does not mutate the input player array', () => {
    const input = [p('a'), p('b'), p('c')];
    const snapshot = input.slice();
    autoBalance(input, 2, 11, teamIdAt);
    expect(input).toEqual(snapshot);
  });
});

describe('teamOf', () => {
  it('returns the id of the containing team', () => {
    let s = createTeams(2, teamIdAt);
    s = assign(s, teamIdAt(1), p('a'));
    expect(teamOf(s, p('a'))).toBe(teamIdAt(1));
  });
  it('returns undefined for an unassigned player', () => {
    const s = createTeams(2, teamIdAt);
    expect(teamOf(s, p('nobody'))).toBeUndefined();
  });
  it('returns undefined on an empty set', () => {
    expect(teamOf(emptyTeamSet(), p('a'))).toBeUndefined();
  });
});

describe('isComplete', () => {
  it('true when every roster player is assigned', () => {
    let s = createTeams(2, teamIdAt);
    s = assign(s, teamIdAt(0), p('a'));
    s = assign(s, teamIdAt(1), p('b'));
    expect(isComplete(s, [p('a'), p('b')])).toBe(true);
  });
  it('false when at least one roster player is unassigned', () => {
    let s = createTeams(2, teamIdAt);
    s = assign(s, teamIdAt(0), p('a'));
    expect(isComplete(s, [p('a'), p('b')])).toBe(false);
  });
  it('empty roster is trivially complete', () => {
    expect(isComplete(createTeams(2, teamIdAt), [])).toBe(true);
    expect(isComplete(emptyTeamSet(), [])).toBe(true);
  });
  it('ignores extra players assigned that are not in the roster', () => {
    let s = createTeams(1, teamIdAt);
    s = assign(s, teamIdAt(0), p('a'));
    s = assign(s, teamIdAt(0), p('extra'));
    expect(isComplete(s, [p('a')])).toBe(true);
  });
  it('false on an empty team set with a non-empty roster', () => {
    expect(isComplete(emptyTeamSet(), [p('a')])).toBe(false);
  });
});

describe('state is JSON-serializable (plain arrays + records)', () => {
  it('round-trips through JSON unchanged', () => {
    let s: TeamSetState = autoBalance([p('a'), p('b'), p('c')], 2, 5, teamIdAt);
    s = assign(s, teamIdAt(0), p('d'));
    s = unassign(s, p('a'));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
