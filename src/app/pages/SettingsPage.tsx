import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen, AppBar, Card, SegmentedControl, Toggle } from '../../sdk/ui';
import { useSettingsStore } from '../../store/settingsStore';
import type { ThemePref, MotionPref } from '../../store/settingsStore';
import type { Lang } from '../../sdk/types';

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const s = useSettingsStore();

  const themeOptions: { value: ThemePref; label: string }[] = [
    { value: 'system', label: t('settings.system') },
    { value: 'light', label: t('settings.light') },
    { value: 'dark', label: t('settings.dark') },
  ];
  const langOptions: { value: Lang; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'fa', label: 'فارسی' },
  ];
  const motionOptions: { value: MotionPref; label: string }[] = [
    { value: 'system', label: t('settings.system') },
    { value: 'on', label: t('settings.on') },
    { value: 'off', label: t('settings.off') },
  ];

  return (
    <Screen>
      <AppBar title={t('settings.title')} onBack={() => navigate(-1)} />

      <Card className="my-2">
        <label className="mb-2 block text-sm text-[var(--text-muted)]">{t('settings.theme')}</label>
        <SegmentedControl
          ariaLabel={t('settings.theme')}
          options={themeOptions}
          value={s.theme}
          onChange={s.setTheme}
        />
      </Card>

      <Card className="my-2">
        <label className="mb-2 block text-sm text-[var(--text-muted)]">
          {t('settings.language')}
        </label>
        <SegmentedControl
          ariaLabel={t('settings.language')}
          options={langOptions}
          value={s.language}
          onChange={s.setLanguage}
        />
      </Card>

      <Card className="my-2">
        <label className="mb-2 block text-sm text-[var(--text-muted)]">{t('settings.motion')}</label>
        <SegmentedControl
          ariaLabel={t('settings.motion')}
          options={motionOptions}
          value={s.reducedMotion}
          onChange={s.setReducedMotion}
        />
      </Card>

      <Card className="my-2">
        <Toggle checked={!s.muted} onChange={(v) => s.setMuted(!v)} label={t('settings.sound')} />
      </Card>

      <Card className="my-2">
        <Toggle checked={s.haptics} onChange={s.setHaptics} label={t('settings.haptics')} />
      </Card>

      <Card className="my-2 flex items-center justify-between gap-3">
        <div>
          <span className="font-medium">💡 {t('settings.guidance')}</span>
          <p className="text-xs text-[var(--text-muted)]">{t('settings.guidanceHint')}</p>
        </div>
        <Toggle checked={s.guidance} onChange={s.setGuidance} />
      </Card>
    </Screen>
  );
}
