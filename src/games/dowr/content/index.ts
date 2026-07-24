import type { LocalizedString } from '../../../sdk/types';
import type { DatasetDescriptor, DatasetItem, EnumFieldDef } from '../../../content/types';
import { arrayFileDataset } from '../../../content/datasetBuilders';
import { registerRebuilder } from '../../../content/overrides';
import food from './food.json';
import objects from './objects.json';
import jobs from './jobs.json';
import places from './places.json';
import animals from './animals.json';

export type DowrCategory = 'food' | 'objects' | 'jobs' | 'places' | 'animals';
export type DowrDifficulty = 'easy' | 'med' | 'hard';

export interface WordCard {
  id: string;
  word: LocalizedString;
  category: DowrCategory;
  difficulty: DowrDifficulty;
  hints?: { taboo?: LocalizedString[] };
}

const GAME = 'dowr';

const DIFFICULTY_FIELD: EnumFieldDef = {
  key: 'difficulty',
  label: { en: 'Difficulty', fa: 'سختی' },
  default: 'easy',
  options: [
    { value: 'easy', label: { en: 'Easy', fa: 'آسان' } },
    { value: 'med', label: { en: 'Medium', fa: 'متوسط' } },
    { value: 'hard', label: { en: 'Hard', fa: 'سخت' } },
  ],
};

const CATEGORY_TITLES: Record<DowrCategory, LocalizedString> = {
  food: { en: 'Food', fa: 'خوراکی' },
  objects: { en: 'Objects', fa: 'اشیا' },
  jobs: { en: 'Jobs', fa: 'مشاغل' },
  places: { en: 'Places', fa: 'مکان‌ها' },
  animals: { en: 'Animals', fa: 'حیوانات' },
};

const DEFAULTS: Record<DowrCategory, WordCard[]> = {
  food: food as unknown as WordCard[],
  objects: objects as unknown as WordCard[],
  jobs: jobs as unknown as WordCard[],
  places: places as unknown as WordCard[],
  animals: animals as unknown as WordCard[],
};

const CATEGORIES: DowrCategory[] = ['food', 'objects', 'jobs', 'places', 'animals'];

export const DATASETS: DatasetDescriptor[] = CATEGORIES.map((cat) =>
  arrayFileDataset({
    gameId: GAME,
    datasetId: cat,
    defaultFile: DEFAULTS[cat] as unknown as DatasetItem[],
    sourcePath: `src/games/dowr/content/${cat}.json`,
    title: CATEGORY_TITLES[cat],
    itemNoun: { en: 'word', fa: 'واژه' },
    idPrefix: `${cat.slice(0, 3)}-`,
    locFields: [{ key: 'word', label: { en: 'Word', fa: 'واژه' } }],
    enumFields: [DIFFICULTY_FIELD],
    constantFields: { category: cat },
  }),
);

const DATASET_BY_CAT = Object.fromEntries(DATASETS.map((d) => [d.datasetId, d])) as Record<
  DowrCategory,
  DatasetDescriptor
>;

export const CONTENT: Record<DowrCategory, WordCard[]> = {
  food: [],
  objects: [],
  jobs: [],
  places: [],
  animals: [],
};
export const ALL_CARDS: WordCard[] = [];
export const CARD_BY_ID: Record<string, WordCard> = {};

function rebuild(): void {
  for (const cat of CATEGORIES) {
    CONTENT[cat] = DATASET_BY_CAT[cat].readFile() as WordCard[];
  }
  ALL_CARDS.length = 0;
  ALL_CARDS.push(...Object.values(CONTENT).flat());
  for (const k of Object.keys(CARD_BY_ID)) delete CARD_BY_ID[k];
  for (const c of ALL_CARDS) CARD_BY_ID[c.id] = c;
}
registerRebuilder(rebuild);
