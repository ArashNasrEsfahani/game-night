// Reusable press/hover feedback prop bags for `motion.*` elements.
// MotionConfig (AppProviders) disables these transforms under reduced motion.
import { springSnappy } from './transitions';

/** Standard tactile feedback for buttons/pills. */
export const press = {
  whileTap: { scale: 0.95 },
  whileHover: { scale: 1.025 },
  transition: springSnappy,
} as const;

/** Softer feedback for large surfaces (cards) — a lift + slight scale. */
export const pressCard = {
  whileTap: { scale: 0.985 },
  whileHover: { y: -4 },
  transition: springSnappy,
} as const;

/** Subtle feedback for small icon controls. */
export const pressIcon = {
  whileTap: { scale: 0.88 },
  whileHover: { scale: 1.08 },
  transition: springSnappy,
} as const;
