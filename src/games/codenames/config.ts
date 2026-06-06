import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';
import { PACK_BY_ID, WORD_PACKS, mergedPool } from './content';

export type CodenamesMode = 'classic' | 'untimed' | 'timed';
export type StartingTeam = 'teamA' | 'teamB' | 'random';

export interface CodenamesOptions {
  mode: CodenamesMode;
  startingTeam: StartingTeam;
  packIds: string[];
  turnSeconds: number;
  allowBonusGuess: boolean;
  /** First team rotates the randomly-generated key (0–3 quarter-turns) before play starts. */
  chooseOrientation: boolean;
}

export const DEFAULT_OPTIONS: CodenamesOptions = {
  mode: 'untimed',
  startingTeam: 'random',
  packIds: ['core'],
  turnSeconds: 120,
  allowBonusGuess: true,
  chooseOrientation: true,
};

export function normalizeOptions(o: Partial<CodenamesOptions> | undefined): CodenamesOptions {
  const src = o ?? {};
  const packIds = (src.packIds ?? []).filter((id) => PACK_BY_ID[id]);
  return {
    mode: src.mode === 'classic' ? 'classic' : src.mode === 'timed' ? 'timed' : 'untimed',
    startingTeam:
      src.startingTeam === 'teamA' ? 'teamA' : src.startingTeam === 'teamB' ? 'teamB' : 'random',
    packIds: packIds.length ? packIds : ['core'],
    turnSeconds: Math.min(300, Math.max(30, Math.round(src.turnSeconds ?? 120))),
    allowBonusGuess: src.allowBonusGuess !== false,
    chooseOrientation: src.chooseOrientation !== false,
  };
}

export function readOptions(config: GameConfig): CodenamesOptions {
  return normalizeOptions(config.options as Partial<CodenamesOptions>);
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
  if (teams.length !== 2) errors.push({ en: 'Codenames needs exactly 2 teams', fa: 'این بازی دقیقاً به ۲ تیم نیاز دارد' });
  if (teams.some((t) => t.memberIds.length < 2))
    errors.push({ en: 'Each team needs at least 2 players', fa: 'هر تیم حداقل به ۲ بازیکن نیاز دارد' });
  if (mergedPool(o.packIds).length < 25)
    errors.push({ en: 'Need at least 25 words', fa: 'حداقل به ۲۵ کلمه نیاز است' });
  return errors.length ? errors : null;
}

export const PACK_LIST = WORD_PACKS;
