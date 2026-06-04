export function TimerRing({
  totalSeconds,
  remainingSeconds,
}: {
  totalSeconds: number;
  remainingSeconds: number;
}) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;
  const color =
    remainingSeconds <= 5
      ? 'var(--color-game-rose-strong)'
      : remainingSeconds <= 15
        ? 'var(--color-game-gold-strong)'
        : 'var(--game-accent-strong)';
  return (
    <div className="relative grid place-items-center">
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
      <span className="absolute text-3xl font-bold tabular-nums">
        {Math.max(0, Math.ceil(remainingSeconds))}
      </span>
    </div>
  );
}
