import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat, TeamSetup } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper, Toggle } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { asTeamId } from '../../../engine/ids';
import {
  DEFAULT_OPTIONS,
  PANTOMIME_CATEGORIES,
  PANTOMIME_DIFFICULTIES,
  ROUND_SECONDS_CHOICES,
  validateConfig,
} from '../config';
import type { PantomimeEndMode, PantomimeOptions } from '../config';
import type { PantomimeCategory, PantomimeDifficulty } from '../content';
import { buildPool } from '../deck';
import type { PantomimeAction, PantomimeState } from '../logic';

export function SetupScreen({ ctx, nav }: GameScreenProps<PantomimeState, PantomimeAction>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const [opts, setOpts] = useState<PantomimeOptions>({ ...DEFAULT_OPTIONS });
  const [teamCount, setTeamCount] = useState(2);
  const [selected, setSelected] = useState<string[]>(() => players.map((p) => p.id));

  function set<K extends keyof PantomimeOptions>(k: K, v: PantomimeOptions[K]) {
    setOpts((o) => ({ ...o, [k]: v }));
  }
  const toggleCat = (c: PantomimeCategory) =>
    set(
      'categories',
      opts.categories.includes(c)
        ? opts.categories.filter((x) => x !== c)
        : [...opts.categories, c],
    );
  const toggleDiff = (d: PantomimeDifficulty) =>
    set(
      'difficulties',
      opts.difficulties.includes(d)
        ? opts.difficulties.filter((x) => x !== d)
        : [...opts.difficulties, d],
    );
  const togglePlayer = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const seats: PlayerSeat[] = players
    .filter((p) => selected.includes(p.id))
    .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color }));

  // Round-robin distribute the chosen players into `teamCount` teams.
  const teams: TeamSetup = {
    mode: 'auto',
    teams: Array.from({ length: teamCount }, (_, i) => ({
      id: asTeamId(`t${i}`),
      name: t('pantomime.teamName', { n: i + 1 }),
      memberIds: seats.filter((_, idx) => idx % teamCount === i).map((s) => s.id),
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
      <AppBar title={t('pantomime.title')} onBack={() => nav.exit()} />
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
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('pantomime.teams')}
          </h2>
          <SegmentedControl<'2' | '3' | '4'>
            value={String(teamCount) as '2' | '3' | '4'}
            onChange={(v) => setTeamCount(Number(v))}
            options={[
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('pantomime.categories')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {PANTOMIME_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => toggleCat(c)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  opts.categories.includes(c)
                    ? 'bg-[var(--game-accent-strong)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                {t(`pantomime.cat.${c}`)}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('pantomime.difficulty')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {PANTOMIME_DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => toggleDiff(d)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  opts.difficulties.includes(d)
                    ? 'bg-[var(--game-accent-strong)] text-white'
                    : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                {t(`pantomime.diff.${d}`)}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('pantomime.roundTime')}
          </h2>
          <SegmentedControl<string>
            value={String(opts.roundSeconds)}
            onChange={(v) => set('roundSeconds', Number(v))}
            options={ROUND_SECONDS_CHOICES.map((s) => ({ value: String(s), label: `${s}s` }))}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-muted)]">
            {t('pantomime.endModeLabel')}
          </h2>
          <SegmentedControl<PantomimeEndMode>
            value={opts.endMode}
            onChange={(v) => set('endMode', v)}
            options={[
              { value: 'targetScore', label: t('pantomime.endMode.targetScore') },
              { value: 'rounds', label: t('pantomime.endMode.rounds') },
            ]}
          />
          {opts.endMode === 'targetScore' ? (
            <Stepper
              label={t('pantomime.targetScore')}
              value={opts.targetScore}
              min={1}
              max={50}
              onChange={(v) => set('targetScore', v)}
            />
          ) : (
            <Stepper
              label={t('pantomime.totalRounds')}
              value={opts.totalRounds}
              min={1}
              max={20}
              onChange={(v) => set('totalRounds', v)}
            />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-muted)]">
            {t('pantomime.skips')}
          </h2>
          <SegmentedControl<string>
            value={String(opts.maxSkipsPerTurn)}
            onChange={(v) => set('maxSkipsPerTurn', Number(v))}
            options={[
              { value: '0', label: '0' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '-1', label: '∞' },
            ]}
          />
          <Toggle
            label={t('pantomime.skipPenalty')}
            checked={opts.skipPenalty}
            onChange={(v) => set('skipPenalty', v)}
          />
        </section>

        <p className="text-sm text-[var(--text-muted)]">
          {t('pantomime.poolHint', { count: poolSize })}
        </p>
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
