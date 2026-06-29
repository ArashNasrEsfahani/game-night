import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Scoreboard, WinnerBanner } from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import { computeOverallWinners, rankPlayers } from '../logic';
import type { MltAction, MltState } from '../logic';

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<MltState, MltAction>) {
  const { t } = useTranslation();
  const s = state;

  useEffect(() => {
    ctx.sound.play('win');
  }, [ctx]);

  const winners = computeOverallWinners(s);
  const winnerNames = winners.map((id) => s.playerNames[id] ?? id);
  const title =
    winners.length > 1 ? t('results.tie') : t('results.winner', { name: winnerNames[0] ?? '' });

  const rows: ScoreRow[] = rankPlayers(s).map((r) => ({
    id: r.id,
    label: `${s.playerNames[r.id] ?? r.id} · ${t('mlt.votesReceived', { n: r.rawVotes })}`,
    score: r.score,
    rank: r.rank,
    color: s.playerColors[r.id],
  }));

  return (
    <Screen>
      <AppBar title={t('results.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 pb-8">
        <WinnerBanner title={title} names={winnerNames} tie={winners.length > 1} />
        <p className="text-center text-sm text-[var(--text-muted)]">{t('mlt.winsLabel')}</p>
        <Scoreboard rows={rows} />
        <div className="mt-2 flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); nav.playAgain(); }}>
            {t('mlt.playAgain')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => nav.exit()}>
            {t('results.home')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
