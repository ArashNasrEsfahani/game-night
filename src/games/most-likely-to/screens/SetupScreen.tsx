import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper, Toggle } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { DEFAULT_OPTIONS, validateConfig } from '../config';
import type { MltOptions, TieBreak, VotingStyle } from '../config';
import { DECKS, getPool } from '../content';
import type { Intensity } from '../content';
import type { MltAction, MltState } from '../logic';

export function SetupScreen({ ctx, nav }: GameScreenProps<MltState, MltAction>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const [opts, setOpts] = useState<MltOptions>({ ...DEFAULT_OPTIONS });
  const [selected, setSelected] = useState<string[]>(() => players.map((p) => p.id));

  function set<K extends keyof MltOptions>(k: K, v: MltOptions[K]) {
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
  const poolSize = getPool({ deckId: opts.deckId, intensity: opts.intensity }).length;

  return (
    <Screen>
      <AppBar title={t('mlt.title')} onBack={() => nav.exit()} />
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
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('mlt.deck')}</h2>
          <SegmentedControl<string>
            value={opts.deckId}
            onChange={(v) => set('deckId', v)}
            options={DECKS.map((d) => ({ value: d.id, label: ctx.localize(d.name) }))}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('mlt.intensityLabel')}
          </h2>
          <SegmentedControl<Intensity>
            value={opts.intensity}
            onChange={(v) => set('intensity', v)}
            options={[
              { value: 'family', label: t('mlt.intensity.family') },
              { value: 'casual', label: t('mlt.intensity.casual') },
              { value: 'spicy', label: t('mlt.intensity.spicy') },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('mlt.votingStyle')}
          </h2>
          <SegmentedControl<VotingStyle>
            value={opts.votingStyle}
            onChange={(v) => set('votingStyle', v)}
            options={[
              { value: 'pass-device', label: t('mlt.style.passDevice') },
              { value: 'simultaneous', label: t('mlt.style.simultaneous') },
            ]}
          />
        </section>

        <section className="flex flex-col gap-4">
          <Stepper
            label={t('mlt.rounds')}
            value={Math.min(opts.roundCount, Math.max(1, poolSize))}
            min={1}
            max={Math.max(1, poolSize)}
            onChange={(v) => set('roundCount', v)}
          />
          <Toggle
            label={t('mlt.allowSelfVote')}
            checked={opts.allowSelfVote}
            onChange={(v) => set('allowSelfVote', v)}
          />
          <div>
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
              {t('mlt.tieBreakLabel')}
            </h2>
            <SegmentedControl<TieBreak>
              value={opts.tieBreak}
              onChange={(v) => set('tieBreak', v)}
              options={[
                { value: 'co-winners', label: t('mlt.tie.coWinners') },
                { value: 'random', label: t('mlt.tie.random') },
              ]}
            />
          </div>
        </section>

        <p className="text-sm text-[var(--text-muted)]">{t('mlt.poolHint', { count: poolSize })}</p>
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
