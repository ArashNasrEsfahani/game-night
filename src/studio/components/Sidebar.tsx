// src/studio/components/Sidebar.tsx — game → dataset navigation tree + global controls.
import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CONTENT_GAMES } from '../../content/registry';
import { diskSaveAvailable } from '../../content/diskSave';
import { buildDatasetHref } from '../routes';
import { cx, en } from '../lib/format';

function DiskStatus() {
  const [mode, setMode] = useState<'unknown' | 'disk' | 'download'>('unknown');
  useEffect(() => {
    let alive = true;
    diskSaveAvailable().then((ok) => alive && setMode(ok ? 'disk' : 'download'));
    return () => {
      alive = false;
    };
  }, []);
  const ok = mode === 'disk';
  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium',
        mode === 'unknown' && 'text-[var(--s-dim)]',
        ok && 'bg-[var(--s-ok-soft)] text-[var(--s-ok)]',
        mode === 'download' && 'bg-[var(--s-warn-soft)] text-[var(--s-warn)]',
      )}
      title={ok ? 'Edits write straight to the source JSON on disk.' : 'Disk endpoint not found — edits export via Download.'}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', ok ? 'bg-[var(--s-ok)]' : 'bg-[var(--s-warn)]')} />
      {mode === 'unknown' ? 'Checking…' : ok ? 'Saving to disk' : 'Download mode'}
    </div>
  );
}

export function Sidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of CONTENT_GAMES) for (const d of g.datasets) m.set(`${d.gameId}/${d.datasetId}`, d.readItems().length);
    return m;
  }, []);
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('studio-theme') as 'dark' | 'light') ?? 'dark',
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('studio-theme', theme);
  }, [theme]);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--s-border)] bg-[var(--s-panel)]">
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--s-accent)] text-[var(--s-on-accent)]">◆</div>
        <NavLink to="/" className="text-sm font-bold tracking-tight text-[var(--s-text)]">
          Content Studio
        </NavLink>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={onOpenSearch}
          className="flex w-full items-center gap-2 rounded-lg border border-[var(--s-border)] bg-[var(--s-sunk)] px-3 py-2 text-sm text-[var(--s-dim)] hover:border-[var(--s-border-strong)]"
        >
          <span>⌕</span>
          <span className="flex-1 text-start">Search everything…</span>
          <kbd className="rounded bg-[var(--s-panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--s-muted)]">Ctrl K</kbd>
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-auto px-2 py-1">
        {CONTENT_GAMES.map((g) => (
          <div key={g.gameId} className="mb-1.5">
            <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--s-dim)]">
              <span className="text-base">{g.manifest.icon}</span>
              <span className="truncate">{en(g.manifest.name)}</span>
            </div>
            <div className="flex flex-col">
              {g.datasets.map((d) => (
                <NavLink
                  key={d.datasetId}
                  to={buildDatasetHref(d.gameId, d.datasetId)}
                  className={({ isActive }) =>
                    cx(
                      'mx-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm',
                      isActive
                        ? 'bg-[var(--s-accent-soft)] font-semibold text-[var(--s-text)]'
                        : 'text-[var(--s-muted)] hover:bg-[var(--s-panel-2)] hover:text-[var(--s-text)]',
                    )
                  }
                >
                  <span className="flex-1 truncate">{en(d.title)}</span>
                  {!d.sourcePath && <span title="No JSON source — download only" className="text-[var(--s-warn)]">◇</span>}
                  <span className="text-xs text-[var(--s-dim)]">{counts.get(`${d.gameId}/${d.datasetId}`)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--s-border)] px-3 py-2.5">
        <DiskStatus />
        <button
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--s-panel-2)] text-[var(--s-muted)] hover:text-[var(--s-text)]"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☾' : '☀'}
        </button>
      </div>
    </aside>
  );
}
