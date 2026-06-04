import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Screen, Button } from '../../sdk/ui';

export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Screen>
      <div className="grid flex-1 place-items-center gap-4 text-center">
        <p className="text-[var(--text-muted)]">{t('errors.notFound')}</p>
        <Button onClick={() => navigate('/')}>{t('results.home')}</Button>
      </div>
    </Screen>
  );
}
