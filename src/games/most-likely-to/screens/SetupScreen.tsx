import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, GameScreenProps, PlayerSeat } from '../../../sdk/types';
import { Screen, AppBar, Button, SetupErrors, SegmentedControl, Stepper, Toggle, Disclosure } from '../../../sdk/ui';
import { useRosterStore } from '../../../store/rosterStore';
import { PlayerPicker } from '../../../app/components/PlayerPicker';
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
        {/* Always visible: players */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
            {t('common.playersCount', { count: seats.length })}
          </h2>
          <PlayerPicker
            selected={selected}
            onToggle={togglePlayer}
            onManageAll={() => navigate('/players')}
          />
        </section>

        {/* Always visible: deck (the primary gameplay choice) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-[var(--text)]">{t('mlt.deck')}</span>
          <SegmentedControl<string>
            value={opts.deckId}
            onChange={(v) => set('deckId', v)}
            options={DECKS.map((d) => ({ value: d.id, label: ctx.localize(d.name) }))}
          />
        </div>

        {/* More options disclosure */}
        <Disclosure title={t('common.moreOptions')} summary={t('common.moreOptionsHint')}>
          {/* Intensity */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('mlt.intensityLabel')}</span>
            <SegmentedControl<Intensity>
              value={opts.intensity}
              onChange={(v) => set('intensity', v)}
              options={[
                { value: 'family', label: t('mlt.intensity.family') },
                { value: 'casual', label: t('mlt.intensity.casual') },
                { value: 'spicy', label: t('mlt.intensity.spicy') },
              ]}
            />
          </div>

          {/* Voting style */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('mlt.votingStyle')}</span>
            <SegmentedControl<VotingStyle>
              value={opts.votingStyle}
              onChange={(v) => set('votingStyle', v)}
              options={[
                { value: 'pass-device', label: t('mlt.style.passDevice') },
                { value: 'simultaneous', label: t('mlt.style.simultaneous') },
              ]}
            />
          </div>

          {/* Rounds */}
          <Stepper
            label={t('mlt.rounds')}
            value={Math.min(opts.roundCount, Math.max(1, poolSize))}
            min={1}
            max={Math.max(1, poolSize)}
            onChange={(v) => set('roundCount', v)}
          />

          {/* Toggles */}
          <Toggle
            label={t('mlt.allowSelfVote')}
            checked={opts.allowSelfVote}
            onChange={(v) => set('allowSelfVote', v)}
          />
          <Toggle
            label={t('mlt.showScores')}
            checked={opts.showRunningScores}
            onChange={(v) => set('showRunningScores', v)}
          />

          {/* Tie break */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--text)]">{t('mlt.tieBreakLabel')}</span>
            <SegmentedControl<TieBreak>
              value={opts.tieBreak}
              onChange={(v) => set('tieBreak', v)}
              options={[
                { value: 'co-winners', label: t('mlt.tie.coWinners') },
                { value: 'random', label: t('mlt.tie.random') },
              ]}
            />
          </div>
        </Disclosure>

        <p className="text-sm text-[var(--text-muted)]">{t('mlt.poolHint', { count: poolSize })}</p>
        <SetupErrors errors={errors} />
        <Button size="lg" fullWidth disabled={!!errors} onClick={() => { ctx.sound.play('tap'); nav.startMatch(config); }}>
          {t('common.start')}
        </Button>
      </div>
    </Screen>
  );
}
