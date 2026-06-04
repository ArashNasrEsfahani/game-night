import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';
import type { Intensity } from './content';
import { INTENSITIES, getDeck } from './content';

export type NhieMode = 'classic' | 'points';
export type RevealMode = 'sequential' | 'honor';

export interface NhieOptions {
  mode: NhieMode;
  revealMode: RevealMode;
  intensities: Intensity[];
  /** Classic only: lives each player starts with. */
  startingLives: number;
  /** Number of statements to play (clamped to available). */
  deckSize: number;
}

export const DEFAULT_OPTIONS: NhieOptions = {
  mode: 'classic',
  revealMode: 'sequential',
  intensities: ['classic'],
  startingLives: 5,
  deckSize: 20,
};

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  const n = Math.round(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeOptions(o: Partial<NhieOptions> | undefined): NhieOptions {
  const src = o ?? {};
  const intensities = (src.intensities ?? []).filter((i): i is Intensity =>
    INTENSITIES.includes(i as Intensity),
  );
  return {
    mode: src.mode === 'points' ? 'points' : 'classic',
    revealMode: src.revealMode === 'honor' ? 'honor' : 'sequential',
    intensities: intensities.length ? intensities : ['classic'],
    startingLives: clampInt(src.startingLives, 1, 20, 5),
    deckSize: clampInt(src.deckSize, 1, 200, 20),
  };
}

export function readOptions(config: GameConfig): NhieOptions {
  return normalizeOptions(config.options as Partial<NhieOptions>);
}

export function defaultConfig({ players, lang }: DefaultConfigInput): GameConfig {
  return { players, lang, options: { ...DEFAULT_OPTIONS } };
}

export function validateConfig(config: GameConfig): LocalizedString[] | null {
  const o = readOptions(config);
  const errors: LocalizedString[] = [];
  const n = config.players.length;
  if (n < 3) errors.push({ en: 'Add at least 3 players', fa: 'حداقل ۳ بازیکن اضافه کن' });
  if (n > 16) errors.push({ en: 'At most 16 players', fa: 'حداکثر ۱۶ بازیکن' });
  if (o.intensities.length === 0)
    errors.push({ en: 'Pick at least one intensity', fa: 'حداقل یک شدت انتخاب کن' });
  if (getDeck({ intensities: o.intensities }).length === 0)
    errors.push({ en: 'No statements for this filter', fa: 'هیچ جمله‌ای با این فیلتر نیست' });
  return errors.length ? errors : null;
}
