// src/content/registry.ts — auto-discovers every game's editable datasets.
//
// A game becomes editable simply by exporting `DATASETS: DatasetDescriptor[]` from its
// content module — exactly like the game registry auto-discovers games by folder.
import type { GameManifest } from '../sdk/types';
import type { DatasetDescriptor } from './types';

type ContentModule = { DATASETS?: DatasetDescriptor[] };
type ManifestModule = { manifest?: GameManifest };

const dirModules = import.meta.glob<ContentModule>('../games/*/content/index.ts', { eager: true });
const fileModules = import.meta.glob<ContentModule>('../games/*/content.ts', { eager: true });

// Game display metadata (icon / name / category) is read from each game's lightweight `manifest.ts`,
// NOT from games/registry.ts — that registry eagerly imports every game's screens + logic, which
// would drag the whole player app into the standalone Content Studio bundle. Manifests are tiny.
const manifestModules = import.meta.glob<ManifestModule>('../games/*/manifest.ts', { eager: true });
const MANIFEST_BY_ID = new Map<string, GameManifest>();
for (const mod of Object.values(manifestModules)) {
  if (mod.manifest?.id) MANIFEST_BY_ID.set(mod.manifest.id, mod.manifest);
}

function collect(): DatasetDescriptor[] {
  const out: DatasetDescriptor[] = [];
  for (const mod of [...Object.values(dirModules), ...Object.values(fileModules)]) {
    if (Array.isArray(mod.DATASETS)) out.push(...mod.DATASETS);
  }
  return out;
}

export const ALL_DATASETS: DatasetDescriptor[] = collect();

export interface ContentGame {
  gameId: string;
  manifest: GameManifest;
  datasets: DatasetDescriptor[];
}

/** Datasets grouped by game, ordered like the home grid (category, then name). */
export const CONTENT_GAMES: ContentGame[] = (() => {
  const byGame = new Map<string, DatasetDescriptor[]>();
  for (const ds of ALL_DATASETS) {
    const list = byGame.get(ds.gameId) ?? [];
    list.push(ds);
    byGame.set(ds.gameId, list);
  }
  const games: ContentGame[] = [];
  for (const [gameId, datasets] of byGame) {
    const manifest = MANIFEST_BY_ID.get(gameId);
    if (!manifest) continue;
    games.push({ gameId, manifest, datasets });
  }
  return games.sort(
    (a, b) =>
      a.manifest.category.localeCompare(b.manifest.category) ||
      a.manifest.name.en.localeCompare(b.manifest.name.en),
  );
})();

export function getContentGame(gameId: string): ContentGame | undefined {
  return CONTENT_GAMES.find((g) => g.gameId === gameId);
}

export function getDataset(gameId: string, datasetId: string): DatasetDescriptor | undefined {
  return ALL_DATASETS.find((d) => d.gameId === gameId && d.datasetId === datasetId);
}

/** Total item counts (effective) for a game — drives the Studio summary line. */
export function gameItemCount(game: ContentGame): number {
  return game.datasets.reduce((sum, d) => sum + d.readItems().length, 0);
}
