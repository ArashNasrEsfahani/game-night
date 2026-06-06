import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import type { ColorToken, GameContext } from '../../../sdk/types';
import { Screen, Button, TurnAura } from '../../../sdk/ui';
import type { ToDAction, ToDState } from '../logic';

/** A spin-the-bottle picker: players sit in a ring and a bottle spins to the chosen one.
 *  The TARGET is decided purely by the reducer (SPIN → activePlayerId); this view only animates
 *  the bottle so its neck lands on that player, then reveals the Truth/Dare choice. */
export function BottleStage({
  state,
  dispatch,
  ctx,
  header,
}: {
  state: ToDState;
  dispatch: (action: ToDAction) => void;
  ctx: GameContext;
  header: ReactNode;
}) {
  const { t } = useTranslation();
  const s = state;
  const players = s.playerIds.map((id) => ({
    id,
    name: s.playerNames[id] ?? '',
    color: s.playerColors[id] as ColorToken | undefined,
  }));
  const n = Math.max(players.length, 1);
  const targetIndex = s.activePlayerId ? players.findIndex((p) => p.id === s.activePlayerId) : -1;
  const reduce = ctx.reducedMotion;

  const [landed, setLanded] = useState(false);
  const rotRef = useRef(0);
  const [rot, setRot] = useState(0);

  // On each new spin (spinSerial bumps when a target is set), wind the bottle several turns and
  // align its neck to the chosen seat. Rotation only ever increases so it always spins forward.
  useEffect(() => {
    if (s.phase !== 'choosing' || targetIndex < 0) return;
    setLanded(false);
    const base = rotRef.current;
    const currentMod = ((base % 360) + 360) % 360;
    const want = (targetIndex / n) * 360;
    const delta = (((want - currentMod) % 360) + 360) % 360;
    const next = base + (reduce ? 0 : 5) * 360 + delta;
    rotRef.current = next;
    setRot(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.spinSerial, targetIndex, n, reduce]);

  const activeName = s.activePlayerId ? s.playerNames[s.activePlayerId] : '';
  const activeColor = s.activePlayerId ? s.playerColors[s.activePlayerId] : undefined;

  const R = 116; // ring radius in px
  const seatStyle = (i: number) => {
    const theta = ((-90 + (i / n) * 360) * Math.PI) / 180;
    const x = Math.cos(theta) * R;
    const y = Math.sin(theta) * R;
    return {
      transform: `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px))`,
    } as const;
  };

  const spin = () => {
    if (s.phase !== 'idle') return;
    ctx.sound.play('shuffle');
    ctx.haptics.light();
    dispatch({ type: 'SPIN', seed: ctx.random.seed() });
  };
  const choose = (kind: 'truth' | 'dare') => {
    ctx.sound.play('tap');
    dispatch({ type: 'CHOOSE', kind, seed: ctx.random.seed() });
  };

  return (
    <Screen>
      {(s.phase === 'choosing' || landed) && <TurnAura color={activeColor} />}
      {header}
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="relative h-[18.5rem] w-[18.5rem]">
          {players.map((p, i) => {
            const chosen = landed && i === targetIndex;
            return (
              <div key={p.id} className="absolute left-1/2 top-1/2" style={seatStyle(i)}>
                <div
                  className={`max-w-[5.5rem] truncate rounded-2xl px-2.5 py-1.5 text-center text-xs font-semibold transition-transform ${
                    chosen
                      ? 'scale-110 bg-[var(--game-accent-strong)] text-[var(--game-on-accent)] shadow-[0_4px_14px_-4px_var(--game-accent-glow)]'
                      : 'bg-[var(--surface-2)] text-[var(--text)]'
                  }`}
                >
                  {p.name}
                </div>
              </div>
            );
          })}
          <motion.button
            type="button"
            aria-label={t('tod.bottleSpin')}
            onClick={spin}
            disabled={s.phase !== 'idle'}
            className="absolute left-1/2 top-1/2 grid place-items-center"
            style={{ transformOrigin: 'center' }}
            initial={false}
            animate={{ rotate: rot, x: '-50%', y: '-50%' }}
            transition={{ rotate: { duration: reduce ? 0.25 : 2.4, ease: [0.16, 0.84, 0.25, 1] } }}
            onAnimationComplete={() => {
              if (s.phase === 'choosing' && !landed) {
                setLanded(true);
                ctx.sound.play('reveal');
                ctx.haptics.medium();
              }
            }}
          >
            <BottleSvg />
          </motion.button>
        </div>

        <div className="flex min-h-[7.5rem] w-full max-w-xs flex-col items-center justify-center gap-3 text-center">
          {s.phase === 'idle' && (
            <>
              <p className="text-sm text-[var(--text-muted)]">{t('tod.bottleHint')}</p>
              <Button size="lg" onClick={spin}>
                🍾 {t('tod.bottleSpin')}
              </Button>
            </>
          )}
          {s.phase === 'choosing' && !landed && (
            <p className="text-lg font-semibold dp-accent">{t('tod.spinning')}</p>
          )}
          {s.phase === 'choosing' && landed && (
            <>
              <h1 className="text-2xl font-extrabold dp-accent">
                {t('tod.yourTurn', { name: activeName })}
              </h1>
              <div className="grid w-full grid-cols-2 gap-3">
                <Button size="lg" onClick={() => choose('truth')}>
                  {t('tod.truth')}
                </Button>
                <Button size="lg" variant="danger" onClick={() => choose('dare')}>
                  {t('tod.dare')}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}

/** Bottle drawn pointing UP (neck at top); the wrapper's center is the spin pivot. */
function BottleSvg() {
  return (
    <svg
      width="46"
      height="138"
      viewBox="0 0 46 138"
      className="drop-shadow-[0_6px_12px_var(--game-accent-glow)]"
      aria-hidden
    >
      <rect x="18" y="2" width="10" height="11" rx="2.5" fill="var(--game-accent-strong)" />
      <rect x="19.5" y="12" width="7" height="22" fill="var(--game-accent)" />
      <path
        d="M15 34 Q23 28 31 34 L35 60 Q36 70 36 84 L36 120 Q36 134 23 134 Q10 134 10 120 L10 84 Q10 70 11 60 Z"
        fill="var(--game-accent)"
        stroke="var(--game-accent-strong)"
        strokeWidth="2.5"
      />
      <rect x="13" y="92" width="20" height="16" rx="3" fill="var(--game-on-accent)" opacity="0.18" />
      <circle cx="23" cy="6.5" r="2" fill="var(--game-on-accent)" opacity="0.5" />
    </svg>
  );
}
