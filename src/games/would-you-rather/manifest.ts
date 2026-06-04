import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'would-you-rather',
  name: { en: 'Would You Rather', fa: 'کدوم رو ترجیح می‌دی؟' },
  tagline: { en: 'Two options. Pick a side. Defend it.', fa: 'دو گزینه. یک طرف رو انتخاب کن. ازش دفاع کن.' },
  description: {
    en: 'Two impossible options appear. Everyone picks A or B, the split is revealed, and the debate begins. Optionally score points for going with the crowd.',
    fa: 'دو گزینهٔ ناممکن می‌آید. همه A یا B را انتخاب می‌کنند، نتیجه نمایش داده می‌شود و بحث شروع می‌شود. می‌توانید برای همراهی با اکثریت امتیاز بگیرید.',
  },
  icon: '🤔',
  color: 'teal',
  category: 'voting',
  minPlayers: 2,
  maxPlayers: 20,
  estimatedMinutes: [5, 20],
  tags: [
    { en: 'Party', fa: 'مهمانی' },
    { en: 'Talk', fa: 'گفتگو' },
    { en: 'Voting', fa: 'رأی‌گیری' },
  ],
  capabilities: {
    usesTeams: false,
    usesTimer: false,
    usesDeck: true,
    usesVoting: true,
    usesRevealGate: true,
    passAndPlay: true,
  },
  stateVersion: 1,
  howToPlay: {
    en: 'Read the two options. Either pass the phone so each player secretly taps A or B, or count hands aloud. Reveal the split and debate. Play through the deck.',
    fa: 'دو گزینه را بخوان. یا گوشی را بچرخان تا هر بازیکن پنهانی A یا B را بزند، یا دست‌ها را بلند بشمار. نتیجه را نشان بده و بحث کن. کل دسته را بازی کن.',
  },
};
