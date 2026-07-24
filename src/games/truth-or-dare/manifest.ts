import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'truth-or-dare',
  name: { en: 'Truth or Dare', fa: 'جرئت یا حقیقت' },
  tagline: { en: 'Spin, pick, reveal, pass the phone!', fa: 'بچرخون، انتخاب کن، نشون بده، گوشی رو بچرخون!' },
  description: {
    en: "Give the bottle a spin, hold your breath, and watch it land on someone. They pick Truth for a question they might regret or Dare for a challenge they definitely will, and a fresh prompt is revealed. Pass the phone and keep the secrets and stunts coming — play loose and endless, or race to a points target.",
    fa: 'بطری را بچرخان، نفست را حبس کن و ببین روی چه کسی می‌ایستد. او «حقیقت» را انتخاب می‌کند برای سوالی که شاید پشیمانش کند، یا «جرئت» را برای کاری که حتماً پشیمانش می‌کند، و یک سرنخ تازه رو می‌شود. گوشی را بچرخان و رازها و کارهای جسورانه را ادامه بده — بی‌خیال و بی‌پایان بازی کن یا به امتیاز هدف برس.',
  },
  icon: '🌶️',
  color: 'gold',
  category: 'party',
  minPlayers: 2,
  maxPlayers: 16,
  estimatedMinutes: [10, 40],
  tags: [
    { en: 'Party', fa: 'مهمانی' },
    { en: 'Spicy', fa: 'تند' },
    { en: 'No equipment', fa: 'بدون وسیله' },
  ],
  capabilities: {
    usesTeams: false,
    usesTimer: false,
    usesDeck: true,
    usesVoting: false,
    usesRevealGate: true,
    passAndPlay: true,
  },
  stateVersion: 1,
  supportsCustomContent: true,
  howToPlay: {
    en: 'Spin (or go in order) to pick a player. They choose Truth or Dare and a prompt is revealed. Mark Done or Skip and pass the phone. Optionally score points for completed prompts.',
    fa: 'بچرخون (یا به ترتیب) تا یک بازیکن انتخاب بشه. او جرئت یا حقیقت را انتخاب می‌کند و سرنخی نمایش داده می‌شود. انجام شد یا رد را بزن و گوشی را بچرخان. می‌توانید برای انجام سرنخ‌ها امتیاز بگیرید.',
  },
};
