import movies from './movies.json';
import animals from './animals.json';
import actions from './actions.json';
import famous from './famous.json';
import tv from './tv.json';
import proverbs from './proverbs.json';
import sports from './sports.json';
import jobs from './jobs.json';
import type {
  PantomimeCategory,
  PantomimeDeckFile,
  PantomimeDifficulty,
  PantomimePrompt,
  RealCategory,
} from './types';
import type { LocalizedString } from '../../../sdk/types';
import type { DatasetDescriptor, EnumFieldDef } from '../../../content/types';
import { objectFileDataset } from '../../../content/datasetBuilders';
import { registerRebuilder } from '../../../content/overrides';

export type {
  PantomimeCategory,
  PantomimeDifficulty,
  PantomimePrompt,
  PantomimeDeckFile,
  RealCategory,
} from './types';

export const REAL_CATEGORIES: RealCategory[] = ['movies', 'tv', 'animals', 'actions', 'famous', 'proverbs', 'sports', 'jobs'];

const GAME = 'pantomime';

const CATEGORY_TITLES: Record<RealCategory, LocalizedString> = {
  movies: { en: 'Movies', fa: 'فیلم‌ها' },
  tv: { en: 'TV Shows', fa: 'سریال‌ها' },
  animals: { en: 'Animals', fa: 'حیوانات' },
  actions: { en: 'Actions', fa: 'کارها' },
  famous: { en: 'Famous People', fa: 'آدم‌های مشهور' },
  proverbs: { en: 'Proverbs', fa: 'ضرب‌المثل‌ها' },
  sports: { en: 'Sports', fa: 'ورزش' },
  jobs: { en: 'Jobs', fa: 'مشاغل' },
};

const DEFAULT_FILES: Record<RealCategory, PantomimeDeckFile> = {
  movies: movies as PantomimeDeckFile,
  tv: tv as PantomimeDeckFile,
  animals: animals as PantomimeDeckFile,
  actions: actions as PantomimeDeckFile,
  famous: famous as PantomimeDeckFile,
  proverbs: proverbs as PantomimeDeckFile,
  sports: sports as PantomimeDeckFile,
  jobs: jobs as PantomimeDeckFile,
};

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

export const DATASETS: DatasetDescriptor[] = REAL_CATEGORIES.map((cat) =>
  objectFileDataset({
    gameId: GAME,
    datasetId: cat,
    itemsKey: 'prompts',
    defaultFile: DEFAULT_FILES[cat],
    sourcePath: `src/games/pantomime/content/${cat}.json`,
    title: CATEGORY_TITLES[cat],
    itemNoun: { en: 'prompt', fa: 'کلمه' },
    idPrefix: `${cat}.`,
    locFields: [
      { key: 'text', label: { en: 'Phrase to act out', fa: 'عبارت برای اجرا' } },
      { key: 'hint', label: { en: 'Acting hint (optional)', fa: 'سرنخ اجرا (اختیاری)' }, optional: true },
    ],
    enumFields: [DIFFICULTY_FIELD],
    constantFields: { category: cat },
  }),
);

const DATASET_BY_CAT = Object.fromEntries(
  REAL_CATEGORIES.map((c, idx) => [c, DATASETS[idx]]),
) as Record<RealCategory, DatasetDescriptor>;

/** Static content indexed by real category. */
export const CONTENT: Record<RealCategory, PantomimePrompt[]> = {
  movies: [],
  tv: [],
  animals: [],
  actions: [],
  famous: [],
  proverbs: [],
  sports: [],
  jobs: [],
};
export const ALL_PROMPTS: PantomimePrompt[] = [];
export const PROMPT_BY_ID: Record<string, PantomimePrompt> = {};

function rebuild(): void {
  for (const cat of REAL_CATEGORIES) {
    CONTENT[cat] = (DATASET_BY_CAT[cat].readFile() as PantomimeDeckFile).prompts;
  }
  ALL_PROMPTS.length = 0;
  ALL_PROMPTS.push(...REAL_CATEGORIES.flatMap((c) => CONTENT[c]));
  for (const k of Object.keys(PROMPT_BY_ID)) delete PROMPT_BY_ID[k];
  for (const p of ALL_PROMPTS) PROMPT_BY_ID[p.id] = p;
}
registerRebuilder(rebuild);

/** Expand "mixed" to all real categories; de-duplicate to real categories only. */
export function resolveCategories(categories: PantomimeCategory[]): RealCategory[] {
  if (categories.length === 0 || categories.includes('mixed')) return [...REAL_CATEGORIES];
  const reals = categories.filter((c): c is RealCategory => c !== 'mixed');
  return reals.length ? reals : [...REAL_CATEGORIES];
}

/** Return prompts for the requested categories + difficulties (used to build the deck pool). */
export function selectPrompts(
  categories: PantomimeCategory[],
  difficulties: PantomimeDifficulty[],
): PantomimePrompt[] {
  const cats = resolveCategories(categories);
  const diffs = difficulties.length ? difficulties : (['easy', 'medium', 'hard'] as const);
  return cats
    .flatMap((c) => CONTENT[c] ?? [])
    .filter((p) => diffs.includes(p.difficulty));
}

/** Return prompt ids for the requested filters. */
export function selectPromptIds(
  categories: PantomimeCategory[],
  difficulties: PantomimeDifficulty[],
): string[] {
  return selectPrompts(categories, difficulties).map((p) => p.id);
}

/** Dev/test integrity check of all content. Returns a list of problems ([] = ok). */
export function validateContent(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const p of ALL_PROMPTS) {
    if (seen.has(p.id)) problems.push(`duplicate id ${p.id}`);
    seen.add(p.id);
    if (!p.text?.en?.trim() || !p.text?.fa?.trim()) problems.push(`empty text ${p.id}`);
    if (!['easy', 'medium', 'hard'].includes(p.difficulty))
      problems.push(`bad difficulty ${p.id}`);
  }
  REAL_CATEGORIES.forEach((cat) => {
    CONTENT[cat].forEach((p) => {
      if (p.category !== cat) problems.push(`category mismatch ${p.id} (in ${cat})`);
    });
  });
  return problems;
}
