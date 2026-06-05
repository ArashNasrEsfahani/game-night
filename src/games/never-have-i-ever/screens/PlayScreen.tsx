import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Card, Chip, Curtain } from '../../../sdk/ui';
import { STATEMENT_BY_ID } from '../content';
import { allAnswered, currentHolder } from '../logic';
import type { NhieAction, NhieState } from '../logic';

function ScoreStrip({ s }: { s: NhieState }) {
  const classic = s.options.mode === 'classic';
  return (
    <div className="flex flex-wrap justify-center gap-2 py-2">
      {s.players.map((p) => (
        <span
          key={p.id}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            p.eliminated ? 'bg-[var(--surface-2)] opacity-40' : 'bg-[var(--surface-2)]'
          }`}
        >
          <span className="font-semibold">{s.playerNames[p.id]}</span>
          {p.eliminated ? '💀' : classic ? `❤️${p.lives}` : `· ${p.haveCount}`}
        </span>
      ))}
    </div>
  );
}

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<NhieState, NhieAction>) {
  const { t } = useTranslation();
  const s = state;
  const [gateOpen, setGateOpen] = useState(false);
  const [honorSel, setHonorSel] = useState<string[]>([]);

  const holder = currentHolder(s);
  // Re-lock the curtain for each new sequential holder.
  useEffect(() => {
    setGateOpen(false);
  }, [holder]);
  // Reset honor selection when (re)entering answering.
  useEffect(() => {
    if (s.phase === 'answering') setHonorSel([]);
  }, [s.phase, s.roundIndex]);

  const stmt = s.currentStatementId ? STATEMENT_BY_ID[s.currentStatementId] : undefined;
  const stmtText = stmt ? ctx.localize(stmt.text) : '';

  if (s.phase === 'error') {
    return (
      <Screen>
        <AppBar title={t('nhie.title')} onBack={() => nav.exit()} />
        <div className="grid flex-1 place-items-center gap-4 text-center">
          <p className="text-[var(--text-muted)]">{t('nhie.errorDeck')}</p>
          <Button onClick={() => nav.playAgain()}>{t('nhie.rematch')}</Button>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'statement') {
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <ScoreStrip s={s} />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <Chip>{t(`nhie.intensity.${stmt?.intensity ?? 'classic'}`)}</Chip>
          <p className="text-sm font-semibold text-[var(--text-muted)]">
            {t('nhie.round', { n: s.roundIndex + 1 })}
          </p>
          <Card className="px-6 py-10">
            <h1 className="text-3xl font-extrabold leading-snug">{stmtText}</h1>
          </Card>
          <div className="flex w-full flex-col gap-2">
            <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); dispatch({ type: 'START_ANSWERING' }); }}>
              {t('nhie.startAnswering')}
            </Button>
            <Button variant="ghost" onClick={() => dispatch({ type: 'SKIP_STATEMENT' })}>
              {t('nhie.skip')}
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  if (s.phase === 'answering' && s.options.revealMode === 'sequential') {
    const done = allAnswered(s);
    const holderName = holder ? s.playerNames[holder] : '';
    if (done) {
      return (
        <Screen>
          <AppBar onBack={() => nav.exit()} />
          <div className="grid flex-1 place-items-center gap-4 text-center">
            <p className="text-lg text-[var(--text-muted)]">{t('nhie.allAnswered')}</p>
            <Button size="lg" onClick={() => { ctx.sound.play('reveal'); dispatch({ type: 'RESOLVE_ROUND' }); }}>
              {t('nhie.resolve')}
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
          holderName={holderName}
          hint={t('nhie.imName', { name: holderName })}
          revealLabel={t('nhie.reveal')}
          onReveal={() => { ctx.sound.play('reveal'); setGateOpen(true); }}
        >
          <div className="grid flex-1 place-items-center gap-6 text-center">
            <h1 className="text-2xl font-extrabold leading-snug">{stmtText}</h1>
            <div className="grid w-full grid-cols-2 gap-3">
              <Button
                size="lg"
                onClick={() => {
                  ctx.haptics.light();
                  if (holder) dispatch({ type: 'ANSWER', playerId: holder, hasDone: true });
                  dispatch({ type: 'PASS_TO_NEXT' });
                }}
              >
                {t('nhie.haveBtn')}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => {
                  ctx.haptics.light();
                  if (holder) dispatch({ type: 'ANSWER', playerId: holder, hasDone: false });
                  dispatch({ type: 'PASS_TO_NEXT' });
                }}
              >
                {t('nhie.haveNotBtn')}
              </Button>
            </div>
          </div>
        </Curtain>
      </Screen>
    );
  }

  if (s.phase === 'answering' && s.options.revealMode === 'honor') {
    const alive = s.players.filter((p) => !p.eliminated);
    const toggle = (id: string) =>
      setHonorSel((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
    const apply = (ids: string[]) => {
      ctx.sound.play('reveal');
      dispatch({ type: 'SET_HONOR_HAVES', playerIds: ids });
      dispatch({ type: 'RESOLVE_ROUND' });
    };
    return (
      <Screen>
        <AppBar onBack={() => nav.exit()} />
        <div className="flex flex-1 flex-col gap-4">
          <h1 className="text-center text-xl font-extrabold leading-snug">{stmtText}</h1>
          <p className="text-center text-sm text-[var(--text-muted)]">
            {t('nhie.haveTapHint')} · {t('nhie.haveCount', { n: honorSel.length })}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {alive.map((p) => (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  honorSel.includes(p.id)
                    ? 'bg-[var(--game-accent-strong)] text-[var(--game-on-accent)]'
                    : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                {s.playerNames[p.id]}
              </button>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <Button size="lg" fullWidth onClick={() => apply(honorSel)}>
              {t('nhie.resolve')}
            </Button>
            <Button variant="ghost" onClick={() => apply([])}>
              {t('nhie.nobody')}
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  // reveal
  const lr = s.lastResult;
  const haveNames = (lr?.haveIds ?? []).map((id) => s.playerNames[id]);
  return (
    <Screen>
      <AppBar onBack={() => nav.exit()} />
      <ScoreStrip s={s} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-extrabold leading-snug">{stmtText}</h1>
        {haveNames.length === 0 ? (
          <p className="text-xl">😇 {t('nhie.innocent')}</p>
        ) : (
          <div>
            <p className="text-sm text-[var(--text-muted)]">{t('nhie.confessed')}</p>
            <p className="text-lg font-bold">{haveNames.join('، ')}</p>
            {lr && lr.newlyEliminated.length > 0 && (
              <p className="mt-2 text-[var(--color-game-rose-strong)]">
                💀 {t('nhie.eliminated')}: {lr.newlyEliminated.map((id) => s.playerNames[id]).join('، ')}
              </p>
            )}
          </div>
        )}
        <Button
          size="lg"
          fullWidth
          onClick={() => {
            ctx.sound.play('tap');
            dispatch({ type: 'NEXT_STATEMENT' });
          }}
        >
          {s.finished ? t('nhie.seeResults') : t('nhie.next')}
        </Button>
      </div>
    </Screen>
  );
}
