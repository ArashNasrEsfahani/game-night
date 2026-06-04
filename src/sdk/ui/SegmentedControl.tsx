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
      className="flex gap-1 rounded-[var(--radius-pill)] bg-[var(--surface-2)] p-1"
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
              ? 'bg-[var(--game-accent-strong)] text-white shadow-sm'
              : 'text-[var(--text)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
