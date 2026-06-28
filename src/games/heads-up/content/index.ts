import animals from './animals.json';
import movies from './movies.json';
import actions from './actions.json';
import food from './food.json';
import tv from './tv.json';
import sports from './sports.json';
import music from './music.json';
import brands from './brands.json';
import type { LocalizedString } from '../../../sdk/types';
import type { DatasetDescriptor, EnumFieldDef } from '../../../content/types';
import { objectFileDataset } from '../../../content/datasetBuilders';
import { registerRebuilder } from '../../../content/overrides';

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

const GAME = 'heads-up';

const DIFFICULTY_FIELD: EnumFieldDef = {
  key: 'difficulty',
  label: { en: 'Difficulty', fa: 'سختی' },
  default: 'easy',
  options: [
    { value: 'easy', label: { en: 'Easy', fa: 'آسان' } },
    { value: 'medium', label: { en: 'Medium', fa: 'متوسط' } },
    { value: 'hard', label: { en: 'Hard', fa: 'سخت' } },
  ],
};

const DEFAULT_DECKS: Deck[] = [
  animals as Deck,
  movies as Deck,
  tv as Deck,
  actions as Deck,
  food as Deck,
  sports as Deck,
  music as Deck,
  brands as Deck,
];

export const DATASETS: DatasetDescriptor[] = DEFAULT_DECKS.map((deck) =>
  objectFileDataset({
    gameId: GAME,
    datasetId: deck.id,
    itemsKey: 'cards',
    defaultFile: deck,
    sourcePath: `src/games/heads-up/content/${deck.id}.json`,
    title: deck.name,
    itemNoun: { en: 'card', fa: 'کارت' },
    idPrefix: `${deck.id}-`,
    locFields: [
      { key: 'word', label: { en: 'Word', fa: 'کلمه' } },
      { key: 'hint', label: { en: 'Hint (optional)', fa: 'سرنخ (اختیاری)' }, optional: true },
    ],
    enumFields: [DIFFICULTY_FIELD],
  }),
);

export const DECKS: Deck[] = [];
export const DECK_BY_ID: Record<string, Deck> = {};
/** A merged card identified by a namespaced key `<deckId>:<cardId>`. */
export const CARD_BY_KEY: Record<string, Card> = {};

function rebuild(): void {
  DECKS.length = 0;
  DECKS.push(...DATASETS.map((d) => d.readFile() as Deck));
  for (const k of Object.keys(DECK_BY_ID)) delete DECK_BY_ID[k];
  for (const d of DECKS) DECK_BY_ID[d.id] = d;
  for (const k of Object.keys(CARD_BY_KEY)) delete CARD_BY_KEY[k];
  for (const d of DECKS) for (const c of d.cards) CARD_BY_KEY[`${d.id}:${c.id}`] = c;
}
registerRebuilder(rebuild);

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
