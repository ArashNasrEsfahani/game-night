import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameScreenProps } from '../../../sdk/types';
import { Screen, AppBar, Button, TurnAura } from '../../../sdk/ui';
import { MineGrid } from '../components/MineGrid';
import { activeSeat, isSolo, minesLeft } from '../logic';
import type { MinesweeperAction, MinesweeperState } from '../logic';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export function PlayScreen({ state, dispatch, ctx, nav }: GameScreenProps<MinesweeperState, MinesweeperAction>) {
  const { t } = useTranslation();
  const s = state;
  const clock = ctx.clock;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const [flagMode, setFlagMode] = useState(false);
  const solo = isSolo(s);

  // Solo stopwatch — screen-local, anchored to wall clock, never persisted (resume-safe).
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  useEffect(() => {
    if (!solo || s.phase !== 'playing') return;
    if (!startRef.current) startRef.current = clock.now();
    const stop = clock.interval(250, (now) => setElapsed(Math.max(0, Math.floor((now - startRef.current) / 1000))));
    return stop;
  }, [solo, s.phase, clock]);

  // Outcome feedback per reveal, then clear the flash.
  useEffect(() => {
    if (!s.flash) return;
    if (s.flash.type === 'boom') {
      ctx.sound.play('wrong');
      ctx.haptics.error();
    } else if (s.flash.type === 'safe') {
      ctx.sound.play('tap');
      ctx.haptics.light();
    }
    const stop = clock.interval(360, () => dispatchRef.current({ type: 'CLEAR_FLASH' }));
    return stop;
  }, [s.flash, clock, ctx]);

  const active = activeSeat(s);
  const seatColors: Record<string, string | undefined> = Object.fromEntries(
    s.seats.map((se) => [se.id, se.color]),
  );

  const reveal = (i: number) => { ctx.haptics.light(); dispatch({ type: 'REVEAL', index: i, seed: ctx.random.seed() }); };
  const flag = (i: number) => { ctx.sound.play('tap'); ctx.haptics.light(); dispatch({ type: 'FLAG', index: i }); };
  const chord = (i: number) => dispatch({ type: 'CHORD', index: i });

  return (
    <Screen>
      <TurnAura color={active?.color} />
      <AppBar title={t('mine.title')} onBack={() => nav.exit()} />

      <div className="flex items-center justify-between px-1 pb-2 text-sm">
        <span className="font-semibold">💣 {minesLeft(s)}</span>
        {solo ? (
          <span className="tabular-nums text-[var(--text-muted)]">⏱ {fmt(elapsed)}</span>
        ) : (
          <span className="font-bold dp-accent">{t('mine.turnOf', { name: active?.name ?? '' })}</span>
        )}
      </div>

      {!solo && (
        <div className="mb-2 flex flex-wrap justify-center gap-1.5">
          {s.seats.map((se) => {
            const isActive = se.id === active?.id;
            return (
              <span
                key={se.id}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  se.eliminated ? 'opacity-40' : ''
                } ${isActive ? 'bg-[var(--game-accent-strong)] text-[var(--game-on-accent)]' : 'bg-[var(--surface-2)]'}`}
              >
                {se.name} · {se.score} · {se.eliminated ? '💀' : '❤'.repeat(se.lives)}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center gap-3">
        <MineGrid
          cells={s.board}
          cols={s.cols}
          flagMode={flagMode}
          seatColors={seatColors}
          onReveal={reveal}
          onFlag={flag}
          onChord={chord}
        />
        <Button
          variant={flagMode ? 'primary' : 'secondary'}
          fullWidth
          onClick={() => { ctx.sound.play('tap'); setFlagMode((f) => !f); }}
        >
          {flagMode ? t('mine.flagOn') : t('mine.flagOff')}
        </Button>
        <p className="text-center text-xs text-[var(--text-muted)]">{t('mine.tapHint')}</p>
      </div>
    </Screen>
  );
}
