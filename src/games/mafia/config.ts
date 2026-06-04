import type { DefaultConfigInput, GameConfig, LocalizedString } from '../../sdk/types';
import type { RoleId } from './roles';
import { ROLES } from './roles';
import { autoComposition, compositionTotal, mafiaInComposition } from './content';

export type MafiaMode = 'device-narrator' | 'silent';
export type DoctorSelfSave = 'never' | 'once' | 'always';
export type VotingMode = 'majority' | 'plurality';
export type TieRule = 'no-elimination' | 'random';

export interface MafiaOptions {
  mode: MafiaMode;
  composition: Record<RoleId, number>;
  presetId: string | null;
  optionalReveal: boolean;
  allowDoctorSelfSave: DoctorSelfSave;
  discussionSeconds: number;
  votingMode: VotingMode;
  nominationsRequired: number;
  tieRule: TieRule;
  peacefulFirstNight: boolean;
}

export const DEFAULT_OPTIONS: MafiaOptions = {
  mode: 'device-narrator',
  composition: {},
  presetId: null,
  optionalReveal: true,
  allowDoctorSelfSave: 'once',
  discussionSeconds: 180,
  votingMode: 'majority',
  nominationsRequired: 2,
  tieRule: 'no-elimination',
  peacefulFirstNight: false,
};

export function normalizeOptions(o: Partial<MafiaOptions> | undefined): MafiaOptions {
  const src = o ?? {};
  return {
    mode: src.mode === 'silent' ? 'silent' : 'device-narrator',
    composition: src.composition ?? {},
    presetId: src.presetId ?? null,
    optionalReveal: src.optionalReveal !== false,
    allowDoctorSelfSave:
      src.allowDoctorSelfSave === 'never' ? 'never' : src.allowDoctorSelfSave === 'always' ? 'always' : 'once',
    discussionSeconds: Math.max(0, Math.round(src.discussionSeconds ?? 180)),
    votingMode: src.votingMode === 'plurality' ? 'plurality' : 'majority',
    nominationsRequired: Math.max(1, Math.round(src.nominationsRequired ?? 2)),
    tieRule: src.tieRule === 'random' ? 'random' : 'no-elimination',
    peacefulFirstNight: !!src.peacefulFirstNight,
  };
}

export function readOptions(config: GameConfig): MafiaOptions {
  return normalizeOptions(config.options as Partial<MafiaOptions>);
}

export function defaultConfig({ players, lang }: DefaultConfigInput): GameConfig {
  return {
    players,
    lang,
    options: { ...DEFAULT_OPTIONS, composition: autoComposition(players.length) },
  };
}

export function validateConfig(config: GameConfig): LocalizedString[] | null {
  const o = readOptions(config);
  const errors: LocalizedString[] = [];
  const n = config.players.length;
  if (n < 5) errors.push({ en: 'Add at least 5 players', fa: 'حداقل ۵ بازیکن اضافه کن' });
  if (n > 30) errors.push({ en: 'At most 30 players', fa: 'حداکثر ۳۰ بازیکن' });
  const total = compositionTotal(o.composition);
  if (total !== n)
    errors.push({
      en: `Assign exactly ${n} roles (have ${total})`,
      fa: `دقیقاً ${n} نقش تعیین کن (الان ${total})`,
    });
  for (const id of Object.keys(o.composition)) {
    if (!ROLES[id]) errors.push({ en: `Unknown role ${id}`, fa: `نقش ناشناخته ${id}` });
  }
  if (mafiaInComposition(o.composition) >= Math.ceil(n / 2))
    errors.push({ en: 'Too many mafia (instant win)', fa: 'مافیا خیلی زیاد است (برد فوری)' });
  if (mafiaInComposition(o.composition) < 1)
    errors.push({ en: 'Need at least 1 mafia', fa: 'حداقل به ۱ مافیا نیاز است' });
  return errors.length ? errors : null;
}
