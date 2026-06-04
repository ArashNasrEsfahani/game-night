import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Card, Chip, Curtain } from '../../../sdk/ui';
import { PROMPT_BY_ID } from '../content';
import { nextSequentialId } from '../logic';
import type { ToDAction, ToDState } from '../logic';

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<ToDState, ToDAction>) {
  const { t } = useTranslation();
  const s = state;
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    setGateOpen(false);
  }, [s.spinSerial, s.currentPromptId]);

  const activeName = s.activePlayerId ? s.playerNames[s.activePlayerId] : '';
  const prompt = s.currentPromptId ? PROMPT_BY_ID[s.currentPromptId] : undefined;
  const promptText = prompt ? ctx.localize(prompt.text) : '';

  const header = (
    <AppBar
      onBack={() => nav.exit()}
      right={
        s.history.length > 0 ? (
          <button onClick={() => dispatch({ type: 'END_GAME' })} className="text-sm text-[var(--text-muted)]">
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

  if (s.phase === 'idle') {
    const seqNext = nextSequentialId(s);
    return (
      <Screen>
        {header}
        <div className="grid flex-1 place-items-center gap-5 text-center">
          {s.options.scoringMode === 'points' && (
            <Chip>{t('tod.turnCount', { n: s.turnIndex })}</Chip>
          )}
          {s.options.selectionMode === 'spinner' ? (
            <>
              <div className="text-7xl">🎯</div>
              <p className="text-lg text-[var(--text-muted)]">{t('tod.spinHint')}</p>
              <Button size="lg" onClick={() => { ctx.sound.play('shuffle'); dispatch({ type: 'SPIN', seed: ctx.random.seed() }); }}>
                {t('tod.spin')}
              </Button>
            </>
          ) : (
            <>
              <p className="text-lg text-[var(--text-muted)]">{t('tod.nextUp')}</p>
              <h1 className="text-4xl font-extrabold text-[var(--game-accent-strong)]">
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
      <Screen>
        {header}
        <div className="grid flex-1 place-items-center gap-6 text-center">
          <h1 className="text-3xl font-extrabold text-[var(--game-accent-strong)]">
            {t('tod.yourTurn', { name: activeName })}
          </h1>
          <div className="grid w-full grid-cols-2 gap-3">
            <Button size="lg" onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'CHOOSE', kind: 'truth', seed: ctx.random.seed() }); }}>
              {t('tod.truth')}
            </Button>
            <Button size="lg" variant="danger" onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'CHOOSE', kind: 'dare', seed: ctx.random.seed() }); }}>
              {t('tod.dare')}
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'revealing') {
    return (
      <Screen>
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
