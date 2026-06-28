// src/studio/components/TableEditor.tsx — the fast, virtualized grid for flat datasets.
//
// Renders only the rows in view (via @tanstack/react-virtual), so a ~2000-word pack scrolls
// smoothly with no pagination. Reuses the shared column model (content/columns.ts). Enter moves
// down the same column (scrolling off-screen rows into view first); Tab is native.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { DatasetDescriptor } from '../../content/types';
import type { LocalizedString } from '../../sdk/types';
import { getColumns, getCell } from '../../content/columns';
import type { Column } from '../../content/columns';
import type { DatasetEditing } from '../lib/useDatasetEditing';
import { cx, en } from '../lib/format';

const ROW_H = 40;
const CELL = 'h-full w-full bg-transparent px-2 text-sm text-[var(--s-text)] outline-none focus:bg-[var(--s-accent-soft)]';

function template(columns: Column[]): string {
  const parts = ['44px'];
  for (const c of columns) {
    if (c.kind === 'id') parts.push('128px');
    else if (c.kind === 'enum') parts.push('150px');
    else if (c.kind === 'text') parts.push('110px');
    else parts.push('minmax(190px, 1fr)');
  }
  parts.push('76px');
  return parts.join(' ');
}

export function TableEditor({
  ds,
  ed,
  search,
  flaggedOnly,
  focusId,
}: {
  ds: DatasetDescriptor;
  ed: DatasetEditing;
  search: string;
  flaggedOnly: boolean;
  focusId?: string | null;
}) {
  const columns = useMemo(() => getColumns(ds), [ds]);
  const grid = useMemo(() => template(columns), [columns]);
  const parentRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ row: number; col: number } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ed.items.filter((it) => {
      if (flaggedOnly && !ed.flags.has(it.id)) return false;
      if (!q) return true;
      return ds.locFields.some((f) => {
        const ls = it[f.key] as LocalizedString | undefined;
        return ls && ((ls.en ?? '').toLowerCase().includes(q) || (ls.fa ?? '').includes(search));
      });
    });
  }, [ed.items, ed.flags, search, flaggedOnly, ds]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 14,
  });

  // Jump-to-row from global search (Ctrl+K) — scroll it into view + flash-highlight.
  useEffect(() => {
    if (!focusId) return;
    const idx = filtered.findIndex((it) => it.id === focusId);
    if (idx < 0) return;
    rowVirtualizer.scrollToIndex(idx, { align: 'center' });
    setFlashId(focusId);
    const t = setTimeout(() => setFlashId(null), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  // After Enter scrolls an off-screen row in, focus the target cell.
  useLayoutEffect(() => {
    const want = pendingFocus.current;
    if (!want) return;
    const el = parentRef.current?.querySelector<HTMLElement>(`[data-row="${want.row}"][data-col="${want.col}"]`);
    if (el) {
      el.focus();
      pendingFocus.current = null;
    }
  });

  const onKey = (e: ReactKeyboardEvent<HTMLElement>, rowIdx: number, colIdx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = rowIdx + 1;
      if (next >= filtered.length) return;
      pendingFocus.current = { row: next, col: colIdx };
      rowVirtualizer.scrollToIndex(next, { align: 'auto' });
      // If already rendered, focus immediately; otherwise the layout effect handles it.
      parentRef.current?.querySelector<HTMLElement>(`[data-row="${next}"][data-col="${colIdx}"]`)?.focus();
    }
  };

  const vItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--s-border)] bg-[var(--s-panel)]">
      {/* header */}
      <div
        className="grid items-center border-b border-[var(--s-border)] bg-[var(--s-elevated)] text-[11px] font-semibold uppercase tracking-wide text-[var(--s-dim)]"
        style={{ gridTemplateColumns: grid }}
      >
        <div className="px-2 py-2 text-center">#</div>
        {columns.map((c, i) => (
          <div key={i} className="truncate px-2 py-2" dir="ltr">
            {c.kind === 'loc' ? `${en(c.label)} · ${c.lang.toUpperCase()}` : en(c.label)}
          </div>
        ))}
        <div className="px-2 py-2" />
      </div>

      {/* virtualized body */}
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--s-dim)]">No rows match.</p>
        ) : (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {vItems.map((v) => {
              const item = filtered[v.index];
              const rowFlags = ed.flags.get(item.id);
              return (
                <div
                  key={item.id}
                  className={cx(
                    'grid items-stretch border-b border-[var(--s-border)]/60',
                    rowFlags && 'bg-[var(--s-danger-soft)]',
                    flashId === item.id && 'ring-2 ring-[var(--s-accent)] ring-inset',
                  )}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: ROW_H,
                    transform: `translateY(${v.start}px)`,
                    gridTemplateColumns: grid,
                  }}
                >
                  <div
                    className="flex items-center justify-center text-center text-[11px] text-[var(--s-dim)]"
                    title={rowFlags?.map((f) => en(f.label)).join(', ')}
                  >
                    {rowFlags ? <span className="cursor-help text-[var(--s-danger)]">⚠</span> : v.index + 1}
                  </div>

                  {columns.map((col, ci) =>
                    col.kind === 'id' ? (
                      <div key={ci} className="flex items-center overflow-hidden px-2">
                        <code className="truncate text-[10px] text-[var(--s-dim)]">{item.id}</code>
                      </div>
                    ) : col.kind === 'enum' ? (
                      <select
                        key={ci}
                        data-row={v.index}
                        data-col={ci}
                        value={getCell(item, col)}
                        onChange={(e) => ed.setEnum(item.id, col.key, e.target.value)}
                        className={cx(CELL, 'cursor-pointer')}
                      >
                        {col.options.map((o) => (
                          <option key={o.value} value={o.value} className="bg-[var(--s-panel)]">
                            {en(o.label)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        key={ci}
                        data-row={v.index}
                        data-col={ci}
                        dir={col.kind === 'loc' && col.lang === 'fa' ? 'rtl' : 'ltr'}
                        value={getCell(item, col)}
                        onKeyDown={(e) => onKey(e, v.index, ci)}
                        onChange={(e) =>
                          col.kind === 'loc'
                            ? ed.setLoc(item.id, col.key, col.lang, e.target.value)
                            : ed.setText(item.id, col.key, e.target.value)
                        }
                        className={CELL}
                      />
                    ),
                  )}

                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => ed.duplicateItem(item.id)}
                      className="rounded px-1.5 text-[var(--s-dim)] hover:text-[var(--s-text)]"
                      title="Duplicate row"
                      aria-label="Duplicate row"
                    >
                      ⧉
                    </button>
                    <button
                      onClick={() => ed.remove(item.id)}
                      className="rounded px-1.5 text-[var(--s-dim)] hover:text-[var(--s-danger)]"
                      title="Delete row"
                      aria-label="Delete row"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--s-border)] bg-[var(--s-elevated)] px-3 py-1.5 text-xs text-[var(--s-dim)]">
        {filtered.length} of {ed.items.length} rows
        {ed.emptyCount > 0 && <span className="ml-2 text-[var(--s-warn)]">· {ed.emptyCount} incomplete</span>}
      </div>
    </div>
  );
}
