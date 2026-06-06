import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'minesweeper',
  name: { en: 'Minesweeper', fa: 'مین‌یاب' },
  tagline: { en: "Sweep safely, don't hit a mine!", fa: 'بی‌خطر پاک کن، رو مین نری!' },
  description: {
    en: 'Clear the board without hitting a mine. Play solo like the classic, or pass and play with 2 to 4 people taking turns. Score the safe cells you uncover and lose a life on a mine. Whoever clears the most cells when the board is swept wins.',
    fa: 'صفحه را بدون منفجر کردن مین پاک کن. تنها مثل بازی کلاسیک بازی کن یا با ۲ تا ۴ نفر نوبتی روی یک گوشی. برای خانه‌های امنی که باز می‌کنی امتیاز بگیر و با هر مین یک جان از دست بده. هرکس بیشترین خانه را پاک کند برنده است.',
  },
  icon: '💣',
  color: 'tangerine',
  category: 'deduction',
  minPlayers: 1,
  maxPlayers: 4,
  estimatedMinutes: [5, 20],
  tags: [
    { en: 'Solo', fa: 'انفرادی' },
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
  stateVersion: 1,
  howToPlay: {
    en: 'Tap a cell to reveal it, and the first tap is always safe. Numbers show how many mines touch that cell. Use the 🚩 flag mode to mark mines you suspect (flagging is free). Tap a number whose flags already match it to clear its neighbours. Solo: clear every safe cell to win. With 2 to 4 players you take turns; each safe reveal scores and each mine costs a life, and whoever has the most cells when the board is swept wins.',
    fa: 'برای باز کردن یک خانه رویش بزن، و اولین لمس همیشه امن است. عددها نشان می‌دهند چند مین کنار آن خانه است. با حالت پرچم 🚩 مین‌های مشکوک را علامت بزن (پرچم‌زدن رایگان است). روی عددی که تعداد پرچم‌هایش با آن برابر است بزن تا همسایه‌هایش باز شوند. تنها: همهٔ خانه‌های امن را پاک کن تا ببری. با ۲ تا ۴ نفر نوبتی بازی کنید؛ هر باز کردن امن امتیاز دارد و هر مین یک جان کم می‌کند، و وقتی صفحه پاک شد هرکس بیشترین خانه را داشته باشد می‌برد.',
  },
};
