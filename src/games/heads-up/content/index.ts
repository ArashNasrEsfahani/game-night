import animals from './animals.json';
import movies from './movies.json';
import actions from './actions.json';
import food from './food.json';
import tv from './tv.json';
import type { LocalizedString } from '../../../sdk/types';

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export interface Card {
  id: string;
  word: LocalizedString;
  hint?: LocalizedString;
  /** easy = common single word, medium = trickier, hard = compound / obscure (e.g. "Gray Fox").
   *  Missing is treated as 'medium' for back-compat. */
  difficulty?: Difficulty;
}

/** A card's effective tier (untagged content counts as 'medium'). */
export const cardDifficulty = (c: Card): Difficulty => c.difficulty ?? 'medium';

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

/** Namespaced card-id pool for the chosen decks (NOT shuffled), optionally filtered by difficulty.
 *  Omitting `difficulties` (or passing all three) includes every card. */
export function mergedPool(deckIds: string[], difficulties?: Difficulty[]): string[] {
  const ids = deckIds.length ? deckIds : [DECKS[0].id];
  const allow = difficulties && difficulties.length ? new Set(difficulties) : null;
  return ids.flatMap((id) =>
    (DECK_BY_ID[id]?.cards ?? [])
      .filter((c) => !allow || allow.has(cardDifficulty(c)))
      .map((c) => `${id}:${c.id}`),
  );
}

/** How many cards each chosen deck has per tier — drives the Setup difficulty hints. */
export function deckDifficultyCounts(deckIds: string[]): Record<Difficulty, number> {
  const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const ids = deckIds.length ? deckIds : [DECKS[0].id];
  for (const id of ids)
    for (const c of DECK_BY_ID[id]?.cards ?? []) counts[cardDifficulty(c)] += 1;
  return counts;
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
      if (c.difficulty && !DIFFICULTIES.includes(c.difficulty))
        problems.push(`bad difficulty ${key}`);
    }
  }
  return problems;
}
