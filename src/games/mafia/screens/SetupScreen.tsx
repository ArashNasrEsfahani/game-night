import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { DEFAULT_OPTIONS, validateConfig } from '../config';
import type { MafiaMode, MafiaOptions } from '../config';
import { autoComposition } from '../content';
import { ROLES } from '../roles';
import type { RoleId } from '../roles';
import type { MafiaAction, MafiaState } from '../logic';

const STEPPER_ROLES: RoleId[] = ['mafia', 'godfather', 'detective', 'doctor', 'sniper'];

export function SetupScreen({ ctx, nav }: GameScreenProps<MafiaState, MafiaAction>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const players = useRosterStore((s) => s.players);
  const [mode, setMode] = useState<MafiaMode>(DEFAULT_OPTIONS.mode);
  const [selected, setSelected] = useState<string[]>(() => players.map((p) => p.id));
  const [counts, setCounts] = useState<Record<RoleId, number>>(() => autoComposition(players.length));

  const seats: PlayerSeat[] = players
    .filter((p) => selected.includes(p.id))
    .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color }));
  const n = seats.length;

  const otherTotal = STEPPER_ROLES.reduce((sum, r) => sum + (counts[r] ?? 0), 0);
  const citizen = Math.max(0, n - otherTotal);

  const composition = useMemo(() => {
    const c: Record<RoleId, number> = {};
    STEPPER_ROLES.forEach((r) => {
      if ((counts[r] ?? 0) > 0) c[r] = counts[r];
    });
    if (citizen > 0) c.citizen = citizen;
    return c;
  }, [counts, citizen]);

  const togglePlayer = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const setCount = (r: RoleId, v: number) => setCounts((c) => ({ ...c, [r]: v }));

  const options: MafiaOptions = { ...DEFAULT_OPTIONS, mode, composition, presetId: null };
  const config: GameConfig = {
    players: seats,
    options: options as unknown as Record<string, unknown>,
    lang: ctx.lang,
  };
  const errors = validateConfig(config);

  return (
    <Screen>
      <AppBar title={t('mf.title')} onBack={() => nav.exit()} />
      <div className="flex flex-col gap-5 pb-8">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('common.players')} · {n}
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

        <section className="flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={() => setCounts(autoComposition(n))}>
            {t('mf.autoFill')}
          </Button>
          <span className="text-sm text-[var(--text-muted)]">{t('mf.citizens', { n: citizen })}</span>
        </section>

        <section className="flex flex-col gap-3">
          {STEPPER_ROLES.map((r) => (
            <Stepper
              key={r}
              label={`${ROLES[r].icon} ${ctx.localize(ROLES[r].name)}`}
              value={counts[r] ?? 0}
              min={0}
              max={n}
              onChange={(v) => setCount(r, v)}
            />
          ))}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">{t('mf.mode')}</h2>
          <SegmentedControl<MafiaMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'device-narrator', label: t('mf.narrated') },
              { value: 'silent', label: t('mf.silent') },
            ]}
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
