// src/lib/localize.ts — resolve bilingual game CONTENT to the active language.
// (UI chrome uses i18next keys instead; this is only for LocalizedString content.)
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lang, LocalizedString } from '../sdk/types';

export function localize(ls: LocalizedString, lang: Lang): string {
  return ls[lang] ?? ls.en;
}

/** React hook: returns a localizer bound to the current i18n language.
 *  Memoized on the language so its identity is stable across renders — this keeps the
 *  host's `ctx` object stable, which is what lets `ctx.clock`-driven timers run instead
 *  of being reset on every render. */
export function useLocalize(): (ls: LocalizedString) => string {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language && i18n.language.startsWith('fa') ? 'fa' : 'en';
  return useCallback((ls: LocalizedString) => localize(ls, lang), [lang]);
}
