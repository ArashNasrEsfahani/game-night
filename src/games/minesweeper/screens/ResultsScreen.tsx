import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Scoreboard, WinnerBanner } from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import { MineGrid } from '../components/MineGrid';
import { isSolo, seatName, standings } from '../logic';
import type { MinesweeperAction, MinesweeperState } from '../logic';

const noop = () => {};

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<MinesweeperState, MinesweeperAction>) {
  const { t } = useTranslation();
  const s = state;
  const solo = isSolo(s);

  useEffect(() => {
    ctx.sound.play('win');
    ctx.sound.play('sparkle');
  }, [ctx]);

  const winnerNames = s.winnerIds.map((id) => seatName(s, id));
  const title =
    s.winReason === 'soloWin'
      ? t('mine.youFoundAll')
      : winnerNames.length > 1
        ? t('results.tie')
        : t('results.winner', { name: winnerNames[0] ?? '' });

  const seatColors: Record<string, string | undefined> = Object.fromEntries(
    s.seats.map((se) => [se.id, se.color]),
  );

  const rows: ScoreRow[] = standings(s).map((r) => ({
    id: r.id,
    label: r.name,
    score: r.score,
    rank: r.rank,
    color: r.color,
    display: t('mine.minesValue', { n: r.score }),
  }));

  return (
    <Screen>
      <AppBar title={t('results.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 pb-8">
        <WinnerBanner title={title} names={solo ? [] : winnerNames} tie={!solo && winnerNames.length > 1} />

        {!solo && <Scoreboard rows={rows} />}

        <div className="mx-auto w-full max-w-xs opacity-90">
          <MineGrid cells={s.board} cols={s.cols} disabled seatColors={seatColors} onReveal={noop} />
        </div>

        <div className="mt-1 flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); nav.playAgain(); }}>
            {t('mine.playAgain')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => nav.exit()}>
            {t('results.home')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
