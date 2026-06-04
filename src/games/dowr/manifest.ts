import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'dowr',
  name: { en: 'Dowr', fa: 'دور' },
  tagline: { en: "Describe it — don't say it!", fa: 'توضیح بده، خودش رو نگو!' },
  description: {
    en: 'Describe the word out loud without saying it — race the clock as the phone circles the group.',
    fa: 'کلمه را بدون گفتن خودش با صدای بلند توضیح بده و با زمان مسابقه بده؛ گوشی دور جمع می‌چرخد.',
  },
  icon: '🗣️',
  color: 'violet',
  category: 'word',
  minPlayers: 2,
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
  stateVersion: 1,
  howToPlay: {
    en: 'On your turn, secretly read the word, then describe it out loud without saying it. Your team guesses; tap Correct to score and move on, or Skip. Pass the phone around the circle.',
    fa: 'در نوبت خود کلمه را پنهانی بخوان و بدون گفتن خودش توضیح بده. تیمت حدس می‌زند؛ برای امتیاز «درست» را بزن یا «رد کن». گوشی را دور جمع بچرخان.',
  },
};
