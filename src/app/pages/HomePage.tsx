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
      <header className="flex items-center justify-between py-4">
        <h1 className="text-3xl font-extrabold">{t('home.title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/players')}>
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
        </div>
      </header>
      <p className="mb-4 text-[var(--text-muted)]">{t('home.subtitle')}</p>

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
