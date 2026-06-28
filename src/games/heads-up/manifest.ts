import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'heads-up',
  name: { en: 'Heads Up!', fa: 'حدس بزن!' },
  tagline: { en: 'Phone on your forehead, guess the word!', fa: 'گوشی روی پیشانی، کلمه را حدس بزن!' },
  description: {
    en: "Slap the phone on your forehead so everyone can see the word except you. The room erupts with frantic clues, wild gestures, and shouting while you guess as fast as you can before the timer dies. Nail it and tap to score, wave off the tough ones, and pile up as many words as you can in one breathless round.",
    fa: 'گوشی را روی پیشانی‌ات بگذار تا همه کلمه را ببینند جز خودت. جمع با سرنخ‌های هول‌هولکی، اشاره‌های دیوانه‌وار و داد و فریاد منفجر می‌شود و تو تا قبل از تمام شدن زمان هرچه سریع‌تر حدس می‌زنی. درست زدی بزن تا امتیاز بگیری، سخت‌ها را رد کن و در یک دور نفس‌گیر هرچه می‌توانی کلمه جمع کن.',
  },
  icon: '🙈',
  color: 'sky',
  category: 'party',
  minPlayers: 2,
  maxPlayers: 16,
  estimatedMinutes: [5, 15],
  tags: [
    { en: 'Party', fa: 'مهمانی' },
    { en: 'Active', fa: 'پرتحرک' },
    { en: 'Fast', fa: 'سریع' },
  ],
  capabilities: {
    usesTeams: true,
    usesTimer: true,
    usesDeck: true,
    usesVoting: false,
    usesRevealGate: true,
    passAndPlay: true,
  },
  stateVersion: 1,
  howToPlay: {
    en: 'Pass the phone to the guesser, who holds it on their forehead. After the 3-2-1, the group gives clues. Tap GOT IT when right, PASS to skip. When time runs out, pass to the next player or team.',
    fa: 'گوشی را به حدس‌زننده بده تا روی پیشانی نگه دارد. بعد از ۳-۲-۱، جمع سرنخ می‌دهد. وقتی درست بود «درست» را بزن، برای رد کردن «رد» را بزن. با تمام شدن زمان، گوشی به نفر یا تیم بعدی می‌رسد.',
  },
};
