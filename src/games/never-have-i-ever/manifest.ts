import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'never-have-i-ever',
  name: { en: 'Never Have I Ever', fa: 'من هیچ‌وقت' },
  tagline: { en: 'Confess or lose a life', fa: 'اعتراف کن یا یک جان از دست بده' },
  description: {
    en: 'A statement pops up. Everyone who HAS done it loses a life. The last clean player standing wins, or whoever ends up with the fewest confessions.',
    fa: 'یک جمله ظاهر می‌شود. هر کس آن را انجام داده باشد یک جان از دست می‌دهد. آخرین بازیکن پاک برنده است، یا هر کس که کمترین اعتراف را داشته باشد.',
  },
  icon: '🙈',
  color: 'rose',
  category: 'party',
  minPlayers: 3,
  maxPlayers: 16,
  estimatedMinutes: [10, 25],
  tags: [
    { en: 'Party', fa: 'مهمانی' },
    { en: 'Confession', fa: 'اعتراف' },
    { en: 'No writing', fa: 'بدون نوشتن' },
  ],
  capabilities: {
    usesTeams: false,
    usesTimer: false,
    usesDeck: true,
    usesVoting: false,
    usesRevealGate: true,
    passAndPlay: true,
  },
  stateVersion: 1,
  howToPlay: {
    en: 'Read the statement out loud. Everyone who has done it owns up to it, either privately by passing the phone around or openly on the honor system. Each confession costs a life (Classic) or a point (Points). The cleanest player wins.',
    fa: 'جمله را با صدای بلند بخوان. هر کس آن را انجام داده اعتراف می‌کند؛ یا پنهانی با چرخاندن گوشی یا آشکارا با شمارش افتخاری. هر اعتراف یک جان (کلاسیک) یا یک امتیاز (امتیازی) هزینه دارد. پاک‌ترین بازیکن برنده است.',
  },
};
