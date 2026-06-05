import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { Motif } from './Motif';

/** A Persian tilework pattern band (boteh + star repeat) — a decorative divider/strip. */
export function TileBand({ className, height = 16 }: { className?: string; height?: number }) {
  const style: CSSProperties = {
    blockSize: height,
    borderRadius: 'var(--radius-pill)',
    backgroundColor: 'color-mix(in oklab, var(--border) 55%, transparent)',
    backgroundImage:
      'radial-gradient(circle at 25% 50%, color-mix(in oklab, var(--color-game-gold) 55%, transparent) 0 22%, transparent 26%),' +
      'radial-gradient(circle at 75% 50%, color-mix(in oklab, var(--color-game-teal) 55%, transparent) 0 22%, transparent 26%)',
    backgroundSize: `${height * 2}px ${height * 2}px`,
  };
  return <div aria-hidden className={className} style={style} />;
}

/** A thin section divider with a centered Persian motif and gradient rules. */
export function MotifDivider({
  motif = 'gereh',
  className,
  size = 26,
}: {
  motif?: string;
  className?: string;
  size?: number;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)} aria-hidden>
      <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,var(--border-glow))]" />
      <Motif name={motif} size={size} color="var(--color-game-gold)" />
      <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--border-glow),transparent)]" />
    </div>
  );
}
