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
    <div className="grid flex-1 place-items-center gap-5 text-center">
      <div className="text-6xl">🤫</div>
      <p className="px-6 text-lg font-semibold">{hint}</p>
      {holderName && (
        <p className="text-2xl font-extrabold text-[var(--game-accent-strong)]">{holderName}</p>
      )}
      <Button size="lg" onClick={onReveal}>
        {revealLabel}
      </Button>
    </div>
  );
}
