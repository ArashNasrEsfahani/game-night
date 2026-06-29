import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Scoreboard, WinnerBanner } from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import { selectStandings, selectWinners, teamColor, teamLabel } from '../logic';
import type { PantomimeAction, PantomimeState } from '../logic';

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<PantomimeState, PantomimeAction>) {
  const { t } = useTranslation();
  const s = state;

  useEffect(() => {
    ctx.sound.play('win');
  }, [ctx]);

  const winners = selectWinners(s);
  const winnerNames = winners.map((id) => teamLabel(s, id));
  const title =
    winners.length > 1 ? t('pantomime.tie') : t('results.winner', { name: winnerNames[0] ?? '' });
  const rows: ScoreRow[] = selectStandings(s).map((st) => ({
    id: st.subjectId,
    label: teamLabel(s, st.subjectId),
    score: st.total,
    rank: st.rank,
    color: teamColor(s, st.subjectId),
  }));

  return (
    <Screen>
      <AppBar title={t('results.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 pb-8">
        <WinnerBanner title={title} names={winnerNames} tie={winners.length > 1} />
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
            {t('pantomime.playAgain')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => nav.exit()}>
            {t('results.home')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
