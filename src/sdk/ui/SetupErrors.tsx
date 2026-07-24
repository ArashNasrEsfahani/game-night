import { motion } from 'framer-motion';
import { useLocalize } from '../../lib/localize';
import type { LocalizedString } from '../types';

/**
 * The "can't start yet" banner shown above a disabled Start button on every game's setup screen.
 * Replaces a faint line of red text with a tinted, bordered card carrying a ⚠ glyph and a small
 * entrance animation, so the blocking reason (too few players, missing config) is impossible to
 * miss — the #1 reason a first-time player taps a greyed-out Start and wonders why nothing happens.
 * Renders nothing when [errors] is null/empty. Self-localizes, so callers just pass the raw list.
 */
export function SetupErrors({ errors }: { errors?: LocalizedString[] | null }) {
  const localize = useLocalize();
  if (!errors || errors.length === 0) return null;
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-2.5 rounded-2xl border border-[color-mix(in_oklab,var(--color-game-rose)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-game-rose)_14%,var(--surface-2))] px-4 py-3"
    >
      <span aria-hidden className="text-lg leading-tight">
        ⚠️
      </span>
      <ul className="flex-1 space-y-0.5 text-sm font-medium text-[var(--color-game-rose-strong)]">
        {errors.map((e, i) => (
          <li key={i}>{localize(e)}</li>
        ))}
      </ul>
    </motion.div>
  );
}
