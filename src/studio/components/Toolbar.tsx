// src/studio/components/Toolbar.tsx — actions + filters for the active dataset.
import { useRef } from 'react';
import type { DatasetEditing } from '../lib/useDatasetEditing';
import { cx } from '../lib/format';

const BTN = 'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const GHOST = `${BTN} bg-[var(--s-panel-2)] text-[var(--s-text)] border border-[var(--s-border)] hover:bg-[var(--s-sunk)]`;
const PRIMARY = `${BTN} bg-[var(--s-accent)] text-[var(--s-on-accent)] hover:bg-[var(--s-accent-strong)]`;

export function Toolbar({
  ed,
  search,
  setSearch,
  flaggedOnly,
  setFlaggedOnly,
}: {
  ed: DatasetEditing;
  search: string;
  setSearch: (v: string) => void;
  flaggedOnly: boolean;
  setFlaggedOnly: (v: boolean) => void;
}) {
  const csvRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-44 flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--s-dim)]">⌕</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter rows…"
          className="w-full rounded-lg border border-[var(--s-border)] bg-[var(--s-sunk)] py-1.5 pl-9 pr-3 text-sm text-[var(--s-text)] placeholder:text-[var(--s-dim)] outline-none"
        />
      </div>

      <button onClick={() => ed.addItem()} className={PRIMARY}>
        + Add
      </button>

      <button onClick={ed.undo} disabled={!ed.canUndo} className={GHOST} title="Undo last structural change">
        ↺ Undo
      </button>

      <button
        onClick={() => setFlaggedOnly(!flaggedOnly)}
        className={cx(
          BTN,
          'border',
          flaggedOnly
            ? 'border-transparent bg-[var(--s-warn)] text-[#1b1300]'
            : 'border-[var(--s-border)] bg-[var(--s-panel-2)] text-[var(--s-text)] hover:bg-[var(--s-sunk)]',
        )}
        title="Show only flagged rows"
      >
        ⚠ Flagged{ed.flaggedCount ? ` (${ed.flaggedCount})` : ''}
      </button>

      {ed.flaggedCount > 0 && (
        <button
          onClick={() => {
            if (window.confirm(`Delete all ${ed.flaggedCount} flagged row(s)? You can Undo.`)) ed.deleteFlagged();
          }}
          className={cx(GHOST, 'text-[var(--s-danger)]')}
        >
          Delete flagged
        </button>
      )}

      <span className="mx-0.5 h-5 w-px bg-[var(--s-border)]" />

      <button onClick={ed.exportCSV} className={GHOST} title="Export CSV (UTF-8 BOM for Excel/Sheets)">
        CSV ↓
      </button>
      <button onClick={() => csvRef.current?.click()} className={GHOST} title="Import CSV (replaces rows)">
        CSV ↑
      </button>
      <button onClick={ed.download} className={GHOST} title="Download this dataset's JSON">
        JSON ↓
      </button>
      <button onClick={ed.resetDefault} className={cx(GHOST, 'text-[var(--s-muted)]')} title="Restore the built-in content">
        Reset
      </button>

      <input
        ref={csvRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) await ed.importCSV(f);
        }}
      />
    </div>
  );
}
