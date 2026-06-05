import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** A gilded roundel framing an emblem or motif — the "coined" logo treatment. */
export function Medallion({
  children,
  size = 120,
  className,
  spin = true,
}: {
  children: ReactNode;
  size?: number | string;
  className?: string;
  spin?: boolean;
}) {
  const ring: CSSProperties = {
    width: size,
    height: size,
    background:
      'radial-gradient(circle at 50% 36%, color-mix(in oklab, var(--game-accent) 32%, var(--lapis)), var(--night) 76%)',
    boxShadow: [
      '0 0 0 2px var(--color-game-gold)',
      '0 0 0 7px color-mix(in oklab, var(--game-accent) 40%, var(--night))',
      '0 0 0 8.5px color-mix(in oklab, var(--color-game-gold) 70%, transparent)',
      'inset 0 0 34px -6px var(--game-accent-glow)',
      '0 18px 44px -18px var(--game-accent-glow)',
    ].join(', '),
  };
  return (
    <div className={cn('relative grid aspect-square place-items-center rounded-full isolate', className)} style={ring}>
      {/* dashed inner ring */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[11px] rounded-full opacity-55"
        style={{ border: '1.5px dashed color-mix(in oklab, var(--color-game-gold) 65%, transparent)' }}
      />
      {/* slow light glint sweeping the coin */}
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 rounded-full mix-blend-screen', spin && 'dp-spin-slow')}
        style={{ background: 'conic-gradient(from 0deg, transparent, rgb(255 255 255 / 0.16), transparent 36%)' }}
      />
      <div className="relative z-[1] grid h-[70%] w-[70%] place-items-center text-[var(--game-accent)] [&_svg]:h-full [&_svg]:w-full">
        {children}
      </div>
    </div>
  );
}
