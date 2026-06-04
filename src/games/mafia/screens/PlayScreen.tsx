import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Card, Curtain } from '../../../sdk/ui';
import { ROLES } from '../roles';
import {
  alivePlayers,
  currentDealId,
  currentStep,
  recordedTarget,
} from '../logic';
import type { MafiaAction, MafiaState } from '../logic';

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<MafiaState, MafiaAction>) {
  const { t } = useTranslation();
  const s = state;
  const [gateOpen, setGateOpen] = useState(false);
  const [voteCursor, setVoteCursor] = useState(0);

  useEffect(() => setGateOpen(false), [s.phase, s.dealCursor, voteCursor]);
  useEffect(() => {
    if (s.phase === 'vote') setVoteCursor(0);
  }, [s.phase]);

  const name = (id: string) => s.playerNames[id] ?? id;
  const alive = alivePlayers(s);

  if (s.phase === 'error') {
    return (
      <Screen>
        <AppBar title={t('mf.title')} onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-[var(--text-muted)]">{t('mf.errorSetup')}</p>
          <Button onClick={() => nav.playAgain()}>{t('mf.playAgain')}</Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'deal') {
    const pid = currentDealId(s);
    const player = s.players.find((p) => p.id === pid);
    const role = player ? ROLES[player.roleId] : undefined;
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <p className="py-1 text-center text-xs text-[var(--text-muted)]">
          {t('mf.dealProgress', { done: s.dealCursor + 1, total: s.dealOrder.length })}
        </p>
        <Curtain
          open={gateOpen}
          holderName={pid ? name(pid) : ''}
          hint={t('mf.imName', { name: pid ? name(pid) : '' })}
          revealLabel={t('mf.reveal')}
          onReveal={() => { ctx.sound.play('reveal'); setGateOpen(true); }}
        >
          <div className="grid flex-1 place-items-center gap-5 text-center">
            <div className="text-7xl">{role?.icon}</div>
            <h1 className="text-3xl font-extrabold text-[var(--game-accent-strong)]">{role ? ctx.localize(role.name) : ''}</h1>
            <p className="px-6 text-sm text-[var(--text-muted)]">{role ? ctx.localize(role.reveal) : ''}</p>
            <Button size="lg" onClick={() => dispatch({ type: 'DEAL_NEXT' })}>
              {t('mf.hideAndPass')}
            </Button>
          </div>
        </Curtain>
      </Screen>
    );
  }

  if (s.phase === 'night') {
    const step = currentStep(s);
    if (!step) return <Screen><AppBar onBack={() => nav.exit()} /></Screen>;
    const role = ROLES[step.roleId];
    const recorded = recordedTarget(s, step.key);
    const legal = alive.filter((p) => step.canTargetSelf || !step.actorIds.includes(p.id));
    const detectiveResult =
      step.key === 'detective.check' && recorded
        ? (ROLES[s.players.find((p) => p.id === recorded)!.roleId].appearsAs ??
            s.players.find((p) => p.id === recorded)!.faction)
        : null;
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <div className="flex flex-1 flex-col gap-3">
          <Card className="px-4 py-3 text-center">
            <div className="text-4xl">{role?.icon}</div>
            <p className="mt-1 font-bold">{t('mf.wake', { role: role ? ctx.localize(role.name) : '' })}</p>
          </Card>
          <div className="flex flex-wrap justify-center gap-2">
            {legal.map((p) => (
              <button
                key={p.id}
                onClick={() => { ctx.haptics.light(); dispatch({ type: 'RECORD_NIGHT_ACTION', actorId: step.actorIds[0], targetId: p.id }); }}
                className={`rounded-full px-4 py-3 text-base font-medium ${
                  recorded === p.id ? 'bg-[var(--game-accent-strong)] text-white' : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                {name(p.id)}
              </button>
            ))}
          </div>
          {detectiveResult && (
            <p className="text-center text-sm font-bold">
              {t('mf.detectiveResult', { name: name(recorded!), faction: t(`mf.faction.${detectiveResult}`) })}
            </p>
          )}
          {s.meta?.error && <p className="text-center text-sm text-[var(--color-game-rose-strong)]">{t(`mf.err.${s.meta.error}`)}</p>}
          <div className="mt-auto flex gap-2">
            {step.skippable && (
              <Button variant="ghost" onClick={() => dispatch({ type: 'RECORD_NIGHT_ACTION', actorId: step.actorIds[0], targetId: null, skipped: true })}>
                {t('mf.skip')}
              </Button>
            )}
            {s.nightCursor > 0 && (
              <Button variant="secondary" onClick={() => dispatch({ type: 'NIGHT_STEP_BACK' })}>
                {t('mf.back')}
              </Button>
            )}
            <Button fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'NIGHT_STEP_NEXT' }); }}>
              {t('mf.next')}
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'night-result') {
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <div className="text-6xl">🌅</div>
          {s.lastNightDeaths.length === 0 ? (
            <p className="text-xl">{t('mf.noDeaths')}</p>
          ) : (
            <div>
              <p className="text-sm text-[var(--text-muted)]">{t('mf.killedLastNight')}</p>
              {s.lastNightDeaths.map((id) => (
                <p key={id} className="text-xl font-bold">
                  💀 {name(id)}{s.options.optionalReveal ? ` · ${ctx.localize(ROLES[s.players.find((p) => p.id === id)!.roleId].name)}` : ''}
                </p>
              ))}
            </div>
          )}
          <Button size="lg" onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'ACK_NIGHT_RESULT' }); }}>
            {t('mf.toDay')}
          </Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'day') {
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <div className="flex flex-1 flex-col items-center gap-4 py-4 text-center">
          <div className="text-6xl">☀️</div>
          <p className="text-lg">{t('mf.dayOpen')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {s.players.map((p) => (
              <span key={p.id} className={`rounded-full px-2.5 py-1 text-xs ${p.alive ? 'bg-[var(--surface-2)]' : 'bg-[var(--surface-2)] opacity-40'}`}>
                {p.alive ? name(p.id) : `💀 ${name(p.id)}`}
              </span>
            ))}
          </div>
          <Button size="lg" className="mt-auto" onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'END_DISCUSSION' }); }}>
            {t('mf.startNominations')}
          </Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'nominate') {
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <div className="flex flex-1 flex-col gap-3">
          <p className="text-center text-sm text-[var(--text-muted)]">{t('mf.nominateHint', { n: s.options.nominationsRequired })}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {alive.map((p) => (
              <button
                key={p.id}
                onClick={() => dispatch({ type: 'NOMINATE', nomineeId: p.id })}
                className={`rounded-full px-4 py-3 text-base font-medium ${
                  s.ballot.includes(p.id) ? 'bg-[var(--game-accent-strong)] text-white' : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                {name(p.id)} {(s.nominations[p.id] ?? 0) > 0 ? `(${s.nominations[p.id]})` : ''}
              </button>
            ))}
          </div>
          {s.meta?.error && <p className="text-center text-sm text-[var(--color-game-rose-strong)]">{t(`mf.err.${s.meta.error}`)}</p>}
          <Button size="lg" fullWidth className="mt-auto" disabled={s.ballot.length === 0} onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'OPEN_VOTE' }); }}>
            {t('mf.goToVote')}
          </Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'vote') {
    const voter = alive[voteCursor];
    if (voteCursor >= alive.length || !voter) {
      return (
        <Screen>
          <AppBar onBack={() => nav.exit()} />
          <div className="grid flex-1 place-items-center gap-4 text-center">
            <p className="text-lg text-[var(--text-muted)]">{t('mf.allVoted')}</p>
            <Button size="lg" onClick={() => { ctx.sound.play('reveal'); dispatch({ type: 'RESOLVE_VOTE', seed: ctx.random.seed() }); }}>
              {t('mf.resolveVote')}
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
          holderName={name(voter.id)}
          hint={t('mf.imName', { name: name(voter.id) })}
          revealLabel={t('mf.reveal')}
          onReveal={() => setGateOpen(true)}
        >
          <div className="flex flex-1 flex-col gap-3">
            <p className="text-center text-base font-bold">{t('mf.voteWho')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {s.ballot.map((id) => (
                <button
                  key={id}
                  onClick={() => { dispatch({ type: 'CAST_VOTE', voterId: voter.id, nomineeId: id }); setVoteCursor((c) => c + 1); }}
                  className="rounded-full bg-[var(--surface-2)] px-4 py-3 text-base font-medium"
                >
                  {name(id)}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setVoteCursor((c) => c + 1)}>
              {t('mf.abstain')}
            </Button>
          </div>
        </Curtain>
      </Screen>
    );
  }

  // vote-result
  return (
    <Screen>
      <AppBar onBack={() => nav.exit()} />
      <div className="grid flex-1 place-items-center gap-4 text-center">
        {s.lastVoteEliminated ? (
          <>
            <div className="text-6xl">⚖️</div>
            <p className="text-xl font-bold">
              {name(s.lastVoteEliminated)}{s.options.optionalReveal ? ` · ${ctx.localize(ROLES[s.players.find((p) => p.id === s.lastVoteEliminated)!.roleId].name)}` : ''}
            </p>
            <p className="text-[var(--text-muted)]">{t('mf.votedOut')}</p>
          </>
        ) : (
          <p className="text-xl">{t('mf.noElimination')}</p>
        )}
        <Button size="lg" onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'ACK_VOTE_RESULT' }); }}>
          {t('mf.nextNight')}
        </Button>
      </div>
    </Screen>
  );
}
