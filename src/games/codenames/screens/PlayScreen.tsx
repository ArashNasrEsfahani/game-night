import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps, Lang } from '../../../sdk/types';
import { Screen, AppBar, Button, Curtain, Stepper } from '../../../sdk/ui';
import { currentSpymasterId, currentTeamName, guessesLeft } from '../logic';
import type { BoardCell, CardRole, CodenamesAction, CodenamesState } from '../logic';

function roleClass(role: CardRole): string {
  switch (role) {
    case 'teamA':
      return 'bg-[var(--color-game-rose-strong)] text-white';
    case 'teamB':
      return 'bg-[var(--color-game-sky-strong)] text-white';
    case 'neutral':
      return 'bg-[var(--color-game-gold)] text-[var(--text)]';
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
    <div className="grid grid-cols-5 gap-1.5">
      {cells.map((c) => {
        const show = spymaster || c.revealed;
        const cls = show ? roleClass(c.role) : 'bg-[var(--surface-2)] text-[var(--text)]';
        return (
          <button
            key={c.index}
            disabled={spymaster || c.revealed || !onTap}
            onClick={() => onTap?.(c.index)}
            className={`flex aspect-square items-center justify-center rounded-lg p-1 text-center text-[10px] font-bold leading-tight ${cls}`}
          >
            {c.word[lang]}
          </button>
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
    endAtRef.current = ctx.clock.now() + s.turnSeconds * 1000;
    setSecondsLeft(s.turnSeconds);
    const stop = ctx.clock.interval(500, (now) => {
      const rem = Math.ceil((endAtRef.current - now) / 1000);
      setSecondsLeft(Math.max(0, rem));
      if (rem <= 0) dispatchRef.current({ type: 'TIMER_EXPIRED' });
    });
    return stop;
  }, [s.phase, s.mode, s.turnSeconds, ctx]);

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

  const scoreStrip = (
    <div className="flex justify-center gap-4 py-2 text-sm font-bold">
      <span className="text-[var(--color-game-rose-strong)]">{s.teamMeta.teamA.name} {s.remaining.teamA}</span>
      <span className="text-[var(--color-game-sky-strong)]">{s.teamMeta.teamB.name} {s.remaining.teamB}</span>
    </div>
  );

  if (s.phase === 'spymasterHandoff') {
    return (
      <Screen>
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
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        {scoreStrip}
        <div className="flex flex-1 flex-col gap-3">
          <p className="text-center text-sm font-semibold">
            {t('cn.clueEcho', { count: s.activeClue?.count ?? 0, left: guessesLeft(s) })}
            {s.mode === 'timed' ? ` · ${secondsLeft}s` : ''}
          </p>
          <Grid cells={s.board} spymaster={false} lang={ctx.lang} onTap={(i) => {
            const cell = s.board[i];
            ctx.sound.play(cell.role === s.currentTeam ? 'correct' : cell.role === 'assassin' ? 'lose' : 'wrong');
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
  return (
    <Screen>
      <AppBar onBack={() => nav.exit()} />
      {scoreStrip}
      <div className="grid flex-1 place-items-center gap-4 text-center">
        <h1 className="text-2xl font-extrabold">{t(reasonKey)}</h1>
        <p className="text-[var(--text-muted)]">{t('cn.nextTeam', { team: s.teamMeta[s.currentTeam === 'teamA' ? 'teamB' : 'teamA'].name })}</p>
        <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'ADVANCE_TURN' }); }}>
          {t('cn.continue')}
        </Button>
      </div>
    </Screen>
  );
}
