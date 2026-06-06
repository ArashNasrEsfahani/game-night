import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'dp-glass rounded-[var(--radius-card)] p-4',
        className,
      )}
      {...rest}
    />
  );
}
