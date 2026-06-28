import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { GameScreenProps, Lang } from '../../../sdk/types';
import { Screen, AppBar, Button, WinnerBanner } from '../../../sdk/ui';
import type { BoardCell, CardRole, CodenamesAction, CodenamesState } from '../logic';

function roleClass(role: CardRole): string {
  switch (role) {
    case 'teamA':
      return 'bg-[var(--color-game-rose-strong)] text-white';
    case 'teamB':
      return 'bg-[var(--color-game-sky-strong)] text-white';
    case 'neutral':
      return 'bg-[var(--color-game-gold)] text-[var(--on-gold)]';
    case 'assassin':
      return 'bg-[var(--color-assassin)] text-white';
  }
}

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<CodenamesState, CodenamesAction>) {
  const { t } = useTranslation();
  const s = state;
  const lang: Lang = ctx.lang;

  useEffect(() => {
    ctx.sound.play(s.winner ? 'win' : 'lose');
    if (s.winner) ctx.sound.play('sparkle');
  }, [ctx, s.winner]);

  const winnerName = s.winner ? s.teamMeta[s.winner].name : '';
  // winReason is null only for a manual early end (every natural game over sets it), so we show a
  // tie title when nobody led and skip the reason line rather than printing a misleading "cleared".
  const title = s.winner ? t('cn.teamWins', { team: winnerName }) : t('results.tie');
  const reasonKey =
    s.winReason === 'opponentHitAssassin'
      ? 'cn.winAssassin'
      : s.winReason === 'clearedWords'
        ? 'cn.winCleared'
        : null;

  return (
    <Screen>
      <AppBar title={t('results.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 pb-8">
        <WinnerBanner title={title} names={reasonKey ? [t(reasonKey)] : []} />
        <div className="grid grid-cols-5 gap-1.5" style={{ perspective: 700 }}>
          {s.board.map((c: BoardCell) => (
            <motion.div
              key={c.index}
              initial={{ opacity: 0, scale: 0.6, rotateY: 90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: Math.min(c.index * 0.02, 0.5) }}
              className={`flex aspect-square items-center justify-center rounded-lg p-1 text-center text-[10px] font-bold leading-tight shadow-[inset_0_1px_0_rgb(255_255_255/0.25),inset_0_-3px_5px_rgb(0_0_0/0.16)] ${roleClass(c.role)}`}
            >
              {c.word[lang]}
            </motion.div>
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); nav.playAgain(); }}>
            {t('cn.rematch')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => nav.exit()}>
            {t('results.home')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
