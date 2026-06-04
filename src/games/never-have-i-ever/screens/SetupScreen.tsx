import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
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
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('nhie.modeLabel')}</h2>
          <SegmentedControl<NhieMode>
            value={opts.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'classic', label: t('nhie.mode.classic') },
              { value: 'points', label: t('nhie.mode.points') },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('nhie.answerStyle')}
          </h2>
          <SegmentedControl<RevealMode>
            value={opts.revealMode}
            onChange={(v) => set('revealMode', v)}
            options={[
              { value: 'sequential', label: t('nhie.answer.sequential') },
              { value: 'honor', label: t('nhie.answer.honor') },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('nhie.intensityLabel')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {INTENSITIES.map((i) => (
              <button
                key={i}
                onClick={() => toggleIntensity(i)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  opts.intensities.includes(i)
                    ? 'bg-[var(--game-accent-strong)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                {t(`nhie.intensity.${i}`)}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          {opts.mode === 'classic' && (
            <Stepper
              label={t('nhie.lives')}
              value={opts.startingLives}
              min={1}
              max={20}
              onChange={(v) => set('startingLives', v)}
            />
          )}
          <Stepper
            label={t('nhie.statements')}
            value={opts.deckSize}
            min={1}
            max={Math.max(1, poolSize)}
            onChange={(v) => set('deckSize', v)}
          />
        </section>

        <p className="text-sm text-[var(--text-muted)]">{t('nhie.deckCount', { n: poolSize })}</p>
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
