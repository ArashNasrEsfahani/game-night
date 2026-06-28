import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen, AppBar, Button, Card } from '../../sdk/ui';
import { popIn } from '../../sdk/motion';
import { useRosterStore } from '../../store/rosterStore';

export function PlayersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const addPlayer = useRosterStore((s) => s.addPlayer);
  const removePlayer = useRosterStore((s) => s.removePlayer);
  const [name, setName] = useState('');

  const add = () => {
    const n = name.trim();
    if (n) {
      addPlayer({ name: n });
      setName('');
    }
  };

  return (
    <Screen>
      <AppBar title={t('players.title')} onBack={() => navigate(-1)} />
      <div className="flex gap-2 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          placeholder={t('players.namePlaceholder')}
          className="h-12 flex-1 rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-4 text-[var(--text)] outline-none"
        />
        <Button onClick={add}>{t('common.add')}</Button>
      </div>

      {players.length === 0 ? (
        <motion.div
          variants={popIn}
          initial="initial"
          animate="animate"
          className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center"
        >
          <div className="grid h-20 w-20 place-items-center rounded-full bg-[var(--surface-2)] text-4xl shadow-[var(--shadow-card)]">
            👥
          </div>
          <p className="max-w-xs text-[var(--text-muted)]">{t('players.empty')}</p>
        </motion.div>
      ) : (
        <ul className="flex flex-col gap-2 py-2">
          {players.map((p) => (
            <Card key={p.id} className="flex items-center justify-between py-3">
              <span className="font-medium">
                {p.emoji ? `${p.emoji} ` : ''}
                {p.name}
              </span>
              <button
                onClick={() => removePlayer(p.id)}
                aria-label={t('common.remove')}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-muted)]"
              >
                ✕
              </button>
            </Card>
          ))}
        </ul>
      )}
    </Screen>
  );
}
