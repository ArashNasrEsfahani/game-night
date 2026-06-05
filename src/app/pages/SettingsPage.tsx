import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen, AppBar, Card } from '../../sdk/ui';
import { useSettingsStore } from '../../store/settingsStore';
import type { ThemePref } from '../../store/settingsStore';
import type { Lang } from '../../sdk/types';

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const s = useSettingsStore();

  const themes: ThemePref[] = ['system', 'light', 'dark'];
  const langs: Lang[] = ['en', 'fa'];

  return (
    <Screen>
      <AppBar title={t('settings.title')} onBack={() => navigate(-1)} />

      <Card className="my-2">
        <label className="mb-2 block text-sm text-[var(--text-muted)]">{t('settings.theme')}</label>
        <div className="flex gap-2">
          {themes.map((th) => (
            <button
              key={th}
              onClick={() => s.setTheme(th)}
              className={`flex-1 rounded-full py-2 text-sm font-medium ${
                s.theme === th
                  ? 'bg-[var(--game-accent-strong)] text-[var(--game-on-accent)]'
                  : 'bg-[var(--surface-2)] text-[var(--text)]'
              }`}
            >
              {t(`settings.${th}`)}
            </button>
          ))}
        </div>
      </Card>

      <Card className="my-2">
        <label className="mb-2 block text-sm text-[var(--text-muted)]">
          {t('settings.language')}
        </label>
        <div className="flex gap-2">
          {langs.map((lng) => (
            <button
              key={lng}
              onClick={() => s.setLanguage(lng)}
              className={`flex-1 rounded-full py-2 text-sm font-medium ${
                s.language === lng
                  ? 'bg-[var(--game-accent-strong)] text-[var(--game-on-accent)]'
                  : 'bg-[var(--surface-2)] text-[var(--text)]'
              }`}
            >
              {lng === 'en' ? 'English' : 'فارسی'}
            </button>
          ))}
        </div>
      </Card>

      <Card className="my-2 flex items-center justify-between">
        <span className="font-medium">{t('settings.sound')}</span>
        <button
          role="switch"
          aria-checked={!s.muted}
          onClick={() => s.setMuted(!s.muted)}
          className={`h-7 w-12 rounded-full p-0.5 transition ${
            !s.muted ? 'bg-[var(--game-accent-strong)]' : 'bg-[var(--surface-2)]'
          }`}
        >
          <span
            className={`block h-6 w-6 rounded-full bg-white transition ${
              !s.muted ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </Card>

      <Card className="my-2 flex items-center justify-between">
        <span className="font-medium">{t('settings.haptics')}</span>
        <button
          role="switch"
          aria-checked={s.haptics}
          onClick={() => s.setHaptics(!s.haptics)}
          className={`h-7 w-12 rounded-full p-0.5 transition ${
            s.haptics ? 'bg-[var(--game-accent-strong)]' : 'bg-[var(--surface-2)]'
          }`}
        >
          <span
            className={`block h-6 w-6 rounded-full bg-white transition ${
              s.haptics ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </Card>
    </Screen>
  );
}
