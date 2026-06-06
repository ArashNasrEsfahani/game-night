import { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { press, springSnappy } from '../motion';
import { useUiSound } from '../../lib/uiSound';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  const groupId = useId();
  const ui = useUiSound();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="dp-glass-2 relative flex gap-1 rounded-[var(--radius-pill)] p-1 shadow-[inset_0_0_0_1px_var(--glass-border)]"
    >
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <motion.button
            key={o.value}
            role="radio"
            aria-checked={selected}
            onClick={() => { if (!selected) ui('select'); onChange(o.value); }}
            whileTap={press.whileTap}
            transition={press.transition}
            className="relative flex-1 rounded-[var(--radius-pill)] px-3 py-2 text-sm font-semibold"
          >
            {selected && (
              <motion.span
                layoutId={`seg-${groupId}`}
                transition={springSnappy}
                className="absolute inset-0 rounded-[var(--radius-pill)] bg-[linear-gradient(135deg,var(--accent-fill),var(--accent-fill-strong))] shadow-[0_4px_14px_-4px_var(--game-accent-glow)]"
              />
            )}
            <span
              className={cn(
                'relative z-10',
                selected ? 'text-[var(--game-on-accent)]' : 'text-[var(--text-muted)]',
              )}
            >
              {o.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
