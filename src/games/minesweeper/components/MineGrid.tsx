import { useRef } from 'react';
import { cn } from '../../../lib/cn';
import type { Cell } from '../logic';

const NUM_COLOR = [
  '',
  'text-blue-600',
  'text-green-600',
  'text-red-600',
  'text-indigo-800',
  'text-rose-800',
  'text-teal-600',
  'text-zinc-800',
  'text-zinc-500',
];

/** Responsive Minesweeper board. Tap = reveal (or flag in flag-mode); long-press = flag;
 *  tapping an already-revealed number chords (reveals its non-flagged neighbours). Revealed safe
 *  cells are faintly tinted by the seat that cleared them. Pure presentation — all rules live in
 *  the reducer (illegal taps are no-ops there). */
export function MineGrid({
  cells,
  cols,
  flagMode,
  disabled,
  seatColors,
  onReveal,
  onFlag,
  onChord,
}: {
  cells: Cell[];
  cols: number;
  flagMode: boolean;
  disabled?: boolean;
  seatColors: Record<string, string | undefined>;
  onReveal: (i: number) => void;
  onFlag: (i: number) => void;
  onChord: (i: number) => void;
}) {
  const press = useRef<{ idx: number; timer: number; longFired: boolean } | null>(null);

  const tap = (c: Cell) => {
    if (disabled) return;
    if (c.revealed) {
      if (!flagMode && !c.mine && c.adjacent > 0) onChord(c.index);
      return;
    }
    if (flagMode) onFlag(c.index);
    else onReveal(c.index);
  };

  const onDown = (c: Cell) => {
    if (disabled || c.revealed) {
      press.current = null;
      return;
    }
    const timer = window.setTimeout(() => {
      onFlag(c.index);
      if (press.current) press.current.longFired = true;
    }, 420);
    press.current = { idx: c.index, timer, longFired: false };
  };
  const onUp = (c: Cell) => {
    const p = press.current;
    press.current = null;
    if (p) window.clearTimeout(p.timer);
    if (p && p.idx === c.index && p.longFired) return; // long-press already flagged
    tap(c);
  };
  const onCancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

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
        return (
          <button
            key={c.index}
            type="button"
            disabled={disabled && !revealed}
            onPointerDown={() => onDown(c)}
            onPointerUp={() => onUp(c)}
            onPointerLeave={onCancel}
            onContextMenu={(e) => e.preventDefault()}
            style={
              revealed && tint && !c.mine
                ? { background: `color-mix(in oklab, var(--color-game-${tint}) 22%, var(--surface-sunk))` }
                : undefined
            }
            className={cn(
              'relative flex aspect-square items-center justify-center rounded-[5px] text-center font-bold leading-none',
              'text-[clamp(10px,3.4vw,18px)]',
              base,
              c.exploded && 'bg-[var(--color-game-rose-strong)]',
            )}
          >
            {c.flagged && !revealed && <span aria-hidden>🚩</span>}
            {revealed && c.mine && <span aria-hidden>{c.exploded ? '💥' : '💣'}</span>}
            {revealed && !c.mine && c.adjacent > 0 && (
              <span className={NUM_COLOR[c.adjacent]}>{c.adjacent}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
