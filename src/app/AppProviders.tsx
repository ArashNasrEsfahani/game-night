import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import i18n from '../i18n';
import { ThemeProvider } from './theme/ThemeProvider';
import { DirProvider } from './theme/DirProvider';
import { useSettingsStore } from '../store/settingsStore';
import { useRosterStore } from '../store/rosterStore';
import { useSessionStore } from '../store/sessionStore';
import { Spinner } from '../sdk/ui';

export function AppProviders({ children }: { children: ReactNode }) {
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const rosterHydrated = useRosterStore((s) => s.hydrated);
  const sessionHydrated = useSessionStore((s) => s.hydrated);
  const language = useSettingsStore((s) => s.language);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  // Keep i18n in sync with the persisted language preference.
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);

  // Mark the document when the in-app Reduce Motion setting is "on" so CSS continuous animations
  // (the gold-foil shimmer, spinners, the home-grid bob) stop too — MotionConfig below only governs
  // framer-motion. "off"/"system" leave it unset, so the OS preference still applies via @media.
  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion === 'on') root.setAttribute('data-reduced-motion', 'true');
    else root.removeAttribute('data-reduced-motion');
  }, [reducedMotion]);

  const ready = settingsHydrated && rosterHydrated && sessionHydrated;
  if (!ready) {
    return (
      <div className="grid min-h-[100svh] place-items-center bg-[var(--bg)]">
        <Spinner />
      </div>
    );
  }

  const motion =
    reducedMotion === 'on' ? 'always' : reducedMotion === 'off' ? 'never' : 'user';

  return (
    <MotionConfig reducedMotion={motion}>
      <ThemeProvider>
        <DirProvider>{children}</DirProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
