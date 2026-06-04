import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'most-likely-to',
  name: { en: 'Most Likely To', fa: 'به احتمال زیاد' },
  tagline: { en: 'Point at the friend most likely to…', fa: 'به دوستی اشاره کن که به احتمال زیاد…' },
  description: {
    en: 'A "Most likely to…" prompt appears, everyone votes for a player, and the most-voted is revealed. Most wins across the deck takes the crown.',
    fa: 'یک سوال «به احتمال زیاد…» می‌آید، همه به یک بازیکن رأی می‌دهند و پررأی‌ترین معرفی می‌شود. بیشترین برد در طول بازی برنده می‌شود.',
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
