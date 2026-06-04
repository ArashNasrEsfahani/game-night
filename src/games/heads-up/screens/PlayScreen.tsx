import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, TimerRing } from '../../../sdk/ui';
import { CARD_BY_KEY } from '../content';
import { currentParticipant, guesserId } from '../logic';
import type { HeadsUpAction, HeadsUpState } from '../logic';

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<HeadsUpState, HeadsUpAction>) {
  const { t } = useTranslation();
  const s = state;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const endAtRef = useRef(0);

  // Countdown 3-2-1.
  useEffect(() => {
    if (s.phase !== 'countdown') return;
    const stop = ctx.clock.interval(700, () => dispatchRef.current({ type: 'COUNTDOWN_TICK' }));
    return stop;
  }, [s.phase, ctx]);

  // Round clock.
  useEffect(() => {
    if (s.phase !== 'playing') return;
    endAtRef.current = ctx.clock.now() + s.roundSeconds * 1000;
    const stop = ctx.clock.interval(250, (now) => {
      const rem = Math.ceil((endAtRef.current - now) / 1000);
      if (rem <= 0) dispatchRef.current({ type: 'TIME_UP' });
      else dispatchRef.current({ type: 'TICK', secondsLeft: rem });
    });
    return stop;
  }, [s.phase, s.turnIndex, ctx, s.roundSeconds]);

  // Clear the color flash shortly after it fires.
  useEffect(() => {
    if (!s.flash) return;
    const stop = ctx.clock.interval(400, () => dispatchRef.current({ type: 'CLEAR_FLASH' }));
    return stop;
  }, [s.flash, ctx]);

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
        <AppBar onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          {participant?.kind === 'team' && (
            <p className="text-sm font-semibold text-[var(--text-muted)]">{participant.name}</p>
          )}
          <div className="text-6xl">🙈</div>
          <p className="text-lg text-[var(--text-muted)]">{t('hu.passTo')}</p>
          <h1 className="text-4xl font-extrabold text-[var(--game-accent-strong)]">{guesserName}</h1>
          <p className="px-8 text-sm text-[var(--text-muted)]">{t('hu.foreheadHint')}</p>
          <Button size="lg" onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'CONFIRM_READY' }); }}>
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
          <div className="text-9xl font-black text-[var(--game-accent-strong)]">
            {s.countdownLeft > 0 ? s.countdownLeft : t('hu.go')}
          </div>
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
        <div className="relative flex flex-1 flex-col items-center justify-center gap-6 py-4">
          {s.flash && <div className={`pointer-events-none absolute inset-0 -z-0 opacity-40 ${flashBg}`} />}
          <TimerRing totalSeconds={s.roundSeconds} remainingSeconds={s.secondsLeft} />
          {s.currentCardId ? (
            <h1 className="z-10 text-center text-6xl font-black leading-tight">{word}</h1>
          ) : (
            <p className="z-10 text-2xl text-[var(--text-muted)]">{t('hu.outOfWords')}</p>
          )}
          <p className="z-10 text-sm text-[var(--text-muted)]">{t('hu.gotCount', { n: got })}</p>
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
        <p className="text-4xl font-extrabold text-[var(--game-accent-strong)]">
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
