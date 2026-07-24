import classic from './classic.en-fa.json';
import spicy from './spicy.en-fa.json';
import travel from './travel.en-fa.json';
import type { Intensity, WyrDeck, WyrItem } from './types';
import type { DatasetDescriptor, EnumFieldDef } from '../../../content/types';
import { objectFileDataset } from '../../../content/datasetBuilders';
import { registerRebuilder } from '../../../content/overrides';

export type { Intensity, WyrDeck, WyrItem } from './types';

const GAME = 'would-you-rather';

const INTENSITY_FIELD: EnumFieldDef = {
  key: 'intensity',
  label: { en: 'Intensity', fa: 'شدت' },
  default: 'mild',
  options: [
    { value: 'mild', label: { en: 'Mild', fa: 'ملایم' } },
    { value: 'medium', label: { en: 'Medium', fa: 'متوسط' } },
    { value: 'spicy', label: { en: 'Spicy', fa: 'تند' } },
    { value: 'risky', label: { en: 'Risky', fa: 'پرریسک' } },
  ],
};

const DECK_FILES: { deck: WyrDeck; file: string }[] = [
  { deck: classic as WyrDeck, file: 'classic.en-fa.json' },
  { deck: spicy as WyrDeck, file: 'spicy.en-fa.json' },
  { deck: travel as WyrDeck, file: 'travel.en-fa.json' },
];

export const DATASETS: DatasetDescriptor[] = DECK_FILES.map(({ deck, file }) =>
  objectFileDataset({
    gameId: GAME,
    datasetId: deck.id,
    itemsKey: 'items',
    defaultFile: deck,
    sourcePath: `src/games/would-you-rather/content/${file}`,
    title: deck.name,
    itemNoun: { en: 'dilemma', fa: 'دوراهی' },
    idPrefix: `${deck.id}-`,
    locFields: [
      { key: 'optionA', label: { en: 'Option A', fa: 'گزینه الف' }, multiline: true },
      { key: 'optionB', label: { en: 'Option B', fa: 'گزینه ب' }, multiline: true },
    ],
    enumFields: [INTENSITY_FIELD],
  }),
);

export const DECKS: WyrDeck[] = [];
export const DECK_BY_ID: Record<string, WyrDeck> = {};
export const ITEM_BY_ID: Record<string, WyrItem> = {};

function rebuild(): void {
  DECKS.length = 0;
  DECKS.push(...DATASETS.map((d) => d.readFile() as WyrDeck));
  for (const k of Object.keys(DECK_BY_ID)) delete DECK_BY_ID[k];
  for (const d of DECKS) DECK_BY_ID[d.id] = d;
  for (const k of Object.keys(ITEM_BY_ID)) delete ITEM_BY_ID[k];
  for (const it of DECKS.flatMap((d) => d.items)) ITEM_BY_ID[it.id] = it;
}
registerRebuilder(rebuild);

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
