import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { dirOf } from '../../i18n/dir';
import type { Lang } from '../../sdk/types';

/** Sets <html dir> + lang from the active i18n language (rtl for fa). */
export function DirProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language && i18n.language.startsWith('fa') ? 'fa' : 'en';
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
  }, [lang]);
  return <>{children}</>;
}
