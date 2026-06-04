export function Spinner({ label }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 p-6 text-[var(--text-muted)]"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label && <span>{label}</span>}
    </div>
  );
}
