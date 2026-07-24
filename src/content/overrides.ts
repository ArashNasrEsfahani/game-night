// src/content/overrides.ts — the runtime content-override layer.
//
// Why this exists: every game bakes its words/phrases in from JSON at build time
// (see each game's content/index.ts). The Content Studio lets you edit those datasets
// on-device; this module is where the edits live and how they reach the games.
//
// Mechanics:
//  • Edits are stored per source file, keyed "<gameId>/<datasetId>", in IndexedDB.
//  • An in-memory cache mirrors IDB so reads are synchronous.
//  • Each game's content module registers a `rebuilder` that re-derives its exported
//    constants (DECKS, *_BY_ID, …) IN PLACE from the effective data. Mutating in place
//    (rather than reassigning) keeps every captured alias — e.g. `PACK_LIST = PACKS` —
//    valid, so the games "naturally" pick up the new content with zero per-screen wiring.
//  • loadAllOverrides() runs once at boot (main.tsx) BEFORE the first render, so the very
//    first screen a player sees already reflects their edits.
import { get, set, del, keys } from 'idb-keyval';
import { CONTENT_EDITING_ENABLED } from './config';

/** IDB key prefix; keeps content overrides clearly separate from the `sgw.*` zustand stores. */
const PREFIX = 'content-override:';

const cache = new Map<string, unknown>();
const rebuilders = new Set<() => void>();
const listeners = new Set<() => void>();
let version = 0;
let loaded = false;

const fullKey = (gameId: string, datasetId: string) => `${gameId}/${datasetId}`;

/** Synchronous read of the current override for a dataset (undefined = use the default). */
export function readOverride<T>(gameId: string, datasetId: string): T | undefined {
  return cache.get(fullKey(gameId, datasetId)) as T | undefined;
}

/** True once an edit has been saved for this dataset. */
export function hasOverride(gameId: string, datasetId: string): boolean {
  return cache.has(fullKey(gameId, datasetId));
}

/** Register a function that re-derives a content module's exports from effective data.
 *  Called immediately (builds from defaults at import) and again whenever overrides change. */
export function registerRebuilder(fn: () => void): void {
  rebuilders.add(fn);
  fn();
}

function rebuildAll(): void {
  for (const fn of rebuilders) {
    try {
      fn();
    } catch (err) {
      console.error('[content] rebuilder failed', err);
    }
  }
  version += 1;
  for (const cb of listeners) cb();
}

/** Load every saved override from IndexedDB into the cache, then rebuild all games.
 *  Resilient: if IDB is unavailable (private mode, etc.) the app simply runs on defaults. */
export async function loadAllOverrides(): Promise<void> {
  // RELEASE lockdown: never read overrides — games use the committed built-in JSON only.
  if (!CONTENT_EDITING_ENABLED) {
    loaded = true;
    return;
  }
  try {
    const all = await keys();
    for (const k of all) {
      if (typeof k !== 'string' || !k.startsWith(PREFIX)) continue;
      const value = await get(k);
      if (value !== undefined) cache.set(k.slice(PREFIX.length), value);
    }
  } catch (err) {
    console.error('[content] failed to load overrides; using defaults', err);
  } finally {
    loaded = true;
    rebuildAll();
  }
}

export const overridesLoaded = () => loaded;

/** Save an edited dataset. Updates the cache, persists to IDB, and rebuilds the games. */
export async function writeOverride<T>(gameId: string, datasetId: string, data: T): Promise<void> {
  const k = fullKey(gameId, datasetId);
  cache.set(k, data);
  rebuildAll();
  try {
    await set(PREFIX + k, data);
  } catch (err) {
    console.error('[content] failed to persist override', err);
    throw err;
  }
}

/** Drop a dataset's override, reverting the game to its built-in default. */
export async function resetOverride(gameId: string, datasetId: string): Promise<void> {
  const k = fullKey(gameId, datasetId);
  cache.delete(k);
  rebuildAll();
  try {
    await del(PREFIX + k);
  } catch (err) {
    console.error('[content] failed to delete override', err);
    throw err;
  }
}

/** Remove every content override (used by the Studio's "reset everything"). */
export async function resetAllOverrides(): Promise<void> {
  const present = [...cache.keys()];
  cache.clear();
  rebuildAll();
  try {
    await Promise.all(present.map((k) => del(PREFIX + k)));
  } catch (err) {
    console.error('[content] failed to clear overrides', err);
    throw err;
  }
}

/* ── React glue: a version counter the Studio subscribes to ── */
export const getOverridesVersion = (): number => version;
export function subscribeOverrides(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
