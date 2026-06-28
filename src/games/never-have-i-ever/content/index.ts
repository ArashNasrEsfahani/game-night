import classic from './statements.classic.json';
import spicy from './statements.spicy.json';
import wild from './statements.wild.json';
import type { Intensity, Statement, StatementDeckFile } from './types';
import type { DatasetDescriptor } from '../../../content/types';
import { objectFileDataset } from '../../../content/datasetBuilders';
import { registerRebuilder } from '../../../content/overrides';

export type { Intensity, Statement, StatementDeckFile } from './types';

export const INTENSITIES: Intensity[] = ['classic', 'spicy', 'wild'];

const GAME = 'never-have-i-ever';

const DEFAULT_FILES: Record<Intensity, StatementDeckFile> = {
  classic: classic as StatementDeckFile,
  spicy: spicy as StatementDeckFile,
  wild: wild as StatementDeckFile,
};

const TITLES: Record<Intensity, { en: string; fa: string }> = {
  classic: { en: 'Classic', fa: 'کلاسیک' },
  spicy: { en: 'Spicy', fa: 'تند' },
  wild: { en: 'Wild', fa: 'وحشی' },
};

export const DATASETS: DatasetDescriptor[] = INTENSITIES.map((intensity) =>
  objectFileDataset({
    gameId: GAME,
    datasetId: `statements.${intensity}`,
    itemsKey: 'items',
    defaultFile: DEFAULT_FILES[intensity],
    sourcePath: `src/games/never-have-i-ever/content/statements.${intensity}.json`,
    title: TITLES[intensity],
    itemNoun: { en: 'statement', fa: 'جمله' },
    idPrefix: `nhie-${intensity[0]}-`,
    locFields: [
      { key: 'text', label: { en: 'Never have I ever…', fa: 'من هیچ‌وقت…' }, multiline: true },
    ],
    constantFields: { intensity },
  }),
);

const DATASET_BY_INTENSITY = Object.fromEntries(
  INTENSITIES.map((i, idx) => [i, DATASETS[idx]]),
) as Record<Intensity, DatasetDescriptor>;

export const CONTENT: Record<Intensity, Statement[]> = { classic: [], spicy: [], wild: [] };
export const ALL_STATEMENTS: Statement[] = [];
export const STATEMENT_BY_ID: Record<string, Statement> = {};
export const DECK_VERSIONS: Record<Intensity, number> = { classic: 0, spicy: 0, wild: 0 };

function rebuild(): void {
  for (const i of INTENSITIES) {
    const file = DATASET_BY_INTENSITY[i].readFile() as StatementDeckFile;
    CONTENT[i] = file.items;
    DECK_VERSIONS[i] = file.version;
  }
  ALL_STATEMENTS.length = 0;
  ALL_STATEMENTS.push(...INTENSITIES.flatMap((i) => CONTENT[i]));
  for (const k of Object.keys(STATEMENT_BY_ID)) delete STATEMENT_BY_ID[k];
  for (const s of ALL_STATEMENTS) STATEMENT_BY_ID[s.id] = s;
}
registerRebuilder(rebuild);

/** Deterministic filter only (no shuffle — the reducer shuffles by seed). */
export function getDeck(opts: { intensities: Intensity[]; tags?: string[] }): Statement[] {
  const intensities = opts.intensities.length ? opts.intensities : INTENSITIES;
  let pool = intensities.flatMap((i) => CONTENT[i] ?? []);
  if (opts.tags && opts.tags.length) {
    pool = pool.filter((s) => s.tags?.some((t) => opts.tags!.includes(t)));
  }
  return pool;
}

/** Dev/test integrity check. Returns a list of problems ([] = ok). */
export function validateContent(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const s of ALL_STATEMENTS) {
    if (seen.has(s.id)) problems.push(`duplicate id ${s.id}`);
    seen.add(s.id);
    if (!s.text?.en?.trim() || !s.text?.fa?.trim()) problems.push(`empty text ${s.id}`);
    if (!INTENSITIES.includes(s.intensity)) problems.push(`bad intensity ${s.id}`);
  }
  return problems;
}
