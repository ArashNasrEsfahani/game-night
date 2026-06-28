import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'dowr',
  name: { en: 'Dowr', fa: 'دور' },
  tagline: { en: 'Describe fast, beat the bomb!', fa: 'سریع توضیح بده، بمب رو ببر!' },
  description: {
    en: "In rapid-fire pairs, you describe the word any way you can while your partner blurts out guesses — and the clock never, ever stops. The instant they nail it, the phone flies to the next team, so every wasted second piles onto your running total. Beat the ticking bomb, dodge the change-word penalty, and keep it moving; the team with the lowest total time at the end takes it all.",
    fa: 'در تیم‌های دونفرهٔ تندوتیز، کلمه را هرطور شده توضیح می‌دهی و هم‌تیمی‌ات پشت‌سرهم حدس می‌زند — و کرنومتر هیچ‌وقت متوقف نمی‌شود. لحظه‌ای که گرفت، گوشی به تیم بعد پرواز می‌کند، پس هر ثانیهٔ هدررفته به زمان کل تو اضافه می‌شود. بمبِ در حال شمارش را شکست بده، از جریمهٔ تعویض کلمه فرار کن و تند پیش برو؛ تیمی که آخرِ بازی کمترین زمان کل را داشته باشد همه‌چیز را می‌برد.',
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
    en: "Players split into teams of two and the phone races around the room, non-stop, with the clock never pausing. On your team's turn, the describer reads the word and describes it out loud (without saying it!) while their partner guesses. The instant your partner gets it, tap “Got it!” and the phone jumps straight to the next team. Be quick, because every second gets added to YOUR team's time.\n\nStuck? Tap “Change word” for a fresh one, but it adds a time penalty. And keep an eye on the bomb: if its fuse runs out first, your team eats the time plus a bigger penalty.\n\nEvery team takes the same number of turns, and the team with the LOWEST total time wins.",
    fa: 'بازیکن‌ها به تیم‌های دونفره تقسیم می‌شوند و گوشی بی‌وقفه دور جمع می‌چرخد و کرنومتر هیچ‌وقت متوقف نمی‌شود. در نوبت تیمت، توضیح‌دهنده کلمه را می‌خواند و بدون گفتن خودش آن را توضیح می‌دهد و هم‌تیمی‌اش حدس می‌زند. لحظه‌ای که هم‌تیمی‌ات گرفت، «گرفتم!» را بزن تا گوشی فوراً به تیم بعد برود. سریع باش، چون هر ثانیه به زمانِ تیمِ تو اضافه می‌شود.\n\nگیر کردی؟ «تعویض کلمه» را بزن، اما جریمهٔ زمانی دارد. مراقب بمب باش: اگر فتیله‌اش زودتر تمام شود، تیمت آن زمان به‌علاوهٔ جریمهٔ بیشتر را می‌گیرد.\n\nهمهٔ تیم‌ها به یک تعداد نوبت بازی می‌کنند و تیمی که کمترین زمان کل را داشته باشد برنده است.',
  },
};
