import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import type { GameScreenProps, Lang } from '../../../sdk/types';
import { Screen, AppBar, Button, Curtain, Stepper, TurnAura } from '../../../sdk/ui';
import { currentSpymasterId, currentTeamName, guessesLeft } from '../logic';
import type { BoardCell, CardRole, CodenamesAction, CodenamesState } from '../logic';

function roleClass(role: CardRole): string {
  switch (role) {
    case 'teamA':
      return 'bg-[var(--color-game-rose-strong)] text-white';
    case 'teamB':
      return 'bg-[var(--color-game-sky-strong)] text-white';
    case 'neutral':
      return 'bg-[var(--color-game-gold)] text-[var(--on-gold)]';
    case 'assassin':
      return 'bg-zinc-900 text-white';
  }
}

function Grid({
  cells,
  spymaster,
  lang,
  onTap,
}: {
  cells: BoardCell[];
  spymaster: boolean;
  lang: Lang;
  onTap?: (i: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5" style={{ perspective: 700 }}>
      {cells.map((c) => {
        const show = spymaster || c.revealed;
        const cls = show ? roleClass(c.role) : 'bg-[var(--surface-2)] text-[var(--text)]';
        const disabled = spymaster || c.revealed || !onTap;
        return (
          <motion.button
            key={`${c.index}-${c.revealed}`}
            initial={c.revealed && !spymaster ? { rotateY: 90, opacity: 0.3, scale: 0.86 } : false}
            animate={
              c.revealed && !spymaster
                ? { rotateY: 0, opacity: 1, scale: [1.14, 1] }
                : { rotateY: 0, opacity: 1 }
            }
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            whileHover={disabled ? undefined : { scale: 1.06 }}
            whileTap={disabled ? undefined : { scale: 0.93 }}
            disabled={disabled}
            onClick={() => onTap?.(c.index)}
            className={`flex aspect-square items-center justify-center rounded-lg p-1 text-center text-[10px] font-bold leading-tight ${cls}`}
          >
            {c.word[lang]}
          </motion.button>
        );
      })}
    </div>
  );
}

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<CodenamesState, CodenamesAction>) {
  const { t } = useTranslation();
  const s = state;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const clock = ctx.clock;
  const [gateOpen, setGateOpen] = useState(false);
  const [count, setCount] = useState(1);
  const endAtRef = useRef(0);
  const [secondsLeft, setSecondsLeft] = useState(s.turnSeconds);

  useEffect(() => setGateOpen(false), [s.phase, s.currentTeam]);
  useEffect(() => {
    if (s.phase === 'clue') setCount(1);
  }, [s.phase, s.currentTeam]);

  useEffect(() => {
    if (s.phase !== 'guessing' || s.mode !== 'timed') return;
    endAtRef.current = clock.now() + s.turnSeconds * 1000;
    setSecondsLeft(s.turnSeconds);
    const stop = clock.interval(500, (now) => {
      const rem = Math.ceil((endAtRef.current - now) / 1000);
      setSecondsLeft(Math.max(0, rem));
      if (rem <= 0) dispatchRef.current({ type: 'TIMER_EXPIRED' });
    });
    return stop;
  }, [s.phase, s.mode, s.turnSeconds, clock]);

  const teamColor = s.currentTeam === 'teamA' ? 'rose' : 'sky';
  const spyName = s.playerNames[currentSpymasterId(s)] ?? '';

  if (s.phase === 'error') {
    return (
      <Screen>
        <AppBar title={t('cn.title')} onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-[var(--text-muted)]">{t('cn.errorSetup')}</p>
          <Button onClick={() => nav.playAgain()}>{t('cn.playAgain')}</Button>
        </div>
      </Screen>
    );
  }

  const lowTime = s.mode === 'timed' && secondsLeft <= 10;
  const scoreStrip = (
    <div className="flex items-center justify-center gap-3 py-2 text-sm font-bold">
      <span
        className={`flex items-center gap-1 text-[var(--color-game-rose-strong)] ${s.currentTeam === 'teamA' ? '' : 'opacity-45'}`}
      >
        {s.currentTeam === 'teamA' && <span aria-hidden>▶</span>}
        {s.teamMeta.teamA.name} {s.remaining.teamA}
      </span>
      {s.mode === 'timed' && s.phase === 'guessing' && (
        <span
          className={`dp-glass-2 rounded-full px-3 py-1 tabular-nums ${lowTime ? 'text-[var(--color-game-rose-strong)]' : 'text-[var(--text)]'}`}
        >
          ⏱ {secondsLeft}s
        </span>
      )}
      <span
        className={`flex items-center gap-1 text-[var(--color-game-sky-strong)] ${s.currentTeam === 'teamB' ? '' : 'opacity-45'}`}
      >
        {s.currentTeam === 'teamB' && <span aria-hidden>▶</span>}
        {s.teamMeta.teamB.name} {s.remaining.teamB}
      </span>
    </div>
  );

  if (s.phase === 'orientation') {
    return (
      <Screen>
        <TurnAura color={teamColor} />
        <AppBar onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-5 text-center">
          <div className={`rounded-2xl bg-[var(--color-game-${teamColor})] px-6 py-3`}>
            <p className="text-sm font-bold">{currentTeamName(s)}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('cn.startsFirst')}</p>
          </div>
          <h1 className="text-2xl font-extrabold">{t('cn.chooseOrientation')}</h1>
          <p className="max-w-xs text-sm text-[var(--text-muted)]">{t('cn.orientationHint')}</p>
          <div className="grid grid-cols-5 gap-1 opacity-60">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="h-7 w-7 rounded bg-[var(--surface-2)]" />
            ))}
          </div>
          <div className="grid w-full grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((r) => (
              <Button
                key={r}
                size="lg"
                onClick={() => {
                  ctx.sound.play('shuffle');
                  ctx.sound.play('drum');
                  ctx.haptics.medium();
                  dispatch({ type: 'CHOOSE_ORIENTATION', rotation: r });
                }}
              >
                {t(`cn.orient.${r}`)}
              </Button>
            ))}
          </div>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'spymasterHandoff') {
    return (
      <Screen>
        <TurnAura color={teamColor} />
        <AppBar onBack={() => nav.exit()} />
        {scoreStrip}
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <div className={`rounded-2xl bg-[var(--color-game-${teamColor})] px-6 py-4`}>
            <p className="text-sm">{currentTeamName(s)}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('cn.spymaster')}</p>
          </div>
          <h1 className="text-3xl font-extrabold">{spyName}</h1>
          <Button size="lg" onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'REVEAL_KEY_TO_SPYMASTER' }); }}>
            {t('cn.imSpymaster')}
          </Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'clue') {
    const max = s.remaining[s.currentTeam];
    return (
      <Screen>
        <TurnAura color={teamColor} />
        <AppBar onBack={() => nav.exit()} />
        <Curtain
          open={gateOpen}
          holderName={spyName}
          hint={t('cn.onlySpymaster', { name: spyName })}
          revealLabel={t('cn.reveal')}
          onReveal={() => { ctx.sound.play('reveal'); setGateOpen(true); }}
        >
          <div className="flex flex-1 flex-col gap-3">
            {scoreStrip}
            <Grid cells={s.board} spymaster lang={ctx.lang} />
            <Stepper label={t('cn.clueNumber')} value={Math.min(count, max)} min={0} max={max} onChange={setCount} />
            <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'GIVE_CLUE', count: Math.min(count, max) }); }}>
              {t('cn.clueGiven')}
            </Button>
          </div>
        </Curtain>
      </Screen>
    );
  }

  if (s.phase === 'guesserHandoff') {
    return (
      <Screen>
        <TurnAura color={teamColor} />
        <AppBar onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <div className="text-6xl">🙈</div>
          <p className="text-lg text-[var(--text-muted)]">{t('cn.hideKey')}</p>
          <Button size="lg" onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'HANDOFF_TO_GUESSERS' }); }}>
            {t('cn.weAreReady')}
          </Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'guessing') {
    const justForgiven =
      !!s.lastReveal &&
      (s.lastReveal.outcome === 'neutral' || s.lastReveal.outcome === 'wrongTeam') &&
      s.wrongGuessesThisTurn > 0;
    return (
      <Screen>
        <TurnAura color={teamColor} />
        <AppBar onBack={() => nav.exit()} />
        {scoreStrip}
        <div className="flex flex-1 flex-col gap-3">
          <motion.p
            key={`${s.activeClue?.count}-${s.activeClue?.guessesMade}`}
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 340, damping: 22 }}
            className="text-center text-sm font-semibold"
          >
            {t('cn.clueEcho', { count: s.activeClue?.count ?? 0, left: guessesLeft(s) })}
          </motion.p>
          <AnimatePresence>
            {justForgiven && (
              <motion.p
                key="forgiven"
                initial={{ y: -10, opacity: 0, scale: 0.85 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                className="text-center text-sm font-bold text-[var(--color-game-gold-strong)]"
              >
                😅 {t('cn.forgiven')}
              </motion.p>
            )}
          </AnimatePresence>
          <Grid cells={s.board} spymaster={false} lang={ctx.lang} onTap={(i) => {
            const cell = s.board[i];
            const willForgive =
              cell.role !== s.currentTeam && cell.role !== 'assassin' && s.forgiveFirstWrong && s.wrongGuessesThisTurn < 1;
            ctx.sound.play(
              cell.role === s.currentTeam ? 'select' : cell.role === 'assassin' ? 'lose' : willForgive ? 'forgive' : 'wrong',
            );
            ctx.haptics.medium();
            dispatch({ type: 'GUESS_CELL', cellIndex: i });
          }} />
          <Button variant="secondary" fullWidth disabled={(s.activeClue?.guessesMade ?? 0) < 1} onClick={() => dispatch({ type: 'STOP_GUESSING' })}>
            {t('cn.stopGuessing')}
          </Button>
        </div>
      </Screen>
    );
  }

  // turnEnd
  const reasonKey = `cn.reason.${s.turnEndReason ?? 'stopped'}`;
  const reasonEmoji =
    s.turnEndReason === 'guessedWrong'
      ? '🙈'
      : s.turnEndReason === 'usedAllGuesses'
        ? '✋'
        : s.turnEndReason === 'timeUp'
          ? '⏰'
          : '🤝';
  return (
    <Screen>
      <TurnAura color={teamColor} />
      <AppBar onBack={() => nav.exit()} />
      {scoreStrip}
      <motion.div
        className="grid flex-1 place-items-center gap-4 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="text-6xl"
          initial={{ scale: 0.3, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          aria-hidden
        >
          {reasonEmoji}
        </motion.div>
        <h1 className="text-2xl font-extrabold">{t(reasonKey)}</h1>
        <p className="text-[var(--text-muted)]">{t('cn.nextTeam', { team: s.teamMeta[s.currentTeam === 'teamA' ? 'teamB' : 'teamA'].name })}</p>
        <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'ADVANCE_TURN' }); }}>
          {t('cn.continue')}
        </Button>
      </motion.div>
    </Screen>
  );
}
