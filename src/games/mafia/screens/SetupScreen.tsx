import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper, Toggle, MotifDivider } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { PlayerPicker } from '../../../app/components/PlayerPicker';
import { DEFAULT_OPTIONS, validateConfig } from '../config';
import type { DoctorSelfSave, MafiaMode, MafiaOptions, TieRule, VotingMode } from '../config';
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
  // House-rule options (all already supported by the reducer; just surfaced here).
  const [rules, setRules] = useState({
    discussionSeconds: DEFAULT_OPTIONS.discussionSeconds,
    votingMode: DEFAULT_OPTIONS.votingMode,
    nominationsRequired: DEFAULT_OPTIONS.nominationsRequired,
    tieRule: DEFAULT_OPTIONS.tieRule,
    allowDoctorSelfSave: DEFAULT_OPTIONS.allowDoctorSelfSave,
    optionalReveal: DEFAULT_OPTIONS.optionalReveal,
    peacefulFirstNight: DEFAULT_OPTIONS.peacefulFirstNight,
  });
  const setRule = <K extends keyof typeof rules>(k: K, v: (typeof rules)[K]) =>
    setRules((r) => ({ ...r, [k]: v }));

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

  const options: MafiaOptions = { ...DEFAULT_OPTIONS, mode, composition, presetId: null, ...rules };
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
          <PlayerPicker
            selected={selected}
            onToggle={togglePlayer}
            onManageAll={() => navigate('/players')}
          />
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

        <MotifDivider />

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-[var(--text-muted)]">{t('mf.houseRules')}</h2>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('mf.discussion')}</span>
            <SegmentedControl<string>
              ariaLabel={t('mf.discussion')}
              value={String(rules.discussionSeconds)}
              onChange={(v) => setRule('discussionSeconds', Number(v))}
              options={[
                { value: '60', label: '1m' },
                { value: '120', label: '2m' },
                { value: '180', label: '3m' },
                { value: '300', label: '5m' },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('mf.voting')}</span>
            <SegmentedControl<VotingMode>
              ariaLabel={t('mf.voting')}
              value={rules.votingMode}
              onChange={(v) => setRule('votingMode', v)}
              options={[
                { value: 'majority', label: t('mf.majority') },
                { value: 'plurality', label: t('mf.plurality') },
              ]}
            />
          </div>

          <Stepper
            label={t('mf.nominations')}
            value={rules.nominationsRequired}
            min={1}
            max={5}
            onChange={(v) => setRule('nominationsRequired', v)}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('mf.onTie')}</span>
            <SegmentedControl<TieRule>
              ariaLabel={t('mf.onTie')}
              value={rules.tieRule}
              onChange={(v) => setRule('tieRule', v)}
              options={[
                { value: 'no-elimination', label: t('mf.tieNoElim') },
                { value: 'random', label: t('mf.tieRandom') },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('mf.doctorSave')}</span>
            <SegmentedControl<DoctorSelfSave>
              ariaLabel={t('mf.doctorSave')}
              value={rules.allowDoctorSelfSave}
              onChange={(v) => setRule('allowDoctorSelfSave', v)}
              options={[
                { value: 'never', label: t('mf.saveNever') },
                { value: 'once', label: t('mf.saveOnce') },
                { value: 'always', label: t('mf.saveAlways') },
              ]}
            />
          </div>

          <Toggle
            label={t('mf.revealRole')}
            checked={rules.optionalReveal}
            onChange={(v) => setRule('optionalReveal', v)}
          />
          <Toggle
            label={t('mf.peacefulFirst')}
            checked={rules.peacefulFirstNight}
            onChange={(v) => setRule('peacefulFirstNight', v)}
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
