import core from './core.json';
import type { LocalizedString } from '../../../sdk/types';

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

export const WORD_PACKS: WordPack[] = [core as WordPack];
export const DEFAULT_PACK_ID = 'core';

export const PACK_BY_ID: Record<string, WordPack> = Object.fromEntries(
  WORD_PACKS.map((p) => [p.id, p]),
);

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
