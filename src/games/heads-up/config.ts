import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';
import { DECKS, DECK_BY_ID, DIFFICULTIES, mergedPool } from './content';
import type { Difficulty } from './content';

export type HeadsUpMode = 'solo' | 'teams';
export const ROUND_SECONDS_CHOICES = [30, 45, 60, 90] as const;

export interface HeadsUpOptions {
  deckIds: string[];
  mode: HeadsUpMode;
  roundSeconds: number;
  rounds: number;
  motionEnabled: boolean;
  passPenalty: 0 | 1;
  recycleDeck: boolean;
  /** Number of teams to auto-build in Setup (teams mode). */
  teamCount: number;
  /** Which difficulty tiers to include from the chosen decks. */
  difficulties: Record<Difficulty, boolean>;
}

export const DEFAULT_OPTIONS: HeadsUpOptions = {
  deckIds: ['animals'],
  mode: 'solo',
  roundSeconds: 60,
  rounds: 1,
  motionEnabled: false,
  passPenalty: 0,
  recycleDeck: true,
  teamCount: 2,
  difficulties: { easy: true, medium: true, hard: true },
};

/** The list of enabled tiers (always non-empty; falls back to all). */
export function selectedDifficulties(o: HeadsUpOptions): Difficulty[] {
  const on = DIFFICULTIES.filter((d) => o.difficulties[d]);
  return on.length ? on : [...DIFFICULTIES];
}

function oneOf<T>(value: T, choices: readonly T[], fallback: T): T {
  return choices.includes(value) ? value : fallback;
}

export function normalizeOptions(o: Partial<HeadsUpOptions> | undefined): HeadsUpOptions {
  const src = o ?? {};
  const deckIds = (src.deckIds ?? []).filter((id) => DECK_BY_ID[id]);
  const d = src.difficulties;
  const difficulties = {
    easy: d?.easy ?? true,
    medium: d?.medium ?? true,
    hard: d?.hard ?? true,
  };
  if (!difficulties.easy && !difficulties.medium && !difficulties.hard) {
    difficulties.easy = true;
    difficulties.medium = true;
    difficulties.hard = true;
  }
  return {
    deckIds: deckIds.length ? deckIds : ['animals'],
    mode: src.mode === 'teams' ? 'teams' : 'solo',
    roundSeconds: oneOf(src.roundSeconds ?? 60, ROUND_SECONDS_CHOICES, 60),
    rounds: Math.min(5, Math.max(1, Math.round(src.rounds ?? 1))),
    motionEnabled: !!src.motionEnabled,
    passPenalty: src.passPenalty === 1 ? 1 : 0,
    recycleDeck: src.recycleDeck !== false,
    teamCount: Math.min(4, Math.max(2, Math.round(src.teamCount ?? 2))),
    difficulties,
  };
}

export function readOptions(config: GameConfig): HeadsUpOptions {
  return normalizeOptions(config.options as Partial<HeadsUpOptions>);
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
  if (o.deckIds.length === 0)
    errors.push({ en: 'Pick at least one deck', fa: 'حداقل یک دسته انتخاب کن' });
  if (mergedPool(o.deckIds, selectedDifficulties(o)).length === 0)
    errors.push({
      en: 'No cards at this difficulty',
      fa: 'کارتی در این سطح سختی نیست',
    });
  if (o.mode === 'teams') {
    const teams = config.teams?.teams ?? [];
    if (n < 4) errors.push({ en: 'Teams mode needs at least 4 players', fa: 'حالت تیمی حداقل به ۴ بازیکن نیاز دارد' });
    if (teams.length < 2) errors.push({ en: 'Need at least 2 teams', fa: 'حداقل ۲ تیم لازم است' });
    if (teams.some((t) => t.memberIds.length < 2))
      errors.push({ en: 'Each team needs at least 2 players', fa: 'هر تیم حداقل به ۲ بازیکن نیاز دارد' });
  }
  return errors.length ? errors : null;
}

export const DECK_LIST = DECKS;
