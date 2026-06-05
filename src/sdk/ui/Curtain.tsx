import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Button } from './Button';
import { reveal, springSnappy } from '../motion';

/** Pass-the-phone secrecy curtain: hides children until the holder taps to reveal. */
export function Curtain({
  open,
  holderName,
  hint,
  revealLabel,
  onReveal,
  children,
}: {
  open: boolean;
  holderName?: string;
  hint: string;
  revealLabel: string;
  onReveal: () => void;
  children: ReactNode;
}) {
  if (open)
    return (
      <motion.div variants={reveal} initial="initial" animate="animate" className="flex flex-1 flex-col">
        {children}
      </motion.div>
    );
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springSnappy}
      className="relative grid flex-1 place-items-center gap-5 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-glow)] px-6 py-10 text-center"
      style={{
        /* Always a dark secrecy alcove (in both themes) so the accent halo reads and light text stays legible. */
        background:
          'radial-gradient(120% 90% at 50% 0%, color-mix(in oklab, var(--game-accent-strong) 60%, #1a1140), #120c2e 82%)',
      }}
    >
      {/* rotating disco halo behind the avatar */}
      <span
        aria-hidden
        className="dp-spin-slow pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, transparent, color-mix(in oklab, var(--game-accent) 70%, transparent), transparent 60%)',
          filter: 'blur(34px)',
          opacity: 0.6,
        }}
      />
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...springSnappy, delay: 0.05 }}
        className="relative grid h-24 w-24 place-items-center rounded-full text-4xl font-extrabold text-[var(--game-on-accent)]"
        style={{
          background: 'linear-gradient(150deg, var(--game-accent), var(--game-accent-strong))',
          boxShadow: '0 0 0 5px rgb(255 255 255 / 0.14), 0 12px 34px -6px var(--game-accent-glow)',
        }}
      >
        {holderName ? holderName.slice(0, 1) : '🤫'}
      </motion.div>
      <p className="relative px-4 text-lg font-semibold text-[#fdf6e6]">{hint}</p>
      {holderName && <p className="relative text-2xl font-extrabold text-[#fdf6e6]">{holderName}</p>}
      <Button size="lg" onClick={onReveal} className="relative">
        {revealLabel}
      </Button>
    </motion.div>
  );
}
