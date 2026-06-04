import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCatalog } from '../../games/registry';
import { Screen, GameCard, Button } from '../../sdk/ui';
import { useLocalize } from '../../lib/localize';
import { buildGamePath } from '../routes';

export function HomePage() {
  const { t } = useTranslation();
  const localize = useLocalize();
  const navigate = useNavigate();
  const catalog = getCatalog();

  return (
    <Screen>
      <header className="flex items-center justify-between pt-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/players')}>
          {t('common.players')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('settings.title')}
          onClick={() => navigate('/settings')}
        >
          ⚙️
        </Button>
      </header>

      <div className="flex flex-col items-center gap-1.5 pb-5 pt-3 text-center">
        <div className="dp-ball mb-1 h-16 w-16" aria-hidden />
        <h1 className="dp-neon font-display text-4xl tracking-wide">Game Night</h1>
        <p className="dp-foil font-display text-2xl leading-none">شب بازی</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('home.subtitle')}</p>
      </div>

      {catalog.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center text-[var(--text-muted)]">
          {t('home.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-8">
          {catalog.map((m) => (
            <GameCard
              key={m.id}
              manifest={m}
              title={localize(m.name)}
              tagline={localize(m.tagline)}
              onClick={() => navigate(buildGamePath(m.id))}
            />
          ))}
        </div>
      )}
    </Screen>
  );
}
