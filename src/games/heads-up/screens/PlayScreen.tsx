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

/** Screen-orientation-compensated pitch. Heads-Up is held on the forehead, usually in LANDSCAPE,
 *  where the forehead "nod" rotates a different device axis than in portrait (and with a flipped
 *  sign) — reading raw `beta` is why tilt felt reversed on iOS and dead in landscape. We pick the
 *  axis + sign from the current screen angle so the SAME physical nod-down always decreases pitch,
 *  on iOS and Android alike. */
function tiltPitch(beta: number, gamma: number): number {
  const angle =
    screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
  if (angle === 90) return -gamma; // landscape (rotated one way)
  if (angle === 270 || angle === -90) return gamma; // landscape (rotated the other way)
  if (angle === 180) return -beta; // upside-down portrait
  return beta; // upright portrait
}

/**
 * Heads-Up tilt input. While `active`, watches device orientation: a baseline is captured the first
 * frame (phone held on the forehead), then tilting the top of the phone DOWN past a threshold fires
 * `onGot`, tilting UP fires `onPass`. Orientation-compensated so it behaves the same in portrait or
 * landscape and across iOS/Android. The gesture must return near neutral to re-arm (one tilt = one
 * action). Falls back to nothing if there's no sensor/permission (the on-screen buttons remain).
 *
 * Note: Android only exposes the sensor on a secure context — it works in the deployed HTTPS PWA,
 * not over a plain-http LAN dev URL.
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
    let sawRelative = false; // prefer `deviceorientation`; only fall back to the absolute event
    const TRIGGER = 28; // degrees from neutral to fire
    const REARM = 12; // must return within this of neutral before the next fire
    const handler = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const pitch = tiltPitch(e.beta, e.gamma);
      if (baseline === null) {
        baseline = pitch;
        return;
      }
      const d = pitch - baseline;
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
    const onRelative = (e: DeviceOrientationEvent) => {
      sawRelative = true;
      handler(e);
    };
    // Some Android builds only populate beta/gamma on the "absolute" event; use it only if the
    // standard event never fires, so the two streams can't double-trigger.
    const onAbsolute = (e: DeviceOrientationEvent) => {
      if (!sawRelative) handler(e);
    };
    window.addEventListener('deviceorientation', onRelative, true);
    window.addEventListener('deviceorientationabsolute', onAbsolute as EventListener, true);
    return () => {
      window.removeEventListener('deviceorientation', onRelative, true);
      window.removeEventListener('deviceorientationabsolute', onAbsolute as EventListener, true);
    };
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
  const endGameButton = (
    <button
      onClick={() => dispatch({ type: 'END_GAME' })}
      className="text-sm text-[var(--text-muted)]"
    >
      {t('common.endGame')}
    </button>
  );
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
        <AppBar onBack={() => nav.exit()} right={endGameButton} />
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
          {participant?.kind === 'team' && (
            <p className="z-10 text-sm font-semibold text-[var(--text-muted)]">{participant.name}</p>
          )}
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
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="z-10 text-2xl text-[var(--text-muted)]"
            >
              {t('hu.outOfWords')}
            </motion.p>
          )}
          <motion.p
            key={got}
            initial={{ scale: 1.25 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            className="z-10 text-sm text-[var(--text-muted)]"
          >
            {t('hu.gotCount', { n: got })}
          </motion.p>
          {tiltMode && (
            <p className="z-10 text-xs font-semibold text-[var(--game-accent-strong)]">{t('hu.tiltHint')}</p>
          )}
          <div className="z-10 grid w-full grid-cols-2 gap-3">
            <Button
              size="lg"
              variant="secondary"
              disabled={!s.currentCardId}
              onClick={() => { ctx.sound.play('pass'); ctx.haptics.light(); dispatch({ type: 'MARK_PASS', seed: ctx.random.seed() }); }}
            >
              ↑ {t('hu.pass')}
            </Button>
            <Button
              size="lg"
              variant="success"
              disabled={!s.currentCardId}
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
      <AppBar onBack={() => nav.exit()} right={endGameButton} />
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
                  ? 'bg-[var(--color-game-lime)] text-[var(--on-lime)]'
                  : 'dp-glass-2 text-[var(--text-muted)]'
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
