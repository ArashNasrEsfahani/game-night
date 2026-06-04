import type { ColorToken, GameManifest } from '../types';
import { cn } from '../../lib/cn';

const ACCENT_VAR: Record<ColorToken, string> = {
  grape: '--color-game-grape',
  tangerine: '--color-game-tangerine',
  lime: '--color-game-lime',
  sky: '--color-game-sky',
  rose: '--color-game-rose',
  gold: '--color-game-gold',
  teal: '--color-game-teal',
  violet: '--color-game-violet',
};

export function GameCard({
  manifest,
  title,
  tagline,
  onClick,
}: {
  manifest: GameManifest;
  title: string;
  tagline: string;
  onClick?: () => void;
}) {
  const base = ACCENT_VAR[manifest.color] ?? '--color-game-grape';
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex aspect-square flex-col justify-between overflow-hidden rounded-[var(--radius-card)]',
        'p-4 text-start text-white shadow-[var(--shadow-card)] transition active:scale-[0.97]',
      )}
      style={{ background: `linear-gradient(140deg, var(${base}), var(${base}-strong))` }}
    >
      <span className="text-4xl drop-shadow-sm">{manifest.icon}</span>
      <span className="z-10">
        <span className="block text-lg font-bold leading-tight">{title}</span>
        <span className="block text-sm leading-snug opacity-90">{tagline}</span>
      </span>
    </button>
  );
}
