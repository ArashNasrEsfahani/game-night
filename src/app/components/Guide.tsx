import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { useSettingsStore } from '../../store/settingsStore';

/** An inline guidance box ("little cloud" of help). Renders only while guidance is enabled. */
export function Guide({
  children,
  icon = '💡',
  className,
}: {
  children: ReactNode;
  icon?: string;
  className?: string;
}) {
  const on = useSettingsStore((s) => s.guidance);
  if (!on) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-start gap-2.5 rounded-2xl bg-[var(--surface-2)] px-3.5 py-2.5 text-sm leading-snug text-[var(--text-muted)] shadow-[inset_0_0_0_1px_var(--border-glow)]',
        className,
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      <p className="flex-1">{children}</p>
    </motion.div>
  );
}

/** A floating guidance cloud pinned to the bottom (used in-game over full-screen layouts). Honors
 *  the guidance toggle and can be dismissed for the current step; it returns when the step changes. */
export function GuideBanner({ text }: { text: string }) {
  const on = useSettingsStore((s) => s.guidance);
  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(false), [text]);
  const visible = on && !hidden && !!text;
  // Reserve bottom space (consumed by <Screen>'s padding) so this floating banner never sits on top
  // of a screen's bottom action button and intercepts taps.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--guide-pad', visible ? '7rem' : '0px');
    return () => root.style.setProperty('--guide-pad', '0px');
  }, [visible]);
  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl bg-[var(--surface-2)] px-3.5 py-2.5 text-sm shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45),inset_0_0_0_1px_var(--border-glow)]"
      >
        <span className="text-base leading-none">💡</span>
        <p className="flex-1 leading-snug text-[var(--text-muted)]">{text}</p>
        <button
          onClick={() => setHidden(true)}
          aria-label="Dismiss"
          className="shrink-0 text-[var(--text-muted)]"
        >
          ✕
        </button>
      </motion.div>
    </div>
  );
}
