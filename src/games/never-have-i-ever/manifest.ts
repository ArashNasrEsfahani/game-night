import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'never-have-i-ever',
  name: { en: 'Never Have I Ever', fa: 'من هیچ‌وقت' },
  tagline: { en: 'Confess or lose a life', fa: 'اعتراف کن یا یک جان از دست بده' },
  description: {
    en: "A bold confession pops up on screen, and anyone who's actually done it has to own up — and lose a life. Secrets spill, eyebrows shoot up, and the whole table erupts every single round. The last player left with a clean record (or simply the fewest confessions) walks away the most innocent of all.",
    fa: 'یک اعتراف جسورانه روی صفحه ظاهر می‌شود و هرکس واقعاً آن را انجام داده باید قبول کند — و یک جان از دست بدهد. رازها لو می‌رود، ابروها بالا می‌پرد و هر دور کل جمع منفجر می‌شود. آخرین بازیکنی که پروندهٔ پاک (یا فقط کمترین اعتراف) را داشته باشد، بی‌گناه‌ترینِ جمع از آب درمی‌آید.',
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
