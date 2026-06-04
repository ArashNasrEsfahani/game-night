import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Scoreboard, WinnerBanner } from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import { computeWinners, participantName, standings } from '../logic';
import type { HeadsUpAction, HeadsUpState } from '../logic';

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<HeadsUpState, HeadsUpAction>) {
  const { t } = useTranslation();
  const s = state;

  useEffect(() => {
    ctx.sound.play('win');
  }, [ctx]);

  const winners = computeWinners(s);
  const winnerNames = winners.map((id) => participantName(s, id));
  const title =
    winners.length > 1 ? t('results.tie') : t('results.winner', { name: winnerNames[0] ?? '' });

  const colorOf = (id: string) => s.participants.find((p) => p.id === id)?.color;
  const rows: ScoreRow[] = standings(s).map((r) => ({
    id: r.participantId,
    label: `${participantName(s, r.participantId)} · ${t('hu.gotPassed', { got: r.got, passed: r.passed })}`,
    score: r.score,
    rank: r.rank,
    color: colorOf(r.participantId),
  }));

  return (
    <Screen>
      <AppBar title={t('results.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 pb-8">
        <WinnerBanner title={title} names={winnerNames} />
        <Scoreboard rows={rows} />
        <div className="mt-2 flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); nav.playAgain(); }}>
            {t('hu.playAgain')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => nav.exit()}>
            {t('results.home')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
