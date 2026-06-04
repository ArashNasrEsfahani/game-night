import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]',
        className,
      )}
      {...rest}
    />
  );
}
