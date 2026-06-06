import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { press } from '../motion';

/**
 * A toggleable multi-select chip (decks, categories, intensity tiers…).
 * Selected → translucent accent fill (sits below the label in opacity) with solid
 * on-accent text; unselected → frosted glass with muted text. Standardizes the
 * ad-hoc chips that each Setup screen used to hand-roll.
 */
export function SelectChip({
  selected,
  onClick,
  children,
  disabled,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      whileTap={press.whileTap}
      transition={press.transition}
      className={cn(
        'rounded-full px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40',
        selected
          ? 'bg-[var(--accent-fill)] text-[var(--game-on-accent)] shadow-[0_4px_14px_-6px_var(--game-accent-glow)]'
          : 'dp-glass-2 text-[var(--text-muted)]',
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
