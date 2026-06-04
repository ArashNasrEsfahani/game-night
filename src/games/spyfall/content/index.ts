import core from './core.json';
import type { SpyfallLocation, SpyfallPack } from './types';

export type { SpyfallLocation, SpyfallRole, SpyfallPack } from './types';

export const PACKS: SpyfallPack[] = [core as SpyfallPack];

export const PACK_BY_ID: Record<string, SpyfallPack> = Object.fromEntries(
  PACKS.map((p) => [p.id, p]),
);

/** Flat catalog of all locations across the enabled packs (first wins on id collision). */
export function buildCatalog(enabledPackIds: string[]): SpyfallLocation[] {
  const ids = enabledPackIds.length ? enabledPackIds : ['core'];
  const seen = new Set<string>();
  const out: SpyfallLocation[] = [];
  for (const pid of ids) {
    for (const loc of PACK_BY_ID[pid]?.locations ?? []) {
      if (!seen.has(loc.id)) {
        seen.add(loc.id);
        out.push(loc);
      }
    }
  }
  return out;
}

export const ALL_LOCATIONS: SpyfallLocation[] = buildCatalog(PACKS.map((p) => p.id));
export const LOCATION_BY_ID: Record<string, SpyfallLocation> = Object.fromEntries(
  ALL_LOCATIONS.map((l) => [l.id, l]),
);

export function roleName(locationId: string, roleId: string): { en: string; fa: string } | undefined {
  return LOCATION_BY_ID[locationId]?.roles.find((r) => r.id === roleId)?.name;
}

export function validateContent(): string[] {
  const problems: string[] = [];
  const locSeen = new Set<string>();
  for (const pack of PACKS) {
    for (const loc of pack.locations) {
      if (locSeen.has(loc.id)) problems.push(`duplicate location ${loc.id}`);
      locSeen.add(loc.id);
      if (!loc.name?.en?.trim() || !loc.name?.fa?.trim()) problems.push(`empty location name ${loc.id}`);
      if (loc.roles.length < 1) problems.push(`no roles ${loc.id}`);
      const roleSeen = new Set<string>();
      for (const r of loc.roles) {
        if (roleSeen.has(r.id)) problems.push(`duplicate role ${loc.id}.${r.id}`);
        roleSeen.add(r.id);
        if (!r.name?.en?.trim() || !r.name?.fa?.trim()) problems.push(`empty role name ${loc.id}.${r.id}`);
      }
    }
  }
  return problems;
}
