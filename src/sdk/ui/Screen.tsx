import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Mobile-first page scaffold: centered column, max width, safe-area padding. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-4', className)}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
      }}
    >
      {children}
    </div>
  );
}
