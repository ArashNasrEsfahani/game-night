import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, Card, WinnerBanner } from '../../../sdk/ui';
import { ROLES } from '../roles';
import type { MafiaAction, MafiaState } from '../logic';

export function ResultsScreen({ state, ctx, nav }: GameScreenProps<MafiaState, MafiaAction>) {
  const { t } = useTranslation();
  const s = state;

  useEffect(() => {
    ctx.sound.play('win');
  }, [ctx]);

  const title =
    s.winner === 'town'
      ? t('mf.win.town')
      : s.winner === 'mafia'
        ? t('mf.win.mafia')
        : s.winner === 'jester'
          ? t('mf.win.jester')
          : t('mf.win.draw');

  return (
    <Screen>
      <AppBar title={t('results.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-4 pb-8">
        <WinnerBanner title={title} names={[]} />
        <div className="flex flex-col gap-2">
          {s.players.map((p) => {
            const role = ROLES[p.roleId];
            return (
              <Card key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="text-xl">{role.icon}</span>
                <span className="flex-1 font-medium">{s.playerNames[p.id] ?? p.id}</span>
                <span
                  className={`text-xs ${
                    role.faction === 'mafia'
                      ? 'text-[var(--color-game-rose-strong)]'
                      : role.faction === 'neutral'
                        ? 'text-[var(--color-game-gold-strong)]'
                        : 'text-[var(--text-muted)]'
                  }`}
                >
                  {ctx.localize(role.name)}
                </span>
                <span className="text-sm">{p.alive ? '🟢' : '💀'}</span>
              </Card>
            );
          })}
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <Button size="lg" fullWidth onClick={() => { ctx.sound.play('tap'); nav.playAgain(); }}>
            {t('mf.playAgain')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => nav.exit()}>
            {t('results.home')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}
