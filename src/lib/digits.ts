// src/lib/digits.ts — render numbers with Persian digits in fa mode.
// Only ASCII 0-9 are remapped, so pre-formatted strings like "1:05" or "10s" keep their
// separators/suffixes and just get Persian numerals. Mirrors the native `fmtNum(value, lang)`.
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lang } from '../sdk/types';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function formatNum(value: number | string, lang: Lang): string {
  const s = String(value);
  return lang === 'fa' ? s.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]) : s;
}

/** Hook returning a formatter bound to the active language; identity is stable per-language. */
export function useNum(): (value: number | string) => string {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language && i18n.language.startsWith('fa') ? 'fa' : 'en';
  return useCallback((value: number | string) => formatNum(value, lang), [lang]);
}
