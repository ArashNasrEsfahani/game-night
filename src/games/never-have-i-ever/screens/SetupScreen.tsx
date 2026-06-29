import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SetupErrors, SegmentedControl, Stepper, Disclosure, SelectChip } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { PlayerPicker } from '../../../app/components/PlayerPicker';
import { DEFAULT_OPTIONS, validateConfig } from '../config';
import type { NhieMode, NhieOptions, RevealMode } from '../config';
import { INTENSITIES, getDeck } from '../content';
import type { Intensity } from '../content';
import type { NhieAction, NhieState } from '../logic';

export function SetupScreen({ ctx, nav }: GameScreenProps<NhieState, NhieAction>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const [opts, setOpts] = useState<NhieOptions>({ ...DEFAULT_OPTIONS });
  const [selected, setSelected] = useState<string[]>(() => players.map((p) => p.id));

  function set<K extends keyof NhieOptions>(k: K, v: NhieOptions[K]) {
    setOpts((o) => ({ ...o, [k]: v }));
  }
  const toggleIntensity = (i: Intensity) =>
    set(
      'intensities',
      opts.intensities.includes(i)
        ? opts.intensities.filter((x) => x !== i)
        : [...opts.intensities, i],
    );
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
  const poolSize = getDeck({ intensities: opts.intensities }).length;

  return (
    <Screen>
      <AppBar title={t('nhie.title')} onBack={() => nav.exit()} />
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

        {/* Always visible: mode (the primary gameplay choice) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-[var(--text)]">{t('nhie.modeLabel')}</span>
          <SegmentedControl<NhieMode>
            value={opts.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'classic', label: t('nhie.mode.classic') },
              { value: 'points', label: t('nhie.mode.points') },
            ]}
          />
        </div>

        {/* More options disclosure */}
        <Disclosure title={t('common.moreOptions')} summary={t('common.moreOptionsHint')}>
          {/* Answer style */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('nhie.answerStyle')}</span>
            <SegmentedControl<RevealMode>
              value={opts.revealMode}
              onChange={(v) => set('revealMode', v)}
              options={[
                { value: 'sequential', label: t('nhie.answer.sequential') },
                { value: 'honor', label: t('nhie.answer.honor') },
              ]}
            />
          </div>

          {/* Intensity chips */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('nhie.intensityLabel')}</span>
            <div className="flex flex-wrap gap-2">
              {INTENSITIES.map((i) => (
                <SelectChip
                  key={i}
                  selected={opts.intensities.includes(i)}
                  onClick={() => toggleIntensity(i)}
                >
                  {t(`nhie.intensity.${i}`)}
                </SelectChip>
              ))}
            </div>
          </div>

          {/* Lives (classic mode only) */}
          {opts.mode === 'classic' && (
            <Stepper
              label={t('nhie.lives')}
              value={opts.startingLives}
              min={1}
              max={20}
              onChange={(v) => set('startingLives', v)}
            />
          )}

          {/* Statements */}
          <Stepper
            label={t('nhie.statements')}
            value={opts.deckSize}
            min={1}
            max={Math.max(1, poolSize)}
            onChange={(v) => set('deckSize', v)}
          />
        </Disclosure>

        <p className="text-sm text-[var(--text-muted)]">{t('nhie.deckCount', { n: poolSize })}</p>
        <SetupErrors errors={errors} />
        <Button size="lg" fullWidth disabled={!!errors} onClick={() => { ctx.sound.play('tap'); nav.startMatch(config); }}>
          {t('common.start')}
        </Button>
      </div>
    </Screen>
  );
}
