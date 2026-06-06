import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat, TeamSetup } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper, Toggle } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { PlayerPicker } from '../../../app/components/PlayerPicker';
import { asTeamId } from '../../../engine/ids';
import { DECK_LIST, DEFAULT_OPTIONS, ROUND_SECONDS_CHOICES, validateConfig } from '../config';
import type { HeadsUpMode, HeadsUpOptions } from '../config';
import { DIFFICULTIES, deckDifficultyCounts } from '../content';
import type { Difficulty } from '../content';
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
  const toggleDifficulty = (d: Difficulty) =>
    set('difficulties', { ...opts.difficulties, [d]: !opts.difficulties[d] });
  const togglePlayer = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const diffCounts = deckDifficultyCounts(opts.deckIds);

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
          <PlayerPicker
            selected={selected}
            onToggle={togglePlayer}
            onManageAll={() => navigate('/players')}
          />
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
                    ? 'bg-[var(--game-accent-strong)] text-[var(--game-on-accent)]'
                    : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                {d.icon} {ctx.localize(d.name)}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('hu.difficulty')}</h2>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => toggleDifficulty(d)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  opts.difficulties[d]
                    ? 'bg-[var(--game-accent-strong)] text-[var(--game-on-accent)]'
                    : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                {t(`hu.diff.${d}`)} · {diffCounts[d]}
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
          <Toggle label={t('hu.recycle')} checked={opts.recycleDeck} onChange={(v) => set('recycleDeck', v)} />
          <Toggle label={t('hu.motion')} checked={opts.motionEnabled} onChange={(v) => set('motionEnabled', v)} />
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
