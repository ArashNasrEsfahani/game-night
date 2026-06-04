import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'codenames',
  name: { en: 'Spy Grid', fa: 'شبکهٔ جاسوسی' },
  tagline: { en: 'Two spymasters, one secret key', fa: 'دو رئیس‌جاسوس، یک کلید مخفی' },
  description: {
    en: 'Two teams race to find their secret words on a 5×5 grid. Each spymaster privately sees the key and gives a one-word clue. Guess your words — but avoid the assassin, or you lose instantly.',
    fa: 'دو تیم برای پیدا کردن کلمات مخفی‌شان روی شبکهٔ ۵×۵ رقابت می‌کنند. هر رئیس‌جاسوس پنهانی کلید را می‌بیند و یک سرنخ تک‌کلمه‌ای می‌دهد. کلمات خودت را حدس بزن — اما از جاسوس مرگبار دوری کن وگرنه فوراً می‌بازی.',
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
  stateVersion: 1,
  howToPlay: {
    en: 'Split into two teams, each with a spymaster. The spymaster privately sees which words are theirs and gives a one-word clue plus a number. Their team taps that many tiles. Reveal all your words to win; tap the assassin and you lose.',
    fa: 'به دو تیم تقسیم شوید، هر کدام با یک رئیس‌جاسوس. رئیس‌جاسوس پنهانی می‌بیند کدام کلمات مال اوست و یک سرنخ تک‌کلمه‌ای با یک عدد می‌دهد. تیمش همان تعداد کاشی را می‌زند. همهٔ کلماتت را رو کن تا برنده شوی؛ جاسوس مرگبار را بزنی می‌بازی.',
  },
};
