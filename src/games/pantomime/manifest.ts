import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'pantomime',
  name: { en: 'Pantomime', fa: 'پانتومیم' },
  tagline: { en: 'Act it out silently', fa: 'بی‌کلام اجرا کن' },
  description: {
    en: "One actor gets a secret prompt and has to bring it to life with nothing but gestures — no words, no sounds, no cheating. Their team shouts guesses in a frenzy while the clock ticks down and the miming gets more desperate by the second. Score every prompt you can before time's up, then hand off to the next team; the most points takes the win.",
    fa: 'یک بازیگر سرنخ مخفی می‌گیرد و باید فقط با حرکت آن را زنده کند — بدون کلام، بدون صدا، بدون تقلب. تیمش دیوانه‌وار حدس می‌زند، زمان می‌گذرد و اجرا هر ثانیه ناامیدانه‌تر می‌شود. تا قبل از پایان وقت هر سرنخی که می‌توانی امتیاز بگیر، بعد نوبت را به تیم بعد بده؛ بیشترین امتیاز برنده است.',
  },
  icon: '🎭',
  color: 'grape',
  category: 'party',
  minPlayers: 4,
  maxPlayers: 16,
  estimatedMinutes: [10, 20],
  tags: [
    { en: 'Party', fa: 'مهمانی' },
    { en: 'Teams', fa: 'تیمی' },
    { en: 'Active', fa: 'پرتحرک' },
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
    en: 'In teams, the actor secretly reads a prompt then mimes it without speaking. Their team shouts guesses; tap Correct to score or Skip a hard one. When time runs out the phone passes to the next team. Most points wins.',
    fa: 'در تیم‌ها، بازیگر سرنخ را پنهانی می‌خواند و بدون حرف زدن اجرا می‌کند. تیمش حدس می‌زند؛ برای امتیاز «درست» را بزن یا سرنخ سخت را «رد کن». با تمام شدن زمان، گوشی به تیم بعدی می‌رسد. بیشترین امتیاز برنده است.',
  },
};
