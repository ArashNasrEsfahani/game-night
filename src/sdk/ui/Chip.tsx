import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]',
        className,
      )}
    >
      {children}
    </span>
  );
}
