// src/games/mafia/roles.ts — the role registry (data only; resolution is table-driven in logic.ts).
import type { LocalizedString } from '../../sdk/types';

export type RoleId = string;
export type Faction = 'town' | 'mafia' | 'neutral';

export type NightEffect = 'kill' | 'protect' | 'investigate' | 'vigKill' | 'none';

export interface NightActionSpec {
  key: string;
  order: number;
  effect: NightEffect;
  canTargetSelf: boolean;
  skippable: boolean;
  perGame?: number;
}

export interface MafiaRole {
  id: RoleId;
  faction: Faction;
  name: LocalizedString;
  reveal: LocalizedString;
  icon: string;
  /** What the detective sees; defaults to faction. */
  appearsAs?: Faction;
  countsAsMafia?: boolean;
  countsAsTown?: boolean;
  night?: NightActionSpec;
}

export const ROLES: Record<RoleId, MafiaRole> = {
  mafia: {
    id: 'mafia',
    faction: 'mafia',
    name: { en: 'Mafia', fa: 'مافیا' },
    reveal: {
      en: 'You are Mafia. Each night, agree with the other mafia on one person to eliminate.',
      fa: 'تو مافیایی. هر شب با بقیهٔ مافیا روی یک نفر برای حذف توافق کن.',
    },
    icon: '🔫',
    night: { key: 'mafia.kill', order: 10, effect: 'kill', canTargetSelf: false, skippable: false },
  },
  godfather: {
    id: 'godfather',
    faction: 'mafia',
    name: { en: 'Godfather', fa: 'پدرخوانده' },
    reveal: {
      en: 'You are the Godfather, leader of the Mafia. To the Detective you appear innocent.',
      fa: 'تو پدرخوانده‌ای، رهبر مافیا. در نگاه کارآگاه بی‌گناه به نظر می‌رسی.',
    },
    icon: '🤵',
    appearsAs: 'town',
    countsAsMafia: true,
    night: { key: 'mafia.kill', order: 10, effect: 'kill', canTargetSelf: false, skippable: false },
  },
  citizen: {
    id: 'citizen',
    faction: 'town',
    name: { en: 'Citizen', fa: 'شهروند' },
    reveal: {
      en: 'You are a Citizen. You have no special power — use your wits to find the Mafia.',
      fa: 'تو شهروندی. قدرت ویژه‌ای نداری — با هوشت مافیا را پیدا کن.',
    },
    icon: '🧑',
  },
  detective: {
    id: 'detective',
    faction: 'town',
    name: { en: 'Detective', fa: 'کارآگاه' },
    reveal: {
      en: 'You are the Detective. Each night you may investigate one player to learn if they are Mafia.',
      fa: 'تو کارآگاه هستی. هر شب می‌توانی یک بازیکن را بررسی کنی تا بفهمی مافیاست یا نه.',
    },
    icon: '🔍',
    night: { key: 'detective.check', order: 20, effect: 'investigate', canTargetSelf: false, skippable: true },
  },
  doctor: {
    id: 'doctor',
    faction: 'town',
    name: { en: 'Doctor', fa: 'دکتر' },
    reveal: {
      en: 'You are the Doctor. Each night you may protect one player from being killed.',
      fa: 'تو دکتری. هر شب می‌توانی یک نفر را از کشته‌شدن نجات دهی.',
    },
    icon: '🩺',
    night: { key: 'doctor.save', order: 30, effect: 'protect', canTargetSelf: true, skippable: true },
  },
  sniper: {
    id: 'sniper',
    faction: 'town',
    name: { en: 'Sniper', fa: 'تک‌تیرانداز' },
    reveal: {
      en: 'You are the Sniper. Once per game, at night, you may shoot one player.',
      fa: 'تو تک‌تیراندازی. یک‌بار در بازی، شب می‌توانی به یک نفر شلیک کنی.',
    },
    icon: '🎯',
    night: { key: 'sniper.shoot', order: 25, effect: 'vigKill', canTargetSelf: false, skippable: true, perGame: 1 },
  },
};

export const ROLE_LIST: MafiaRole[] = Object.values(ROLES);

export const countsAsMafia = (role: MafiaRole): boolean => role.countsAsMafia ?? role.faction === 'mafia';
export const countsAsTown = (role: MafiaRole): boolean => role.countsAsTown ?? role.faction === 'town';
