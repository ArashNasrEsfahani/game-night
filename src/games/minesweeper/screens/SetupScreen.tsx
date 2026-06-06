import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper, Disclosure } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { PlayerPicker } from '../../../app/components/PlayerPicker';
import { DEFAULT_OPTIONS, PRESETS, validateConfig } from '../config';
import type { MineDifficulty, MinesweeperOptions } from '../config';
import type { MinesweeperAction, MinesweeperState } from '../logic';

export function SetupScreen({ ctx, nav }: GameScreenProps<MinesweeperState, MinesweeperAction>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const [opts, setOpts] = useState<MinesweeperOptions>({ ...DEFAULT_OPTIONS });
  const [selected, setSelected] = useState<string[]>(() => players.slice(0, 4).map((p) => p.id));

  function set<K extends keyof MinesweeperOptions>(k: K, v: MinesweeperOptions[K]) {
    setOpts((o) => ({ ...o, [k]: v }));
  }
  const setDifficulty = (d: MineDifficulty) =>
    setOpts((o) => (d === 'custom' ? { ...o, difficulty: 'custom' } : { ...o, difficulty: d, ...PRESETS[d] }));
  const setCols = (cols: number) => setOpts((o) => ({ ...o, cols, mines: Math.min(o.mines, cols * o.rows - 9) }));
  const setRows = (rows: number) => setOpts((o) => ({ ...o, rows, mines: Math.min(o.mines, o.cols * rows - 9) }));

  const togglePlayer = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const seats: PlayerSeat[] = players
    .filter((p) => selected.includes(p.id))
    .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color }));

  const config: GameConfig = {
    players: seats,
    options: opts as unknown as Record<string, unknown>,
    lang: ctx.lang,
  };
  const errors = validateConfig(config);

  return (
    <Screen>
      <AppBar title={t('mine.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-5 pb-8">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('common.players')} · {seats.length}
          </h2>
          <PlayerPicker
            selected={selected}
            onToggle={togglePlayer}
            onManageAll={() => navigate('/players')}
          />
        </section>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-[var(--text)]">{t('mine.difficulty')}</span>
          <SegmentedControl<MineDifficulty>
            value={opts.difficulty}
            onChange={setDifficulty}
            options={[
              { value: 'easy', label: t('mine.diff.easy') },
              { value: 'medium', label: t('mine.diff.medium') },
              { value: 'hard', label: t('mine.diff.hard') },
              { value: 'custom', label: t('mine.diff.custom') },
            ]}
          />
        </div>

        <Disclosure title={t('common.moreOptions')} summary={t('common.moreOptionsHint')}>
          {opts.difficulty === 'custom' && (
            <>
              <Stepper label={t('mine.cols')} value={opts.cols} min={6} max={14} onChange={setCols} />
              <Stepper label={t('mine.rows')} value={opts.rows} min={6} max={18} onChange={setRows} />
              <Stepper
                label={t('mine.mines')}
                value={opts.mines}
                min={1}
                max={opts.cols * opts.rows - 9}
                onChange={(v) => set('mines', v)}
              />
            </>
          )}

          <span className="text-xs text-[var(--text-muted)]">
            {t('mine.boardHint', { mines: opts.mines, cols: opts.cols, rows: opts.rows })}
          </span>
        </Disclosure>

        {errors && (
          <ul className="text-sm text-[var(--color-game-rose-strong)]">
            {errors.map((e, i) => (
              <li key={i}>{ctx.localize(e)}</li>
            ))}
          </ul>
        )}
        <Button size="lg" fullWidth disabled={!!errors} onClick={() => { ctx.sound.play('tap'); nav.startMatch(config); }}>
          {t('common.start')}
        </Button>
      </div>
    </Screen>
  );
}
