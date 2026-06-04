import { shuffle } from '../../engine/rng';
import { ALL_CARDS, CONTENT } from './content';
import type { DowrCategory, WordCard } from './content';
import type { DowrOptions } from './config';

const ALL_CATS: DowrCategory[] = ['food', 'objects', 'jobs', 'places', 'animals'];

export { shuffle };

/** Flatten + filter the static content into an UNSHUFFLED pool (shuffle happens via deck/seed). */
export function buildPool(o: DowrOptions): WordCard[] {
  const cats = o.categories.length ? o.categories : ALL_CATS;
  let pool: WordCard[] = cats.flatMap((c) => CONTENT[c] ?? []);
  if (o.difficulty !== 'random') {
    pool = pool.filter((w) => w.difficulty === o.difficulty);
  }
  return pool;
}

/** Dev/test integrity check of all content. Returns a list of problems ([] = ok). */
export function validateContent(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const c of ALL_CARDS) {
    if (seen.has(c.id)) problems.push(`duplicate id ${c.id}`);
    seen.add(c.id);
    if (!c.word?.en?.trim() || !c.word?.fa?.trim()) problems.push(`empty word ${c.id}`);
    if (!['easy', 'med', 'hard'].includes(c.difficulty)) problems.push(`bad difficulty ${c.id}`);
  }
  (Object.keys(CONTENT) as (keyof typeof CONTENT)[]).forEach((cat) => {
    CONTENT[cat].forEach((c) => {
      if (c.category !== cat) problems.push(`category mismatch ${c.id} (in ${cat})`);
    });
  });
  return problems;
}
