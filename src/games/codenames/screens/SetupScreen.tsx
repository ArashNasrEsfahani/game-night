import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat, TeamSetup } from '../../../sdk/types';
import { Screen, AppBar, Button, Disclosure, SegmentedControl, SelectChip, Toggle } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { PlayerPicker } from '../../../app/components/PlayerPicker';
import { TeamAssigner, useTeamAssignment } from '../../../app/components/TeamAssigner';
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

  // Auto-split into two teams the host can tweak per player; spymaster = first member of each.
  const { byPlayer, cycle, memberIdsByTeam } = useTeamAssignment(seats.map((s) => s.id), 2);
  const teamColumns = [
    { name: t('cn.red'), color: 'rose' },
    { name: t('cn.blue'), color: 'sky' },
  ];
  const teams: TeamSetup = {
    mode: 'manual',
    teams: teamColumns.map((col, i) => ({
      id: asTeamId(i === 0 ? 'teamA' : 'teamB'),
      name: col.name,
      memberIds: memberIdsByTeam[i] ?? [],
    })),
  };

  const config: GameConfig = {
    players: seats,
    teams,
    options: opts as unknown as Record<string, unknown>,
    lang: ctx.lang,
  };
  const errors = validateConfig(config);

  return (
    <Screen>
      <AppBar title={t('cn.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-5 pb-8">

        {/* ── Always visible: players ── */}
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

        {/* ── Always visible: tap-to-move team assignment (spymaster = first, 🔍) ── */}
        {seats.length >= 2 && (
          <section>
            <TeamAssigner
              players={seats}
              teamColumns={teamColumns}
              byPlayer={byPlayer}
              onCycle={cycle}
              spymasterFirst
              hint={`🔍 = ${t('cn.spymaster')} · ${t('common.teamHint')}`}
            />
          </section>
        )}

        {/* ── More options disclosure ── */}
        <Disclosure title={t('common.moreOptions')} summary={t('common.moreOptionsHint')}>
          {/* Mode */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('cn.mode')}</span>
            <SegmentedControl<CodenamesMode>
              value={opts.mode}
              onChange={(v) => set('mode', v)}
              options={[
                { value: 'untimed', label: t('cn.untimed') },
                { value: 'timed', label: t('cn.timed') },
              ]}
            />
          </div>

          {/* Turn time (only when timed) */}
          {opts.mode === 'timed' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-[var(--text)]">{t('cn.turnTime')}</span>
              <SegmentedControl<string>
                value={String(opts.turnSeconds)}
                onChange={(v) => set('turnSeconds', Number(v))}
                options={[60, 120, 180, 240].map((s) => ({ value: String(s), label: `${s / 60}m` }))}
              />
            </div>
          )}

          {/* Packs */}
          {PACK_LIST.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-[var(--text)]">{t('cn.packs')}</span>
              <div className="flex flex-wrap gap-2">
                {PACK_LIST.map((p) => (
                  <SelectChip
                    key={p.id}
                    selected={opts.packIds.includes(p.id)}
                    onClick={() => togglePack(p.id)}
                  >
                    {ctx.localize(p.name)}
                  </SelectChip>
                ))}
              </div>
            </div>
          )}

          {/* Starting team */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('cn.startingTeam')}</span>
            <SegmentedControl<StartingTeam>
              value={opts.startingTeam}
              onChange={(v) => set('startingTeam', v)}
              options={[
                { value: 'random', label: t('cn.random') },
                { value: 'teamA', label: t('cn.red') },
                { value: 'teamB', label: t('cn.blue') },
              ]}
            />
          </div>

          {/* Toggles */}
          <Toggle label={t('cn.bonusGuess')} checked={opts.allowBonusGuess} onChange={(v) => set('allowBonusGuess', v)} />
          <Toggle label={t('cn.forgiveWrong')} checked={opts.forgiveFirstWrong} onChange={(v) => set('forgiveFirstWrong', v)} />
          <Toggle label={t('cn.orientationToggle')} checked={opts.chooseOrientation} onChange={(v) => set('chooseOrientation', v)} />
        </Disclosure>

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
