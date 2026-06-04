// src/lib/localize.ts — resolve bilingual game CONTENT to the active language.
// (UI chrome uses i18next keys instead; this is only for LocalizedString content.)
import type { Lang, LocalizedString } from '../sdk/types';

export function localize(ls: LocalizedString, lang: Lang): string {
  return ls[lang] ?? ls.en;
}
