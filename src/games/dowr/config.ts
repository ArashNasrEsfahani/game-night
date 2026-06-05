import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';
import type { DowrCategory, DowrDifficulty } from './content';
import { buildPool } from './deck';

export type DowrDifficultySel = DowrDifficulty | 'random';
/** How a match ends: a fixed number of turns per team, or a shared time budget. */
export type DowrEndMode = 'turns' | 'time';

export const DOWR_CATEGORIES: DowrCategory[] = ['food', 'objects', 'jobs', 'places', 'animals'];

/** Total game-time choices (seconds) for the 'time' end mode. Most words wins. */
export const TIME_LIMIT_CHOICES = [120, 180, 300, 420] as const;
/** Bomb-fuse length choices (seconds). The describing team must score before it blows. */
export const FUSE_CHOICES = [30, 45, 60, 90] as const;
/** Extra seconds added to a team's total when the bomb explodes. */
export const BOMB_PENALTY_CHOICES = [10, 20, 30] as const;
/** Time penalty (seconds) added each time the describer swaps the word. 0 = free. */
export const CHANGE_PENALTY_CHOICES = [0, 3, 5, 10] as const;

export interface DowrOptions {
  categories: DowrCategory[];
  difficulty: DowrDifficultySel;
  /** How the match ends. 'turns' = fixed turns each (lowest total time wins);
   *  'time' = a shared countdown (most words guessed wins). */
  endMode: DowrEndMode;
  /** Turns per team (endMode 'turns'). Every team describes this many words; lowest total time wins. */
  rounds: number;
  /** Total shared game time in seconds (endMode 'time'). Most words guessed wins. */
  timeLimitSeconds: number;
  /** Bomb fuse per turn, in seconds. */
  fuseSeconds: number;
  /** Seconds added to the team's total if the bomb explodes. */
  bombPenaltySeconds: number;
  /** Seconds added each time the team changes the word. */
  changePenaltySeconds: number;
  /** Hide the countdown so nobody knows exactly when the bomb blows. */
  surpriseBomb: boolean;
}

export const DEFAULT_OPTIONS: DowrOptions = {
  categories: [...DOWR_CATEGORIES],
  difficulty: 'random',
  endMode: 'turns',
  rounds: 3,
  timeLimitSeconds: 180,
  fuseSeconds: 60,
  bombPenaltySeconds: 20,
  changePenaltySeconds: 5,
  surpriseBomb: true,
};

const oneOf = <T extends number>(choices: readonly T[], v: unknown, fallback: T): T =>
  (choices as readonly number[]).includes(v as number) ? (v as T) : fallback;

export function normalizeOptions(o: Partial<DowrOptions> | undefined): DowrOptions {
  const src = o ?? {};
  const cats = (src.categories ?? []).filter((c): c is DowrCategory =>
    DOWR_CATEGORIES.includes(c as DowrCategory),
  );
  const categories = cats.length ? cats : [...DOWR_CATEGORIES];
  const rounds = Math.min(8, Math.max(1, Math.round(src.rounds ?? DEFAULT_OPTIONS.rounds)));
  const difficulty: DowrDifficultySel = (['easy', 'med', 'hard', 'random'] as const).includes(
    src.difficulty as DowrDifficultySel,
  )
    ? (src.difficulty as DowrDifficultySel)
    : 'random';
  return {
    categories,
    difficulty,
    endMode: src.endMode === 'time' ? 'time' : 'turns',
    rounds,
    timeLimitSeconds: oneOf(TIME_LIMIT_CHOICES, src.timeLimitSeconds, DEFAULT_OPTIONS.timeLimitSeconds),
    fuseSeconds: oneOf(FUSE_CHOICES, src.fuseSeconds, DEFAULT_OPTIONS.fuseSeconds),
    bombPenaltySeconds: oneOf(
      BOMB_PENALTY_CHOICES,
      src.bombPenaltySeconds,
      DEFAULT_OPTIONS.bombPenaltySeconds,
    ),
    changePenaltySeconds: oneOf(
      CHANGE_PENALTY_CHOICES,
      src.changePenaltySeconds,
      DEFAULT_OPTIONS.changePenaltySeconds,
    ),
    surpriseBomb: src.surpriseBomb ?? DEFAULT_OPTIONS.surpriseBomb,
  };
}

export function readOptions(config: GameConfig): DowrOptions {
  return normalizeOptions(config.options as Partial<DowrOptions>);
}

export function defaultConfig({ players, lang }: DefaultConfigInput): GameConfig {
  return { players, lang, options: { ...DEFAULT_OPTIONS } };
}

export function validateConfig(config: GameConfig): LocalizedString[] | null {
  const o = readOptions(config);
  const n = config.players.length;
  const errors: LocalizedString[] = [];
  if (n < 4)
    errors.push({ en: 'Add at least 4 players (2 teams)', fa: 'حداقل ۴ بازیکن اضافه کن (۲ تیم)' });
  else if (n % 2 !== 0)
    errors.push({
      en: 'Add an even number of players — teams of 2',
      fa: 'تعداد بازیکن‌ها باید زوج باشد — تیم‌های دونفره',
    });
  if (n > 10) errors.push({ en: 'At most 10 players', fa: 'حداکثر ۱۰ بازیکن' });
  if (buildPool(o).length === 0)
    errors.push({ en: 'No words match these filters', fa: 'هیچ کلمه‌ای با این فیلترها نیست' });
  return errors.length ? errors : null;
}
