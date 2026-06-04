import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-[var(--border)] bg-gradient-to-b from-[var(--surface-2)] to-[var(--surface)] p-4 shadow-[var(--shadow-card)]',
        className,
      )}
      {...rest}
    />
  );
}
