import { motion } from 'framer-motion';
import { pressIcon, springSnappy } from '../motion';
import { useUiSound } from '../../lib/uiSound';
import { useNum } from '../../lib/digits';

export function Stepper({
  value,
  min = 1,
  max = 99,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  const ui = useUiSound();
  const num = useNum();
  return (
    <div className="flex items-center justify-between">
      {label && <span className="text-[var(--text)]">{label}</span>}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => { ui('tap'); onChange(Math.max(min, value - 1)); }}
          disabled={value <= min}
          aria-label="decrease"
          whileTap={pressIcon.whileTap}
          whileHover={pressIcon.whileHover}
          transition={pressIcon.transition}
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--control-fill)] text-xl text-[var(--text)] shadow-[inset_0_0_0_1px_var(--glass-border)] disabled:opacity-40"
        >
          −
        </motion.button>
        <span className="w-8 overflow-hidden text-center text-lg font-bold tabular-nums">
          <motion.span
            key={value}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={springSnappy}
            className="inline-block"
          >
            {num(value)}
          </motion.span>
        </span>
        <motion.button
          onClick={() => { ui('tap'); onChange(Math.min(max, value + 1)); }}
          disabled={value >= max}
          aria-label="increase"
          whileTap={pressIcon.whileTap}
          whileHover={pressIcon.whileHover}
          transition={pressIcon.transition}
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--control-fill)] text-xl text-[var(--text)] shadow-[inset_0_0_0_1px_var(--glass-border)] disabled:opacity-40"
        >
          +
        </motion.button>
      </div>
    </div>
  );
}
