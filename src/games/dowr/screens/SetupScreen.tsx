import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat, TeamSetup } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper, Toggle, MotifDivider } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { asTeamId } from '../../../engine/ids';
import {
  DEFAULT_OPTIONS,
  DOWR_CATEGORIES,
  FUSE_CHOICES,
  BOMB_PENALTY_CHOICES,
  CHANGE_PENALTY_CHOICES,
  TIME_LIMIT_CHOICES,
  validateConfig,
} from '../config';
import type { DowrDifficultySel, DowrEndMode, DowrOptions } from '../config';
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

  const teamCount = Math.floor(seats.length / 2);
  const teams: TeamSetup = {
    mode: 'auto',
    teams: Array.from({ length: teamCount }, (_, i) => ({
      id: asTeamId(`t${i}`),
      name: `Team ${i + 1}`,
      memberIds: [seats[2 * i].id, seats[2 * i + 1].id],
    })),
  };

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

  const chip = (active: boolean) =>
    `rounded-full px-3 py-2 text-sm font-medium ${
      active
        ? 'bg-[var(--game-accent-strong)] text-[var(--game-on-accent)]'
        : 'bg-[var(--surface-2)] text-[var(--text)]'
    }`;

  return (
    <Screen>
      <AppBar title={t('dowr.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-5 pb-8">
        {/* Players → auto-paired into teams of two */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-muted)]">
              {t('common.players')} · {seats.length}
            </h2>
            {teamCount > 0 && (
              <span className="dp-accent text-xs font-semibold">
                {t('dowr.teamsPreview', { count: teamCount })}
              </span>
            )}
          </div>
          {players.length === 0 ? (
            <Button variant="secondary" onClick={() => navigate('/players')}>
              {t('players.add')}
            </Button>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    className={chip(selected.includes(p.id))}
                  >
                    {p.emoji ? `${p.emoji} ` : ''}
                    {p.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">{t('dowr.evenHint')}</p>
            </>
          )}
        </section>

        <MotifDivider motif="tar" />

        {/* Word packs */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('dowr.categories')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {DOWR_CATEGORIES.map((c) => (
              <button key={c} onClick={() => toggleCat(c)} className={chip(opts.categories.includes(c))}>
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

        <MotifDivider motif="boteh" />

        {/* Length + bomb settings */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('dowr.endMode')}</h2>
            <SegmentedControl<DowrEndMode>
              value={opts.endMode}
              onChange={(v) => set('endMode', v)}
              options={[
                { value: 'turns', label: t('dowr.endTurns') },
                { value: 'time', label: t('dowr.endTime') },
              ]}
            />
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              {opts.endMode === 'time' ? t('dowr.endTimeHint') : t('dowr.endTurnsHint')}
            </p>
          </div>

          {opts.endMode === 'turns' ? (
            <Stepper
              label={t('dowr.rounds')}
              value={opts.rounds}
              min={1}
              max={8}
              onChange={(v) => set('rounds', v)}
            />
          ) : (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('dowr.timeLimit')}</h2>
              <SegmentedControl<string>
                value={String(opts.timeLimitSeconds)}
                onChange={(v) => set('timeLimitSeconds', Number(v))}
                options={TIME_LIMIT_CHOICES.map((n) => ({ value: String(n), label: `${n / 60}m` }))}
              />
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('dowr.fuse')}</h2>
            <SegmentedControl<string>
              value={String(opts.fuseSeconds)}
              onChange={(v) => set('fuseSeconds', Number(v))}
              options={FUSE_CHOICES.map((n) => ({ value: String(n), label: `${n}s` }))}
            />
          </div>

          {/* Time penalties only matter when lowest-time wins (turns mode). */}
          {opts.endMode === 'turns' && (
            <>
              <div>
                <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
                  {t('dowr.bombPenalty')}
                </h2>
                <SegmentedControl<string>
                  value={String(opts.bombPenaltySeconds)}
                  onChange={(v) => set('bombPenaltySeconds', Number(v))}
                  options={BOMB_PENALTY_CHOICES.map((n) => ({ value: String(n), label: `+${n}s` }))}
                />
              </div>

              <div>
                <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
                  {t('dowr.changePenalty')}
                </h2>
                <SegmentedControl<string>
                  value={String(opts.changePenaltySeconds)}
                  onChange={(v) => set('changePenaltySeconds', Number(v))}
                  options={CHANGE_PENALTY_CHOICES.map((n) => ({
                    value: String(n),
                    label: n === 0 ? t('dowr.off') : `+${n}s`,
                  }))}
                />
              </div>
            </>
          )}

          <Toggle
            label={t('dowr.surpriseBomb')}
            checked={opts.surpriseBomb}
            onChange={(v) => set('surpriseBomb', v)}
          />
          <p className="-mt-2 text-xs text-[var(--text-muted)]">{t('dowr.surpriseBombHint')}</p>
        </section>

        <p className="text-sm text-[var(--text-muted)]">{t('dowr.poolHint', { count: poolSize })}</p>
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
