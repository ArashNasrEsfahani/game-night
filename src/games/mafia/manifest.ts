import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'mafia',
  name: { en: 'Mafia', fa: 'مافیا' },
  tagline: { en: 'Hidden roles, night & day', fa: 'نقش‌های پنهان، شب و روز' },
  description: {
    en: 'Town versus Mafia social deduction. The phone deals secret roles, then narrates the night/day loop: mafia eliminate, the doctor saves, the detective investigates, and the town votes to hang a suspect.',
    fa: 'نبرد مردم‌شهر و مافیا. گوشی نقش‌ها را پنهانی پخش می‌کند و چرخهٔ شب و روز را روایت می‌کند: مافیا حذف می‌کند، دکتر نجات می‌دهد، کارآگاه تحقیق می‌کند و شهر برای حذف یک مظنون رأی می‌دهد.',
  },
  icon: '🎭',
  color: 'rose',
  category: 'deduction',
  minPlayers: 5,
  maxPlayers: 20,
  estimatedMinutes: [15, 45],
  tags: [
    { en: 'Deduction', fa: 'استنتاج' },
    { en: 'Party', fa: 'مهمانی' },
    { en: 'Roles', fa: 'نقش‌ها' },
  ],
  capabilities: {
    usesTeams: false,
    usesTimer: true,
    usesDeck: true,
    usesVoting: true,
    usesRevealGate: true,
    passAndPlay: true,
  },
  stateVersion: 1,
  howToPlay: {
    en: 'Pass the phone so each player privately sees their secret role. Then the device narrates: at night the mafia pick a victim and special roles act; by day everyone discusses, nominates, and votes someone out. Town wins by eliminating all mafia; mafia win at parity.',
    fa: 'گوشی را بچرخان تا هر بازیکن پنهانی نقشش را ببیند. سپس گوشی روایت می‌کند: شب مافیا قربانی را انتخاب می‌کند و نقش‌های ویژه عمل می‌کنند؛ روز همه بحث، نامزد و رأی‌گیری می‌کنند. مردم‌شهر با حذف همهٔ مافیا برنده می‌شوند؛ مافیا با برابری.',
  },
};
