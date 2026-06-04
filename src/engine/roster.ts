// src/engine/roster.ts — pure roster model: players + saved groups.
// No React/DOM/I/O/stores. No wall clock / RNG: `now` arrives as an argument and ids are
// supplied by the caller. All ops return NEW state (never mutate input). State is plain JSON.

import type { PlayerId, ColorToken, PlayerSeat } from '../sdk/types';

export interface Player {
  id: PlayerId;
  name: string;
  emoji?: string;
  color?: ColorToken;
  createdAt: number;
}

export interface SavedGroup {
  id: string;
  name: string;
  memberIds: PlayerId[];
  createdAt: number;
}

export interface RosterState {
  players: Player[];
  groups: SavedGroup[];
}

/** A fresh, empty roster. */
export function emptyRoster(): RosterState {
  return { players: [], groups: [] };
}

/**
 * Append a new player built from `p`, with caller-supplied `id` and `now` timestamp.
 * If a player with `id` already exists, this is a no-op (returns the input unchanged).
 */
export function addPlayer(
  s: RosterState,
  p: Omit<Player, 'id' | 'createdAt'>,
  id: PlayerId,
  now: number,
): RosterState {
  if (s.players.some((pl) => pl.id === id)) return s;
  const player: Player = { ...p, id, createdAt: now };
  return { ...s, players: [...s.players, player] };
}

/**
 * Merge `patch` into the player with `id`. Cannot change `id` (type prevents it).
 * Unknown id is a no-op (returns the input unchanged).
 */
export function updatePlayer(
  s: RosterState,
  id: PlayerId,
  patch: Partial<Omit<Player, 'id'>>,
): RosterState {
  const idx = s.players.findIndex((pl) => pl.id === id);
  if (idx === -1) return s;
  const next = s.players.slice();
  next[idx] = { ...next[idx], ...patch, id };
  return { ...s, players: next };
}

/**
 * Remove the player with `id` and strip the id from every saved group's memberIds.
 * Unknown id is a no-op (returns the input unchanged).
 */
export function removePlayer(s: RosterState, id: PlayerId): RosterState {
  if (!s.players.some((pl) => pl.id === id)) return s;
  const players = s.players.filter((pl) => pl.id !== id);
  const groups = s.groups.map((g) =>
    g.memberIds.includes(id)
      ? { ...g, memberIds: g.memberIds.filter((m) => m !== id) }
      : g,
  );
  return { players, groups };
}

/**
 * Reorder players to match `orderedIds`. Players listed in `orderedIds` come first in that
 * order; any players not mentioned keep their relative order at the end. Unknown ids in
 * `orderedIds` are ignored. Returns the input unchanged if the order does not change.
 */
export function reorderPlayers(s: RosterState, orderedIds: PlayerId[]): RosterState {
  const byId: Record<string, Player> = {};
  for (const pl of s.players) byId[pl.id] = pl;

  const seen: Record<string, true> = {};
  const ordered: Player[] = [];
  for (const id of orderedIds) {
    const pl = byId[id];
    if (pl && !seen[id]) {
      seen[id] = true;
      ordered.push(pl);
    }
  }
  for (const pl of s.players) {
    if (!seen[pl.id]) ordered.push(pl);
  }

  const unchanged =
    ordered.length === s.players.length &&
    ordered.every((pl, i) => pl === s.players[i]);
  if (unchanged) return s;

  return { ...s, players: ordered };
}

/**
 * Save (create or replace) a group with `id`. If a group with `id` exists it is replaced
 * in place (preserving its position); otherwise the new group is appended.
 */
export function saveGroup(
  s: RosterState,
  name: string,
  memberIds: PlayerId[],
  id: string,
  now: number,
): RosterState {
  const group: SavedGroup = { id, name, memberIds: [...memberIds], createdAt: now };
  const idx = s.groups.findIndex((g) => g.id === id);
  if (idx === -1) {
    return { ...s, groups: [...s.groups, group] };
  }
  const next = s.groups.slice();
  next[idx] = group;
  return { ...s, groups: next };
}

/**
 * Delete the group with `id`. Unknown id is a no-op (returns the input unchanged).
 */
export function deleteGroup(s: RosterState, id: string): RosterState {
  if (!s.groups.some((g) => g.id === id)) return s;
  return { ...s, groups: s.groups.filter((g) => g.id !== id) };
}

/**
 * Map `memberIds` to PlayerSeat snapshots, preserving the order of `memberIds` and
 * skipping any id not present in the roster.
 */
export function toSeats(s: RosterState, memberIds: PlayerId[]): PlayerSeat[] {
  const byId: Record<string, Player> = {};
  for (const pl of s.players) byId[pl.id] = pl;

  const seats: PlayerSeat[] = [];
  for (const id of memberIds) {
    const pl = byId[id];
    if (!pl) continue;
    const seat: PlayerSeat = { id: pl.id, name: pl.name };
    if (pl.emoji !== undefined) seat.emoji = pl.emoji;
    if (pl.color !== undefined) seat.color = pl.color;
    seats.push(seat);
  }
  return seats;
}
