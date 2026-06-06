import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'dp-glass-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]',
        className,
      )}
    >
      {children}
    </span>
  );
}
