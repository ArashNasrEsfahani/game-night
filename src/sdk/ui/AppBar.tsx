import type { ReactNode } from 'react';

export function AppBar({
  title,
  onBack,
  right,
}: {
  title?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="flex h-14 items-center gap-2">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Back"
          className="grid h-10 w-10 place-items-center rounded-full text-2xl text-[var(--text)]"
        >
          <span className="rtl:rotate-180">‹</span>
        </button>
      )}
      <h1 className="flex-1 truncate text-xl font-bold">{title}</h1>
      {right}
    </header>
  );
}
