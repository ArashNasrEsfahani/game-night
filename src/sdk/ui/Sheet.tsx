import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { sheet as sheetVariant, fade } from '../motion';

/** A bottom sheet / modal that slides up from the bottom, with a dimmed backdrop. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
            variants={fade}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="dp-glass fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[80svh] max-w-md overflow-y-auto rounded-t-[var(--radius-card)] p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
            variants={sheetVariant}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--border-glow)]" />
            {title && <h2 className="mb-3 font-display text-2xl">{title}</h2>}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
