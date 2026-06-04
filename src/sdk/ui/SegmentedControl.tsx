import { cn } from '../../lib/cn';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-[var(--radius-pill)] bg-[var(--surface-sunk)] p-1 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-[var(--radius-pill)] px-3 py-2 text-sm font-semibold transition',
            value === o.value
              ? 'bg-[linear-gradient(135deg,var(--game-accent),var(--game-accent-strong))] text-[var(--on-accent)] shadow-[0_4px_14px_-4px_var(--game-accent-glow)]'
              : 'text-[var(--text-muted)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
