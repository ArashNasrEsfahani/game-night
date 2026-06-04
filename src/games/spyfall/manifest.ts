import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'spyfall',
  name: { en: 'Spyfall', fa: 'جاسوس' },
  tagline: { en: 'Find the spy, hide the location', fa: 'جاسوس را پیدا کن، مکان را پنهان کن' },
  description: {
    en: 'Everyone secretly shares a location and a role — except the spy, who knows neither. Ask sharp questions to expose the spy without naming the place. The spy blends in and tries to guess where you are.',
    fa: 'همه پنهانی یک مکان و نقش مشترک دارند — جز جاسوس که هیچ‌کدام را نمی‌داند. با سؤال‌های هوشمندانه جاسوس را لو بده بدون اینکه اسم مکان را بگویی. جاسوس خودش را جا می‌زند و سعی می‌کند مکان را حدس بزند.',
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
