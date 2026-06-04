// src/lib/localize.ts — resolve bilingual game CONTENT to the active language.
// (UI chrome uses i18next keys instead; this is only for LocalizedString content.)
import { useTranslation } from 'react-i18next';
import type { Lang, LocalizedString } from '../sdk/types';

export function localize(ls: LocalizedString, lang: Lang): string {
  return ls[lang] ?? ls.en;
}

/** React hook: returns a localizer bound to the current i18n language. */
export function useLocalize(): (ls: LocalizedString) => string {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language && i18n.language.startsWith('fa') ? 'fa' : 'en';
  return (ls: LocalizedString) => localize(ls, lang);
}
