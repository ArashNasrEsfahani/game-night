// src/i18n/index.ts — i18next init (UI chrome strings only; game content uses LocalizedString).
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fa from './fa.json';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fa: { translation: fa },
  },
  // Deterministic default for tests/first tick; the running app switches to the user's saved
  // language (default fa — see settingsStore) via AppProviders on load.
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'fa'],
  interpolation: { escapeValue: false },
});

export default i18n;
