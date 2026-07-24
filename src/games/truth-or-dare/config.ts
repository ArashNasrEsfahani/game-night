import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';
import type { Intensity } from './content';
import { getPool } from './content';

export type SelectionMode = 'spinner' | 'sequential' | 'bottle';
export type ScoringMode = 'casual' | 'points';
export type EndType = 'endless' | 'rounds' | 'target';
export type PrivateReveal = 'never' | 'spicyOnly' | 'always';

export interface ToDOptions {
  intensities: Record<Intensity, boolean>;
  selectionMode: SelectionMode;
  scoringMode: ScoringMode;
  pointsForDare: number;
  pointsForTruth: number;
  pointsForSkip: number;
  endType: EndType;
  /** rounds count (endType 'rounds') or target points (endType 'target'). */
  endValue: number;
  privateReveal: PrivateReveal;
  avoidImmediateRepeat: boolean;
}

export const DEFAULT_OPTIONS: ToDOptions = {
  intensities: { mild: true, medium: true, spicy: false, extreme: false },
  // Default to the real spin-the-bottle animation (BottleStage) rather than the name-roulette, so the
  // headline mechanic is what players see out of the box. Spinner/Sequential remain options in setup.
  selectionMode: 'bottle',
  scoringMode: 'casual',
  pointsForDare: 2,
  pointsForTruth: 1,
  pointsForSkip: 0,
  endType: 'endless',
  endValue: 5,
  privateReveal: 'never',
  avoidImmediateRepeat: true,
};

export function normalizeOptions(o: Partial<ToDOptions> | undefined): ToDOptions {
  const src = o ?? {};
  const intensities = {
    mild: src.intensities?.mild ?? true,
    medium: src.intensities?.medium ?? false,
    spicy: src.intensities?.spicy ?? false,
    extreme: src.intensities?.extreme ?? false,
  };
  if (!intensities.mild && !intensities.medium && !intensities.spicy && !intensities.extreme)
    intensities.mild = true;
  return {
    intensities,
    selectionMode:
      src.selectionMode === 'sequential'
        ? 'sequential'
        : src.selectionMode === 'bottle'
          ? 'bottle'
          : 'spinner',
    scoringMode: src.scoringMode === 'points' ? 'points' : 'casual',
    pointsForDare: Math.round(src.pointsForDare ?? 2),
    pointsForTruth: Math.round(src.pointsForTruth ?? 1),
    pointsForSkip: Math.round(src.pointsForSkip ?? 0),
    endType: src.endType === 'rounds' ? 'rounds' : src.endType === 'target' ? 'target' : 'endless',
    endValue: Math.max(1, Math.round(src.endValue ?? 5)),
    privateReveal:
      src.privateReveal === 'always'
        ? 'always'
        : src.privateReveal === 'spicyOnly'
          ? 'spicyOnly'
          : 'never',
    avoidImmediateRepeat: src.avoidImmediateRepeat !== false,
  };
}

export function readOptions(config: GameConfig): ToDOptions {
  return normalizeOptions(config.options as Partial<ToDOptions>);
}

export function defaultConfig({ players, lang }: DefaultConfigInput): GameConfig {
  return { players, lang, options: { ...DEFAULT_OPTIONS } };
}

export function validateConfig(config: GameConfig): LocalizedString[] | null {
  const o = readOptions(config);
  const errors: LocalizedString[] = [];
  const n = config.players.length;
  if (n < 2) errors.push({ en: 'Add at least 2 players', fa: 'حداقل ۲ بازیکن اضافه کن' });
  if (n > 16) errors.push({ en: 'At most 16 players', fa: 'حداکثر ۱۶ بازیکن' });
  const truths = getPool({ kind: 'truth', intensities: o.intensities, playerCount: Math.max(2, n) });
  const dares = getPool({ kind: 'dare', intensities: o.intensities, playerCount: Math.max(2, n) });
  if (truths.length === 0) errors.push({ en: 'No truths at this intensity', fa: 'هیچ حقیقتی در این شدت نیست' });
  if (dares.length === 0) errors.push({ en: 'No dares at this intensity', fa: 'هیچ جرئتی در این شدت نیست' });
  return errors.length ? errors : null;
}
