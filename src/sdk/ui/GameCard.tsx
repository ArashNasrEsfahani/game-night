import type { CSSProperties } from 'react';
import type { GameManifest } from '../types';
import { gameEmblem } from './emblems';

export function GameCard({
  manifest,
  title,
  tagline,
  onClick,
  index = 0,
}: {
  manifest: GameManifest;
  title: string;
  tagline: string;
  onClick?: () => void;
  index?: number;
}) {
  const accent = manifest.color;
  const accentVars = {
    '--game-accent': `var(--color-game-${accent})`,
    '--game-accent-strong': `var(--color-game-${accent}-strong)`,
    '--game-accent-glow': `color-mix(in oklab, var(--color-game-${accent}) 60%, transparent)`,
    animationDelay: `${index * 0.05}s`,
  } as CSSProperties;
  const emblem = gameEmblem(manifest.id);
  const faName = manifest.name.fa;

  return (
    <button
      onClick={onClick}
      style={accentVars}
      className="dp-rise group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] text-start shadow-[var(--shadow-card)] transition duration-300 ease-[var(--ease-pop)] hover:-translate-y-1 hover:shadow-[0_26px_60px_-20px_var(--game-accent-glow)] active:scale-[0.98]"
    >
      {/* Lit niche / arch with the glowing emblem */}
      <div
        className="relative grid h-28 place-items-center transition-[filter] duration-300 group-hover:brightness-110"
        style={{
          background:
            'radial-gradient(75% 95% at 50% 128%, var(--game-accent-strong) 0%, transparent 62%), linear-gradient(180deg, #1a1340, #0e0a28)',
        }}
      >
        <div
          className="h-[68px] w-[68px] text-[var(--game-accent)] [&_svg]:h-full [&_svg]:w-full"
          style={{ filter: 'drop-shadow(0 0 10px var(--game-accent-glow))' }}
          {...(emblem
            ? { dangerouslySetInnerHTML: { __html: emblem } }
            : { children: <span className="grid h-full w-full place-items-center text-5xl">{manifest.icon}</span> })}
        />
      </div>

      {/* Body */}
      <div className="flex flex-col gap-0.5 px-3.5 pb-3.5 pt-2.5">
        <span className="font-display text-lg leading-tight text-[var(--text)]">{title}</span>
        {faName !== title && (
          <span className="font-display text-sm leading-tight text-[var(--game-accent)]">{faName}</span>
        )}
        <span className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">{tagline}</span>
      </div>
    </button>
  );
}
