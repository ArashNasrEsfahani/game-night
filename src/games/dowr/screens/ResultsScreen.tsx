import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Scoreboard, WinnerBanner } from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import { selectStandings, selectWinners } from '../logic';
import type { DowrAction, DowrState } from '../logic';

const fmtTotal = (ms: number): string => {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
};

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<DowrState, DowrAction>) {
  const { t } = useTranslation();
  const s = state;

  useEffect(() => {
    ctx.sound.play('win');
  }, [ctx]);

  const winners = selectWinners(s);
  const standings = selectStandings(s);
  const nameOf = (id: string) => s.teams.find((tm) => tm.id === id)?.name ?? id;
  const winnerNames = winners.map(nameOf);
  const title =
    winners.length > 1 ? t('results.tie') : t('results.winner', { name: winnerNames[0] ?? '' });

  const timeMode = s.options.endMode === 'time';
  const rows: ScoreRow[] = standings.map((st) => ({
    id: st.subjectId,
    label: st.label,
    score: timeMode ? st.words : st.totalMs,
    display: timeMode ? t('dowr.wordsCount', { n: st.words }) : fmtTotal(st.totalMs),
    rank: st.rank,
    color: st.color,
  }));

  return (
    <Screen>
      <AppBar title={t('results.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 pb-8">
        <WinnerBanner title={title} names={winnerNames} tie={winners.length > 1} />
        <p className="text-center text-sm text-[var(--text-muted)]">
          {timeMode ? t('dowr.mostWords') : t('dowr.fastest')}
        </p>
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
