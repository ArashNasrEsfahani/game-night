import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Toggle } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { DEFAULT_OPTIONS, validateConfig } from '../config';
import type { WyrMode, WyrOptions } from '../config';
import { DECKS, poolFor } from '../content';
import type { Intensity } from '../content';
import type { WyrAction, WyrState } from '../logic';

export function SetupScreen({ ctx, nav }: GameScreenProps<WyrState, WyrAction>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const [opts, setOpts] = useState<WyrOptions>({ ...DEFAULT_OPTIONS });
  const [selected, setSelected] = useState<string[]>(() => players.map((p) => p.id));

  function set<K extends keyof WyrOptions>(k: K, v: WyrOptions[K]) {
    setOpts((o) => ({ ...o, [k]: v }));
  }
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
  const poolSize = poolFor(opts.deckId, opts.maxIntensity).length;
  const lenChoices = [5, 10, 15, 20];

  return (
    <Screen>
      <AppBar title={t('wyr.title')} onBack={() => nav.exit()} />
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
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('wyr.deck')}</h2>
          <SegmentedControl<string>
            value={opts.deckId}
            onChange={(v) => set('deckId', v)}
            options={DECKS.map((d) => ({ value: d.id, label: ctx.localize(d.name) }))}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('wyr.intensityLabel')}
          </h2>
          <SegmentedControl<Intensity>
            value={opts.maxIntensity}
            onChange={(v) => set('maxIntensity', v)}
            options={[
              { value: 'mild', label: t('wyr.intensity.mild') },
              { value: 'medium', label: t('wyr.intensity.medium') },
              { value: 'spicy', label: t('wyr.intensity.spicy') },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('wyr.modeLabel')}</h2>
          <SegmentedControl<WyrMode>
            value={opts.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'vote', label: t('wyr.mode.vote') },
              { value: 'quick', label: t('wyr.mode.quick') },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('wyr.length')}</h2>
          <SegmentedControl<string>
            value={String(opts.roundLength >= 999 ? 'all' : opts.roundLength)}
            onChange={(v) => set('roundLength', v === 'all' ? 999 : Number(v))}
            options={[
              ...lenChoices.map((n) => ({ value: String(n), label: String(n) })),
              { value: 'all', label: t('wyr.all') },
            ]}
          />
        </section>

        <section className="flex flex-col gap-3">
          <Toggle
            label={t('wyr.awardPoints')}
            checked={opts.awardMajorityPoints}
            onChange={(v) => set('awardMajorityPoints', v)}
          />
          {opts.awardMajorityPoints && opts.mode === 'vote' && (
            <Toggle
              label={t('wyr.tieCountsForBoth')}
              checked={opts.tieCountsForBoth}
              onChange={(v) => set('tieCountsForBoth', v)}
            />
          )}
        </section>

        <p className="text-sm text-[var(--text-muted)]">{t('wyr.poolSize', { n: poolSize })}</p>
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
