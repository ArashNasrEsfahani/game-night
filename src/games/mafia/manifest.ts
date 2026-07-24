import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'mafia',
  name: { en: 'Mafia', fa: 'مافیا' },
  tagline: { en: 'Hidden roles, night & day', fa: 'نقش‌های پنهان، شب و روز' },
  description: {
    en: "Night falls on a town quietly torn apart by a hidden Mafia, and the phone deals everyone a secret role. As darkness comes the Mafia pick off a victim, the doctor scrambles to save a life, and the detective digs for the truth; by day the whole town argues, accuses, and votes someone to the gallows. Town wins by rooting out every last Mafioso — but trust no one, because anyone could be lying straight to your face.",
    fa: 'شب بر شهری فرود می‌آید که مافیای پنهان بی‌سروصدا از هم می‌پاشدش، و گوشی به هرکس یک نقش مخفی می‌دهد. با آمدن تاریکی مافیا قربانی می‌گیرد، دکتر تقلا می‌کند جانی را نجات دهد و کارآگاه دنبال حقیقت می‌گردد؛ روز که می‌شود کل شهر بحث و متهم و رأی‌گیری می‌کند تا یکی را پای چوبهٔ دار بفرستد. مردم‌شهر با ریشه‌کن کردن تک‌تک مافیاها برنده می‌شوند — اما به هیچ‌کس اعتماد نکن، چون هرکسی ممکن است توی چشمت دروغ بگوید.',
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
