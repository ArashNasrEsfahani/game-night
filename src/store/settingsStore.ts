// src/store/settingsStore.ts — theme, language, mute, haptics, reduced-motion (persisted).
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './persist/idbStorage';
import { STORE_KEYS } from './persist/keys';
import type { Lang } from '../sdk/types';

export type ThemePref = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'on' | 'off';

export interface SettingsState {
  theme: ThemePref;
  language: Lang;
  muted: boolean;
  haptics: boolean;
  reducedMotion: MotionPref;
  /** Show step-by-step guidance boxes throughout the app. */
  guidance: boolean;
  /** true once async idb rehydration has completed (host gates first paint on this). */
  hydrated: boolean;
  setTheme: (t: ThemePref) => void;
  setLanguage: (l: Lang) => void;
  setMuted: (m: boolean) => void;
  setHaptics: (h: boolean) => void;
  setReducedMotion: (r: MotionPref) => void;
  setGuidance: (g: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      language: 'fa',
      muted: false,
      haptics: true,
      reducedMotion: 'system',
      guidance: true,
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setMuted: (muted) => set({ muted }),
      setHaptics: (haptics) => set({ haptics }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setGuidance: (guidance) => set({ guidance }),
    }),
    {
      name: STORE_KEYS.settings,
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      partialize: (s) => ({
        theme: s.theme,
        language: s.language,
        muted: s.muted,
        haptics: s.haptics,
        reducedMotion: s.reducedMotion,
        guidance: s.guidance,
      }),
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ hydrated: true });
      },
    },
  ),
);
