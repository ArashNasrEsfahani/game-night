// src/studio/pages/DashboardPage.tsx — landing overview of every game and its datasets.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CONTENT_GAMES } from '../../content/registry';
import { buildDatasetHref } from '../routes';
import { en } from '../lib/format';

export function DashboardPage() {
  const stats = useMemo(() => {
    const perDataset = new Map<string, number>();
    let items = 0;
    let datasets = 0;
    for (const g of CONTENT_GAMES) {
      for (const d of g.datasets) {
        const n = d.readItems().length;
        perDataset.set(`${d.gameId}/${d.datasetId}`, n);
        items += n;
        datasets += 1;
      }
    }
    return { perDataset, items, datasets };
  }, []);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--s-text)]">Databases</h1>
        <p className="mt-1 text-sm text-[var(--s-muted)]">
          {stats.items.toLocaleString()} items across {stats.datasets} datasets · {CONTENT_GAMES.length} games. Edits save
          straight to the source files — open one and just type.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTENT_GAMES.map((g) => (
            <div key={g.gameId} className="rounded-2xl border border-[var(--s-border)] bg-[var(--s-panel)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-2xl">{g.manifest.icon}</span>
                <h2 className="flex-1 truncate text-base font-bold text-[var(--s-text)]">{en(g.manifest.name)}</h2>
              </div>
              <div className="flex flex-col gap-1">
                {g.datasets.map((d) => (
                  <Link
                    key={d.datasetId}
                    to={buildDatasetHref(d.gameId, d.datasetId)}
                    className="group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--s-muted)] hover:bg-[var(--s-panel-2)] hover:text-[var(--s-text)]"
                  >
                    <span className="flex-1 truncate">{en(d.title)}</span>
                    {!d.sourcePath && <span title="No JSON source — download only" className="text-[var(--s-warn)]">◇</span>}
                    <span className="text-xs text-[var(--s-dim)]">{stats.perDataset.get(`${d.gameId}/${d.datasetId}`)}</span>
                    <span className="text-[var(--s-dim)] opacity-0 transition-opacity group-hover:opacity-100">→</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
