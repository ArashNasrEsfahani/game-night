import classic from './classic.json';
import spicy from './spicy.json';
import type { Intensity, MltDeck, MltPrompt } from './types';

export type { Intensity, MltDeck, MltPrompt } from './types';

export const DECKS: MltDeck[] = [classic as MltDeck, spicy as MltDeck];

export const DECK_BY_ID: Record<string, MltDeck> = Object.fromEntries(
  DECKS.map((d) => [d.id, d]),
);

export const PROMPT_BY_ID: Record<string, MltPrompt> = Object.fromEntries(
  DECKS.flatMap((d) => d.prompts).map((p) => [p.id, p]),
);

/** Intensities included at or below the chosen ceiling. */
export function intensitiesAtOrBelow(ceiling: Intensity): Intensity[] {
  const order: Intensity[] = ['family', 'casual', 'spicy'];
  return order.slice(0, order.indexOf(ceiling) + 1);
}

/** Filter a deck's prompts by intensity ceiling (NOT shuffled — the reducer shuffles by seed). */
export function getPool(opts: { deckId: string; intensity: Intensity }): MltPrompt[] {
  const deck = DECK_BY_ID[opts.deckId] ?? DECKS[0];
  const allowed = new Set(intensitiesAtOrBelow(opts.intensity));
  return deck.prompts.filter((p) => allowed.has(p.intensity));
}

/** Dev/test integrity check. Returns problems ([] = ok). */
export function validateContent(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const d of DECKS) {
    for (const p of d.prompts) {
      if (seen.has(p.id)) problems.push(`duplicate id ${p.id}`);
      seen.add(p.id);
      if (!p.text?.en?.trim() || !p.text?.fa?.trim()) problems.push(`empty text ${p.id}`);
    }
  }
  return problems;
}
