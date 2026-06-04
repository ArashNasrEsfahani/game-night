export function TeamBadge({ color, label }: { color?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-sm font-medium">
      {color && (
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: `var(--color-game-${color})` }}
        />
      )}
      {label}
    </span>
  );
}
