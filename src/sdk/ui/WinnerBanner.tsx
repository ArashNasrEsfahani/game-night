export function WinnerBanner({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <div className="text-6xl">🏆</div>
      <h2 className="text-2xl font-extrabold">{title}</h2>
      {names.length > 0 && (
        <p className="text-lg text-[var(--text-muted)]">{names.join('، ')}</p>
      )}
    </div>
  );
}
