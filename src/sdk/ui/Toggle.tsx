import { motion } from 'framer-motion';
import { springSnappy } from '../motion';

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      {label && <span className="text-[var(--text)]">{label}</span>}
      <motion.button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        whileTap={{ scale: 0.92 }}
        transition={springSnappy}
        className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors ${
          checked ? 'bg-[var(--accent-fill-strong)]' : 'bg-[var(--control-fill)]'
        }`}
      >
        <motion.span
          layout
          transition={springSnappy}
          className={`block h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.4)] ${
            checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
          }`}
        />
      </motion.button>
    </div>
  );
}
