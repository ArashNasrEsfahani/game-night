import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'never-have-i-ever',
  name: { en: 'Never Have I Ever', fa: 'من هیچ‌وقت' },
  tagline: { en: 'Confess or lose a life', fa: 'اعتراف کن یا یک جان از دست بده' },
  description: {
    en: 'A statement appears. Everyone who HAS done it loses a life. Last clean player — or the one with the fewest confessions — wins.',
    fa: 'یک جمله ظاهر می‌شود. هر کس آن را انجام داده باشد یک جان از دست می‌دهد. آخرین بازیکن پاک — یا کسی که کمترین اعتراف را دارد — برنده است.',
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
    en: 'Read the statement. Everyone who has done it confesses — privately by passing the phone, or openly by an honor count. Each confession costs a life (Classic) or a point (Points). Cleanest player wins.',
    fa: 'جمله را بخوان. هر کس آن را انجام داده اعتراف می‌کند — پنهانی با چرخاندن گوشی یا آشکارا با شمارش افتخاری. هر اعتراف یک جان (کلاسیک) یا یک امتیاز (امتیازی) هزینه دارد. پاک‌ترین بازیکن برنده است.',
  },
};
