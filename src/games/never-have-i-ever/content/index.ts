import classic from './statements.classic.json';
import spicy from './statements.spicy.json';
import wild from './statements.wild.json';
import type { Intensity, Statement, StatementDeckFile } from './types';

export type { Intensity, Statement, StatementDeckFile } from './types';

export const INTENSITIES: Intensity[] = ['classic', 'spicy', 'wild'];

const FILES: Record<Intensity, StatementDeckFile> = {
  classic: classic as StatementDeckFile,
  spicy: spicy as StatementDeckFile,
  wild: wild as StatementDeckFile,
};

export const CONTENT: Record<Intensity, Statement[]> = {
  classic: FILES.classic.items,
  spicy: FILES.spicy.items,
  wild: FILES.wild.items,
};

export const ALL_STATEMENTS: Statement[] = INTENSITIES.flatMap((i) => CONTENT[i]);

export const STATEMENT_BY_ID: Record<string, Statement> = Object.fromEntries(
  ALL_STATEMENTS.map((s) => [s.id, s]),
);

export const DECK_VERSIONS: Record<Intensity, number> = {
  classic: FILES.classic.version,
  spicy: FILES.spicy.version,
  wild: FILES.wild.version,
};

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
