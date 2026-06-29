import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Card, Chip, Curtain, TurnAura } from '../../../sdk/ui';
import { PROMPT_BY_ID } from '../content';
import { nextSequentialId } from '../logic';
import type { ToDAction, ToDState } from '../logic';
import { BottleStage } from './BottleStage';

/** The "who's up" screen. In spinner mode it earns its name: the picked player roulettes through
 *  the roster and decelerates onto the chosen one (the reducer already made the pick — this only
 *  animates the reveal), then Truth/Dare slide in. Sequential mode and reduce-motion settle at once
 *  (no name-flashing). */
function ChoosingScreen({
  s,
  dispatch,
  ctx,
  header,
  activeName,
  activeColor,
}: {
  s: ToDState;
  dispatch: GameScreenProps<ToDState, ToDAction>['dispatch'];
  ctx: GameScreenProps<ToDState, ToDAction>['ctx'];
  header: ReactNode;
  activeName: string;
  activeColor?: string;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const spin = s.options.selectionMode === 'spinner';
  const [settled, setSettled] = useState(!spin);
  const [display, setDisplay] = useState(activeName);

  useEffect(() => {
    if (!spin || reduce) {
      setDisplay(activeName);
      setSettled(true);
      return;
    }
    setSettled(false);
    let cancelled = false;
    const names = Object.values(s.playerNames);
    let i = 0;
    let delay = 55;
    let timer = window.setTimeout(function tick() {
      if (cancelled) return;
      setDisplay(names[i % names.length]);
      i += 1;
      delay *= 1.22; // decelerate toward the landing
      if (delay < 300) {
        timer = window.setTimeout(tick, delay);
      } else {
        setDisplay(activeName);
        setSettled(true);
        ctx.sound.play('reveal');
        ctx.haptics.success();
      }
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Re-run the roulette for each fresh spin; activeName/names are derived from the same serial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.spinSerial]);

  return (
    <Screen>
      <TurnAura color={activeColor} />
      {header}
      <div className="grid flex-1 place-items-center gap-6 text-center">
        <motion.div
          aria-hidden
          className="text-6xl"
          animate={settled ? { rotate: 0, scale: 1.06 } : { rotate: 360 }}
          transition={
            settled
              ? { type: 'spring', stiffness: 150, damping: 21 }
              : { duration: 0.6, repeat: Infinity, ease: 'linear' }
          }
        >
          🎯
        </motion.div>
        <motion.h1
          key={settled ? 'settled' : display}
          initial={{ scale: 0.82, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="text-3xl font-extrabold dp-accent"
        >
          {settled ? t('tod.yourTurn', { name: activeName }) : display}
        </motion.h1>
        <AnimatePresence>
          {settled && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid w-full grid-cols-2 gap-3"
            >
              <Button
                size="lg"
                onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'CHOOSE', kind: 'truth', seed: ctx.random.seed() }); }}
              >
                {t('tod.truth')}
              </Button>
              <Button
                size="lg"
                variant="danger"
                onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'CHOOSE', kind: 'dare', seed: ctx.random.seed() }); }}
              >
                {t('tod.dare')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Screen>
  );
}

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<ToDState, ToDAction>) {
  const { t } = useTranslation();
  const s = state;
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    setGateOpen(false);
  }, [s.spinSerial, s.currentPromptId]);

  const activeName = s.activePlayerId ? s.playerNames[s.activePlayerId] : '';
  const activeColor = s.activePlayerId ? s.playerColors[s.activePlayerId] : undefined;
  const prompt = s.currentPromptId ? PROMPT_BY_ID[s.currentPromptId] : undefined;
  const promptText = prompt ? ctx.localize(prompt.text) : '';

  const header = (
    <AppBar
      onBack={() => nav.exit()}
      right={
        s.history.length > 0 ? (
          <button onClick={() => nav.endGame()} className="text-sm text-[var(--text-muted)]">
            {t('tod.endGame')}
          </button>
        ) : undefined
      }
    />
  );

  if (s.phase === 'error') {
    return (
      <Screen>
        <AppBar title={t('tod.title')} onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-[var(--text-muted)]">{t('tod.errorPool')}</p>
          <Button onClick={() => nav.playAgain()}>{t('tod.playAgain')}</Button>
        </div>
      </Screen>
    );
  }

  // Bottle mode owns both the pick (idle) and the choose (choosing) screens.
  if (s.options.selectionMode === 'bottle' && (s.phase === 'idle' || s.phase === 'choosing')) {
    return <BottleStage state={s} dispatch={dispatch} ctx={ctx} header={header} />;
  }

  if (s.phase === 'idle') {
    const seqNext = nextSequentialId(s);
    return (
      <Screen>
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          {s.options.scoringMode === 'points' && (
            <Chip>{t('tod.turnCount', { n: s.turnIndex })}</Chip>
          )}
          {s.options.selectionMode === 'spinner' ? (
            <>
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                className="text-8xl"
              >
                🎯
              </motion.div>
              <p className="text-lg text-[var(--text-muted)]">{t('tod.spinHint')}</p>
              <Button size="lg" onClick={() => { ctx.sound.play('shuffle'); dispatch({ type: 'SPIN', seed: ctx.random.seed() }); }}>
                {t('tod.spin')}
              </Button>
            </>
          ) : (
            <>
              <p className="text-lg text-[var(--text-muted)]">{t('tod.nextUp')}</p>
              <h1 className="text-4xl font-extrabold dp-accent">
                {s.playerNames[seqNext]}
              </h1>
              <Button size="lg" onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'NEXT_PLAYER' }); }}>
                {t('tod.nextPlayer')}
              </Button>
            </>
          )}
        </div>
      </Screen>
    );
  }

  if (s.phase === 'choosing') {
    return (
      <ChoosingScreen
        s={s}
        dispatch={dispatch}
        ctx={ctx}
        header={header}
        activeName={activeName}
        activeColor={activeColor}
      />
    );
  }

  if (s.phase === 'revealing') {
    return (
      <Screen>
        <TurnAura color={activeColor} />
        {header}
        <Curtain
          open={gateOpen}
          holderName={activeName}
          hint={t('tod.passTo', { name: activeName })}
          revealLabel={t('tod.reveal')}
          onReveal={() => { ctx.sound.play('reveal'); dispatch({ type: 'REVEAL' }); setGateOpen(true); }}
        >
          <div />
        </Curtain>
        <div className="pb-4 text-center">
          <Button variant="ghost" onClick={() => dispatch({ type: 'RESOLVE', outcome: 'skip' })}>
            {t('tod.skipNoReveal')}
          </Button>
        </div>
      </Screen>
    );
  }

  // resolving
  return (
    <Screen>
      <TurnAura color={activeColor} />
      {header}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="flex items-center gap-2">
          <Chip>{t(`tod.intensityName.${prompt?.intensity ?? 'mild'}`)}</Chip>
          <Chip>{s.currentKind === 'dare' ? t('tod.dare') : t('tod.truth')}</Chip>
          {prompt?.requiresProps && <span title="props" className="text-lg">🎒</span>}
        </div>
        <p className="text-sm font-semibold text-[var(--text-muted)]">{activeName}</p>
        <Card className="px-6 py-10">
          <h1 className="text-2xl font-extrabold leading-snug">{promptText}</h1>
        </Card>
        <div className="grid w-full grid-cols-2 gap-3">
          <Button size="lg" onClick={() => { ctx.sound.play('correct'); ctx.haptics.success(); dispatch({ type: 'RESOLVE', outcome: 'done' }); }}>
            ✓ {t('tod.done')}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => { ctx.sound.play('pass'); dispatch({ type: 'RESOLVE', outcome: 'skip' }); }}>
            {t('tod.skip')}
          </Button>
        </div>
        <Button variant="ghost" onClick={() => { ctx.sound.play('shuffle'); dispatch({ type: 'REDRAW', seed: ctx.random.seed() }); }}>
          ↻ {t('tod.redraw')}
        </Button>
      </div>
    </Screen>
  );
}
