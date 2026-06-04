import { Card } from './Card';

export interface ScoreRow {
  id: string;
  label: string;
  score: number;
  rank: number;
  color?: string; // ColorToken name
}

export function Scoreboard({ rows }: { rows: ScoreRow[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <Card key={r.id} className="flex items-center gap-3 py-3">
          <span className="w-6 text-center font-bold text-[var(--text-muted)]">{r.rank}</span>
          {r.color && (
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: `var(--color-game-${r.color})` }}
            />
          )}
          <span className="flex-1 truncate font-medium">{r.label}</span>
          <span className="text-lg font-bold tabular-nums">{r.score}</span>
        </Card>
      ))}
    </ul>
  );
}
