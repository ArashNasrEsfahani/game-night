import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat, TeamSetup } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper, Toggle, MotifDivider, Disclosure, SelectChip } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { PlayerPicker } from '../../../app/components/PlayerPicker';
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

  return (
    <Screen>
      <AppBar title={t('dowr.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-5 pb-8">
        {/* Always visible: Players */}
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
          <PlayerPicker
            selected={selected}
            onToggle={togglePlayer}
            onManageAll={() => navigate('/players')}
          />
          <p className="mt-2 text-xs text-[var(--text-muted)]">{t('dowr.evenHint')}</p>
        </section>

        <MotifDivider motif="tar" />

        {/* Always visible: Word packs */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('dowr.categories')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {DOWR_CATEGORIES.map((c) => (
              <SelectChip
                key={c}
                selected={opts.categories.includes(c)}
                onClick={() => toggleCat(c)}
              >
                {t(`dowr.cat.${c}`)}
              </SelectChip>
            ))}
          </div>
        </section>

        {/* More options: everything else */}
        <Disclosure title={t('common.moreOptions')} summary={t('common.moreOptionsHint')}>
          {/* Difficulty */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('dowr.difficulty')}</span>
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
          </div>

          {/* End mode */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('dowr.endMode')}</span>
            <SegmentedControl<DowrEndMode>
              value={opts.endMode}
              onChange={(v) => set('endMode', v)}
              options={[
                { value: 'turns', label: t('dowr.endTurns') },
                { value: 'time', label: t('dowr.endTime') },
              ]}
            />
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
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-[var(--text)]">{t('dowr.timeLimit')}</span>
              <SegmentedControl<string>
                value={String(opts.timeLimitSeconds)}
                onChange={(v) => set('timeLimitSeconds', Number(v))}
                options={TIME_LIMIT_CHOICES.map((n) => ({ value: String(n), label: `${n / 60}m` }))}
              />
            </div>
          )}

          {/* Fuse */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('dowr.fuse')}</span>
            <SegmentedControl<string>
              value={String(opts.fuseSeconds)}
              onChange={(v) => set('fuseSeconds', Number(v))}
              options={FUSE_CHOICES.map((n) => ({ value: String(n), label: `${n}s` }))}
            />
          </div>

          {/* Time penalties (turns mode only) */}
          {opts.endMode === 'turns' && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-[var(--text)]">{t('dowr.bombPenalty')}</span>
                <SegmentedControl<string>
                  value={String(opts.bombPenaltySeconds)}
                  onChange={(v) => set('bombPenaltySeconds', Number(v))}
                  options={BOMB_PENALTY_CHOICES.map((n) => ({ value: String(n), label: `+${n}s` }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-[var(--text)]">{t('dowr.changePenalty')}</span>
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
        </Disclosure>

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
