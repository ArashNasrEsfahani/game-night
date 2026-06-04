// src/i18n/dir.ts — text direction per language.
import type { Lang } from '../sdk/types';

export const dirOf = (lang: Lang): 'rtl' | 'ltr' => (lang === 'fa' ? 'rtl' : 'ltr');
export const isRTL = (lang: Lang): boolean => lang === 'fa';
