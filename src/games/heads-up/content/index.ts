import animals from './animals.json';
import movies from './movies.json';
import actions from './actions.json';
import food from './food.json';
import tv from './tv.json';
import type { LocalizedString } from '../../../sdk/types';

export interface Card {
  id: string;
  word: LocalizedString;
  hint?: LocalizedString;
}

export interface Deck {
  id: string;
  name: LocalizedString;
  category: string;
  icon: string;
  cards: Card[];
}

export const DECKS: Deck[] = [animals as Deck, movies as Deck, tv as Deck, actions as Deck, food as Deck];

export const DECK_BY_ID: Record<string, Deck> = Object.fromEntries(DECKS.map((d) => [d.id, d]));

/** A merged card identified by a namespaced key `<deckId>:<cardId>`. */
export const CARD_BY_KEY: Record<string, Card> = Object.fromEntries(
  DECKS.flatMap((d) => d.cards.map((c) => [`${d.id}:${c.id}`, c])),
);

/** Namespaced card-id pool for the chosen decks (NOT shuffled). */
export function mergedPool(deckIds: string[]): string[] {
  const ids = deckIds.length ? deckIds : [DECKS[0].id];
  return ids.flatMap((id) => (DECK_BY_ID[id]?.cards ?? []).map((c) => `${id}:${c.id}`));
}

export function validateContent(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const d of DECKS) {
    for (const c of d.cards) {
      const key = `${d.id}:${c.id}`;
      if (seen.has(key)) problems.push(`duplicate ${key}`);
      seen.add(key);
      if (!c.word?.en?.trim() || !c.word?.fa?.trim()) problems.push(`empty word ${key}`);
    }
  }
  return problems;
}
