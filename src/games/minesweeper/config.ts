import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';

export type MineDifficulty = 'easy' | 'medium' | 'hard' | 'custom';

export interface MinesweeperOptions {
  cols: number;
  rows: number;
  /** Number of mines hidden on the board — these are the prizes players hunt for. */
  mines: number;
  difficulty: MineDifficulty;
}

export const PRESETS: Record<'easy' | 'medium' | 'hard', { cols: number; rows: number; mines: number }> = {
  easy: { cols: 8, rows: 8, mines: 12 },
  medium: { cols: 10, rows: 12, mines: 28 },
  hard: { cols: 12, rows: 16, mines: 50 },
};

export const DEFAULT_OPTIONS: MinesweeperOptions = {
  ...PRESETS.medium,
  difficulty: 'medium',
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

export function normalizeOptions(o: Partial<MinesweeperOptions> | undefined): MinesweeperOptions {
  const src = o ?? {};
  const difficulty: MineDifficulty =
    src.difficulty === 'easy' || src.difficulty === 'hard' || src.difficulty === 'custom'
      ? src.difficulty
      : 'medium';

  let cols: number;
  let rows: number;
  let mines: number;
  if (difficulty === 'custom') {
    cols = clamp(src.cols ?? DEFAULT_OPTIONS.cols, 6, 14);
    rows = clamp(src.rows ?? DEFAULT_OPTIONS.rows, 6, 18);
    mines = clamp(src.mines ?? DEFAULT_OPTIONS.mines, 1, cols * rows - 9);
  } else {
    ({ cols, rows, mines } = PRESETS[difficulty]);
  }

  return { cols, rows, mines, difficulty };
}

export function readOptions(config: GameConfig): MinesweeperOptions {
  return normalizeOptions(config.options as Partial<MinesweeperOptions>);
}

export function defaultConfig({ players, lang }: DefaultConfigInput): GameConfig {
  return { players, lang, options: { ...DEFAULT_OPTIONS } };
}

export function validateConfig(config: GameConfig): LocalizedString[] | null {
  const o = readOptions(config);
  const errors: LocalizedString[] = [];
  const n = config.players.length;
  if (n < 1) errors.push({ en: 'Add at least 1 player', fa: 'حداقل ۱ بازیکن اضافه کن' });
  if (n > 4) errors.push({ en: 'At most 4 players', fa: 'حداکثر ۴ بازیکن' });
  if (o.cols * o.rows < 16) errors.push({ en: 'Board is too small', fa: 'صفحه خیلی کوچک است' });
  if (o.mines > o.cols * o.rows - 9)
    errors.push({ en: 'Too many mines for this board', fa: 'برای این صفحه مین زیادی است' });
  if (o.mines < 1) errors.push({ en: 'Need at least 1 mine', fa: 'حداقل به ۱ مین نیاز است' });
  return errors.length ? errors : null;
}
