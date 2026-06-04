import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Card, Chip, Curtain } from '../../../sdk/ui';
import { ALL_LOCATIONS, LOCATION_BY_ID, roleName } from '../content';
import { currentRevealPlayerId } from '../logic';
import type { SpyfallAction, SpyfallState } from '../logic';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<SpyfallState, SpyfallAction>) {
  const { t } = useTranslation();
  const s = state;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const [gateOpen, setGateOpen] = useState(false);
  const [voteCursor, setVoteCursor] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(s.options.roundSeconds);
  const endAtRef = useRef(0);

  useEffect(() => setGateOpen(false), [s.phase, s.revealCursor, voteCursor]);
  useEffect(() => {
    if (s.phase === 'voting') setVoteCursor(0);
  }, [s.phase]);

  // QA timer.
  useEffect(() => {
    if (s.phase !== 'qa' || !s.options.useTimer) return;
    endAtRef.current = ctx.clock.now() + s.options.roundSeconds * 1000;
    setSecondsLeft(s.options.roundSeconds);
    const stop = ctx.clock.interval(500, (now) => {
      const rem = Math.ceil((endAtRef.current - now) / 1000);
      setSecondsLeft(Math.max(0, rem));
      if (rem <= 0) dispatchRef.current({ type: 'TIMER_EXPIRED' });
    });
    return stop;
  }, [s.phase, s.options.useTimer, s.options.roundSeconds, ctx]);

  const name = (id: string) => s.playerNames[id] ?? id;

  if (s.phase === 'error') {
    return (
      <Screen>
        <AppBar title={t('spy.title')} onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-[var(--text-muted)]">{t('spy.errorSetup')}</p>
          <Button onClick={() => nav.playAgain()}>{t('spy.playAgain')}</Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'reveal') {
    const pid = currentRevealPlayerId(s);
    const card = pid ? s.round.cards[pid] : undefined;
    const loc = card ? LOCATION_BY_ID[card.locationId] : undefined;
    const role = card && !card.isSpy && card.roleId ? roleName(card.locationId, card.roleId) : undefined;
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <p className="py-1 text-center text-xs text-[var(--text-muted)]">
          {t('spy.revealProgress', { done: s.revealCursor + 1, total: s.playerIds.length })}
        </p>
        <Curtain
          open={gateOpen}
          holderName={pid ? name(pid) : ''}
          hint={t('spy.imName', { name: pid ? name(pid) : '' })}
          revealLabel={t('spy.reveal')}
          onReveal={() => { ctx.sound.play('reveal'); setGateOpen(true); }}
        >
          <div className="grid flex-1 place-items-center gap-5 text-center">
            {card?.isSpy ? (
              <>
                <div className="text-7xl">🕵️</div>
                <h1 className="text-3xl font-extrabold text-[var(--game-accent-strong)]">{t('spy.youAreSpy')}</h1>
                <p className="text-sm text-[var(--text-muted)]">{t('spy.spyHint')}</p>
              </>
            ) : (
              <>
                <div className="text-6xl">{loc?.icon ?? '📍'}</div>
                <h1 className="text-3xl font-extrabold">{loc ? ctx.localize(loc.name) : ''}</h1>
                {role && <Chip>{ctx.localize(role)}</Chip>}
              </>
            )}
            <Button size="lg" onClick={() => dispatch({ type: 'REVEAL_NEXT' })}>
              {t('spy.hideAndPass')}
            </Button>
          </div>
        </Curtain>
      </Screen>
    );
  }

  if (s.phase === 'qa') {
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <div className="flex flex-1 flex-col items-center gap-4 py-2 text-center">
          {s.options.useTimer && (
            <div className={`text-6xl font-black tabular-nums ${secondsLeft <= 60 ? 'text-[var(--color-game-rose-strong)]' : 'text-[var(--game-accent-strong)]'}`}>
              {fmt(secondsLeft)}
            </div>
          )}
          <p className="text-sm text-[var(--text-muted)]">{t('spy.firstAsker', { name: name(s.round.firstAskerId) })}</p>
          <Card className="w-full px-4 py-3 text-start">
            <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">{t('spy.locations')}</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_LOCATIONS.map((l) => (
                <span key={l.id} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs">
                  {l.icon} {ctx.localize(l.name)}
                </span>
              ))}
            </div>
          </Card>
          <div className="mt-auto w-full">
            <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'CALL_VOTE', accuserId: '', nomineeId: '' }); }}>
              {t('spy.callVote')}
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'accusation') {
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <h1 className="text-2xl font-extrabold">{t('spy.timeToVote')}</h1>
          <Button size="lg" onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'OPEN_VOTING' }); }}>
            {t('spy.startVote')}
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: 'CANCEL_VOTE' })}>
            {t('spy.cancelVote')}
          </Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'voting') {
    const voter = s.playerIds[voteCursor];
    if (voteCursor >= s.playerIds.length) {
      return (
        <Screen>
          <AppBar onBack={() => nav.exit()} />
          <div className="grid flex-1 place-items-center gap-4 text-center">
            <p className="text-lg text-[var(--text-muted)]">{t('spy.allVoted')}</p>
            <Button size="lg" onClick={() => { ctx.sound.play('reveal'); dispatch({ type: 'LOCK_VOTES' }); }}>
              {t('spy.revealResult')}
            </Button>
          </div>
        </Screen>
      );
    }
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <Curtain
          open={gateOpen}
          holderName={name(voter)}
          hint={t('spy.imName', { name: name(voter) })}
          revealLabel={t('spy.reveal')}
          onReveal={() => setGateOpen(true)}
        >
          <div className="flex flex-1 flex-col gap-3">
            <p className="text-center text-base font-bold">{t('spy.voteWho')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {s.playerIds.filter((id) => id !== voter).map((id) => (
                <button
                  key={id}
                  onClick={() => { ctx.haptics.light(); dispatch({ type: 'CAST_VOTE', voterId: voter, targetId: id }); setVoteCursor((c) => c + 1); }}
                  className="rounded-full bg-[var(--surface-2)] px-4 py-3 text-base font-medium"
                >
                  {name(id)}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => { dispatch({ type: 'CAST_VOTE', voterId: voter, targetId: null }); setVoteCursor((c) => c + 1); }}>
              {t('spy.abstain')}
            </Button>
          </div>
        </Curtain>
      </Screen>
    );
  }

  if (s.phase === 'spyGuess') {
    const spy = s.round.spyIds[0];
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <Curtain
          open={gateOpen}
          holderName={name(spy)}
          hint={t('spy.spyGuessHint', { name: name(spy) })}
          revealLabel={t('spy.reveal')}
          onReveal={() => setGateOpen(true)}
        >
          <div className="flex flex-1 flex-col gap-3">
            <p className="text-center text-base font-bold">{t('spy.guessTitle')}</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_LOCATIONS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => { ctx.sound.play('reveal'); dispatch({ type: 'SPY_GUESS', spyId: spy, locationId: l.id }); }}
                  className="rounded-xl bg-[var(--surface-2)] px-3 py-3 text-sm font-medium"
                >
                  {l.icon} {ctx.localize(l.name)}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => dispatch({ type: 'SKIP_SPY_GUESS' })}>
              {t('spy.dontGuess')}
            </Button>
          </div>
        </Curtain>
      </Screen>
    );
  }

  // roundEnd
  const r = s.round;
  const loc = LOCATION_BY_ID[r.locationId];
  const last = s.round.index + 1 >= s.options.totalRounds;
  const outcomeKey = `spy.outcome.${r.outcome}`;
  return (
    <Screen>
      <AppBar onBack={() => nav.exit()} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-extrabold text-[var(--game-accent-strong)]">{t(outcomeKey)}</h1>
        <Card className="w-full px-4 py-4">
          <p className="text-sm text-[var(--text-muted)]">{t('spy.locationWas')}</p>
          <p className="text-xl font-bold">{loc?.icon} {loc ? ctx.localize(loc.name) : ''}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{t('spy.spyWas')}</p>
          <p className="font-bold">{r.spyIds.map((id) => name(id)).join('، ')}</p>
        </Card>
        <div className="flex flex-wrap justify-center gap-2">
          {s.playerIds.map((id) => (
            <span key={id} className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs">
              {name(id)} {(r.roundScores[id] ?? 0) > 0 ? `+${r.roundScores[id]}` : '·'}
            </span>
          ))}
        </div>
        <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'NEXT_ROUND', seed: ctx.random.seed() }); }}>
          {last ? t('spy.seeResults') : t('spy.nextRound')}
        </Button>
      </div>
    </Screen>
  );
}
