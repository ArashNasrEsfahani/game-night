import { AnimatePresence, motion } from 'framer-motion';
import type { ColorToken } from '../types';

/**
 * Ambient background "undertone lights" in the active team/player's colour. Sits behind all
 * screen content (the Screen scaffold is transparent over the body background) and cross-fades
 * smoothly as turns pass. Pass either a `ColorToken` (mapped to `--color-game-<token>`) or a
 * full CSS colour string; nullish falls back to the current game accent.
 */
export function TurnAura({ color }: { color?: ColorToken | string | null }) {
  const c = !color
    ? 'var(--game-accent)'
    : /[(#]/.test(color) || color.startsWith('var(')
      ? color
      : `var(--color-game-${color})`;
  const strong = `color-mix(in oklab, ${c} 58%, transparent)`;
  const base = `color-mix(in oklab, ${c} 28%, transparent)`;
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <AnimatePresence>
        <motion.div
          key={c}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          className="absolute inset-0"
          style={{
            // A full-screen wash of the active colour + intensified top/bottom glows so the
            // whole screen reads in that team's/player's colour.
            background: `radial-gradient(125% 85% at 50% -6%, ${strong} 0%, transparent 80%), radial-gradient(125% 85% at 50% 106%, ${strong} 0%, transparent 80%), linear-gradient(180deg, ${base}, ${base})`,
          }}
        />
      </AnimatePresence>
    </div>
  );
}
