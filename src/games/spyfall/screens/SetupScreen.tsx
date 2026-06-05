import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper, Toggle } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { DEFAULT_OPTIONS, PACK_LIST, ROUND_SECONDS_CHOICES, maxSpies, validateConfig } from '../config';
import type { SpyfallOptions } from '../config';
import type { SpyfallAction, SpyfallState } from '../logic';

export function SetupScreen({ ctx, nav }: GameScreenProps<SpyfallState, SpyfallAction>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const [opts, setOpts] = useState<SpyfallOptions>({ ...DEFAULT_OPTIONS });
  const [selected, setSelected] = useState<string[]>(() => players.map((p) => p.id));

  function set<K extends keyof SpyfallOptions>(k: K, v: SpyfallOptions[K]) {
    setOpts((o) => ({ ...o, [k]: v }));
  }
  const togglePlayer = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const togglePack = (id: string) =>
    set(
      'enabledPackIds',
      opts.enabledPackIds.includes(id)
        ? opts.enabledPackIds.filter((x) => x !== id)
        : [...opts.enabledPackIds, id],
    );

  const seats: PlayerSeat[] = players
    .filter((p) => selected.includes(p.id))
    .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color }));

  const cap = maxSpies(Math.max(3, seats.length));
  const config: GameConfig = {
    players: seats,
    options: { ...opts, spyCount: Math.min(opts.spyCount, cap) } as unknown as Record<string, unknown>,
    lang: ctx.lang,
  };
  const errors = validateConfig(config);

  return (
    <Screen>
      <AppBar title={t('spy.title')} onBack={() => nav.exit()} />
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
                      ? 'bg-[var(--game-accent-strong)] text-[var(--game-on-accent)]'
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

        <section className="flex flex-col gap-4">
          <Stepper label={t('spy.spies')} value={Math.min(opts.spyCount, cap)} min={1} max={cap} onChange={(v) => set('spyCount', v)} />
          <Stepper label={t('spy.rounds')} value={opts.totalRounds} min={1} max={10} onChange={(v) => set('totalRounds', v)} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('spy.roundTime')}</h2>
          <SegmentedControl<string>
            value={String(opts.roundSeconds)}
            onChange={(v) => set('roundSeconds', Number(v))}
            options={ROUND_SECONDS_CHOICES.map((s) => ({ value: String(s), label: `${Math.round(s / 60)}m` }))}
          />
        </section>

        {PACK_LIST.length > 1 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('spy.packs')}</h2>
            <div className="flex flex-wrap gap-2">
              {PACK_LIST.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePack(p.id)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    opts.enabledPackIds.includes(p.id)
                      ? 'bg-[var(--game-accent-strong)] text-[var(--game-on-accent)]'
                      : 'bg-[var(--surface-2)] text-[var(--text)]'
                  }`}
                >
                  {ctx.localize(p.name)}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <Toggle label={t('spy.useTimer')} checked={opts.useTimer} onChange={(v) => set('useTimer', v)} />
          <Toggle label={t('spy.allowGuess')} checked={opts.allowSpyGuess} onChange={(v) => set('allowSpyGuess', v)} />
        </section>

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
