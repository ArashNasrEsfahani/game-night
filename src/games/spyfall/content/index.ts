import core from './core.json';
import modern from './modern.json';
import type { SpyfallLocation, SpyfallPack } from './types';
import type { DatasetDescriptor } from '../../../content/types';
import { objectFileDataset } from '../../../content/datasetBuilders';
import { registerRebuilder } from '../../../content/overrides';

export type { SpyfallLocation, SpyfallRole, SpyfallPack } from './types';

const GAME = 'spyfall';

const locationDataset = (
  datasetId: string,
  defaultFile: unknown,
  sourcePath: string,
  title: { en: string; fa: string },
): DatasetDescriptor =>
  objectFileDataset({
    gameId: GAME,
    datasetId,
    itemsKey: 'locations',
    defaultFile,
    sourcePath,
    title,
    itemNoun: { en: 'location', fa: 'مکان' },
    idPrefix: `${datasetId}-loc-`,
    locFields: [{ key: 'name', label: { en: 'Location name', fa: 'نام مکان' } }],
    textFields: [{ key: 'icon', label: { en: 'Icon (emoji)', fa: 'آیکون (ایموجی)' } }],
    subList: {
      key: 'roles',
      itemNoun: { en: 'role', fa: 'نقش' },
      idPrefix: 'role-',
      locFields: [{ key: 'name', label: { en: 'Role', fa: 'نقش' } }],
    },
  });

export const DATASETS: DatasetDescriptor[] = [
  locationDataset('core', core, 'src/games/spyfall/content/core.json', { en: 'Classic Locations', fa: 'مکان‌های کلاسیک' }),
  locationDataset('modern', modern, 'src/games/spyfall/content/modern.json', { en: 'Modern Places', fa: 'مکان‌های امروزی' }),
];

export const PACKS: SpyfallPack[] = [];
export const PACK_BY_ID: Record<string, SpyfallPack> = {};

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

export const ALL_LOCATIONS: SpyfallLocation[] = [];
export const LOCATION_BY_ID: Record<string, SpyfallLocation> = {};

function rebuild(): void {
  PACKS.length = 0;
  PACKS.push(...DATASETS.map((d) => d.readFile() as SpyfallPack));
  for (const k of Object.keys(PACK_BY_ID)) delete PACK_BY_ID[k];
  for (const p of PACKS) PACK_BY_ID[p.id] = p;

  const catalog = buildCatalog(PACKS.map((p) => p.id));
  ALL_LOCATIONS.length = 0;
  ALL_LOCATIONS.push(...catalog);
  for (const k of Object.keys(LOCATION_BY_ID)) delete LOCATION_BY_ID[k];
  for (const l of ALL_LOCATIONS) LOCATION_BY_ID[l.id] = l;
}
registerRebuilder(rebuild);

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
