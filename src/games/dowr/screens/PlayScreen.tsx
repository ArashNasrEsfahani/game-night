import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Curtain, TimerRing, TeamBadge, Scoreboard } from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import * as timerEngine from '../../../engine/timer';
import { CARD_BY_ID } from '../content';
import {
  currentRound,
  describerPlayerId,
  isLastTurn,
  selectStandings,
} from '../logic';
import type { DowrAction, DowrState } from '../logic';

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<DowrState, DowrAction>) {
  const { t } = useTranslation();
  const s = state;
  const [now, setNow] = useState(() => ctx.clock.now());
  const [gateOpen, setGateOpen] = useState(false);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // Pump the clock while describing; the reducer auto-finalizes on expiry.
  useEffect(() => {
    if (s.phase !== 'describing') return;
    const stop = ctx.clock.interval(250, (n) => {
      setNow(n);
      dispatchRef.current({ type: 'TICK', now: n });
    });
    return stop;
  }, [s.phase, ctx]);

  // Re-lock the curtain whenever a new reveal begins.
  useEffect(() => {
    if (s.phase === 'reveal') setGateOpen(false);
  }, [s.phase, s.turn.index, s.turn.round]);

  const seat = s.turn.index;
  const describerId = describerPlayerId(s);
  const describerName = s.playerNames[describerId] ?? '';
  const scorerId = s.seatToScorer[seat];
  const partnerId =
    s.options.mode === 'teams'
      ? s.playerIds.find((_id, i) => i !== seat && s.seatToScorer[i] === scorerId)
      : undefined;
  const partnerName = partnerId ? s.playerNames[partnerId] : undefined;

  const card = s.currentCardId ? CARD_BY_ID[s.currentCardId] : undefined;
  const word = card ? ctx.localize(card.word) : '';
  const remainingSec = timerEngine.remainingMs(s.clock, now) / 1000;

  const rows: ScoreRow[] = selectStandings(s).map((st) => ({
    id: st.subjectId,
    label: s.scorerLabels[st.subjectId] ?? st.subjectId,
    score: st.total,
    rank: st.rank,
    color: s.scorerColors[st.subjectId],
  }));

  if (s.phase === 'error') {
    return (
      <Screen>
        <AppBar title={t('dowr.title')} onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-[var(--text-muted)]">{t('dowr.outOfWords')}</p>
          <Button onClick={() => nav.playAgain()}>{t('dowr.playAgain')}</Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'roundIntro') {
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-sm font-semibold text-[var(--text-muted)]">
            {t('dowr.roundOf', { round: currentRound(s), total: s.options.rounds })}
          </p>
          <p className="text-lg text-[var(--text-muted)]">{t('dowr.passTo', { name: '' })}</p>
          <h1 className="text-4xl font-extrabold text-[var(--game-accent-strong)]">{describerName}</h1>
          {partnerName && <TeamBadge label={t('dowr.partner', { name: partnerName })} />}
          <Button
            size="lg"
            onClick={() => {
              ctx.sound.play('tap');
              dispatch({ type: 'BEGIN_TURN' });
            }}
          >
            {t('dowr.ready')}
          </Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'reveal') {
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <Curtain
          open={gateOpen}
          holderName={describerName}
          hint={t('dowr.revealHint', { name: describerName })}
          revealLabel={t('dowr.reveal')}
          onReveal={() => {
            ctx.sound.play('reveal');
            dispatch({ type: 'REVEAL' });
            setGateOpen(true);
          }}
        >
          <div className="grid flex-1 place-items-center gap-6 text-center">
            <h1 className="text-5xl font-extrabold">{word}</h1>
            {card?.hints?.taboo && card.hints.taboo.length > 0 && (
              <div className="text-[var(--text-muted)]">
                <p className="text-sm">{t('dowr.dontSay')}</p>
                <p>{card.hints.taboo.map((x) => ctx.localize(x)).join('، ')}</p>
              </div>
            )}
            <Button
              size="lg"
              onClick={() => dispatch({ type: 'START_DESCRIBE', now: ctx.clock.now() })}
            >
              {t('dowr.startDescribing')}
            </Button>
          </div>
        </Curtain>
      </Screen>
    );
  }

  if (s.phase === 'describing') {
    return (
      <Screen>
        <div className="flex flex-col items-center gap-6 py-4">
          <TimerRing totalSeconds={s.options.timerSeconds} remainingSeconds={remainingSec} />
          <h1 className="text-center text-5xl font-extrabold">{word}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {t('dowr.tally', { correct: s.turnCorrect, skipped: s.turnSkipped })}
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
              ✓ {t('dowr.correct')}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                ctx.sound.play('pass');
                ctx.haptics.warning();
                dispatch({ type: 'SKIP' });
              }}
            >
              ↷ {t('dowr.skip')}
              {s.options.skipPenalty ? ' (−1)' : ''}
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => dispatch({ type: 'END_TURN_EARLY', now: ctx.clock.now() })}
          >
            {t('dowr.endTurn')}
          </Button>
        </div>
      </Screen>
    );
  }

  // turnSummary
  const last = s.history.at(-1);
  const reasonKey =
    s.lastTurnEndReason === 'timeExpired'
      ? 'dowr.timeUp'
      : s.lastTurnEndReason === 'deckExhausted'
        ? 'dowr.outOfWords'
        : 'dowr.endedEarly';
  return (
    <Screen>
      <AppBar onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 py-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold">{describerName}</h2>
          <p className="text-[var(--text-muted)]">{t(reasonKey)}</p>
          <p className="mt-2 text-3xl font-extrabold text-[var(--game-accent-strong)]">
            {last ? (last.delta >= 0 ? `+${last.delta}` : last.delta) : '+0'}
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            {t('dowr.tally', { correct: last?.correct ?? 0, skipped: last?.skipped ?? 0 })}
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
          {isLastTurn(s) ? t('dowr.seeResults') : t('dowr.nextPlayer')}
        </Button>
      </div>
    </Screen>
  );
}
