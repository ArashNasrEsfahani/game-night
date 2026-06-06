import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { springSnappy } from '../motion';

/**
 * A collapsible "Advanced options" panel. Keeps the first thing a player sees on a
 * Setup screen short: the essentials are always visible, the rest hides behind one tap.
 * Renders as a single frosted-glass card whose header toggles the body.
 */
export function Disclosure({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="dp-glass overflow-hidden rounded-[var(--radius-card)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start"
      >
        <span className="flex flex-col">
          <span className="font-semibold text-[var(--text)]">{title}</span>
          {summary && <span className="text-xs text-[var(--text-muted)]">{summary}</span>}
        </span>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={springSnappy}
          className="text-lg leading-none text-[var(--text-muted)]"
        >
          ⌄
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              // Height glides on a material-style curve; opacity resolves faster so the
              // content fades in just after the panel starts opening (and out before it
              // collapses), which reads much smoother than animating both together.
              height: { duration: 0.34, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.2, ease: 'easeOut' },
            }}
            className="overflow-hidden"
            style={{ willChange: 'height' }}
          >
            <motion.div
              initial={{ y: -8 }}
              animate={{ y: 0 }}
              exit={{ y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-4 px-4 pb-4 pt-1"
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
