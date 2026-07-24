import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'minesweeper',
  name: { en: 'Mine Hunt', fa: 'مین‌یاب' },
  tagline: { en: 'Hunt down the hidden mines!', fa: 'مین‌های پنهان را پیدا کن!' },
  description: {
    en: "Minesweeper flipped on its head: this time the mines are buried treasure and you want every last one. Tap a square to strike a mine and score it (then tap again), or hit a safe spot that reveals a number clue and passes your turn — nothing ever explodes. Read the numbers like a detective to sniff out where the mines hide, and whoever digs up the most takes the win.",
    fa: 'مین‌یاب وارونه شده: این بار مین‌ها گنجِ دفن‌شده‌اند و تو همه‌شان را می‌خواهی. روی خانه‌ای بزن تا به مین برسی و امتیاز بگیری (و دوباره بزن)، یا به خانهٔ امنی بخوری که عددی راهنما رو می‌کند و نوبتت را رد می‌کند — هیچ‌چیز هرگز منفجر نمی‌شود. مثل یک کارآگاه عددها را بخوان تا بفهمی مین‌ها کجا پنهان‌اند، و هرکس بیشترین مین را بیرون بکشد برنده است.',
  },
  icon: '💣',
  color: 'tangerine',
  category: 'deduction',
  minPlayers: 1,
  maxPlayers: 4,
  estimatedMinutes: [5, 20],
  tags: [
    { en: 'Hunt', fa: 'شکار' },
    { en: 'Puzzle', fa: 'پازل' },
    { en: 'Logic', fa: 'منطقی' },
  ],
  capabilities: {
    usesTeams: false,
    usesTimer: false,
    usesDeck: false,
    usesVoting: false,
    usesRevealGate: false,
    passAndPlay: true,
  },
  stateVersion: 3,
  howToPlay: {
    en: 'The mines are what you want! Tap a square: if it hides a mine you found one (you score it and tap again), and if it is safe it shows a number for how many mines touch it and your turn passes to the next player. Nothing explodes and there are no lives. Read the numbers to deduce where mines are. The game ends when every mine is found, and whoever found the most wins. Solo, just hunt them all down.',
    fa: 'این بار مین‌ها را می‌خواهی! روی یک خانه بزن: اگر مین داشته باشد پیدایش کردی (امتیاز می‌گیری و دوباره می‌زنی)، و اگر امن باشد عددی نشان می‌دهد که چند مین کنارش است و نوبت به نفر بعد می‌رسد. هیچ‌چیز منفجر نمی‌شود و جانی در کار نیست. از روی عددها بفهم مین‌ها کجایند. وقتی همهٔ مین‌ها پیدا شد بازی تمام است و هرکس بیشترین را یافته باشد می‌برد. تنها هم می‌توانی همه را شکار کنی.',
  },
};
