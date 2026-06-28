import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, TurnAura } from '../../../sdk/ui';
import { MineGrid } from '../components/MineGrid';
import { activeSeat, isSolo, minesLeft } from '../logic';
import type { MinesweeperAction, MinesweeperState } from '../logic';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<MinesweeperState, MinesweeperAction>) {
  const { t } = useTranslation();
  const s = state;
  const clock = ctx.clock;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const solo = isSolo(s);

  // Solo stopwatch — screen-local, anchored to wall clock, never persisted (resume-safe).
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  useEffect(() => {
    if (!solo || s.phase !== 'playing') return;
    if (!startRef.current) startRef.current = clock.now();
    const stop = clock.interval(250, (now) => setElapsed(Math.max(0, Math.floor((now - startRef.current) / 1000))));
    return stop;
  }, [solo, s.phase, clock]);

  // Feedback per tap, then clear the flash. A find is celebratory; a safe square is a soft pass.
  useEffect(() => {
    if (!s.flash) return;
    if (s.flash.type === 'found') {
      ctx.sound.play('select');
      ctx.haptics.success();
    } else if (s.flash.type === 'safe') {
      ctx.sound.play('pass');
      ctx.haptics.light();
    }
    const stop = clock.interval(900, () => dispatchRef.current({ type: 'CLEAR_FLASH' }));
    return stop;
  }, [s.flash, clock, ctx]);

  const active = activeSeat(s);
  const seatColors: Record<string, string | undefined> = Object.fromEntries(
    s.seats.map((se) => [se.id, se.color]),
  );

  const reveal = (i: number) => { ctx.haptics.light(); dispatch({ type: 'REVEAL', index: i, seed: ctx.random.seed() }); };

  const toast =
    s.flash?.type === 'found'
      ? t('mine.goAgain')
      : s.flash?.type === 'safe' && !solo
        ? t('mine.missed')
        : null;

  return (
    <Screen>
      <TurnAura color={active?.color} />
      <AppBar
        title={t('mine.title')}
        onBack={() => nav.exit()}
        right={
          <button onClick={() => dispatch({ type: 'END_GAME' })} className="text-sm text-[var(--text-muted)]">
            {t('common.endGame')}
          </button>
        }
      />

      <div className="flex items-center justify-between px-1 pb-2 text-sm">
        {/* The exact mine total isn't known until the first tap seeds the board (coverage may add a
            few to kill 0-clue squares), so show a goal prompt until then rather than a number that
            jumps. */}
        <span className="font-semibold">
          💣 {s.minesPlaced ? t('mine.minesLeft', { n: minesLeft(s) }) : t('mine.findThemAll')}
        </span>
        {solo ? (
          <span className="tabular-nums text-[var(--text-muted)]">⏱ {fmt(elapsed)}</span>
        ) : (
          <motion.span
            key={active?.id}
            initial={{ opacity: 0, y: -6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className="font-bold dp-accent"
          >
            {t('mine.turnOf', { name: active?.name ?? '' })}
          </motion.span>
        )}
      </div>

      {!solo && (
        <div className="mb-2 flex flex-wrap justify-center gap-1.5">
          {s.seats.map((se) => {
            const isActive = se.id === active?.id;
            return (
              <span
                key={se.id}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isActive
                    ? 'bg-[var(--accent-fill-strong)] text-[var(--game-on-accent)]'
                    : 'dp-glass-2 text-[var(--text-muted)]'
                }`}
              >
                {se.name} · 💣 {se.score}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center gap-3">
        {/* Fixed-height slot so the toast never reflows (and jumps) the board. */}
        <div className="flex h-6 items-center justify-center">
          <AnimatePresence mode="wait">
            {toast && (
              <motion.p
                key={toast}
                initial={{ y: -8, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                className={`text-center text-sm font-bold ${
                  s.flash?.type === 'found' ? 'text-[var(--color-game-gold-strong)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {toast}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <MineGrid cells={s.board} cols={s.cols} seatColors={seatColors} onReveal={reveal} />
        <p className="text-center text-xs text-[var(--text-muted)]">{t('mine.tapHint')}</p>
      </div>
    </Screen>
  );
}
