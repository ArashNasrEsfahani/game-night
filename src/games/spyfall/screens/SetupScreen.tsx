import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SegmentedControl, Stepper, Toggle, Disclosure, SelectChip } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { PlayerPicker } from '../../../app/components/PlayerPicker';
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
          <PlayerPicker
            selected={selected}
            onToggle={togglePlayer}
            onManageAll={() => navigate('/players')}
          />
        </section>

        <Disclosure title={t('common.moreOptions')} summary={t('common.moreOptionsHint')}>
          <Stepper label={t('spy.spies')} value={Math.min(opts.spyCount, cap)} min={1} max={cap} onChange={(v) => set('spyCount', v)} />
          <Stepper label={t('spy.rounds')} value={opts.totalRounds} min={1} max={10} onChange={(v) => set('totalRounds', v)} />

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('spy.roundTime')}</span>
            <SegmentedControl<string>
              value={String(opts.roundSeconds)}
              onChange={(v) => set('roundSeconds', Number(v))}
              options={ROUND_SECONDS_CHOICES.map((s) => ({ value: String(s), label: `${Math.round(s / 60)}m` }))}
            />
          </div>

          {PACK_LIST.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-[var(--text)]">{t('spy.packs')}</span>
              <div className="flex flex-wrap gap-2">
                {PACK_LIST.map((p) => (
                  <SelectChip
                    key={p.id}
                    selected={opts.enabledPackIds.includes(p.id)}
                    onClick={() => togglePack(p.id)}
                  >
                    {ctx.localize(p.name)}
                  </SelectChip>
                ))}
              </div>
            </div>
          )}

          <Toggle label={t('spy.useTimer')} checked={opts.useTimer} onChange={(v) => set('useTimer', v)} />
          <Toggle label={t('spy.allowGuess')} checked={opts.allowSpyGuess} onChange={(v) => set('allowSpyGuess', v)} />
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
