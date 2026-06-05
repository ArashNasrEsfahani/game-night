import { motion } from 'framer-motion';
import { pressIcon, springSnappy } from '../motion';

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
  return (
    <div className="flex items-center justify-between">
      {label && <span className="text-[var(--text)]">{label}</span>}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label="decrease"
          whileTap={pressIcon.whileTap}
          whileHover={pressIcon.whileHover}
          transition={pressIcon.transition}
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-xl shadow-[inset_0_0_0_1px_var(--border)] disabled:opacity-40"
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
            {value}
          </motion.span>
        </span>
        <motion.button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label="increase"
          whileTap={pressIcon.whileTap}
          whileHover={pressIcon.whileHover}
          transition={pressIcon.transition}
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-xl shadow-[inset_0_0_0_1px_var(--border)] disabled:opacity-40"
        >
          +
        </motion.button>
      </div>
    </div>
  );
}
