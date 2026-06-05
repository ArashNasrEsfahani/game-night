import type { CSSProperties } from 'react';
import { motif as getMotif } from './emblems';
import { cn } from '../../lib/cn';

/** A decorative Persian motif (currentColor drives the accent; baked-in gold stays gold).
 *  `size` sets the width; height follows the SVG's aspect ratio. */
export function Motif({
  name,
  size = 48,
  className,
  color = 'var(--game-accent)',
  style,
}: {
  name: string;
  size?: number | string;
  className?: string;
  color?: string;
  style?: CSSProperties;
}) {
  const svg = getMotif(name);
  if (!svg) return null;
  return (
    <span
      aria-hidden
      className={cn('inline-block align-middle [&_svg]:block [&_svg]:h-auto [&_svg]:w-full', className)}
      style={{ width: size, color, ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
