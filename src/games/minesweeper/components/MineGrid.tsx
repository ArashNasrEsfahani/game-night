import { motion } from 'framer-motion';
import { cn } from '../../../lib/cn';
import type { Cell } from '../logic';

// Theme-aware clue colours: deep classic-minesweeper shades on the light (cream) tiles, bright
// shades on the dark sunk tiles — each stays high-contrast against its own background.
const NUM_COLOR = [
  '',
  'text-blue-700 dark:text-blue-400',
  'text-emerald-700 dark:text-emerald-400',
  'text-red-700 dark:text-red-400',
  'text-violet-700 dark:text-violet-400',
  'text-rose-700 dark:text-rose-400',
  'text-teal-700 dark:text-teal-400',
  'text-amber-700 dark:text-amber-400',
  'text-slate-600 dark:text-slate-400',
];

/** Responsive mine-hunt board. Tap a square to reveal it: a mine is a find (💣, tinted by whoever
 *  found it, with a little pop), a safe square shows its number clue. Pure presentation — all rules
 *  live in the reducer (illegal taps are no-ops there). */
export function MineGrid({
  cells,
  cols,
  disabled,
  seatColors,
  onReveal,
}: {
  cells: Cell[];
  cols: number;
  disabled?: boolean;
  seatColors: Record<string, string | undefined>;
  onReveal: (i: number) => void;
}) {
  return (
    <div
      className="mx-auto grid w-full max-w-md gap-[3px] select-none"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cells.map((c) => {
        const revealed = c.revealed;
        const tint = c.revealedBy ? seatColors[c.revealedBy] : undefined;
        const base = revealed
          ? 'bg-[var(--surface-sunk)]'
          : 'bg-[var(--surface-2)] shadow-[inset_0_-2px_0_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-px';
        // A found mine fills with the finder's colour (so you can count each player's haul at a
        // glance); a revealed safe square gets only a faint finder tint.
        const style =
          revealed && tint
            ? c.mine
              ? {
                  background: `color-mix(in oklab, var(--color-game-${tint}) 82%, var(--surface-sunk))`,
                  boxShadow: 'inset 0 0 0 2px rgb(255 255 255 / 0.35)',
                }
              : { background: `color-mix(in oklab, var(--color-game-${tint}) 18%, var(--surface-sunk))` }
            : undefined;
        return (
          <button
            key={c.index}
            type="button"
            disabled={disabled || revealed}
            onClick={() => onReveal(c.index)}
            onContextMenu={(e) => e.preventDefault()}
            style={style}
            className={cn(
              'relative flex aspect-square items-center justify-center rounded-[5px] text-center font-bold leading-none',
              'text-[clamp(10px,3.4vw,18px)]',
              base,
            )}
          >
            {revealed && c.mine && (
              <motion.span
                aria-hidden
                initial={{ scale: 0.2, rotate: -20 }}
                animate={{ scale: [0.2, 1.35, 1], rotate: [-20, 8, 0] }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                💣
              </motion.span>
            )}
            {revealed && !c.mine && c.adjacent > 0 && (
              <span className={NUM_COLOR[c.adjacent]}>{c.adjacent}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
