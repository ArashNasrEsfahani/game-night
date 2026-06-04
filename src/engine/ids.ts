// src/engine/ids.ts — the ONLY place branded ids are constructed. Casts are centralized here.
import type { PlayerId, TeamId } from '../sdk/types';

export const asPlayerId = (s: string): PlayerId => s as PlayerId;
export const asTeamId = (s: string): TeamId => s as TeamId;

let counter = 0;

/**
 * Generate a collision-resistant id string from an entropy `seed` (host-side use only —
 * never called inside a pure reducer; reducers build ids deterministically from action seeds).
 */
export function makeId(seed: number): string {
  counter = (counter + 1) >>> 0;
  return (seed >>> 0).toString(36) + '-' + counter.toString(36);
}

/** Deterministic indexed team id builder for engine.teams.createTeams / autoBalance. */
export const teamIdAt = (i: number): TeamId => asTeamId(`team-${i}`);
