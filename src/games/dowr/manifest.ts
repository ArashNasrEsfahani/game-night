import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'dowr',
  name: { en: 'Dowr', fa: 'دور' },
  tagline: { en: 'Describe fast — beat the bomb!', fa: 'سریع توضیح بده — بمب رو ببر!' },
  description: {
    en: 'A timed relay in teams of two: describe the word so your partner guesses it, before the bomb blows. The phone races around the room — the fastest team wins.',
    fa: 'یک مسابقهٔ زمانی تیمی (تیم‌های دونفره): کلمه را طوری توضیح بده که هم‌تیمی‌ات قبل از انفجار بمب حدس بزند. گوشی دور جمع می‌چرخد و سریع‌ترین تیم برنده می‌شود.',
  },
  icon: '🗣️',
  color: 'violet',
  category: 'word',
  minPlayers: 4,
  maxPlayers: 10,
  estimatedMinutes: [5, 20],
  tags: [
    { en: 'Party', fa: 'مهمانی' },
    { en: 'Words', fa: 'کلمات' },
    { en: 'Teams', fa: 'تیمی' },
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
    en: "Players split into teams of two and the phone races around the room — non-stop, the clock never pauses. On your team's turn, the describer reads the word and describes it out loud (without saying it!) while their partner guesses. The instant your partner gets it, tap “Got it!” and the phone jumps straight to the next team. Be quick — every second is added to YOUR team's time.\n\nStuck? Tap “Change word” for a fresh one — but it adds a time penalty. And watch the bomb: if its fuse runs out first, your team eats the time plus a bigger penalty.\n\nEvery team takes the same number of turns. The team with the LOWEST total time wins.",
    fa: 'بازیکن‌ها به تیم‌های دونفره تقسیم می‌شوند و گوشی بی‌وقفه دور جمع می‌چرخد — کرنومتر هیچ‌وقت متوقف نمی‌شود. در نوبت تیمت، توضیح‌دهنده کلمه را می‌خواند و بدون گفتن خودش آن را توضیح می‌دهد و هم‌تیمی‌اش حدس می‌زند. لحظه‌ای که هم‌تیمی‌ات گرفت، «گرفتم!» را بزن تا گوشی فوراً به تیم بعد برود. سریع باش — هر ثانیه به زمانِ تیمِ تو اضافه می‌شود.\n\nگیر کردی؟ «تعویض کلمه» را بزن — اما جریمهٔ زمانی دارد. مراقب بمب باش: اگر فتیله‌اش زودتر تمام شود، تیمت آن زمان به‌علاوهٔ جریمهٔ بیشتر را می‌گیرد.\n\nهمهٔ تیم‌ها به یک تعداد نوبت بازی می‌کنند. تیمی که کمترین زمان کل را داشته باشد برنده است.',
  },
};
