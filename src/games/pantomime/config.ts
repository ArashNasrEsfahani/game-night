import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';
import type { PantomimeCategory, PantomimeDifficulty } from './content';
import { buildPool } from './deck';

export type PantomimeEndMode = 'targetScore' | 'rounds';

export const PANTOMIME_CATEGORIES: PantomimeCategory[] = [
  'movies',
  'animals',
  'actions',
  'famous',
  'mixed',
];
export const PANTOMIME_DIFFICULTIES: PantomimeDifficulty[] = ['easy', 'medium', 'hard'];
export const ROUND_SECONDS_CHOICES = [30, 45, 60, 90, 120] as const;
/** -1 means unlimited skips. */
export const SKIP_CHOICES = [0, 1, 2, 3, -1] as const;

export interface PantomimeOptions {
  /** Selected decks; "mixed" expands to all four real decks at resolve time. */
  categories: PantomimeCategory[];
  /** Difficulty filter; non-empty. */
  difficulties: PantomimeDifficulty[];
  /** Seconds per turn (the actor's miming window). */
  roundSeconds: number;
  /** End condition (exactly one mode). */
  endMode: PantomimeEndMode;
  /** Used when endMode === 'targetScore'. */
  targetScore: number;
  /** Used when endMode === 'rounds'. */
  totalRounds: number;
  /** Skips allowed per turn. -1 = unlimited. */
  maxSkipsPerTurn: number;
  /** If true, a skip costs the team −1 (floored at 0). */
  skipPenalty: boolean;
}

export const DEFAULT_OPTIONS: PantomimeOptions = {
  categories: ['mixed'],
  difficulties: [...PANTOMIME_DIFFICULTIES],
  roundSeconds: 60,
  endMode: 'targetScore',
  targetScore: 10,
  totalRounds: 5,
  maxSkipsPerTurn: 2,
  skipPenalty: false,
};

function oneOf<T>(value: T, choices: readonly T[], fallback: T): T {
  return choices.includes(value) ? value : fallback;
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  const n = Math.round(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeOptions(o: Partial<PantomimeOptions> | undefined): PantomimeOptions {
  const src = o ?? {};
  const categories = (src.categories ?? []).filter((c): c is PantomimeCategory =>
    PANTOMIME_CATEGORIES.includes(c as PantomimeCategory),
  );
  const difficulties = (src.difficulties ?? []).filter((d): d is PantomimeDifficulty =>
    PANTOMIME_DIFFICULTIES.includes(d as PantomimeDifficulty),
  );
  return {
    categories: categories.length ? categories : [...DEFAULT_OPTIONS.categories],
    difficulties: difficulties.length ? difficulties : [...PANTOMIME_DIFFICULTIES],
    roundSeconds: oneOf(src.roundSeconds ?? 60, ROUND_SECONDS_CHOICES, 60),
    endMode: src.endMode === 'rounds' ? 'rounds' : 'targetScore',
    targetScore: clampInt(src.targetScore, 1, 50, 10),
    totalRounds: clampInt(src.totalRounds, 1, 20, 5),
    maxSkipsPerTurn: oneOf(src.maxSkipsPerTurn ?? 2, SKIP_CHOICES, 2),
    skipPenalty: !!src.skipPenalty,
  };
}

export function readOptions(config: GameConfig): PantomimeOptions {
  return normalizeOptions(config.options as Partial<PantomimeOptions>);
}

export function defaultConfig({ players, lang }: DefaultConfigInput): GameConfig {
  return { players, lang, options: { ...DEFAULT_OPTIONS } };
}

export function validateConfig(config: GameConfig): LocalizedString[] | null {
  const o = readOptions(config);
  const errors: LocalizedString[] = [];
  const n = config.players.length;
  const teams = config.teams?.teams ?? [];

  if (n < 4) errors.push({ en: 'Add at least 4 players', fa: 'حداقل ۴ بازیکن اضافه کن' });
  if (n > 16) errors.push({ en: 'At most 16 players', fa: 'حداکثر ۱۶ بازیکن' });
  if (teams.length < 2)
    errors.push({ en: 'Need at least 2 teams', fa: 'حداقل ۲ تیم لازم است' });
  if (teams.length > 4) errors.push({ en: 'At most 4 teams', fa: 'حداکثر ۴ تیم' });
  if (teams.some((t) => t.memberIds.length < 2))
    errors.push({
      en: 'Each team needs at least 2 players',
      fa: 'هر تیم حداقل به ۲ بازیکن نیاز دارد',
    });
  if (o.difficulties.length === 0)
    errors.push({ en: 'Pick at least one difficulty', fa: 'حداقل یک سختی انتخاب کن' });
  if (buildPool(o).length === 0)
    errors.push({
      en: 'No prompts for these categories/difficulties',
      fa: 'هیچ سرنخی با این دسته‌ها/سختی‌ها نیست',
    });
  return errors.length ? errors : null;
}
