import { useCallback } from 'react';
import { soundService } from '../services/sound';
import { hapticsService } from '../services/haptics';
import { useSettingsStore } from '../store/settingsStore';
import type { SoundId } from '../sdk/types';

/**
 * Incidental UI feedback for the shared SDK controls (toggles, segmented controls, chips, steppers),
 * which have no game `ctx`. Plays the sound unless 🔇 muted, and pulses a light haptic unless the
 * haptics setting is off — so SDK controls feel as responsive on a phone as in-game ones do. Each
 * cue is gated by its own setting (mute = sound, haptics = vibration), matching `ctx`'s split.
 */
export function useUiSound() {
  const muted = useSettingsStore((s) => s.muted);
  const haptics = useSettingsStore((s) => s.haptics);
  return useCallback(
    (id: SoundId) => {
      if (!muted) soundService.play(id);
      if (haptics) hapticsService.light();
    },
    [muted, haptics],
  );
}
