import coreDefault from './core.json';
import natureDefault from './nature.json';
import type { LocalizedString } from '../../../sdk/types';
import type { DatasetDescriptor } from '../../../content/types';
import { objectFileDataset } from '../../../content/datasetBuilders';
import { registerRebuilder } from '../../../content/overrides';

export interface WordEntry {
  id: string;
  text: LocalizedString;
  difficulty?: 1 | 2 | 3;
  tags?: string[];
}

export interface WordPack {
  id: string;
  name: LocalizedString;
  version: number;
  words: WordEntry[];
}

const GAME = 'codenames';

/** Editable datasets exposed to the Content Studio (one per word pack). */
export const DATASETS: DatasetDescriptor[] = [
  objectFileDataset({
    gameId: GAME,
    datasetId: 'core',
    itemsKey: 'words',
    defaultFile: coreDefault,
    sourcePath: 'src/games/codenames/content/core.json',
    title: { en: 'Core Words', fa: 'واژگان پایه' },
    itemNoun: { en: 'word', fa: 'واژه' },
    idPrefix: 'word-',
    locFields: [{ key: 'text', label: { en: 'Word', fa: 'واژه' } }],
  }),
  objectFileDataset({
    gameId: GAME,
    datasetId: 'nature',
    itemsKey: 'words',
    defaultFile: natureDefault,
    sourcePath: 'src/games/codenames/content/nature.json',
    title: { en: 'Nature', fa: 'طبیعت' },
    itemNoun: { en: 'word', fa: 'واژه' },
    idPrefix: 'nat-',
    locFields: [{ key: 'text', label: { en: 'Word', fa: 'واژه' } }],
  }),
];

// Live exports — rebuilt in place from effective (default + override) data so every alias
// stays valid and the game naturally reflects edits made in the Content Studio.
export const WORD_PACKS: WordPack[] = [];
export const DEFAULT_PACK_ID = 'core';
export const PACK_BY_ID: Record<string, WordPack> = {};

function rebuild(): void {
  WORD_PACKS.length = 0;
  WORD_PACKS.push(...DATASETS.map((d) => d.readFile() as WordPack));
  for (const k of Object.keys(PACK_BY_ID)) delete PACK_BY_ID[k];
  for (const p of WORD_PACKS) PACK_BY_ID[p.id] = p;
}
registerRebuilder(rebuild);

/** Flatten + de-duplicate (first wins) the selected packs into a candidate pool. */
export function mergedPool(packIds: string[]): WordEntry[] {
  const ids = packIds.length ? packIds : [DEFAULT_PACK_ID];
  const seen = new Set<string>();
  const out: WordEntry[] = [];
  for (const pid of ids) {
    for (const w of PACK_BY_ID[pid]?.words ?? []) {
      if (!seen.has(w.id)) {
        seen.add(w.id);
        out.push(w);
      }
    }
  }
  return out;
}

export function validateContent(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const pack of WORD_PACKS) {
    if (pack.words.length < 25) problems.push(`pack ${pack.id} has < 25 words`);
    for (const w of pack.words) {
      if (seen.has(w.id)) problems.push(`duplicate id ${w.id}`);
      seen.add(w.id);
      if (!w.text?.en?.trim() || !w.text?.fa?.trim()) problems.push(`empty text ${w.id}`);
    }
  }
  return problems;
}
