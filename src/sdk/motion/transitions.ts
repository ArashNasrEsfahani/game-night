// Shared framer-motion transition presets. Mirror the CSS eases in src/index.css.
import type { Transition } from 'framer-motion';

/** Overshoot easing — matches --ease-pop. */
export const easePop = [0.34, 1.56, 0.64, 1] as const;
/** Smooth deceleration — matches --ease-out. */
export const easeOut = [0.22, 1, 0.36, 1] as const;

// Slower, smoother settle (kept in step with the native springSnappy): low stiffness so motion eases
// over a relaxed ~0.4s, high damping ratio (~0.9) so it glides to rest with almost no bounce.
export const springSnappy: Transition = { type: 'spring', stiffness: 300, damping: 31 };
export const springSoft: Transition = { type: 'spring', stiffness: 210, damping: 26 };
export const springBouncy: Transition = { type: 'spring', stiffness: 500, damping: 18, mass: 0.6 };

export const tweenFast: Transition = { duration: 0.18, ease: easeOut };
export const tweenMed: Transition = { duration: 0.34, ease: easeOut };
