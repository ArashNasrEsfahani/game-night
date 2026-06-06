import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat, TeamSetup } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Toggle } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { PlayerPicker } from '../../../app/components/PlayerPicker';
import { asTeamId } from '../../../engine/ids';
import { DEFAULT_OPTIONS, PACK_LIST, validateConfig } from '../config';
import type { CodenamesMode, CodenamesOptions, StartingTeam } from '../config';
import type { CodenamesAction, CodenamesState } from '../logic';

export function SetupScreen({ ctx, nav }: GameScreenProps<CodenamesState, CodenamesAction>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const [opts, setOpts] = useState<CodenamesOptions>({ ...DEFAULT_OPTIONS });
  const [selected, setSelected] = useState<string[]>(() => players.map((p) => p.id));

  function set<K extends keyof CodenamesOptions>(k: K, v: CodenamesOptions[K]) {
    setOpts((o) => ({ ...o, [k]: v }));
  }
  const togglePlayer = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const togglePack = (id: string) =>
    set('packIds', opts.packIds.includes(id) ? opts.packIds.filter((x) => x !== id) : [...opts.packIds, id]);

  const seats: PlayerSeat[] = players
    .filter((p) => selected.includes(p.id))
    .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color }));

  // Auto-split into two teams (round-robin); spymaster = first member of each.
  const teams: TeamSetup = {
    mode: 'auto',
    teams: [0, 1].map((i) => ({
      id: asTeamId(i === 0 ? 'teamA' : 'teamB'),
      name: i === 0 ? t('cn.red') : t('cn.blue'),
      memberIds: seats.filter((_, idx) => idx % 2 === i).map((s) => s.id),
    })),
  };

  const config: GameConfig = {
    players: seats,
    teams,
    options: opts as unknown as Record<string, unknown>,
    lang: ctx.lang,
  };
  const errors = validateConfig(config);
  const spyA = teams.teams[0].memberIds[0];
  const spyB = teams.teams[1].memberIds[0];

  return (
    <Screen>
      <AppBar title={t('cn.title')} onBack={() => nav.exit()} />
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

        {seats.length >= 4 && (
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[var(--color-game-rose)] p-3">
              <p className="text-sm font-bold">{t('cn.red')}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {t('cn.spymaster')}: {spyA ? seats.find((s) => s.id === spyA)?.name : '—'}
              </p>
              <p className="text-xs">{teams.teams[0].memberIds.map((id) => seats.find((s) => s.id === id)?.name).join('، ')}</p>
            </div>
            <div className="rounded-xl bg-[var(--color-game-sky)] p-3">
              <p className="text-sm font-bold">{t('cn.blue')}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {t('cn.spymaster')}: {spyB ? seats.find((s) => s.id === spyB)?.name : '—'}
              </p>
              <p className="text-xs">{teams.teams[1].memberIds.map((id) => seats.find((s) => s.id === id)?.name).join('، ')}</p>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('cn.mode')}</h2>
          <SegmentedControl<CodenamesMode>
            value={opts.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'untimed', label: t('cn.untimed') },
              { value: 'timed', label: t('cn.timed') },
            ]}
          />
        </section>

        {opts.mode === 'timed' && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('cn.turnTime')}</h2>
            <SegmentedControl<string>
              value={String(opts.turnSeconds)}
              onChange={(v) => set('turnSeconds', Number(v))}
              options={[60, 120, 180, 240].map((s) => ({ value: String(s), label: `${s / 60}m` }))}
            />
          </section>
        )}

        {PACK_LIST.length > 1 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('cn.packs')}</h2>
            <div className="flex flex-wrap gap-2">
              {PACK_LIST.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePack(p.id)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    opts.packIds.includes(p.id)
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

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('cn.startingTeam')}</h2>
          <SegmentedControl<StartingTeam>
            value={opts.startingTeam}
            onChange={(v) => set('startingTeam', v)}
            options={[
              { value: 'random', label: t('cn.random') },
              { value: 'teamA', label: t('cn.red') },
              { value: 'teamB', label: t('cn.blue') },
            ]}
          />
        </section>

        <Toggle label={t('cn.bonusGuess')} checked={opts.allowBonusGuess} onChange={(v) => set('allowBonusGuess', v)} />
        <Toggle label={t('cn.orientationToggle')} checked={opts.chooseOrientation} onChange={(v) => set('chooseOrientation', v)} />

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
