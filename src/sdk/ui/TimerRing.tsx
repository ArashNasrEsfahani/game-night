import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNum } from '../../lib/digits';
import { useUiSound } from '../../lib/uiSound';

export function TimerRing({
  totalSeconds,
  remainingSeconds,
}: {
  totalSeconds: number;
  remainingSeconds: number;
}) {
  const num = useNum();
  const ui = useUiSound();
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;

  // Audible (+ haptic) countdown for the final seconds: a soft tick each whole second from 5→1 as
  // the ring goes red, so the time pressure lands even when eyes are on the word/board, not the
  // clock. Fires once per second and only while counting *down* (a new round resetting up is silent);
  // gated by the mute/haptics settings via useUiSound.
  const shown = Math.max(0, Math.ceil(remainingSeconds));
  const lastShown = useRef<number | null>(null);
  useEffect(() => {
    const prev = lastShown.current;
    if (prev !== null && shown < prev && shown >= 1 && shown <= 5) uiRef.current('tick');
    lastShown.current = shown;
  }, [shown]);
  // The last five seconds are the tense ones — turn the ring red, glow it, and pulse it so the
  // pressure reads at a glance (matters in Heads Up / Dowr / Pantomime where eyes are on the word,
  // not the clock). Pulse is a framer transform, so the app's reduce-motion setting stills it while
  // keeping the colour + glow urgency cue.
  const critical = remainingSeconds > 0 && remainingSeconds <= 5;
  const color =
    remainingSeconds <= 5
      ? 'var(--color-game-rose-strong)'
      : remainingSeconds <= 15
        ? 'var(--color-game-gold-strong)'
        : 'var(--game-accent-strong)';
  return (
    <motion.div
      className="relative grid place-items-center"
      animate={critical ? { scale: [1, 1.07, 1] } : { scale: 1 }}
      transition={critical ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      style={critical ? { filter: 'drop-shadow(0 0 9px var(--color-game-rose-strong))' } : undefined}
    >
      <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s' }}
        />
      </svg>
      <span
        className="absolute text-3xl font-bold tabular-nums"
        style={critical ? { color: 'var(--color-game-rose-strong)' } : undefined}
      >
        {num(shown)}
      </span>
    </motion.div>
  );
}
