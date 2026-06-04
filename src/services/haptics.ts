// src/services/haptics.ts — navigator.vibrate wrapper (Capacitor Haptics later). Host swaps noop when muted.
import type { HapticsService } from '../sdk/types';

function vibe(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

export const hapticsService: HapticsService = {
  light: () => vibe(10),
  medium: () => vibe(20),
  heavy: () => vibe(35),
  success: () => vibe([12, 40, 12]),
  warning: () => vibe([20, 60, 20]),
  error: () => vibe([40, 30, 40, 30, 40]),
};

export const noopHaptics: HapticsService = {
  light: () => {},
  medium: () => {},
  heavy: () => {},
  success: () => {},
  warning: () => {},
  error: () => {},
};
