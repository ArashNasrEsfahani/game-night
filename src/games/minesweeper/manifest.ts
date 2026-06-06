import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'minesweeper',
  name: { en: 'Mine Hunt', fa: 'مین‌یاب' },
  tagline: { en: 'Hunt down the hidden mines!', fa: 'مین‌های پنهان را پیدا کن!' },
  description: {
    en: 'Reverse Minesweeper: the mines are the treasure. Tap squares to hunt them. Find a mine and you score it and tap again; tap a safe square and it reveals a number clue and your turn passes. Nothing explodes. Use the clues to track down every mine, and whoever finds the most wins.',
    fa: 'مین‌یاب وارونه: این بار مین‌ها گنج‌اند. روی خانه‌ها بزن تا پیدایشان کنی. مین پیدا کنی امتیاز می‌گیری و دوباره می‌زنی؛ خانهٔ امن بزنی یک عدد راهنما رو می‌شود و نوبت رد می‌شود. هیچ‌چیز منفجر نمی‌شود. با عددها رد مین‌ها را بگیر، و هرکس بیشترین مین را پیدا کند برنده است.',
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
