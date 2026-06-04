// src/games/registry.ts — auto-discovery: adding a game folder is all it takes.
import type { AnyGameModule, GameId, GameManifest } from '../sdk/types';

const modules = import.meta.glob<{ default: AnyGameModule }>('./*/index.ts', {
  eager: true,
});

function validate(m: AnyGameModule, key: string): void {
  if (!m?.manifest?.id) throw new Error(`Game at ${key} is missing manifest.id`);
  if (!m.logic?.reducer || !m.logic?.createInitialState)
    throw new Error(`Game "${m.manifest.id}" missing pure logic`);
  if (!m.screens?.Setup || !m.screens?.Play || !m.screens?.Results)
    throw new Error(`Game "${m.manifest.id}" missing a required screen`);
}

const byId = new Map<GameId, AnyGameModule>();
for (const [key, mod] of Object.entries(modules)) {
  const m = mod.default;
  validate(m, key);
  const folder = key.split('/')[1];
  if (import.meta.env.DEV && folder !== m.manifest.id)
    throw new Error(`Folder "${folder}" != manifest.id "${m.manifest.id}"`);
  if (byId.has(m.manifest.id)) throw new Error(`Duplicate game id "${m.manifest.id}"`);
  byId.set(m.manifest.id, m);
}

export function getGame(id: GameId): AnyGameModule | undefined {
  return byId.get(id);
}

export function allGames(): AnyGameModule[] {
  return [...byId.values()];
}

export function getCatalog(opts?: { includeExperimental?: boolean }): GameManifest[] {
  return allGames()
    .map((m) => m.manifest)
    .filter((mf) => opts?.includeExperimental || !mf.experimental)
    .sort(
      (a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id),
    );
}
