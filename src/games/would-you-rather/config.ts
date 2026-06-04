import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';
import type { Intensity } from './content';
import { DECK_BY_ID, DECKS, poolFor } from './content';

export type WyrMode = 'vote' | 'quick';

export interface WyrOptions {
  deckId: string;
  maxIntensity: Intensity;
  mode: WyrMode;
  /** Number of prompts to play (clamped to pool; a very large value plays the whole deck). */
  roundLength: number;
  awardMajorityPoints: boolean;
  tieCountsForBoth: boolean;
}

export const DEFAULT_OPTIONS: WyrOptions = {
  deckId: 'classic',
  maxIntensity: 'medium',
  mode: 'vote',
  roundLength: 10,
  awardMajorityPoints: false,
  tieCountsForBoth: true,
};

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  const n = Math.round(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeOptions(o: Partial<WyrOptions> | undefined): WyrOptions {
  const src = o ?? {};
  const deckId = DECK_BY_ID[src.deckId ?? ''] ? src.deckId! : DECKS[0].id;
  const maxIntensity: Intensity = (['mild', 'medium', 'spicy'] as const).includes(
    src.maxIntensity as Intensity,
  )
    ? (src.maxIntensity as Intensity)
    : 'medium';
  return {
    deckId,
    maxIntensity,
    mode: src.mode === 'quick' ? 'quick' : 'vote',
    roundLength: clampInt(src.roundLength, 1, 999, 10),
    awardMajorityPoints: !!src.awardMajorityPoints,
    tieCountsForBoth: src.tieCountsForBoth !== false,
  };
}

export function readOptions(config: GameConfig): WyrOptions {
  return normalizeOptions(config.options as Partial<WyrOptions>);
}

export function defaultConfig({ players, lang }: DefaultConfigInput): GameConfig {
  return { players, lang, options: { ...DEFAULT_OPTIONS } };
}

export function validateConfig(config: GameConfig): LocalizedString[] | null {
  const o = readOptions(config);
  const errors: LocalizedString[] = [];
  const n = config.players.length;
  if (n < 2) errors.push({ en: 'Add at least 2 players', fa: 'حداقل ۲ بازیکن اضافه کن' });
  if (n > 20) errors.push({ en: 'At most 20 players', fa: 'حداکثر ۲۰ بازیکن' });
  if (poolFor(o.deckId, o.maxIntensity).length === 0)
    errors.push({ en: 'No prompts at this intensity', fa: 'هیچ سوالی در این شدت نیست' });
  return errors.length ? errors : null;
}
