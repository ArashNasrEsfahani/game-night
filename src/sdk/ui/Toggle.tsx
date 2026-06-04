export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      {label && <span className="text-[var(--text)]">{label}</span>}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition ${
          checked ? 'bg-[var(--game-accent-strong)]' : 'bg-[var(--surface-2)]'
        }`}
      >
        <span
          className={`block h-6 w-6 rounded-full bg-white transition ${
            checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
