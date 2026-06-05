import type { LocalizedString } from '../../../sdk/types';

/** The real decks shipped with the game. "mixed" is a virtual deck (union of all real decks). */
export type PantomimeCategory = 'movies' | 'animals' | 'actions' | 'famous' | 'tv' | 'mixed';

/** A real (non-virtual) category that maps to a content file. */
export type RealCategory = Exclude<PantomimeCategory, 'mixed'>;

export type PantomimeDifficulty = 'easy' | 'medium' | 'hard';

/** A single promptable item to mime. */
export interface PantomimePrompt {
  /** Stable unique id, namespaced by category, e.g. "movies.titanic". */
  id: string;
  /** The phrase to act out, bilingual. */
  text: LocalizedString;
  /** Which real deck this belongs to (never "mixed"). */
  category: RealCategory;
  difficulty: PantomimeDifficulty;
  /** Optional acting hint shown ONLY to the actor inside the reveal gate. */
  hint?: LocalizedString;
  /** Optional tags for future filtering; not surfaced in Phase-1 UI. */
  tags?: string[];
}

/** One JSON file per real category. */
export interface PantomimeDeckFile {
  category: RealCategory;
  /** Schema/content version for migration & sync. */
  version: number;
  prompts: PantomimePrompt[];
}
