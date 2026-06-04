import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';
import { PACKS, PACK_BY_ID, buildCatalog } from './content';

export const ROUND_SECONDS_CHOICES = [300, 360, 480, 600] as const;

export const maxSpies = (n: number): number => Math.max(1, Math.min(3, Math.floor(n / 3)));

export interface SpyfallOptions {
  spyCount: number;
  roundSeconds: number;
  enabledPackIds: string[];
  totalRounds: number;
  allowSpyGuess: boolean;
  useTimer: boolean;
}

export const DEFAULT_OPTIONS: SpyfallOptions = {
  spyCount: 1,
  roundSeconds: 480,
  enabledPackIds: ['core'],
  totalRounds: 1,
  allowSpyGuess: true,
  useTimer: true,
};

function oneOf<T>(value: T, choices: readonly T[], fallback: T): T {
  return choices.includes(value) ? value : fallback;
}

export function normalizeOptions(
  o: Partial<SpyfallOptions> | undefined,
  playerCount: number,
): SpyfallOptions {
  const src = o ?? {};
  const enabledPackIds = (src.enabledPackIds ?? []).filter((id) => PACK_BY_ID[id]);
  const cap = maxSpies(Math.max(3, playerCount));
  return {
    spyCount: Math.min(cap, Math.max(1, Math.round(src.spyCount ?? 1))),
    roundSeconds: oneOf(src.roundSeconds ?? 480, ROUND_SECONDS_CHOICES, 480),
    enabledPackIds: enabledPackIds.length ? enabledPackIds : ['core'],
    totalRounds: Math.min(10, Math.max(1, Math.round(src.totalRounds ?? 1))),
    allowSpyGuess: src.allowSpyGuess !== false,
    useTimer: src.useTimer !== false,
  };
}

export function readOptions(config: GameConfig): SpyfallOptions {
  return normalizeOptions(config.options as Partial<SpyfallOptions>, config.players.length);
}

export function defaultConfig({ players, lang }: DefaultConfigInput): GameConfig {
  return { players, lang, options: { ...DEFAULT_OPTIONS } };
}

export function validateConfig(config: GameConfig): LocalizedString[] | null {
  const o = readOptions(config);
  const errors: LocalizedString[] = [];
  const n = config.players.length;
  if (n < 3) errors.push({ en: 'Add at least 3 players', fa: 'حداقل ۳ بازیکن اضافه کن' });
  if (n > 12) errors.push({ en: 'At most 12 players', fa: 'حداکثر ۱۲ بازیکن' });
  if (n - o.spyCount < 2)
    errors.push({ en: 'Need at least 2 non-spies', fa: 'حداقل ۲ غیرجاسوس لازم است' });
  if (buildCatalog(o.enabledPackIds).length === 0)
    errors.push({ en: 'Pick at least one location pack', fa: 'حداقل یک دستهٔ مکان انتخاب کن' });
  return errors.length ? errors : null;
}

export const PACK_LIST = PACKS;
