import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { GameManifest } from '../types';
import { gameEmblem } from './emblems';
import { easePop, springSnappy } from '../motion';

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
    '--game-on-accent': `var(--on-${accent})`,
  } as CSSProperties;
  const emblem = gameEmblem(manifest.id);
  const faName = manifest.name.fa;

  return (
    <motion.button
      onClick={onClick}
      style={accentVars}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.45, ease: easePop }}
      whileHover={{ y: -4, transition: springSnappy }}
      whileTap={{ scale: 0.97, transition: springSnappy }}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] text-start shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[0_26px_60px_-20px_var(--game-accent-glow)]"
    >
      {/* Lit niche / arch (طاق) with the glowing emblem — theme-aware: a warm cream alcove by
          day, a jewel-dark alcove at night. Identical formula on every card → consistent family. */}
      <div
        className="relative grid h-28 w-full place-items-center transition-[filter] duration-300 group-hover:brightness-110"
        style={{
          background:
            'radial-gradient(80% 120% at 50% 122%, var(--game-accent) 0%, var(--game-accent-strong) 55%, transparent 100%), linear-gradient(180deg, color-mix(in oklab, var(--game-accent) 28%, var(--lapis)), var(--lapis-2))',
        }}
      >
        <motion.div
          className="dp-accent h-[68px] w-[68px] [&_svg]:h-full [&_svg]:w-full"
          style={{ filter: 'drop-shadow(0 0 10px var(--game-accent-glow))' }}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          {...(emblem
            ? { dangerouslySetInnerHTML: { __html: emblem } }
            : { children: <span className="grid h-full w-full place-items-center text-5xl">{manifest.icon}</span> })}
        />
      </div>

      {/* Body */}
      <div className="flex flex-col gap-0.5 px-3.5 pb-3.5 pt-2.5">
        <span className="font-display text-lg leading-tight text-[var(--text)]">{title}</span>
        {faName !== title && (
          <span className="dp-accent font-display text-sm leading-tight">{faName}</span>
        )}
        <span className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">{tagline}</span>
      </div>
    </motion.button>
  );
}
