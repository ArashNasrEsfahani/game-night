// src/i18n/index.ts — i18next init (UI chrome strings only; game content uses LocalizedString).
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fa from './fa.json';
import { formatNum } from '../lib/digits';

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

// Interpolation formatter so any string can render Persian numerals via `{{value, faDigits}}`
// (e.g. "Players · {{count, faDigits}}"). Latin in English, ۰–۹ in Persian — one source of truth.
i18n.services.formatter?.add('faDigits', (value, lng) =>
  formatNum(value as number | string, lng?.startsWith('fa') ? 'fa' : 'en'),
);

export default i18n;
