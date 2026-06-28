// Named framer-motion variants used across the app. Use with `initial="initial"
// animate="animate" exit="exit"`. MotionConfig (AppProviders) gates these on the
// user's reduced-motion preference, so screens can use them freely.
import type { Variants } from 'framer-motion';
import { easePop, easeOut, springSnappy } from './transitions';

export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: 0.18, ease: easeOut } },
};

export const rise: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.42, ease: easePop } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: easeOut } },
};

export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1, transition: springSnappy },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.16 } },
};

/** Bottom-sheet / modal slide-up. */
export const sheet: Variants = {
  initial: { y: '100%', opacity: 0.6 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.3, ease: easeOut } },
  exit: { y: '100%', opacity: 0, transition: { duration: 0.22, ease: easeOut } },
};

/** Parent that staggers its children's entrance. */
export const stagger: Variants = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.34, ease: easePop } },
};

/** 3D card flip (needs a perspective parent + transformStyle preserve-3d). */
export const cardFlip: Variants = {
  initial: { rotateY: 90, opacity: 0 },
  animate: { rotateY: 0, opacity: 1, transition: { duration: 0.45, ease: easeOut } },
  exit: { rotateY: -90, opacity: 0, transition: { duration: 0.3, ease: easeOut } },
};

/** Prompt / word / role reveal. */
export const reveal: Variants = {
  initial: { opacity: 0, scale: 0.92, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0, transition: springSnappy },
  exit: { opacity: 0, scale: 0.96, y: -8, transition: { duration: 0.16 } },
};

/** A one-shot scale pulse for score/count changes (key the element by its value). */
export const scorePop: Variants = {
  initial: { scale: 1 },
  animate: { scale: [1, 1.35, 1], transition: { duration: 0.4, ease: easePop } },
};

/** Directional screen transition for Setup → Play → Results. */
export const screenSlide: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: easeOut } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.2, ease: easeOut } },
};

/** Vertical screen transition (no horizontal overflow) — for route/phase changes. */
export const screenFade: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: easeOut } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.18, ease: easeOut } },
};

/** App-shell route transition: a soft fade + micro-zoom that reads as a gentle "settle".
 *  Uses scale (not y) on purpose, so it never compounds with a game's internal screenFade
 *  y-lift when you navigate into a game. Transform-only — no layout shift, no scrollbar flash. */
export const routeShell: Variants = {
  initial: { opacity: 0, scale: 0.985 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.26, ease: easeOut } },
  exit: { opacity: 0, scale: 0.99, transition: { duration: 0.15, ease: easeOut } },
};
