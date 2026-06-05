import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, TimerRing, TurnAura } from '../../../sdk/ui';
import { CARD_BY_KEY } from '../content';
import { currentParticipant, guesserId } from '../logic';
import type { HeadsUpAction, HeadsUpState } from '../logic';

/** iOS 13+ gates DeviceOrientation behind a permission prompt that must fire from a user gesture
 *  (and HTTPS). Other platforms expose it freely. Returns true if motion events may be used. */
async function requestTiltPermission(): Promise<boolean> {
  const DOE = window.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> })
    | undefined;
  if (!DOE) return false;
  if (typeof DOE.requestPermission === 'function') {
    try {
      return (await DOE.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Heads-Up tilt input. While `active`, watches device orientation: a baseline is captured the first
 * frame (phone held on the forehead), then tilting the top of the phone DOWN past a threshold fires
 * `onGot`, tilting UP fires `onPass`. The gesture must return near neutral to re-arm — so one tilt =
 * one action. Falls back to nothing if there's no sensor/permission (the on-screen buttons remain).
 */
function useTiltInput({ active, onGot, onPass }: { active: boolean; onGot: () => void; onPass: () => void }) {
  const cbRef = useRef({ onGot, onPass });
  useEffect(() => {
    cbRef.current = { onGot, onPass };
  });
  useEffect(() => {
    if (!active) return;
    let baseline: number | null = null;
    let armed = true;
    const TRIGGER = 32; // degrees from neutral to fire
    const REARM = 12; // must return within this of neutral before the next fire
    const handler = (e: DeviceOrientationEvent) => {
      if (e.beta == null) return;
      if (baseline === null) {
        baseline = e.beta;
        return;
      }
      const d = e.beta - baseline;
      if (armed) {
        if (d <= -TRIGGER) {
          armed = false;
          cbRef.current.onGot();
        } else if (d >= TRIGGER) {
          armed = false;
          cbRef.current.onPass();
        }
      } else if (Math.abs(d) < REARM) {
        armed = true;
      }
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, [active]);
}

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<HeadsUpState, HeadsUpAction>) {
  const { t } = useTranslation();
  const s = state;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const endAtRef = useRef(0);

  const clock = ctx.clock;

  // Countdown 3-2-1.
  useEffect(() => {
    if (s.phase !== 'countdown') return;
    const stop = clock.interval(700, () => dispatchRef.current({ type: 'COUNTDOWN_TICK' }));
    return stop;
  }, [s.phase, clock]);

  // Round clock.
  useEffect(() => {
    if (s.phase !== 'playing') return;
    endAtRef.current = clock.now() + s.roundSeconds * 1000;
    const stop = clock.interval(250, (now) => {
      const rem = Math.ceil((endAtRef.current - now) / 1000);
      if (rem <= 0) dispatchRef.current({ type: 'TIME_UP' });
      else dispatchRef.current({ type: 'TICK', secondsLeft: rem });
    });
    return stop;
  }, [s.phase, s.turnIndex, clock, s.roundSeconds]);

  // Clear the color flash shortly after it fires.
  useEffect(() => {
    if (!s.flash) return;
    const stop = clock.interval(400, () => dispatchRef.current({ type: 'CLEAR_FLASH' }));
    return stop;
  }, [s.flash, clock]);

  // Tilt controls (phone on the forehead): tilt down = got, up = pass. Buttons stay as a fallback.
  const tiltMode = s.inputMode === 'motion';
  useTiltInput({
    active: s.phase === 'playing' && tiltMode,
    onGot: () => { ctx.sound.play('correct'); ctx.haptics.success(); dispatch({ type: 'MARK_GOT', seed: ctx.random.seed() }); },
    onPass: () => { ctx.sound.play('pass'); ctx.haptics.light(); dispatch({ type: 'MARK_PASS', seed: ctx.random.seed() }); },
  });

  const participant = currentParticipant(s);
  const guesserName = participant ? s.playerNames[guesserId(participant)] : '';
  const card = s.currentCardId ? CARD_BY_KEY[s.currentCardId] : undefined;
  const word = card ? ctx.localize(card.word) : '';
  const got = s.currentEntries.filter((e) => e.result === 'got').length;

  if (s.phase === 'error') {
    return (
      <Screen>
        <AppBar title={t('hu.title')} onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-[var(--text-muted)]">{t('hu.errorDeck')}</p>
          <Button onClick={() => nav.playAgain()}>{t('hu.playAgain')}</Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'handoff') {
    return (
      <Screen>
        <TurnAura color={participant?.color} />
        <AppBar onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          {participant?.kind === 'team' && (
            <p className="text-sm font-semibold text-[var(--text-muted)]">{participant.name}</p>
          )}
          <div className="text-6xl">🙈</div>
          <p className="text-lg text-[var(--text-muted)]">{t('hu.passTo')}</p>
          <h1 className="text-4xl font-extrabold dp-accent">{guesserName}</h1>
          <p className="px-8 text-sm text-[var(--text-muted)]">{t('hu.foreheadHint')}</p>
          {tiltMode && (
            <p className="px-8 text-xs font-semibold text-[var(--game-accent-strong)]">{t('hu.tiltHint')}</p>
          )}
          <Button
            size="lg"
            onClick={async () => {
              ctx.sound.play('tap');
              if (tiltMode) await requestTiltPermission();
              dispatch({ type: 'CONFIRM_READY' });
            }}
          >
            {t('hu.ready')}
          </Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'countdown') {
    return (
      <Screen>
        <div className="grid flex-1 place-items-center">
          <motion.div
            key={s.countdownLeft}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
            className="text-9xl font-black dp-accent"
          >
            {s.countdownLeft > 0 ? s.countdownLeft : t('hu.go')}
          </motion.div>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'playing') {
    const flashBg =
      s.flash === 'got'
        ? 'bg-[var(--color-game-lime-strong)]'
        : s.flash === 'passed'
          ? 'bg-[var(--color-game-gold-strong)]'
          : '';
    return (
      <Screen>
        <TurnAura color={participant?.color} />
        <div className="relative flex flex-1 flex-col items-center justify-center gap-6 py-4">
          {s.flash && <div className={`pointer-events-none absolute inset-0 -z-0 opacity-40 ${flashBg}`} />}
          <TimerRing totalSeconds={s.roundSeconds} remainingSeconds={s.secondsLeft} />
          {s.currentCardId ? (
            <motion.h1
              key={s.currentCardId}
              initial={{ scale: 0.7, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="z-10 text-center text-6xl font-black leading-tight"
            >
              {word}
            </motion.h1>
          ) : (
            <p className="z-10 text-2xl text-[var(--text-muted)]">{t('hu.outOfWords')}</p>
          )}
          <p className="z-10 text-sm text-[var(--text-muted)]">{t('hu.gotCount', { n: got })}</p>
          {tiltMode && (
            <p className="z-10 text-xs font-semibold text-[var(--game-accent-strong)]">{t('hu.tiltHint')}</p>
          )}
          <div className="z-10 grid w-full grid-cols-2 gap-3">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => { ctx.sound.play('pass'); ctx.haptics.light(); dispatch({ type: 'MARK_PASS', seed: ctx.random.seed() }); }}
            >
              ↑ {t('hu.pass')}
            </Button>
            <Button
              size="lg"
              onClick={() => { ctx.sound.play('correct'); ctx.haptics.success(); dispatch({ type: 'MARK_GOT', seed: ctx.random.seed() }); }}
            >
              ↓ {t('hu.got')}
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  // roundEnd
  const last = s.rounds[s.rounds.length - 1];
  const allDone = s.participants.every(
    (p) => (s.roundOfParticipant[p.id] ?? 0) >= s.totalRoundsPerParticipant,
  );
  return (
    <Screen>
      <AppBar onBack={() => nav.exit()} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-2xl font-bold">{guesserName}</h2>
        <p className="text-4xl font-extrabold dp-accent">
          {t('hu.gotPassed', { got: last?.got ?? 0, passed: last?.passed ?? 0 })}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {(last?.entries ?? []).map((e, i) => (
            <span
              key={i}
              className={`rounded-full px-2.5 py-1 text-xs ${
                e.result === 'got'
                  ? 'bg-[var(--color-game-lime)] text-[var(--text)]'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
              }`}
            >
              {ctx.localize(CARD_BY_KEY[e.cardKey]?.word ?? { en: '?', fa: '؟' })}
            </span>
          ))}
        </div>
        <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'NEXT_PARTICIPANT', seed: ctx.random.seed() }); }}>
          {allDone ? t('hu.seeResults') : t('hu.next')}
        </Button>
      </div>
    </Screen>
  );
}
