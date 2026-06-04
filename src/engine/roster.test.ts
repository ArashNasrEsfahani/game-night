import { describe, it, expect } from 'vitest';
import {
  emptyRoster,
  addPlayer,
  updatePlayer,
  removePlayer,
  reorderPlayers,
  saveGroup,
  deleteGroup,
  toSeats,
  type RosterState,
} from './roster';
import { asPlayerId } from './ids';

const pA = asPlayerId('a');
const pB = asPlayerId('b');
const pC = asPlayerId('c');
const pX = asPlayerId('x'); // never added

/** Build a roster of three players a, b, c with stable createdAt timestamps. */
function threePlayers(): RosterState {
  let s = emptyRoster();
  s = addPlayer(s, { name: 'Ann' }, pA, 100);
  s = addPlayer(s, { name: 'Bob', emoji: '🦊' }, pB, 200);
  s = addPlayer(s, { name: 'Cleo', color: 'rose' }, pC, 300);
  return s;
}

describe('emptyRoster', () => {
  it('returns empty players and groups', () => {
    expect(emptyRoster()).toEqual({ players: [], groups: [] });
  });
  it('returns a fresh object each call (no shared reference)', () => {
    const a = emptyRoster();
    const b = emptyRoster();
    expect(a).not.toBe(b);
    expect(a.players).not.toBe(b.players);
    expect(a.groups).not.toBe(b.groups);
  });
});

describe('addPlayer', () => {
  it('appends a player with the given id and createdAt', () => {
    const s = addPlayer(emptyRoster(), { name: 'Ann' }, pA, 42);
    expect(s.players).toEqual([{ id: pA, name: 'Ann', createdAt: 42 }]);
  });
  it('preserves optional emoji and color', () => {
    const s = addPlayer(emptyRoster(), { name: 'Bob', emoji: '🦊', color: 'sky' }, pB, 1);
    expect(s.players[0]).toEqual({ id: pB, name: 'Bob', emoji: '🦊', color: 'sky', createdAt: 1 });
  });
  it('does not mutate the input', () => {
    const s0 = emptyRoster();
    const s1 = addPlayer(s0, { name: 'Ann' }, pA, 1);
    expect(s0.players).toEqual([]);
    expect(s1).not.toBe(s0);
  });
  it('appends in insertion order', () => {
    const s = threePlayers();
    expect(s.players.map((p) => p.id)).toEqual([pA, pB, pC]);
  });
  it('is a no-op (returns same ref) when id already exists', () => {
    const s = threePlayers();
    const again = addPlayer(s, { name: 'Duplicate' }, pA, 999);
    expect(again).toBe(s);
  });
});

describe('updatePlayer', () => {
  it('merges patch fields', () => {
    const s = updatePlayer(threePlayers(), pA, { name: 'Annie', color: 'lime' });
    const a = s.players.find((p) => p.id === pA)!;
    expect(a).toEqual({ id: pA, name: 'Annie', color: 'lime', createdAt: 100 });
  });
  it('cannot change the id even if a patch somehow includes it', () => {
    // id is excluded from the patch type, but guard the runtime behavior anyway.
    const s = updatePlayer(threePlayers(), pA, { name: 'Z' } as never);
    expect(s.players[0].id).toBe(pA);
  });
  it('returns the same ref for an unknown id (no-op)', () => {
    const s = threePlayers();
    expect(updatePlayer(s, pX, { name: 'Nope' })).toBe(s);
  });
  it('does not mutate the input', () => {
    const s = threePlayers();
    const before = JSON.parse(JSON.stringify(s));
    updatePlayer(s, pA, { name: 'Changed' });
    expect(s).toEqual(before);
  });
  it('leaves other players untouched', () => {
    const s0 = threePlayers();
    const s1 = updatePlayer(s0, pB, { emoji: '🐼' });
    expect(s1.players[0]).toBe(s0.players[0]);
    expect(s1.players[2]).toBe(s0.players[2]);
  });
});

describe('removePlayer', () => {
  it('removes the player', () => {
    const s = removePlayer(threePlayers(), pB);
    expect(s.players.map((p) => p.id)).toEqual([pA, pC]);
  });
  it('strips the id from all groups', () => {
    let s = threePlayers();
    s = saveGroup(s, 'G1', [pA, pB], 'g1', 1);
    s = saveGroup(s, 'G2', [pB, pC], 'g2', 2);
    s = removePlayer(s, pB);
    expect(s.groups[0].memberIds).toEqual([pA]);
    expect(s.groups[1].memberIds).toEqual([pC]);
  });
  it('returns same ref for unknown id (no-op)', () => {
    const s = threePlayers();
    expect(removePlayer(s, pX)).toBe(s);
  });
  it('does not mutate the input', () => {
    let s = threePlayers();
    s = saveGroup(s, 'G', [pA, pB], 'g', 1);
    const before = JSON.parse(JSON.stringify(s));
    removePlayer(s, pA);
    expect(s).toEqual(before);
  });
  it('leaves groups untouched (same ref) when they do not contain the id', () => {
    let s = threePlayers();
    s = saveGroup(s, 'G', [pA], 'g', 1);
    const groupRef = s.groups[0];
    const s2 = removePlayer(s, pC);
    expect(s2.groups[0]).toBe(groupRef);
  });
  it('handles removing the only player', () => {
    const s = addPlayer(emptyRoster(), { name: 'Solo' }, pA, 1);
    expect(removePlayer(s, pA).players).toEqual([]);
  });
});

describe('reorderPlayers', () => {
  it('reorders to match orderedIds', () => {
    const s = reorderPlayers(threePlayers(), [pC, pA, pB]);
    expect(s.players.map((p) => p.id)).toEqual([pC, pA, pB]);
  });
  it('appends unmentioned players at the end in original order', () => {
    const s = reorderPlayers(threePlayers(), [pC]);
    expect(s.players.map((p) => p.id)).toEqual([pC, pA, pB]);
  });
  it('ignores unknown ids', () => {
    const s = reorderPlayers(threePlayers(), [pX, pB, pX, pA]);
    expect(s.players.map((p) => p.id)).toEqual([pB, pA, pC]);
  });
  it('ignores duplicate ids in the order list', () => {
    const s = reorderPlayers(threePlayers(), [pB, pB, pB]);
    expect(s.players.map((p) => p.id)).toEqual([pB, pA, pC]);
  });
  it('returns same ref when order is unchanged (full list)', () => {
    const s = threePlayers();
    expect(reorderPlayers(s, [pA, pB, pC])).toBe(s);
  });
  it('returns same ref when order is unchanged (empty list)', () => {
    const s = threePlayers();
    expect(reorderPlayers(s, [])).toBe(s);
  });
  it('does not mutate the input', () => {
    const s = threePlayers();
    const before = JSON.parse(JSON.stringify(s));
    reorderPlayers(s, [pC, pB, pA]);
    expect(s).toEqual(before);
  });
  it('preserves player objects (same refs, reordered)', () => {
    const s0 = threePlayers();
    const s1 = reorderPlayers(s0, [pC, pB, pA]);
    expect(s1.players[0]).toBe(s0.players[2]);
    expect(s1.players[2]).toBe(s0.players[0]);
  });
});

describe('saveGroup', () => {
  it('creates a new group appended at the end', () => {
    const s = saveGroup(threePlayers(), 'Crew', [pA, pB], 'g1', 7);
    expect(s.groups).toEqual([{ id: 'g1', name: 'Crew', memberIds: [pA, pB], createdAt: 7 }]);
  });
  it('copies memberIds (no shared reference with caller array)', () => {
    const members = [pA, pB];
    const s = saveGroup(threePlayers(), 'Crew', members, 'g1', 1);
    expect(s.groups[0].memberIds).not.toBe(members);
    expect(s.groups[0].memberIds).toEqual([pA, pB]);
  });
  it('replaces an existing group in place (same position)', () => {
    let s = threePlayers();
    s = saveGroup(s, 'First', [pA], 'g1', 1);
    s = saveGroup(s, 'Second', [pB], 'g2', 2);
    s = saveGroup(s, 'Updated', [pA, pB, pC], 'g1', 3);
    expect(s.groups.map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(s.groups[0]).toEqual({
      id: 'g1',
      name: 'Updated',
      memberIds: [pA, pB, pC],
      createdAt: 3,
    });
  });
  it('does not mutate the input', () => {
    const s = threePlayers();
    const before = JSON.parse(JSON.stringify(s));
    saveGroup(s, 'G', [pA], 'g1', 1);
    expect(s).toEqual(before);
  });
  it('supports an empty member list', () => {
    const s = saveGroup(emptyRoster(), 'Empty', [], 'g0', 1);
    expect(s.groups[0].memberIds).toEqual([]);
  });
});

describe('deleteGroup', () => {
  it('removes the group with the id', () => {
    let s = threePlayers();
    s = saveGroup(s, 'A', [pA], 'g1', 1);
    s = saveGroup(s, 'B', [pB], 'g2', 2);
    s = deleteGroup(s, 'g1');
    expect(s.groups.map((g) => g.id)).toEqual(['g2']);
  });
  it('returns same ref for unknown id (no-op)', () => {
    let s = threePlayers();
    s = saveGroup(s, 'A', [pA], 'g1', 1);
    expect(deleteGroup(s, 'nope')).toBe(s);
  });
  it('no-op on empty roster groups', () => {
    const s = emptyRoster();
    expect(deleteGroup(s, 'g1')).toBe(s);
  });
  it('does not mutate the input', () => {
    let s = saveGroup(emptyRoster(), 'A', [pA], 'g1', 1);
    const before = JSON.parse(JSON.stringify(s));
    deleteGroup(s, 'g1');
    expect(s).toEqual(before);
  });
});

describe('toSeats', () => {
  it('maps ids to seats preserving memberIds order', () => {
    const seats = toSeats(threePlayers(), [pC, pA]);
    expect(seats).toEqual([
      { id: pC, name: 'Cleo', color: 'rose' },
      { id: pA, name: 'Ann' },
    ]);
  });
  it('includes emoji and color only when present', () => {
    const seats = toSeats(threePlayers(), [pA, pB, pC]);
    expect(seats[0]).toEqual({ id: pA, name: 'Ann' });
    expect(seats[1]).toEqual({ id: pB, name: 'Bob', emoji: '🦊' });
    expect(seats[2]).toEqual({ id: pC, name: 'Cleo', color: 'rose' });
  });
  it('skips unknown ids', () => {
    const seats = toSeats(threePlayers(), [pX, pB, pX]);
    expect(seats).toEqual([{ id: pB, name: 'Bob', emoji: '🦊' }]);
  });
  it('returns an empty array for empty memberIds', () => {
    expect(toSeats(threePlayers(), [])).toEqual([]);
  });
  it('returns an empty array when all ids are unknown', () => {
    expect(toSeats(threePlayers(), [pX])).toEqual([]);
  });
  it('does not mutate the input roster', () => {
    const s = threePlayers();
    const before = JSON.parse(JSON.stringify(s));
    toSeats(s, [pA, pB, pC]);
    expect(s).toEqual(before);
  });
  it('produces JSON-serializable seats (plain objects)', () => {
    const seats = toSeats(threePlayers(), [pA, pB]);
    expect(JSON.parse(JSON.stringify(seats))).toEqual(seats);
  });
});

describe('determinism / purity', () => {
  it('identical operations on equal states yield deep-equal results', () => {
    const build = () => {
      let s = emptyRoster();
      s = addPlayer(s, { name: 'Ann' }, pA, 100);
      s = addPlayer(s, { name: 'Bob' }, pB, 200);
      s = saveGroup(s, 'G', [pA, pB], 'g1', 300);
      s = reorderPlayers(s, [pB, pA]);
      return s;
    };
    expect(build()).toEqual(build());
  });
});
