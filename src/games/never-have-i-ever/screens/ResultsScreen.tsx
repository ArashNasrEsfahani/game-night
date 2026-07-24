import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Scoreboard, WinnerBanner } from '../../../sdk/ui';
import type { ScoreRow } from '../../../sdk/ui';
import { rankPlayers } from '../logic';
import type { NhieAction, NhieState } from '../logic';

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<NhieState, NhieAction>) {
  const { t } = useTranslation();
  const s = state;

  useEffect(() => {
    ctx.sound.play('win');
  }, [ctx]);

  const winnerNames = s.winnerIds.map((id) => s.playerNames[id] ?? id);
  const title =
    s.winnerIds.length > 1
      ? t('results.tie')
      : t('results.winner', { name: winnerNames[0] ?? '' });

  const ranked = rankPlayers(s);
  const classic = s.options.mode === 'classic';
  const rows: ScoreRow[] = ranked.map((p, i) => ({
    id: p.id,
    label: s.playerNames[p.id] ?? p.id,
    // Classic: lives remaining (higher = better). Points: confessions (lower = better).
    score: classic ? p.lives : p.haveCount,
    rank: i + 1,
  }));

  return (
    <Screen>
      <AppBar title={t('results.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 pb-8">
        <WinnerBanner title={title} names={winnerNames} tie={s.winnerIds.length > 1} />
        <p className="text-center text-sm text-[var(--text-muted)]">
          {classic ? t('nhie.livesLeft') : t('nhie.confessionsLabel')}
        </p>
        <Scoreboard rows={rows} />
        <div className="mt-2 flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); nav.playAgain(); }}>
            {t('nhie.rematch')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => nav.exit()}>
            {t('results.home')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
