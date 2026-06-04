import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Scoreboard, WinnerBanner } from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import { computeWinners, standings } from '../logic';
import type { SpyfallAction, SpyfallState } from '../logic';

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<SpyfallState, SpyfallAction>) {
  const { t } = useTranslation();
  const s = state;

  useEffect(() => {
    ctx.sound.play('win');
  }, [ctx]);

  const winners = computeWinners(s);
  const winnerNames = winners.map((id) => s.playerNames[id] ?? id);
  const title =
    winners.length > 1 ? t('results.tie') : t('results.winner', { name: winnerNames[0] ?? '' });

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
        <WinnerBanner title={title} names={winnerNames} />
        <Scoreboard rows={rows} />
        <div className="mt-2 flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); nav.playAgain(); }}>
            {t('spy.playAgain')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => nav.exit()}>
            {t('results.home')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
