export function Stepper({
  value,
  min = 1,
  max = 99,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      {label && <span className="text-[var(--text)]">{label}</span>}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label="decrease"
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-xl disabled:opacity-40"
        >
          −
        </button>
        <span className="w-8 text-center text-lg font-bold tabular-nums">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label="increase"
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-xl disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
