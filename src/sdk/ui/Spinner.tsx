import { Motif } from './Motif';

export function Spinner({ label }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 p-6 text-[var(--text-muted)]"
    >
      <span className="dp-spin-med inline-block">
        <Motif name="gereh" size={42} color="var(--color-game-gold)" />
      </span>
      {label && <span>{label}</span>}
    </div>
  );
}
