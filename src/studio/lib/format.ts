// src/studio/lib/format.ts — tiny shared helpers for the Studio UI.
import type { LocalizedString } from '../../sdk/types';

/** Studio chrome is English; data labels come from {en, fa} descriptors — prefer en, fall back fa. */
export const en = (s: LocalizedString | undefined): string => (s ? s.en || s.fa || '' : '');

/** Join class names, dropping falsy entries. */
export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/** Does a string contain any Persian/Arabic-script characters? (for auto RTL on data cells) */
export const hasRTL = (v: string): boolean => /[؀-ۿݐ-ݿ]/.test(v);
