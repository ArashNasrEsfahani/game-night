import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { Motif } from './Motif';

/** Wide winged-disc (Faravahar) crest — a banner divider drenched in gold light. */
export function FaravaharBanner({
  subtitle,
  className,
  width = 'min(360px, 78%)',
}: {
  subtitle?: string;
  className?: string;
  width?: string;
}) {
  const bg: CSSProperties = {
    background:
      'radial-gradient(80% 140% at 50% 0%, color-mix(in oklab, var(--color-game-gold) 18%, var(--lapis)), var(--surface))',
    boxShadow: 'inset 0 0 60px -20px var(--color-game-gold)',
  };
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] px-4 py-6',
        className,
      )}
      style={bg}
    >
      <Motif
        name="faravahar"
        size={width}
        color="var(--color-game-gold)"
        style={{ filter: 'drop-shadow(0 0 22px color-mix(in oklab, var(--color-game-gold) 55%, transparent))' }}
      />
      {subtitle && <p className="text-center text-[var(--text-muted)]">{subtitle}</p>}
    </div>
  );
}
