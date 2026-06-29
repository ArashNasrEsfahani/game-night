import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Screen, AppBar, Button, Card, Sheet } from '../../sdk/ui';
import { popIn } from '../../sdk/motion';
import { useRosterStore } from '../../store/rosterStore';
import { useUiSound } from '../../lib/uiSound';

export function PlayersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const addPlayer = useRosterStore((s) => s.addPlayer);
  const removePlayer = useRosterStore((s) => s.removePlayer);
  const ui = useUiSound();
  const [name, setName] = useState('');
  // A delete is staged here and waits for the confirm sheet, so a stray ✕ tap can't silently
  // drop a configured player (mirrors the native ConfirmDeleteDialog).
  const [confirm, setConfirm] = useState<{ id: (typeof players)[number]['id']; name: string } | null>(
    null,
  );

  const add = () => {
    const n = name.trim();
    if (n) {
      ui('tap');
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
          aria-label={t('players.namePlaceholder')}
          className="h-12 flex-1 rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-4 text-[var(--text)] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_var(--color-game-teal)]"
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
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setConfirm({ id: p.id, name: p.name })}
                aria-label={`${t('common.remove')} ${p.name}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                ✕
              </motion.button>
            </Card>
          ))}
        </ul>
      )}

      <Sheet
        open={confirm != null}
        onClose={() => setConfirm(null)}
        title={t('players.removeTitle')}
      >
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {t('players.removeConfirm', { name: confirm?.name ?? '' })}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              if (confirm) {
                ui('wrong');
                removePlayer(confirm.id);
              }
              setConfirm(null);
            }}
          >
            {t('common.remove')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setConfirm(null)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
