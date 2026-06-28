import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const COLORS = ['grape', 'tangerine', 'lime', 'sky', 'rose', 'gold', 'teal', 'violet'].map(
  (c) => `var(--color-game-${c})`,
);

/** A one-shot confetti burst that rains down once on mount — a mix of dots, flakes and fluttering
 *  ribbon streamers for a fuller, more festive fall. */
export function Confetti({ count = 48 }: { count?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const roll = Math.random();
        const streamer = roll > 0.82; // a few long fluttering ribbons
        const round = !streamer && roll > 0.5;
        const w = streamer ? 3 + Math.random() * 3 : 6 + Math.random() * 8;
        return {
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 0.5,
          dur: 1.8 + Math.random() * 1.6,
          drift: (Math.random() - 0.5) * (streamer ? 100 : 60),
          spin: (streamer ? 540 : 360) + Math.random() * 720,
          color: COLORS[i % COLORS.length],
          w,
          h: streamer ? w * (3.4 + Math.random() * 2) : round ? w : w * 0.5,
          radius: round ? '50%' : streamer ? 999 : 2,
        };
      }),
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
            height: p.h,
            background: p.color,
            borderRadius: p.radius,
            boxShadow: `0 0 6px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
