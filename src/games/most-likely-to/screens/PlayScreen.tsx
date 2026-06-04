import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Card, Chip, Curtain, Stepper } from '../../../sdk/ui';
import { PROMPT_BY_ID } from '../content';
import { allVoted, currentPromptId, currentVoterId } from '../logic';
import type { MltAction, MltState, VoteTally } from '../logic';

function ScoreStrip({ s }: { s: MltState }) {
  if (!s.options.showRunningScores) return null;
  const top = [...s.playerIds].sort((a, b) => (s.scores[b] ?? 0) - (s.scores[a] ?? 0)).slice(0, 5);
  return (
    <div className="flex flex-wrap justify-center gap-2 py-2">
      {top.map((id) => (
        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs">
          <span className="font-semibold">{s.playerNames[id]}</span> 🏆{s.scores[id] ?? 0}
        </span>
      ))}
    </div>
  );
}

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<MltState, MltAction>) {
  const { t } = useTranslation();
  const s = state;
  const [gateOpen, setGateOpen] = useState(false);
  const [tally, setTally] = useState<VoteTally>({});

  const voterId = currentVoterId(s);
  useEffect(() => {
    setGateOpen(false);
  }, [voterId]);
  useEffect(() => {
    if (s.phase === 'voting' && s.options.votingStyle === 'simultaneous') {
      const init: VoteTally = {};
      s.playerIds.forEach((id) => (init[id] = 0));
      setTally(init);
    }
  }, [s.phase, s.currentRound, s.options.votingStyle, s.playerIds]);

  const promptId = currentPromptId(s);
  const prompt = promptId ? PROMPT_BY_ID[promptId] : undefined;
  const promptText = prompt ? ctx.localize(prompt.text) : '';

  if (s.phase === 'error') {
    return (
      <Screen>
        <AppBar title={t('mlt.title')} onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-[var(--text-muted)]">{t('mlt.errorDeck')}</p>
          <Button onClick={() => nav.playAgain()}>{t('mlt.playAgain')}</Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'prompt') {
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <ScoreStrip s={s} />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <p className="text-sm font-semibold text-[var(--text-muted)]">
            {t('mlt.round', { k: s.currentRound + 1, n: s.orderedPromptIds.length })}
          </p>
          <Card className="px-6 py-10">
            <div className="mb-3 text-5xl">{prompt?.emoji ?? '👉'}</div>
            <h1 className="text-3xl font-extrabold leading-snug">{promptText}</h1>
          </Card>
          <div className="flex w-full flex-col gap-2">
            <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'BEGIN_VOTING' }); }}>
              {t('mlt.startVoting')}
            </Button>
            {s.poolNextIndex < s.pool.length && (
              <Button variant="ghost" onClick={() => dispatch({ type: 'SKIP_PROMPT' })}>
                {t('mlt.skip')}
              </Button>
            )}
          </div>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'voting' && s.options.votingStyle === 'pass-device') {
    const done = allVoted(s);
    const voterName = voterId ? s.playerNames[voterId] : '';
    if (done) {
      return (
        <Screen>
          <AppBar onBack={() => nav.exit()} />
          <div className="grid flex-1 place-items-center gap-4 text-center">
            <p className="text-lg text-[var(--text-muted)]">{t('mlt.allVotesIn')}</p>
            <Button size="lg" onClick={() => { ctx.sound.play('reveal'); dispatch({ type: 'SUBMIT_VOTES', seed: ctx.random.seed() }); }}>
              {t('mlt.reveal')}
            </Button>
            <Button variant="ghost" onClick={() => dispatch({ type: 'UNDO_LAST_VOTE' })}>
              {t('mlt.undo')}
            </Button>
          </div>
        </Screen>
      );
    }
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <p className="py-1 text-center text-xs text-[var(--text-muted)]">
          {t('mlt.votedProgress', { done: s.activeVoterIndex ?? 0, total: s.playerIds.length })}
        </p>
        <Curtain
          open={gateOpen}
          holderName={voterName}
          hint={t('mlt.imName', { name: voterName })}
          revealLabel={t('mlt.reveal')}
          onReveal={() => setGateOpen(true)}
        >
          <div className="flex flex-1 flex-col gap-4">
            <h1 className="text-center text-xl font-extrabold leading-snug">{promptText}</h1>
            <div className="flex flex-wrap justify-center gap-2">
              {s.playerIds.map((id) => {
                const disabled = id === voterId && !s.options.allowSelfVote;
                return (
                  <button
                    key={id}
                    disabled={disabled}
                    onClick={() => {
                      ctx.haptics.light();
                      if (voterId) dispatch({ type: 'CAST_VOTE', voterId, targetId: id });
                    }}
                    className="rounded-full bg-[var(--surface-2)] px-4 py-3 text-base font-medium text-[var(--text)] disabled:opacity-30"
                  >
                    {s.playerNames[id]}
                  </button>
                );
              })}
            </div>
          </div>
        </Curtain>
      </Screen>
    );
  }

  if (s.phase === 'voting' && s.options.votingStyle === 'simultaneous') {
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <div className="flex flex-1 flex-col gap-3">
          <h1 className="text-center text-xl font-extrabold leading-snug">{promptText}</h1>
          <p className="text-center text-sm text-[var(--text-muted)]">{t('mlt.enterTally')}</p>
          <div className="flex flex-col gap-2">
            {s.playerIds.map((id) => (
              <Stepper
                key={id}
                label={s.playerNames[id]}
                value={tally[id] ?? 0}
                min={0}
                max={s.playerIds.length}
                onChange={(v) => setTally((tly) => ({ ...tly, [id]: v }))}
              />
            ))}
          </div>
          <p className="text-center text-xs text-[var(--text-muted)]">
            {t('mlt.tallyTotal', { total, players: s.playerIds.length })}
          </p>
          <Button
            size="lg"
            fullWidth
            onClick={() => { ctx.sound.play('reveal'); dispatch({ type: 'SUBMIT_VOTES', tally, seed: ctx.random.seed() }); }}
          >
            {t('mlt.reveal')}
          </Button>
        </div>
      </Screen>
    );
  }

  // reveal
  const round = s.rounds[s.rounds.length - 1];
  const winnerNames = (round?.winnerIds ?? []).map((id) => s.playerNames[id]);
  return (
    <Screen>
      <AppBar onBack={() => nav.exit()} />
      <ScoreStrip s={s} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <Chip>{t('mlt.round', { k: s.currentRound + 1, n: s.orderedPromptIds.length })}</Chip>
        <h1 className="text-2xl font-extrabold leading-snug">{promptText}</h1>
        {winnerNames.length === 0 ? (
          <p className="text-xl">🤷 {t('mlt.noVotes')}</p>
        ) : (
          <div>
            <div className="text-5xl">🎉</div>
            <p className="mt-2 text-2xl font-extrabold text-[var(--game-accent-strong)]">
              {winnerNames.join('، ')}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {winnerNames.length > 1 ? t('mlt.coWinners') : t('mlt.winnerMost')}
              {round?.wasTie && s.options.tieBreak === 'random' ? ` · ${t('mlt.tieBroken')}` : ''}
            </p>
          </div>
        )}
        <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'NEXT_ROUND' }); }}>
          {s.currentRound + 1 >= s.orderedPromptIds.length ? t('mlt.seeResults') : t('mlt.next')}
        </Button>
      </div>
    </Screen>
  );
}
