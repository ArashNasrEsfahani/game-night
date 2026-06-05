import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import {
  Screen,
  AppBar,
  Button,
  Curtain,
  TimerRing,
  TeamBadge,
  Scoreboard,
  TurnAura,
} from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import * as timerEngine from '../../../engine/timer';
import { PROMPT_BY_ID } from '../content';
import {
  actorName,
  activeTeam,
  currentRound,
  selectStandings,
  skipsLeft,
} from '../logic';
import type { PantomimeAction, PantomimeState } from '../logic';

export function PlayScreen({
  state,
  dispatch,
  ctx,
  nav,
}: GameScreenProps<PantomimeState, PantomimeAction>) {
  const { t } = useTranslation();
  const s = state;
  const [now, setNow] = useState(() => ctx.clock.now());
  const [gateOpen, setGateOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const clock = ctx.clock;

  // Pump the clock while acting; the reducer auto-finalizes on expiry.
  useEffect(() => {
    if (s.phase !== 'acting' || !s.clock.running) return;
    const stop = clock.interval(250, (n) => {
      setNow(n);
      dispatchRef.current({ type: 'TICK', now: n });
    });
    return stop;
  }, [s.phase, s.clock.running, clock]);

  // Re-lock the curtain and reset the hint whenever a new reveal begins.
  useEffect(() => {
    if (s.phase === 'reveal') {
      setGateOpen(false);
      setShowHint(false);
    }
  }, [s.phase, s.turn.index, s.turn.round]);

  const team = activeTeam(s);
  const name = actorName(s);
  const prompt = s.currentPromptId ? PROMPT_BY_ID[s.currentPromptId] : undefined;
  const promptText = prompt ? ctx.localize(prompt.text) : '';
  const remainingSec = timerEngine.remainingMs(s.clock, now) / 1000;
  const left = skipsLeft(s);

  const rows: ScoreRow[] = selectStandings(s).map((st) => ({
    id: st.subjectId,
    label: s.teams.find((tm) => tm.teamId === st.subjectId)?.name ?? st.subjectId,
    score: st.total,
    rank: st.rank,
    color: s.teams.find((tm) => tm.teamId === st.subjectId)?.color,
  }));

  if (s.phase === 'error') {
    return (
      <Screen>
        <AppBar title={t('pantomime.title')} onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-[var(--text-muted)]">{t('pantomime.error.noPrompts')}</p>
          <Button onClick={() => nav.playAgain()}>{t('pantomime.playAgain')}</Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'handoff') {
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-sm font-semibold text-[var(--text-muted)]">
            {t('pantomime.roundOf', {
              round: currentRound(s),
              total: s.options.endMode === 'rounds' ? s.options.totalRounds : '∞',
            })}
          </p>
          {team && <TeamBadge label={team.name} color={team.color} />}
          <p className="text-lg text-[var(--text-muted)]">{t('pantomime.passTo')}</p>
          <h1 className="text-4xl font-extrabold dp-accent">{name}</h1>
          <Button
            size="lg"
            onClick={() => {
              ctx.sound.play('tap');
              dispatch({ type: 'HANDOFF_READY' });
            }}
          >
            {t('pantomime.ready', { name })}
          </Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'reveal') {
    return (
      <Screen>
        <TurnAura color={team?.color} />
        <AppBar onBack={() => nav.exit()} />
        <Curtain
          open={gateOpen}
          holderName={name}
          hint={t('pantomime.revealHint', { name })}
          revealLabel={t('pantomime.reveal')}
          onReveal={() => {
            ctx.sound.play('reveal');
            dispatch({ type: 'REVEAL' });
            setGateOpen(true);
          }}
        >
          <div className="grid flex-1 place-items-center gap-6 text-center">
            <h1 className="text-5xl font-extrabold">{promptText}</h1>
            {prompt?.hint && (
              <div className="text-[var(--text-muted)]">
                {showHint ? (
                  <p>{ctx.localize(prompt.hint)}</p>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setShowHint(true)}>
                    {t('pantomime.showHint')}
                  </Button>
                )}
              </div>
            )}
            <Button size="lg" onClick={() => dispatch({ type: 'START_ACTING', now: ctx.clock.now() })}>
              {t('pantomime.startActing')}
            </Button>
          </div>
        </Curtain>
      </Screen>
    );
  }

  if (s.phase === 'acting') {
    return (
      <Screen>
        <TurnAura color={team?.color} />
        <div className="flex flex-col items-center gap-6 py-4">
          <TimerRing totalSeconds={s.options.roundSeconds} remainingSeconds={remainingSec} />
          <h1 className="text-center text-5xl font-extrabold">{promptText}</h1>
          {prompt?.hint &&
            (showHint ? (
              <p className="text-center text-[var(--text-muted)]">{ctx.localize(prompt.hint)}</p>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowHint(true)}>
                {t('pantomime.showHint')}
              </Button>
            ))}
          <p className="text-sm text-[var(--text-muted)]">
            {t('pantomime.tally', { correct: s.turnCorrect, skipped: s.turnSkipped })}
          </p>
          <div className="grid w-full grid-cols-2 gap-3">
            <Button
              size="lg"
              onClick={() => {
                ctx.sound.play('correct');
                ctx.haptics.success();
                dispatch({ type: 'CORRECT' });
              }}
            >
              ✓ {t('pantomime.correct')}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={left <= 0}
              onClick={() => {
                ctx.sound.play('pass');
                ctx.haptics.warning();
                dispatch({ type: 'SKIP' });
              }}
            >
              ↷ {t('pantomime.skip')}
              {Number.isFinite(left) ? ` (${Math.max(0, left)})` : ''}
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => dispatch({ type: 'END_TURN_EARLY', now: ctx.clock.now() })}
          >
            {t('pantomime.endTurn')}
          </Button>
        </div>
      </Screen>
    );
  }

  // turnEnd
  const last = s.history.at(-1);
  const reasonKey =
    s.lastTurnEndReason === 'timeExpired'
      ? 'pantomime.timeUp'
      : s.lastTurnEndReason === 'deckExhausted'
        ? 'pantomime.outOfPrompts'
        : 'pantomime.endedEarly';
  return (
    <Screen>
      <AppBar onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 py-4">
        <div className="text-center">
          {team && <TeamBadge label={team.name} color={team.color} />}
          <h2 className="mt-2 text-2xl font-bold">{name}</h2>
          <p className="text-[var(--text-muted)]">{t(reasonKey)}</p>
          <p className="mt-2 text-3xl font-extrabold dp-accent">
            +{last?.correct ?? 0}
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            {t('pantomime.tally', {
              correct: last?.correct ?? 0,
              skipped: last?.skipped ?? 0,
            })}
          </p>
        </div>
        <Scoreboard rows={rows} />
        <Button
          size="lg"
          fullWidth
          onClick={() => {
            ctx.sound.play('tap');
            dispatch({ type: 'NEXT_TURN', seed: ctx.random.seed() });
          }}
        >
          {t('pantomime.nextTurn')}
        </Button>
      </div>
    </Screen>
  );
}
