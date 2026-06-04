import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat, TeamSetup } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper, Toggle } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { asTeamId } from '../../../engine/ids';
import { DEFAULT_OPTIONS, DOWR_CATEGORIES, validateConfig } from '../config';
import type { DowrDifficultySel, DowrMode, DowrOptions } from '../config';
import type { DowrCategory } from '../content';
import { buildPool } from '../deck';
import type { DowrAction, DowrState } from '../logic';

export function SetupScreen({ ctx, nav }: GameScreenProps<DowrState, DowrAction>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const [opts, setOpts] = useState<DowrOptions>({ ...DEFAULT_OPTIONS });
  const [selected, setSelected] = useState<string[]>(() => players.map((p) => p.id));

  function set<K extends keyof DowrOptions>(k: K, v: DowrOptions[K]) {
    setOpts((o) => ({ ...o, [k]: v }));
  }
  const toggleCat = (c: DowrCategory) =>
    set(
      'categories',
      opts.categories.includes(c)
        ? opts.categories.filter((x) => x !== c)
        : [...opts.categories, c],
    );
  const togglePlayer = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const seats: PlayerSeat[] = players
    .filter((p) => selected.includes(p.id))
    .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color }));

  const teams: TeamSetup | undefined =
    opts.mode === 'teams'
      ? {
          mode: 'auto',
          teams: Array.from({ length: Math.floor(seats.length / 2) }, (_, i) => ({
            id: asTeamId(`t${i}`),
            name: `Team ${i + 1}`,
            memberIds: [seats[2 * i].id, seats[2 * i + 1].id],
          })),
        }
      : undefined;

  const config: GameConfig = {
    players: seats,
    teams,
    options: opts as unknown as Record<string, unknown>,
    lang: ctx.lang,
  };
  const errors = validateConfig(config);
  const poolSize = buildPool(opts).length;

  const start = () => {
    ctx.sound.play('tap');
    nav.startMatch(config);
  };

  return (
    <Screen>
      <AppBar title={t('dowr.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-5 pb-8">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('dowr.mode')}</h2>
          <SegmentedControl<DowrMode>
            value={opts.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'teams', label: t('dowr.teams') },
              { value: 'solo', label: t('dowr.solo') },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('common.players')} · {seats.length}
          </h2>
          {players.length === 0 ? (
            <Button variant="secondary" onClick={() => navigate('/players')}>
              {t('players.add')}
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id)}
                  className={`rounded-full px-3 py-2 text-sm font-medium ${
                    selected.includes(p.id)
                      ? 'bg-[var(--game-accent-strong)] text-white'
                      : 'bg-[var(--surface-2)] text-[var(--text)]'
                  }`}
                >
                  {p.emoji ? `${p.emoji} ` : ''}
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('dowr.categories')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {DOWR_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => toggleCat(c)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  opts.categories.includes(c)
                    ? 'bg-[var(--game-accent-strong)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                {t(`dowr.cat.${c}`)}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('dowr.difficulty')}
          </h2>
          <SegmentedControl<DowrDifficultySel>
            value={opts.difficulty}
            onChange={(v) => set('difficulty', v)}
            options={[
              { value: 'random', label: t('dowr.random') },
              { value: 'easy', label: t('dowr.easy') },
              { value: 'med', label: t('dowr.med') },
              { value: 'hard', label: t('dowr.hard') },
            ]}
          />
        </section>

        <section className="flex flex-col gap-4">
          <Stepper
            label={t('dowr.rounds')}
            value={opts.rounds}
            min={1}
            max={10}
            onChange={(v) => set('rounds', v)}
          />
          <div>
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('dowr.timer')}</h2>
            <SegmentedControl<'60' | '120'>
              value={String(opts.timerSeconds) as '60' | '120'}
              onChange={(v) => set('timerSeconds', Number(v) as 60 | 120)}
              options={[
                { value: '60', label: '60s' },
                { value: '120', label: '120s' },
              ]}
            />
          </div>
          <Toggle
            label={t('dowr.skipPenalty')}
            checked={opts.skipPenalty}
            onChange={(v) => set('skipPenalty', v)}
          />
        </section>

        <p className="text-sm text-[var(--text-muted)]">
          {t('dowr.poolHint', { count: poolSize })}
        </p>
        {errors && (
          <ul className="text-sm text-[var(--color-game-rose-strong)]">
            {errors.map((e, i) => (
              <li key={i}>{ctx.localize(e)}</li>
            ))}
          </ul>
        )}
        <Button size="lg" fullWidth disabled={!!errors} onClick={start}>
          {t('common.start')}
        </Button>
      </div>
    </Screen>
  );
}
