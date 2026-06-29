import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen, Button, Motif } from '../../sdk/ui';

export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Screen>
      <div className="grid flex-1 place-items-center gap-5 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 165, damping: 22 }}
        >
          <Motif name="dome" size={96} color="var(--color-game-gold)" />
        </motion.div>
        <p className="text-[var(--text-muted)]">{t('errors.notFound')}</p>
        <Button onClick={() => navigate('/')}>{t('results.home')}</Button>
      </div>
    </Screen>
  );
}
