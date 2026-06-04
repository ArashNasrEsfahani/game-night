import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Scoreboard, WinnerBanner } from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import { selectStandings, selectWinners } from '../logic';
import type { DowrAction, DowrState } from '../logic';

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<DowrState, DowrAction>) {
  const { t } = useTranslation();
  const s = state;

  useEffect(() => {
    ctx.sound.play('win');
  }, [ctx]);

  const winners = selectWinners(s);
  const winnerNames = winners.map((id) => s.scorerLabels[id] ?? id);
  const title =
    winners.length > 1 ? t('results.tie') : t('results.winner', { name: winnerNames[0] ?? '' });
  const rows: ScoreRow[] = selectStandings(s).map((st) => ({
    id: st.subjectId,
    label: s.scorerLabels[st.subjectId] ?? st.subjectId,
    score: st.total,
    rank: st.rank,
    color: s.scorerColors[st.subjectId],
  }));

  return (
    <Screen>
      <AppBar title={t('results.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 pb-8">
        <WinnerBanner title={title} names={winnerNames} />
        <Scoreboard rows={rows} />
        <div className="mt-2 flex flex-col gap-2">
          <Button
            size="lg"
            fullWidth
            onClick={() => {
              ctx.sound.play('tap');
              nav.playAgain();
            }}
          >
            {t('dowr.playAgain')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => nav.exit()}>
            {t('results.home')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
