import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'spyfall',
  name: { en: 'Spyfall', fa: 'جاسوس' },
  tagline: { en: 'Find the spy, hide the location', fa: 'جاسوس را پیدا کن، مکان را پنهان کن' },
  description: {
    en: "Everyone secretly shares the same location and a role to play — everyone except one spy, who's flying completely blind. Trade pointed questions to expose the impostor without ever naming the place out loud, because one careless answer hands the spy the win. Meanwhile the spy bluffs along and races to figure out where on earth everybody is. It's pure paranoia, in the best possible way.",
    fa: 'همه پنهانی یک مکان و یک نقش مشترک می‌گیرند — همه جز یک جاسوس که در تاریکی مطلق است. با سؤال‌های هدف‌دار جاسوس را لو بده، اما مبادا اسم مکان را بلند بگویی، چون یک جواب بی‌احتیاط برد را تقدیم جاسوس می‌کند. جاسوس هم همزمان بلوف می‌زند و تلاش می‌کند بفهمد اصلاً کجایید. سوءظنِ ناب، به بهترین شکل ممکن!',
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
