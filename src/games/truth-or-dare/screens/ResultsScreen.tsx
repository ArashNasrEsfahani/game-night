import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Card, Scoreboard, WinnerBanner } from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import { computeWinners, standings } from '../logic';
import type { ToDAction, ToDState } from '../logic';

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<ToDState, ToDAction>) {
  const { t } = useTranslation();
  const s = state;

  useEffect(() => {
    ctx.sound.play('win');
  }, [ctx]);

  const points = s.options.scoringMode === 'points';
  const winners = computeWinners(s);
  const winnerNames = winners.map((id) => s.playerNames[id] ?? id);
  const dares = s.history.filter((h) => h.kind === 'dare' && h.outcome === 'done').length;
  const truths = s.history.filter((h) => h.kind === 'truth' && h.outcome === 'done').length;
  const skips = s.history.filter((h) => h.outcome === 'skip').length;

  const rows: ScoreRow[] = standings(s).map((r) => ({
    id: r.id,
    label: s.playerNames[r.id] ?? r.id,
    score: r.score,
    rank: r.rank,
    color: s.playerColors[r.id],
  }));

  return (
    <Screen>
      <AppBar title={t('results.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 pb-8">
        {points && winners.length > 0 ? (
          <>
            <WinnerBanner
              title={winners.length > 1 ? t('results.tie') : t('results.winner', { name: winnerNames[0] ?? '' })}
              names={winnerNames}
            />
            <Scoreboard rows={rows} />
          </>
        ) : (
          <Card className="px-5 py-8 text-center">
            <div className="text-5xl">🎯</div>
            <p className="mt-3 text-lg font-extrabold">{t('tod.sessionSummary')}</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {t('tod.statLine', { turns: s.history.length, dares, truths, skips })}
            </p>
          </Card>
        )}
        <div className="mt-2 flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); nav.playAgain(); }}>
            {t('tod.playAgain')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => nav.exit()}>
            {t('results.home')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
