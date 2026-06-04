// src/engine/teams.ts — pure team-assignment primitive for the game SDK.
// No React, no DOM, no I/O, no stores, no console. All randomness flows from a numeric
// seed via ./rng; there is no clock dependency here. State is plain JSON (arrays + records).
import type { PlayerId, TeamId, LocalizedString, ColorToken } from '../sdk/types';
import { shuffle } from './rng';

export interface Team {
  id: TeamId;
  name: LocalizedString | string;
  memberIds: PlayerId[];
  color?: ColorToken;
}

export interface TeamSetState {
  teams: Team[];
}

/** An empty team set (no teams). */
export function emptyTeamSet(): TeamSetState {
  return { teams: [] };
}

/**
 * Build `count` empty teams named "Team 1".."Team n".
 * Non-positive / non-finite counts produce an empty set.
 */
export function createTeams(count: number, makeId: (i: number) => TeamId): TeamSetState {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const teams: Team[] = [];
  for (let i = 0; i < n; i++) {
    teams.push({ id: makeId(i), name: `Team ${i + 1}`, memberIds: [] });
  }
  return { teams };
}

/**
 * Move `playerId` into the team identified by `teamId`, removing it from any other team first.
 * No-ops (returns the input unchanged) when the target team does not exist or the player is
 * already the sole/only resident of that team and present nowhere else.
 */
export function assign(s: TeamSetState, teamId: TeamId, playerId: PlayerId): TeamSetState {
  const targetExists = s.teams.some((t) => t.id === teamId);
  if (!targetExists) return s;

  // Already correctly placed (in the target team and not in any other team) -> no-op.
  const alreadyPlaced =
    s.teams.every((t) =>
      t.id === teamId ? t.memberIds.includes(playerId) : !t.memberIds.includes(playerId),
    );
  if (alreadyPlaced) return s;

  const teams = s.teams.map((t) => {
    if (t.id === teamId) {
      const memberIds = t.memberIds.includes(playerId)
        ? t.memberIds.slice()
        : [...t.memberIds, playerId];
      return { ...t, memberIds };
    }
    if (t.memberIds.includes(playerId)) {
      return { ...t, memberIds: t.memberIds.filter((id) => id !== playerId) };
    }
    return t;
  });
  return { teams };
}

/**
 * Remove `playerId` from whichever team contains it. No-op when the player is unassigned.
 */
export function unassign(s: TeamSetState, playerId: PlayerId): TeamSetState {
  const present = s.teams.some((t) => t.memberIds.includes(playerId));
  if (!present) return s;
  const teams = s.teams.map((t) =>
    t.memberIds.includes(playerId)
      ? { ...t, memberIds: t.memberIds.filter((id) => id !== playerId) }
      : t,
  );
  return { teams };
}

/**
 * Create `count` named empty teams, then deal a seed-shuffled copy of `playerIds`
 * round-robin across them. With count <= 0 returns an empty set (players are dropped).
 */
export function autoBalance(
  playerIds: PlayerId[],
  count: number,
  seed: number,
  makeId: (i: number) => TeamId,
): TeamSetState {
  const base = createTeams(count, makeId);
  if (base.teams.length === 0) return base;
  const dealt = shuffle(playerIds, seed);
  const teams = base.teams.map((t) => ({ ...t, memberIds: [] as PlayerId[] }));
  for (let i = 0; i < dealt.length; i++) {
    teams[i % teams.length].memberIds.push(dealt[i]);
  }
  return { teams };
}

/** Return the id of the team containing `playerId`, or undefined if unassigned. */
export function teamOf(s: TeamSetState, playerId: PlayerId): TeamId | undefined {
  for (const t of s.teams) {
    if (t.memberIds.includes(playerId)) return t.id;
  }
  return undefined;
}

/**
 * True when every id in `allPlayerIds` is assigned to some team.
 * An empty roster is trivially complete.
 */
export function isComplete(s: TeamSetState, allPlayerIds: PlayerId[]): boolean {
  if (allPlayerIds.length === 0) return true;
  const assigned = new Set<PlayerId>();
  for (const t of s.teams) {
    for (const id of t.memberIds) assigned.add(id);
  }
  return allPlayerIds.every((id) => assigned.has(id));
}
