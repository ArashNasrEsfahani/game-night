import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SetupErrors, SegmentedControl, Toggle, Disclosure } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { PlayerPicker } from '../../../app/components/PlayerPicker';
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

        {/* Always visible: primary choice — deck */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('wyr.deck')}</h2>
          <SegmentedControl<string>
            value={opts.deckId}
            onChange={(v) => set('deckId', v)}
            options={DECKS.map((d) => ({ value: d.id, label: ctx.localize(d.name) }))}
          />
        </section>

        {/* Collapsible: everything else */}
        <Disclosure title={t('common.moreOptions')} summary={t('common.moreOptionsHint')}>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('wyr.intensityLabel')}</span>
            <SegmentedControl<Intensity>
              value={opts.maxIntensity}
              onChange={(v) => set('maxIntensity', v)}
              options={[
                { value: 'mild', label: t('wyr.intensity.mild') },
                { value: 'medium', label: t('wyr.intensity.medium') },
                { value: 'spicy', label: t('wyr.intensity.spicy') },
                { value: 'risky', label: t('wyr.intensity.risky') },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('wyr.modeLabel')}</span>
            <SegmentedControl<WyrMode>
              value={opts.mode}
              onChange={(v) => set('mode', v)}
              options={[
                { value: 'vote', label: t('wyr.mode.vote') },
                { value: 'quick', label: t('wyr.mode.quick') },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('wyr.length')}</span>
            <SegmentedControl<string>
              value={String(opts.roundLength >= 999 ? 'all' : opts.roundLength)}
              onChange={(v) => set('roundLength', v === 'all' ? 999 : Number(v))}
              options={[
                ...lenChoices.map((n) => ({ value: String(n), label: String(n) })),
                { value: 'all', label: t('wyr.all') },
              ]}
            />
          </div>

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
        </Disclosure>

        <p className="text-sm text-[var(--text-muted)]">{t('wyr.poolSize', { n: poolSize })}</p>
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
