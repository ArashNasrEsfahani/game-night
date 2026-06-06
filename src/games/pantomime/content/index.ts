import movies from './movies.json';
import animals from './animals.json';
import actions from './actions.json';
import famous from './famous.json';
import tv from './tv.json';
import proverbs from './proverbs.json';
import type {
  PantomimeCategory,
  PantomimeDeckFile,
  PantomimeDifficulty,
  PantomimePrompt,
  RealCategory,
} from './types';

export type {
  PantomimeCategory,
  PantomimeDifficulty,
  PantomimePrompt,
  PantomimeDeckFile,
  RealCategory,
} from './types';

export const REAL_CATEGORIES: RealCategory[] = ['movies', 'tv', 'animals', 'actions', 'famous', 'proverbs'];

/** Static content indexed by real category. */
export const CONTENT: Record<RealCategory, PantomimePrompt[]> = {
  movies: (movies as PantomimeDeckFile).prompts,
  tv: (tv as PantomimeDeckFile).prompts,
  animals: (animals as PantomimeDeckFile).prompts,
  actions: (actions as PantomimeDeckFile).prompts,
  famous: (famous as PantomimeDeckFile).prompts,
  proverbs: (proverbs as PantomimeDeckFile).prompts,
};

export const ALL_PROMPTS: PantomimePrompt[] = REAL_CATEGORIES.flatMap((c) => CONTENT[c]);

export const PROMPT_BY_ID: Record<string, PantomimePrompt> = Object.fromEntries(
  ALL_PROMPTS.map((p) => [p.id, p]),
);

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
