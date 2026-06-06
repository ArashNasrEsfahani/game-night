import { useCallback } from 'react';
import { soundService } from '../services/sound';
import { useSettingsStore } from '../store/settingsStore';
import type { SoundId } from '../sdk/types';

/**
 * A mute-aware play() for incidental UI feedback (toggles, segmented controls, chips, steppers).
 * Game screens drive sound through `ctx.sound`; the shared SDK controls have no ctx, so they use
 * this hook instead — gated by the same persisted mute setting so 🔇 silences everything.
 */
export function useUiSound() {
  const muted = useSettingsStore((s) => s.muted);
  return useCallback(
    (id: SoundId) => {
      if (!muted) soundService.play(id);
    },
    [muted],
  );
}
