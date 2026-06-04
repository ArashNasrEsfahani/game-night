import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';
import type { DowrCategory, DowrDifficulty } from './content';
import { buildPool } from './deck';

export type DowrMode = 'teams' | 'solo';
export type DowrTimerLen = 60 | 120;
export type DowrDifficultySel = DowrDifficulty | 'random';

export const DOWR_CATEGORIES: DowrCategory[] = ['food', 'objects', 'jobs', 'places', 'animals'];

export interface DowrOptions {
  mode: DowrMode;
  categories: DowrCategory[];
  difficulty: DowrDifficultySel;
  rounds: number;
  timerSeconds: DowrTimerLen;
  skipPenalty: boolean;
}

export const DEFAULT_OPTIONS: DowrOptions = {
  mode: 'teams',
  categories: [...DOWR_CATEGORIES],
  difficulty: 'random',
  rounds: 3,
  timerSeconds: 60,
  skipPenalty: false,
};

export function normalizeOptions(o: Partial<DowrOptions> | undefined): DowrOptions {
  const src = o ?? {};
  const cats = (src.categories ?? []).filter((c): c is DowrCategory =>
    DOWR_CATEGORIES.includes(c as DowrCategory),
  );
  const categories = cats.length ? cats : [...DOWR_CATEGORIES];
  const rounds = Math.min(10, Math.max(1, Math.round(src.rounds ?? 3)));
  const timerSeconds: DowrTimerLen = src.timerSeconds === 120 ? 120 : 60;
  const difficulty: DowrDifficultySel = (['easy', 'med', 'hard', 'random'] as const).includes(
    src.difficulty as DowrDifficultySel,
  )
    ? (src.difficulty as DowrDifficultySel)
    : 'random';
  const mode: DowrMode = src.mode === 'solo' ? 'solo' : 'teams';
  return { mode, categories, difficulty, rounds, timerSeconds, skipPenalty: !!src.skipPenalty };
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
  if (n < 2) errors.push({ en: 'Add at least 2 players', fa: 'حداقل ۲ بازیکن اضافه کن' });
  if (n > 10) errors.push({ en: 'At most 10 players', fa: 'حداکثر ۱۰ بازیکن' });
  if (o.mode === 'teams' && n % 2 !== 0)
    errors.push({
      en: 'Teams mode needs an even number of players',
      fa: 'حالت تیمی به تعداد زوج بازیکن نیاز دارد',
    });
  if (buildPool(o).length === 0)
    errors.push({ en: 'No words match these filters', fa: 'هیچ کلمه‌ای با این فیلترها نیست' });
  return errors.length ? errors : null;
}
