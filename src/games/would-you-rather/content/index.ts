import classic from './classic.en-fa.json';
import spicy from './spicy.en-fa.json';
import type { Intensity, WyrDeck, WyrItem } from './types';

export type { Intensity, WyrDeck, WyrItem } from './types';

export const DECKS: WyrDeck[] = [classic as WyrDeck, spicy as WyrDeck];

export const DECK_BY_ID: Record<string, WyrDeck> = Object.fromEntries(
  DECKS.map((d) => [d.id, d]),
);

export const ITEM_BY_ID: Record<string, WyrItem> = Object.fromEntries(
  DECKS.flatMap((d) => d.items).map((it) => [it.id, it]),
);

const ORDER: Intensity[] = ['mild', 'medium', 'spicy', 'risky'];

/** Items at or below the chosen intensity ceiling (NOT shuffled). */
export function poolFor(deckId: string, maxIntensity: Intensity): WyrItem[] {
  const ceil = ORDER.indexOf(maxIntensity);
  return (DECK_BY_ID[deckId]?.items ?? []).filter((it) => ORDER.indexOf(it.intensity) <= ceil);
}

export function validateContent(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const d of DECKS) {
    for (const it of d.items) {
      if (seen.has(it.id)) problems.push(`duplicate id ${it.id}`);
      seen.add(it.id);
      if (!it.optionA?.en?.trim() || !it.optionA?.fa?.trim()) problems.push(`empty A ${it.id}`);
      if (!it.optionB?.en?.trim() || !it.optionB?.fa?.trim()) problems.push(`empty B ${it.id}`);
    }
  }
  return problems;
}
