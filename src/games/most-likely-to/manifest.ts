import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'most-likely-to',
  name: { en: 'Most Likely To', fa: 'به احتمال زیاد' },
  tagline: { en: 'Point at the friend most likely to…', fa: 'به دوستی اشاره کن که به احتمال زیاد…' },
  description: {
    en: "A cheeky \"Most likely to…\" prompt drops, and every finger in the room swings toward one unlucky friend. Everyone votes in secret, the count is revealed, and the most-accused suddenly has some explaining to do. Rack up the most call-outs across the deck and you wear the crown — for better or for worse.",
    fa: 'یک سوال شیطنت‌آمیز «به احتمال زیاد…» می‌آید و همهٔ انگشت‌ها به سمت یک دوستِ بدشانس نشانه می‌رود. همه پنهانی رأی می‌دهند، شمارش رو می‌شود و پررأی‌ترین یک‌دفعه کلی توضیح برای دادن دارد. هرکس در طول بازی بیشترین رأی را جمع کند تاج را می‌گیرد — حالا خوب یا بد!',
  },
  icon: '👉',
  color: 'tangerine',
  category: 'voting',
  minPlayers: 3,
  maxPlayers: 20,
  estimatedMinutes: [8, 15],
  tags: [
    { en: 'Party', fa: 'مهمانی' },
    { en: 'Voting', fa: 'رأی‌گیری' },
    { en: 'No teams', fa: 'بدون تیم' },
  ],
  capabilities: {
    usesTeams: false,
    usesTimer: false,
    usesDeck: true,
    usesVoting: true,
    usesRevealGate: true,
    passAndPlay: true,
  },
  stateVersion: 1,
  howToPlay: {
    en: 'Read the prompt. Either pass the phone so each player secretly taps who they pick, or count votes out loud. The most-voted player wins the round. Play the deck; most round wins takes it.',
    fa: 'سوال را بخوان. یا گوشی را بچرخان تا هر بازیکن پنهانی انتخابش را بزند، یا رأی‌ها را بلند بشمارید. پررأی‌ترین بازیکن برندهٔ دور است. کل دسته را بازی کنید؛ بیشترین برد برنده می‌شود.',
  },
};
