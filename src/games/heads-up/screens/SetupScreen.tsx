import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat, TeamSetup } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper, Toggle } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { asTeamId } from '../../../engine/ids';
import { DECK_LIST, DEFAULT_OPTIONS, ROUND_SECONDS_CHOICES, validateConfig } from '../config';
import type { HeadsUpMode, HeadsUpOptions } from '../config';
import type { HeadsUpAction, HeadsUpState } from '../logic';

export function SetupScreen({ ctx, nav }: GameScreenProps<HeadsUpState, HeadsUpAction>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const [opts, setOpts] = useState<HeadsUpOptions>({ ...DEFAULT_OPTIONS });
  const [selected, setSelected] = useState<string[]>(() => players.map((p) => p.id));

  function set<K extends keyof HeadsUpOptions>(k: K, v: HeadsUpOptions[K]) {
    setOpts((o) => ({ ...o, [k]: v }));
  }
  const toggleDeck = (id: string) =>
    set('deckIds', opts.deckIds.includes(id) ? opts.deckIds.filter((x) => x !== id) : [...opts.deckIds, id]);
  const togglePlayer = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const seats: PlayerSeat[] = players
    .filter((p) => selected.includes(p.id))
    .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color }));

  const teams: TeamSetup | undefined =
    opts.mode === 'teams'
      ? {
          mode: 'auto',
          teams: Array.from({ length: opts.teamCount }, (_, i) => ({
            id: asTeamId(`t${i}`),
            name: t('hu.teamName', { n: i + 1 }),
            memberIds: seats.filter((_, idx) => idx % opts.teamCount === i).map((s) => s.id),
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

  return (
    <Screen>
      <AppBar title={t('hu.title')} onBack={() => nav.exit()} />
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
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('hu.decks')}</h2>
          <div className="flex flex-wrap gap-2">
            {DECK_LIST.map((d) => (
              <button
                key={d.id}
                onClick={() => toggleDeck(d.id)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  opts.deckIds.includes(d.id)
                    ? 'bg-[var(--game-accent-strong)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                {d.icon} {ctx.localize(d.name)}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('hu.mode')}</h2>
          <SegmentedControl<HeadsUpMode>
            value={opts.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'solo', label: t('hu.solo') },
              { value: 'teams', label: t('hu.teams') },
            ]}
          />
        </section>

        {opts.mode === 'teams' && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('hu.teamCount')}</h2>
            <SegmentedControl<string>
              value={String(opts.teamCount)}
              onChange={(v) => set('teamCount', Number(v))}
              options={[
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4', label: '4' },
              ]}
            />
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('hu.roundTime')}</h2>
          <SegmentedControl<string>
            value={String(opts.roundSeconds)}
            onChange={(v) => set('roundSeconds', Number(v))}
            options={ROUND_SECONDS_CHOICES.map((s) => ({ value: String(s), label: `${s}s` }))}
          />
        </section>

        <section className="flex flex-col gap-4">
          <Stepper label={t('hu.roundsEach')} value={opts.rounds} min={1} max={5} onChange={(v) => set('rounds', v)} />
          <Toggle
            label={t('hu.passPenalty')}
            checked={opts.passPenalty === 1}
            onChange={(v) => set('passPenalty', v ? 1 : 0)}
          />
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
