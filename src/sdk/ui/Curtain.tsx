import type { ReactNode } from 'react';
import { Button } from './Button';

/** Pass-the-phone secrecy curtain: hides children until the holder taps to reveal. */
export function Curtain({
  open,
  holderName,
  hint,
  revealLabel,
  onReveal,
  children,
}: {
  open: boolean;
  holderName?: string;
  hint: string;
  revealLabel: string;
  onReveal: () => void;
  children: ReactNode;
}) {
  if (open) return <>{children}</>;
  return (
    <div
      className="relative grid flex-1 place-items-center gap-5 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-glow)] px-6 py-10 text-center"
      style={{
        background: 'radial-gradient(120% 90% at 50% 0%, var(--game-accent-strong), var(--lapis) 82%)',
      }}
    >
      <div
        className="grid h-24 w-24 place-items-center rounded-full text-4xl font-extrabold text-[var(--on-accent)]"
        style={{
          background: 'linear-gradient(150deg, var(--game-accent), var(--game-accent-strong))',
          boxShadow: '0 0 0 5px rgb(255 255 255 / 0.14), 0 12px 34px -6px var(--game-accent-glow)',
        }}
      >
        {holderName ? holderName.slice(0, 1) : '🤫'}
      </div>
      <p className="px-4 text-lg font-semibold text-white">{hint}</p>
      {holderName && <p className="text-2xl font-extrabold text-white">{holderName}</p>}
      <Button size="lg" onClick={onReveal}>
        {revealLabel}
      </Button>
    </div>
  );
}
