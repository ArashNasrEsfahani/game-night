import classic from './classic.json';
import spicy from './spicy.json';
import work from './work.json';
import type { Intensity, MltDeck, MltPrompt } from './types';
import type { DatasetDescriptor, EnumFieldDef } from '../../../content/types';
import { objectFileDataset } from '../../../content/datasetBuilders';
import { registerRebuilder } from '../../../content/overrides';

export type { Intensity, MltDeck, MltPrompt } from './types';

const GAME = 'most-likely-to';

const INTENSITY_FIELD: EnumFieldDef = {
  key: 'intensity',
  label: { en: 'Intensity', fa: 'شدت' },
  default: 'casual',
  options: [
    { value: 'family', label: { en: 'Family', fa: 'خانوادگی' } },
    { value: 'casual', label: { en: 'Casual', fa: 'معمولی' } },
    { value: 'spicy', label: { en: 'Spicy', fa: 'تند' } },
  ],
};

const DEFAULT_DECKS: MltDeck[] = [classic as MltDeck, spicy as MltDeck, work as MltDeck];

export const DATASETS: DatasetDescriptor[] = DEFAULT_DECKS.map((deck) =>
  objectFileDataset({
    gameId: GAME,
    datasetId: deck.id,
    itemsKey: 'prompts',
    defaultFile: deck,
    sourcePath: `src/games/most-likely-to/content/${deck.id}.json`,
    title: deck.name,
    itemNoun: { en: 'prompt', fa: 'سوال' },
    idPrefix: `mlt-${deck.id}-`,
    locFields: [{ key: 'text', label: { en: 'Most likely to…', fa: 'به احتمال زیاد…' }, multiline: true }],
    enumFields: [INTENSITY_FIELD],
    textFields: [{ key: 'emoji', label: { en: 'Emoji (optional)', fa: 'ایموجی (اختیاری)' } }],
  }),
);

export const DECKS: MltDeck[] = [];
export const DECK_BY_ID: Record<string, MltDeck> = {};
export const PROMPT_BY_ID: Record<string, MltPrompt> = {};

function rebuild(): void {
  DECKS.length = 0;
  DECKS.push(...DATASETS.map((d) => d.readFile() as MltDeck));
  for (const k of Object.keys(DECK_BY_ID)) delete DECK_BY_ID[k];
  for (const d of DECKS) DECK_BY_ID[d.id] = d;
  for (const k of Object.keys(PROMPT_BY_ID)) delete PROMPT_BY_ID[k];
  for (const p of DECKS.flatMap((d) => d.prompts)) PROMPT_BY_ID[p.id] = p;
}
registerRebuilder(rebuild);

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
