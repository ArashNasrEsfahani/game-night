import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Card, Sheet, Button } from '../../sdk/ui';
import { useNum } from '../../lib/digits';
import { useLeaderboardStore, leaderboardRows } from '../../store/leaderboardStore';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Overall cross-game standings shown on Home: per-player wins (solo + group) as stacked bars. */
export function Leaderboard() {
  const { t } = useTranslation();
  const num = useNum();
  const tallies = useLeaderboardStore((s) => s.tallies);
  const totalMatches = useLeaderboardStore((s) => s.totalMatches);
  const reset = useLeaderboardStore((s) => s.reset);
  // Reset wipes every game's win history, so gate it behind an are-you-sure (like delete/leave).
  const [confirmReset, setConfirmReset] = useState(false);

  const rows = leaderboardRows(tallies);
  if (totalMatches === 0 || rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <section className="scroll-mt-4 pt-7">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--game-accent-strong)]">
          🏆 {t('leaderboard.title')}
        </p>
        <button onClick={() => setConfirmReset(true)} className="text-xs text-[var(--text-muted)] underline-offset-2 hover:underline">
          {t('leaderboard.reset')}
        </button>
      </div>
      <Card className="flex flex-col gap-3 py-4">
        <p className="text-center text-xs text-[var(--text-muted)]">
          {t('leaderboard.matches', { n: totalMatches })}
        </p>
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-2.5">
            <span className="w-6 shrink-0 text-center text-sm font-bold">{MEDALS[i] ?? num(i + 1)}</span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{r.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                  {t('leaderboard.winLine', { total: r.total, ind: r.individual, team: r.team })}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunk)]">
                <motion.div
                  className="flex h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(r.total / max) * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
                >
                  <span
                    className="h-full bg-[var(--color-game-gold-strong)]"
                    style={{ flexBasis: r.total ? `${(r.individual / r.total) * 100}%` : '0%' }}
                  />
                  <span
                    className="h-full bg-[var(--color-game-teal)]"
                    style={{ flexBasis: r.total ? `${(r.team / r.total) * 100}%` : '0%' }}
                  />
                </motion.div>
              </div>
            </div>
          </div>
        ))}
        <div className="mt-1 flex justify-center gap-5 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-game-gold-strong)]" />
            {t('leaderboard.individual')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-game-teal)]" />
            {t('leaderboard.group')}
          </span>
        </div>
      </Card>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title={t('leaderboard.resetTitle')}>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {t('leaderboard.resetConfirm')}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              reset();
              setConfirmReset(false);
            }}
          >
            {t('leaderboard.reset')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setConfirmReset(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
