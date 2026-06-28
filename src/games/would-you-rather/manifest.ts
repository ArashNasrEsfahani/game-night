import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'would-you-rather',
  name: { en: 'Would You Rather', fa: 'کدوم رو ترجیح می‌دی؟' },
  tagline: { en: 'Two options. Pick a side. Defend it.', fa: 'دو گزینه. یک طرف رو انتخاب کن. ازش دفاع کن.' },
  description: {
    en: "Every card forces an impossible choice between two unthinkable options, and there's no sitting on the fence. The whole group locks in A or B, the split is revealed, and suddenly everyone's defending the indefensible. It's the fastest way to start an argument you'll all end up laughing about — and you can keep score for siding with the majority.",
    fa: 'هر کارت تو را بین دو گزینهٔ غیرممکن گیر می‌اندازد و راه فراری هم نیست. همه پنهانی A یا B را انتخاب می‌کنند، نتیجه رو می‌شود و یک‌دفعه همه دارند از انتخاب عجیبشان دفاع می‌کنند. سریع‌ترین راه برای راه انداختن بحثی که آخرش همه‌تان به آن می‌خندید — و می‌توانید برای همراهی با اکثریت امتیاز هم بگیرید.',
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
