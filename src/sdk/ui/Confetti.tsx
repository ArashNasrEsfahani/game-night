import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const COLORS = ['grape', 'tangerine', 'lime', 'sky', 'rose', 'gold', 'teal', 'violet'].map(
  (c) => `var(--color-game-${c})`,
);

/** A one-shot confetti burst that rains down once on mount. */
export function Confetti({ count = 40 }: { count?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.8 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 60,
        spin: 360 + Math.random() * 720,
        color: COLORS[i % COLORS.length],
        w: 6 + Math.random() * 8,
        round: Math.random() > 0.6,
      })),
    [count],
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: '-8vh', x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '112vh', x: p.drift, rotate: p.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: 0,
            width: p.w,
            height: p.round ? p.w : p.w * 0.5,
            background: p.color,
            borderRadius: p.round ? '50%' : 2,
            boxShadow: `0 0 6px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
