import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Card, Scoreboard, WinnerBanner } from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import { computeWinners, sideWins, standings } from '../logic';
import type { WyrAction, WyrState } from '../logic';

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<WyrState, WyrAction>) {
  const { t } = useTranslation();
  const s = state;

  useEffect(() => {
    ctx.sound.play('win');
  }, [ctx]);

  const scored = s.options.awardMajorityPoints && s.options.mode === 'vote';
  const winners = computeWinners(s);
  const winnerNames = winners.map((id) => s.playerNames[id] ?? id);
  const sides = sideWins(s);

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
        {scored && winners.length > 0 ? (
          <>
            <WinnerBanner
              title={winners.length > 1 ? t('results.tie') : t('results.winner', { name: winnerNames[0] ?? '' })}
              names={winnerNames}
            />
            <p className="text-center text-sm text-[var(--text-muted)]">{t('wyr.mostInStep')}</p>
            <Scoreboard rows={rows} />
          </>
        ) : (
          <Card className="px-5 py-8 text-center">
            <div className="text-5xl">🗳️</div>
            <p className="mt-3 text-xl font-extrabold">{t('wyr.sideWins', { a: sides.A, b: sides.B })}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{t('wyr.recap', { n: s.history.length })}</p>
          </Card>
        )}
        <div className="mt-2 flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); nav.playAgain(); }}>
            {t('wyr.playAgain')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => nav.exit()}>
            {t('results.home')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
