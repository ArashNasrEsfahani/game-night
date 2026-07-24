import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SetupErrors, SegmentedControl, Stepper, Toggle, Disclosure, SelectChip } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { PlayerPicker } from '../../../app/components/PlayerPicker';
import { DEFAULT_OPTIONS, validateConfig } from '../config';
import type { EndType, PrivateReveal, ScoringMode, SelectionMode, ToDOptions } from '../config';
import { INTENSITIES } from '../content';
import type { Intensity } from '../content';
import type { ToDAction, ToDState } from '../logic';

export function SetupScreen({ ctx, nav }: GameScreenProps<ToDState, ToDAction>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const [opts, setOpts] = useState<ToDOptions>({ ...DEFAULT_OPTIONS });
  const [selected, setSelected] = useState<string[]>(() => players.map((p) => p.id));

  function set<K extends keyof ToDOptions>(k: K, v: ToDOptions[K]) {
    setOpts((o) => ({ ...o, [k]: v }));
  }
  const toggleIntensity = (i: Intensity) =>
    set('intensities', { ...opts.intensities, [i]: !opts.intensities[i] });
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
      <AppBar title={t('tod.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-5 pb-8">
        {/* Always visible: players */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('common.playersCount', { count: seats.length })}
          </h2>
          <PlayerPicker
            selected={selected}
            onToggle={togglePlayer}
            onManageAll={() => navigate('/players')}
          />
        </section>

        {/* Always visible: primary choice — intensity tiers (multi-select) */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('tod.intensity')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {INTENSITIES.map((i) => (
              <SelectChip
                key={i}
                selected={opts.intensities[i]}
                onClick={() => toggleIntensity(i)}
              >
                {t(`tod.intensityName.${i}`)}
              </SelectChip>
            ))}
          </div>
        </section>

        {/* Collapsible: everything else */}
        <Disclosure title={t('common.moreOptions')} summary={t('common.moreOptionsHint')}>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('tod.selection')}</span>
            <SegmentedControl<SelectionMode>
              value={opts.selectionMode}
              onChange={(v) => set('selectionMode', v)}
              options={[
                { value: 'spinner', label: t('tod.sel.spinner') },
                { value: 'bottle', label: t('tod.sel.bottle') },
                { value: 'sequential', label: t('tod.sel.sequential') },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('tod.scoring')}</span>
            <SegmentedControl<ScoringMode>
              value={opts.scoringMode}
              onChange={(v) => set('scoringMode', v)}
              options={[
                { value: 'casual', label: t('tod.score.casual') },
                { value: 'points', label: t('tod.score.points') },
              ]}
            />
          </div>

          {opts.scoringMode === 'points' && (
            <>
              <Stepper label={t('tod.pointsForDare')} value={opts.pointsForDare} min={0} max={10} onChange={(v) => set('pointsForDare', v)} />
              <Stepper label={t('tod.pointsForTruth')} value={opts.pointsForTruth} min={0} max={10} onChange={(v) => set('pointsForTruth', v)} />
              <Stepper label={t('tod.pointsForSkip')} value={opts.pointsForSkip} min={0} max={10} onChange={(v) => set('pointsForSkip', v)} />
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('tod.endLabel')}</span>
            <SegmentedControl<EndType>
              value={opts.endType}
              onChange={(v) => set('endType', v)}
              options={[
                { value: 'endless', label: t('tod.end.endless') },
                { value: 'rounds', label: t('tod.end.rounds') },
                ...(opts.scoringMode === 'points' ? [{ value: 'target' as EndType, label: t('tod.end.target') }] : []),
              ]}
            />
            {opts.endType !== 'endless' && (
              <Stepper
                label={opts.endType === 'rounds' ? t('tod.roundsCount') : t('tod.targetPoints')}
                value={opts.endValue}
                min={1}
                max={50}
                onChange={(v) => set('endValue', v)}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('tod.privacy')}</span>
            <SegmentedControl<PrivateReveal>
              value={opts.privateReveal}
              onChange={(v) => set('privateReveal', v)}
              options={[
                { value: 'never', label: t('tod.priv.never') },
                { value: 'spicyOnly', label: t('tod.priv.spicy') },
                { value: 'always', label: t('tod.priv.always') },
              ]}
            />
          </div>

          <Toggle
            label={t('tod.avoidRepeat')}
            checked={opts.avoidImmediateRepeat}
            onChange={(v) => set('avoidImmediateRepeat', v)}
          />
        </Disclosure>

        <SetupErrors errors={errors} />
        <Button
          size="lg"
          fullWidth
          disabled={!!errors}
          onClick={() => {
            ctx.sound.play('tap');
            nav.startMatch(config);
          }}
        >
          {t('common.start')}
        </Button>
      </div>
    </Screen>
  );
}
