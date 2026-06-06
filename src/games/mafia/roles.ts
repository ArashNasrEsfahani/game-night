// src/games/mafia/roles.ts — the role registry (data only; resolution is table-driven in logic.ts).
import type { LocalizedString } from '../../sdk/types';

export type RoleId = string;
export type Faction = 'town' | 'mafia' | 'neutral';

export type NightEffect =
  | 'kill'
  | 'protect'
  | 'guard'
  | 'investigate'
  | 'investigateExact'
  | 'vigKill'
  | 'block'
  | 'frame'
  | 'none';

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
  /** Shown privately on the deal screen when this player reveals their card. */
  reveal: LocalizedString;
  /** One-line "how it works" used by the in-game role guide. */
  guide: LocalizedString;
  icon: string;
  /** What the detective sees; defaults to faction. */
  appearsAs?: Faction;
  countsAsMafia?: boolean;
  countsAsTown?: boolean;
  /** Neutral win: if this player is voted out by day, they win and the game ends. */
  winsIfLynched?: boolean;
  /** At most this many of this role in one game (Setup caps the stepper). */
  maxInGame?: number;
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
    guide: {
      en: 'Wakes with the other mafia each night and picks one player to eliminate. Wins when the mafia equal or outnumber the town.',
      fa: 'هر شب با بقیهٔ مافیا بیدار می‌شود و یک نفر را برای حذف انتخاب می‌کند. وقتی تعداد مافیا با شهر برابر شود برنده است.',
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
    guide: {
      en: 'Leads the mafia kill and reads as Town if the Detective investigates them.',
      fa: 'رهبر کشتن مافیاست و اگر کارآگاه بررسی‌اش کند، شهروند به نظر می‌رسد.',
    },
    icon: '🤵',
    appearsAs: 'town',
    countsAsMafia: true,
    maxInGame: 1,
    night: { key: 'mafia.kill', order: 10, effect: 'kill', canTargetSelf: false, skippable: false },
  },
  framer: {
    id: 'framer',
    faction: 'mafia',
    name: { en: 'Framer', fa: 'پاپوش‌دوز' },
    reveal: {
      en: 'You are the Framer (Mafia). Each night you may frame one player so the Detective sees them as Mafia.',
      fa: 'تو پاپوش‌دوزی (مافیا). هر شب می‌توانی برای یک نفر پاپوش بدوزی تا کارآگاه او را مافیا ببیند.',
    },
    guide: {
      en: 'Mafia helper. Frames one player a night — if the Detective checks that player tonight, they read as Mafia.',
      fa: 'کمک‌مافیا. هر شب برای یکی پاپوش می‌دوزد؛ اگر کارآگاه همان شب او را بررسی کند، مافیا دیده می‌شود.',
    },
    icon: '🖼️',
    countsAsMafia: true,
    maxInGame: 1,
    night: { key: 'framer.frame', order: 15, effect: 'frame', canTargetSelf: false, skippable: true },
  },
  consigliere: {
    id: 'consigliere',
    faction: 'mafia',
    name: { en: 'Consigliere', fa: 'مشاور مافیا' },
    reveal: {
      en: 'You are the Consigliere (Mafia). Each night you may learn one player’s exact role.',
      fa: 'تو مشاور مافیایی. هر شب می‌توانی نقش دقیق یک بازیکن را بفهمی.',
    },
    guide: {
      en: 'Mafia investigator. Each night learns the exact role of one player (not just their side).',
      fa: 'کارآگاه مافیا. هر شب نقش دقیق یک بازیکن را می‌فهمد، نه فقط جناحش را.',
    },
    icon: '🕵️',
    countsAsMafia: true,
    maxInGame: 1,
    night: { key: 'consigliere.check', order: 22, effect: 'investigateExact', canTargetSelf: false, skippable: true },
  },
  citizen: {
    id: 'citizen',
    faction: 'town',
    name: { en: 'Citizen', fa: 'شهروند' },
    reveal: {
      en: 'You are a Citizen. You have no special power — use your wits to find the Mafia.',
      fa: 'تو شهروندی. قدرت ویژه‌ای نداری — با هوشت مافیا را پیدا کن.',
    },
    guide: {
      en: 'No night power. Talks, reads the room, and votes by day to find the mafia.',
      fa: 'قدرت شبانه ندارد. روزها صحبت می‌کند، فضا را می‌سنجد و رأی می‌دهد تا مافیا را پیدا کند.',
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
    guide: {
      en: 'Each night checks one player and learns their side: Town or Mafia. The Godfather fools them; a Framer can too.',
      fa: 'هر شب یک نفر را بررسی می‌کند و جناحش را می‌فهمد: شهر یا مافیا. پدرخوانده و پاپوش‌دوز می‌توانند گولش بزنند.',
    },
    icon: '🔍',
    maxInGame: 1,
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
    guide: {
      en: 'Each night picks one player to shield. If that player is attacked tonight, they survive.',
      fa: 'هر شب یک نفر را برای محافظت انتخاب می‌کند. اگر همان شب به او حمله شود، زنده می‌ماند.',
    },
    icon: '🩺',
    maxInGame: 1,
    night: { key: 'doctor.save', order: 30, effect: 'protect', canTargetSelf: true, skippable: true },
  },
  bodyguard: {
    id: 'bodyguard',
    faction: 'town',
    name: { en: 'Bodyguard', fa: 'محافظ' },
    reveal: {
      en: 'You are the Bodyguard. Each night you guard one player — if they are attacked, you die in their place.',
      fa: 'تو محافظی. هر شب از یک نفر نگهبانی می‌دهی — اگر به او حمله شود، تو به‌جایش کشته می‌شوی.',
    },
    guide: {
      en: 'Guards one player a night. If that player is attacked, the Bodyguard takes the hit and dies instead.',
      fa: 'هر شب از یک نفر نگهبانی می‌دهد. اگر به آن نفر حمله شود، محافظ ضربه را می‌خورد و به‌جایش می‌میرد.',
    },
    icon: '🛡️',
    maxInGame: 1,
    night: { key: 'bodyguard.guard', order: 28, effect: 'guard', canTargetSelf: false, skippable: true },
  },
  escort: {
    id: 'escort',
    faction: 'town',
    name: { en: 'Escort', fa: 'اغواگر' },
    reveal: {
      en: 'You are the Escort. Each night you may block one player — they cannot use their power tonight.',
      fa: 'تو اغواگری. هر شب می‌توانی یک نفر را مسدود کنی — آن شب نمی‌تواند از قدرتش استفاده کند.',
    },
    guide: {
      en: 'Blocks one player a night, cancelling their night ability. Can stop a lone mafia’s kill, the Doctor’s save, an investigation, and more.',
      fa: 'هر شب یک نفر را مسدود می‌کند و قدرت شبانه‌اش را خنثی می‌کند. می‌تواند کشتن یک مافیای تنها، نجات دکتر، یک بررسی و… را متوقف کند.',
    },
    icon: '💋',
    maxInGame: 1,
    night: { key: 'escort.block', order: 5, effect: 'block', canTargetSelf: false, skippable: true },
  },
  sniper: {
    id: 'sniper',
    faction: 'town',
    name: { en: 'Sniper', fa: 'تک‌تیرانداز' },
    reveal: {
      en: 'You are the Sniper. Once per game, at night, you may shoot one player.',
      fa: 'تو تک‌تیراندازی. یک‌بار در بازی، شب می‌توانی به یک نفر شلیک کنی.',
    },
    guide: {
      en: 'Town vigilante. Once per game may shoot a player at night. Be careful — shooting a townsperson hurts the town.',
      fa: 'تیرخلاص شهر. یک‌بار در بازی می‌تواند شب به کسی شلیک کند. مراقب باش — شلیک به شهروند به ضرر شهر است.',
    },
    icon: '🎯',
    maxInGame: 1,
    night: { key: 'sniper.shoot', order: 25, effect: 'vigKill', canTargetSelf: false, skippable: true, perGame: 1 },
  },
  jester: {
    id: 'jester',
    faction: 'neutral',
    name: { en: 'Jester', fa: 'دلقک' },
    reveal: {
      en: 'You are the Jester. You have one goal: get the town to vote YOU out. If you are lynched, you win!',
      fa: 'تو دلقکی. یک هدف داری: کاری کن شهر به حذف خودت رأی بدهد. اگر اعدام شوی، برنده‌ای!',
    },
    guide: {
      en: 'Neutral. Wins immediately if the town votes them out by day. Dying at night does nothing — act suspicious!',
      fa: 'بی‌طرف. اگر شهر روز به حذفش رأی دهد، فوراً برنده می‌شود. مردن در شب فایده‌ای ندارد — مشکوک رفتار کن!',
    },
    icon: '🃏',
    winsIfLynched: true,
    maxInGame: 1,
  },
};

export const ROLE_LIST: MafiaRole[] = Object.values(ROLES);

export const countsAsMafia = (role: MafiaRole): boolean => role.countsAsMafia ?? role.faction === 'mafia';
export const countsAsTown = (role: MafiaRole): boolean => role.countsAsTown ?? role.faction === 'town';
