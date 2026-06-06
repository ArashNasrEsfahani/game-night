import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'truth-or-dare',
  name: { en: 'Truth or Dare', fa: 'جرئت یا حقیقت' },
  tagline: { en: 'Spin, pick, reveal, pass the phone!', fa: 'بچرخون، انتخاب کن، نشون بده، گوشی رو بچرخون!' },
  description: {
    en: 'Spin to pick a player, choose Truth or Dare, and reveal a prompt. Play casually forever or race to a points target.',
    fa: 'بچرخون تا یک بازیکن انتخاب بشه، جرئت یا حقیقت را انتخاب کن و سرنخ را ببین. بی‌خیال تا ابد بازی کن یا به امتیاز هدف برس.',
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
