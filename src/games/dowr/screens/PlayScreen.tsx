import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, TimerRing, TurnAura } from '../../../sdk/ui';
import { reveal as revealVariant } from '../../../sdk/motion';
import { CARD_BY_ID } from '../content';
import {
  currentTeam,
  describerName,
  guesserName,
  currentRound,
  elapsedMs,
  timeLimitMs,
  timeRemainingMs,
  teamWords,
} from '../logic';
import type { DowrAction, DowrState } from '../logic';

/** Tidy mm:ss / Ns total. */
const fmtTotal = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
};

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<DowrState, DowrAction>) {
  const { t } = useTranslation();
  const s = state;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const clock = ctx.clock;

  // Live timing lives here, not in reducer state: the current word's segment is measured against
  // the wall clock from the moment the word appeared. This keeps the match resume-safe.
  // Wall-clock mark for when the current word began. Source of truth for timing; only touched
  // in handlers/callbacks. `segMs` (state) mirrors it for rendering so render never reads the ref.
  const segStartRef = useRef(clock.now());
  const [segMs, setSegMs] = useState(0);
  // Purely-cosmetic success burst: bumped on each guessed word so a green check pops over the
  // word swap. Lives in view state (not the reducer) so it stays resume-safe and test-neutral.
  const [gotBurst, setGotBurst] = useState(0);

  const timeMode = s.options.endMode === 'time';
  const bankedMs = elapsedMs(s); // banked across all turns; changes only on a turn boundary
  const limitMs = timeLimitMs(s);

  // The always-running clock: pump elapsed, end the match when the shared clock runs out (time
  // mode), and auto-detonate the per-word bomb when its fuse is spent.
  useEffect(() => {
    if (s.phase !== 'playing') return;
    const stop = clock.interval(120, (n) => {
      const e = Math.max(0, n - segStartRef.current);
      setSegMs(e);
      if (timeMode && bankedMs + e >= limitMs) {
        segStartRef.current = n;
        setSegMs(0);
        ctx.sound.play('lose');
        ctx.haptics.error();
        dispatchRef.current({ type: 'END_TIME', segmentMs: e });
        return;
      }
      if (e >= s.fuseMs) {
        segStartRef.current = n; // re-anchor first so the next tick doesn't double-fire
        setSegMs(0);
        ctx.sound.play('explosion');
        ctx.haptics.error();
        dispatchRef.current({ type: 'ADVANCE', reason: 'bomb', segmentMs: s.fuseMs, seed: ctx.random.seed() });
      }
    });
    return stop;
  }, [s.phase, s.turnNo, s.fuseMs, timeMode, bankedMs, limitMs, clock, ctx]);

  // Clear the bomb flash shortly after it fires.
  useEffect(() => {
    if (!s.flash) return;
    const stop = clock.interval(450, () => dispatchRef.current({ type: 'CLEAR_FLASH' }));
    return stop;
  }, [s.flash, clock]);

  if (s.phase === 'error') {
    return (
      <Screen>
        <AppBar title={t('dowr.title')} onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-[var(--text-muted)]">{t('dowr.poolHint', { count: 0 })}</p>
          <Button onClick={() => nav.playAgain()}>{t('dowr.playAgain')}</Button>
        </div>
      </Screen>
    );
  }

  const team = currentTeam(s);
  const card = s.currentCardId ? CARD_BY_ID[s.currentCardId] : undefined;
  const word = card ? ctx.localize(card.word) : '';
  const fuseSec = s.fuseMs / 1000;
  const remainSec = Math.max(0, (s.fuseMs - segMs) / 1000);
  const changeCost = timeMode ? 0 : s.options.changePenaltySeconds;
  const liveTotal = (id: string) =>
    id === team.id ? (s.totals[id] ?? 0) + s.changePenaltyMs + segMs : s.totals[id] ?? 0;
  // Strip shows each team's word count in time mode (most words wins), running time otherwise.
  const teamScore = (id: string) => (timeMode ? `${teamWords(s, id)}✓` : fmtTotal(liveTotal(id)));
  const sharedLeftMs = timeRemainingMs(s, segMs);

  const gotIt = () => {
    const n = clock.now();
    const segmentMs = Math.min(Math.max(0, n - segStartRef.current), s.fuseMs);
    segStartRef.current = n; // anchor the next team's segment to this instant
    setSegMs(0);
    setGotBurst((b) => b + 1);
    ctx.sound.play('correct');
    ctx.haptics.success();
    dispatch({ type: 'ADVANCE', reason: 'guessed', segmentMs, seed: ctx.random.seed() });
  };
  const changeWord = () => {
    ctx.sound.play('pass');
    ctx.haptics.warning();
    dispatch({ type: 'CHANGE_WORD', seed: ctx.random.seed() });
  };

  return (
    <Screen>
      <TurnAura color={team.color} />
      <AppBar
        onBack={() => nav.exit()}
        right={
          <button
            onClick={() => dispatch({ type: 'END_GAME' })}
            className="text-sm text-[var(--text-muted)]"
          >
            {t('common.endGame')}
          </button>
        }
      />
      <div className="relative flex flex-1 flex-col gap-3 py-1">
        {/* Bomb explosion — expanding fireball + a kaboom that punches in, over a red wash. */}
        <AnimatePresence>
          {s.flash === 'bomb' && (
            <motion.div
              key="kaboom"
              className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <motion.div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 50% 45%, var(--color-game-gold) 0%, var(--color-game-tangerine) 22%, var(--color-game-rose-strong) 48%, transparent 74%)',
                }}
                initial={{ scale: 0.15, opacity: 0.95 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              <motion.div
                className="relative text-[7rem] leading-none"
                initial={{ scale: 0.2, rotate: -18, opacity: 0 }}
                animate={{ scale: [0.2, 1.7, 1.25], rotate: [-18, 12, 0], opacity: [0, 1, 1] }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                aria-hidden
              >
                💥
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Guessed! — a quick lime wash + a check that pops and fades over the word swap, so a
            correct guess feels as rewarding as a bomb is punishing (symmetry the screen was missing). */}
        {gotBurst > 0 && (
          <div key={gotBurst} className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-hidden">
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 50% 48%, color-mix(in oklab, var(--color-game-lime-strong) 55%, transparent), transparent 70%)',
              }}
              initial={{ opacity: 0.55, scale: 0.6 }}
              animate={{ opacity: 0, scale: 1.35 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <motion.div
              className="relative grid h-24 w-24 place-items-center rounded-full text-5xl font-black text-[var(--on-lime)]"
              style={{
                background: 'linear-gradient(150deg, var(--color-game-lime), var(--color-game-lime-strong))',
                boxShadow: '0 14px 40px -8px var(--color-game-lime-strong)',
              }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.25, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              aria-hidden
            >
              ✓
            </motion.div>
          </div>
        )}

        {/* Always-visible standings strip — whose turn + every team's running total. */}
        <div className="z-10 flex flex-wrap justify-center gap-1.5">
          {s.teams.map((tm) => {
            const active = tm.id === team.id;
            return (
              <span
                key={tm.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  active
                    ? 'bg-[var(--accent-fill-strong)] text-[var(--game-on-accent)]'
                    : 'dp-glass-2 text-[var(--text-muted)]'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: `var(--color-game-${tm.color})` }}
                />
                {tm.name}
                <span className="tabular-nums">{teamScore(tm.id)}</span>
              </span>
            );
          })}
        </div>

        {/* Shared countdown — the headline pressure in time mode (most words wins when it hits 0). */}
        {timeMode && (
          <p
            className={`z-10 text-center text-3xl font-black tabular-nums ${
              sharedLeftMs <= 15000 ? 'text-[var(--color-game-rose-strong)]' : 'dp-accent'
            }`}
          >
            ⏱ {fmtTotal(sharedLeftMs)}
          </p>
        )}

        {/* Whose turn — always visible */}
        <p className="z-10 text-center text-base font-bold dp-accent">
          {t('dowr.describerIs', { name: describerName(s) })}
        </p>
        <p className="z-10 -mt-2 text-center text-xs text-[var(--text-muted)]">
          {t('dowr.guesserIs', { name: guesserName(s) })}
          {!timeMode && <> · {t('dowr.roundOf', { round: currentRound(s), total: s.options.rounds })}</>}
        </p>

        {/* Bomb + word */}
        <motion.div
          className="z-10 flex flex-1 flex-col items-center justify-center gap-5 text-center"
          animate={s.flash === 'bomb' ? { x: [0, -10, 9, -7, 5, 0], y: [0, 5, -4, 3, 0] } : { x: 0, y: 0 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
        >
          {s.options.surpriseBomb ? (
            <motion.div
              animate={{ scale: [1, 1.14, 1], rotate: [0, -7, 7, 0] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
              className="text-5xl"
              aria-hidden
            >
              💣
            </motion.div>
          ) : (
            <TimerRing totalSeconds={fuseSec} remainingSeconds={remainSec} />
          )}

          <motion.h1
            key={s.currentCardId}
            variants={revealVariant}
            initial="initial"
            animate="animate"
            className="text-6xl font-black leading-tight"
          >
            {word}
          </motion.h1>
          {card?.hints?.taboo && card.hints.taboo.length > 0 && (
            <p className="text-sm text-[var(--text-muted)]">
              {t('dowr.dontSay')}: {card.hints.taboo.map((x) => ctx.localize(x)).join('، ')}
            </p>
          )}
        </motion.div>

        {/* Controls */}
        <div className="z-10 flex w-full flex-col gap-2">
          <Button size="lg" variant="success" fullWidth onClick={gotIt}>
            ✓ {t('dowr.gotIt')}
          </Button>
          <Button variant="secondary" fullWidth onClick={changeWord}>
            ↻ {changeCost > 0 ? t('dowr.changeWordCost', { n: changeCost }) : t('dowr.changeWord')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
