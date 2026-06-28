import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'codenames',
  name: { en: 'Codenames', fa: 'کدنیمز' },
  tagline: { en: 'Two spymasters, one secret key', fa: 'دو رئیس‌جاسوس، یک کلید مخفی' },
  description: {
    en: "Two teams face a 5×5 grid of words, but only the spymasters know which ones are theirs. Armed with a single one-word clue and a number, each spymaster sends their team hunting across the board — link the right words and you look like a genius, brush the wrong one and you might hand the round to your rivals. Uncover all your agents first to win, but one tap on the assassin ends it for you instantly.",
    fa: 'دو تیم روبه‌روی شبکه‌ای ۵×۵ از کلمات می‌نشینند، اما فقط رئیس‌جاسوس‌ها می‌دانند کدام کلمات مال آن‌هاست. هر رئیس‌جاسوس با یک سرنخ تک‌کلمه‌ای و یک عدد، تیمش را به شکار کلمات می‌فرستد — کلمات درست را به هم وصل کنی نابغه به نظر می‌رسی، اشتباه بزنی شاید دور را تقدیم حریف کنی. اول همهٔ مأمورانت را پیدا کن تا ببری، اما یک ضربه به جاسوس مرگبار همان لحظه کارت را تمام می‌کند.',
  },
  icon: '🔲',
  color: 'lime',
  category: 'word',
  minPlayers: 4,
  maxPlayers: 16,
  estimatedMinutes: [10, 20],
  tags: [
    { en: 'Teams', fa: 'تیمی' },
    { en: 'Words', fa: 'کلمات' },
    { en: 'Deduction', fa: 'استنتاج' },
  ],
  capabilities: {
    usesTeams: true,
    usesTimer: true,
    usesDeck: true,
    usesVoting: false,
    usesRevealGate: true,
    passAndPlay: true,
  },
  stateVersion: 2,
  howToPlay: {
    en: 'Split into two teams, each with a spymaster. The first team rotates the secret key to pick an orientation, then play begins. The spymaster privately sees which words are theirs and gives a one-word clue plus a number. Their team taps that many tiles. Reveal all your words to win; tap the assassin and you lose.',
    fa: 'به دو تیم تقسیم شوید، هر کدام با یک رئیس‌جاسوس. رئیس‌جاسوس پنهانی می‌بیند کدام کلمات مال اوست و یک سرنخ تک‌کلمه‌ای با یک عدد می‌دهد. تیمش همان تعداد کاشی را می‌زند. همهٔ کلماتت را رو کن تا برنده شوی؛ جاسوس مرگبار را بزنی می‌بازی.',
  },
};
