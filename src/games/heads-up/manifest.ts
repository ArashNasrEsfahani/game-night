import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'heads-up',
  name: { en: 'Heads Up!', fa: 'حدس بزن!' },
  tagline: { en: 'Phone on your forehead, guess the word!', fa: 'گوشی روی پیشانی، کلمه را حدس بزن!' },
  description: {
    en: 'Hold the phone on your forehead so the group can see the word. They give clues; you guess against the clock. Got it or pass, then race to the next word.',
    fa: 'گوشی را روی پیشانی بگیر تا جمع کلمه را ببینند. آن‌ها سرنخ می‌دهند و تو با زمان مسابقه می‌دهی. درست حدس زدی یا رد کن، بعد سراغ کلمهٔ بعدی برو.',
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
