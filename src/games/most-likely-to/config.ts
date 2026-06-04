import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';
import type { Intensity } from './content';
import { DECK_BY_ID, DECKS, getPool } from './content';

export type VotingStyle = 'pass-device' | 'simultaneous';
export type TieBreak = 'co-winners' | 'random';

export interface MltOptions {
  deckId: string;
  /** Intensity ceiling: include prompts at or below this tier. */
  intensity: Intensity;
  votingStyle: VotingStyle;
  roundCount: number;
  allowSelfVote: boolean;
  tieBreak: TieBreak;
  showRunningScores: boolean;
}

export const DEFAULT_OPTIONS: MltOptions = {
  deckId: 'classic',
  intensity: 'casual',
  votingStyle: 'pass-device',
  roundCount: 8,
  allowSelfVote: false,
  tieBreak: 'co-winners',
  showRunningScores: true,
};

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  const n = Math.round(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeOptions(o: Partial<MltOptions> | undefined): MltOptions {
  const src = o ?? {};
  const deckId = DECK_BY_ID[src.deckId ?? ''] ? src.deckId! : DECKS[0].id;
  const intensity: Intensity = (['family', 'casual', 'spicy'] as const).includes(
    src.intensity as Intensity,
  )
    ? (src.intensity as Intensity)
    : 'casual';
  const poolSize = getPool({ deckId, intensity }).length;
  return {
    deckId,
    intensity,
    votingStyle: src.votingStyle === 'simultaneous' ? 'simultaneous' : 'pass-device',
    roundCount: clampInt(src.roundCount, 1, Math.max(1, poolSize), Math.min(8, poolSize || 8)),
    allowSelfVote: !!src.allowSelfVote,
    tieBreak: src.tieBreak === 'random' ? 'random' : 'co-winners',
    showRunningScores: src.showRunningScores !== false,
  };
}

export function readOptions(config: GameConfig): MltOptions {
  return normalizeOptions(config.options as Partial<MltOptions>);
}

export function defaultConfig({ players, lang }: DefaultConfigInput): GameConfig {
  return { players, lang, options: { ...DEFAULT_OPTIONS } };
}

export function validateConfig(config: GameConfig): LocalizedString[] | null {
  const o = readOptions(config);
  const errors: LocalizedString[] = [];
  const n = config.players.length;
  if (n < 3) errors.push({ en: 'Add at least 3 players', fa: 'حداقل ۳ بازیکن اضافه کن' });
  if (n > 20) errors.push({ en: 'At most 20 players', fa: 'حداکثر ۲۰ بازیکن' });
  if (getPool({ deckId: o.deckId, intensity: o.intensity }).length === 0)
    errors.push({ en: 'No prompts at this intensity', fa: 'هیچ سوالی در این شدت نیست' });
  return errors.length ? errors : null;
}
