import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { sheet as sheetVariant, fade } from '../motion';

/** A bottom sheet / modal that slides up from the bottom, with a dimmed backdrop. The grabber is a
 *  real handle: drag it down (or flick) to dismiss, matching the affordance it implies. The body
 *  stays freely scrollable because only the handle initiates the drag (dragListener disabled). */
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
  const dragControls = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);

  // Keyboard + focus a11y: when open, move focus into the dialog (so screen readers announce it and
  // keyboard users land inside) and let Escape close it — standard modal behaviour the sheet lacked.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className="dp-glass fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[80svh] max-w-md overflow-y-auto rounded-t-[var(--radius-card)] p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] outline-none"
            variants={sheetVariant}
            initial="initial"
            animate="animate"
            exit="exit"
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onClose();
            }}
          >
            {/* Drag handle — grab here to swipe the sheet away (touchAction:none lets the gesture
                start cleanly on touch without scrolling the body). */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="-mx-5 -mt-5 mb-1 flex cursor-grab justify-center px-5 pb-1 pt-3 active:cursor-grabbing"
              style={{ touchAction: 'none' }}
              aria-hidden
            >
              <div className="h-1.5 w-10 rounded-full bg-[var(--border-glow)]" />
            </div>
            {title && <h2 className="mb-3 font-display text-2xl">{title}</h2>}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
