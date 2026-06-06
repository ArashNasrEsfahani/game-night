import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'spyfall',
  name: { en: 'Spyfall', fa: 'جاسوس' },
  tagline: { en: 'Find the spy, hide the location', fa: 'جاسوس را پیدا کن، مکان را پنهان کن' },
  description: {
    en: 'Everyone secretly gets the same location and a role. Everyone except the spy, who knows neither one. Ask clever questions to sniff out the spy without giving away the place, while the spy plays along and tries to figure out where you all are.',
    fa: 'همه پنهانی یک مکان و یک نقش مشترک می‌گیرند؛ به‌جز جاسوس که هیچ‌کدام را نمی‌داند. با سؤال‌های زیرکانه جاسوس را پیدا کن بدون اینکه اسم مکان را لو بدهی، و جاسوس هم سعی می‌کند خودش را جا بزند و حدس بزند کجایید.',
  },
  icon: '🕵️',
  color: 'violet',
  category: 'deduction',
  minPlayers: 3,
  maxPlayers: 12,
  estimatedMinutes: [8, 15],
  tags: [
    { en: 'Deduction', fa: 'استنتاج' },
    { en: 'Party', fa: 'مهمانی' },
    { en: 'Hidden roles', fa: 'نقش‌های مخفی' },
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
    en: 'Pass the phone so each player privately sees their secret card. Then discuss: ask each other questions to find the spy without giving away the location. Call a vote to accuse; the spy may guess the location to steal the win.',
    fa: 'گوشی را بچرخان تا هر بازیکن پنهانی کارت مخفی‌اش را ببیند. بعد بحث کنید: از هم سؤال بپرسید تا جاسوس را پیدا کنید بدون لو دادن مکان. برای متهم کردن رأی‌گیری کن؛ جاسوس می‌تواند مکان را حدس بزند تا برد را برباید.',
  },
};
