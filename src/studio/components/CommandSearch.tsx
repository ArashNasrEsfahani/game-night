// src/studio/components/CommandSearch.tsx — Ctrl/Cmd+K palette: search every word/phrase across
// every dataset and jump straight to its row. The core "edit fast" affordance.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ALL_DATASETS, CONTENT_GAMES } from '../../content/registry';
import type { LocalizedString } from '../../sdk/types';
import { buildDatasetHref } from '../routes';
import { cx, en } from '../lib/format';

interface Hit {
  gameId: string;
  datasetId: string;
  itemId: string;
  icon: string;
  dsTitle: string;
  text: string;
}

const LIMIT = 60;

function buildIndex(): Hit[] {
  const iconByGame = new Map(CONTENT_GAMES.map((g) => [g.gameId, g.manifest.icon]));
  const out: Hit[] = [];
  for (const ds of ALL_DATASETS) {
    const icon = iconByGame.get(ds.gameId) ?? '·';
    const dsTitle = en(ds.title);
    const primary = ds.locFields[0]?.key;
    if (!primary) continue;
    for (const it of ds.readItems()) {
      const ls = it[primary] as LocalizedString | undefined;
      const text = [ls?.en, ls?.fa].filter(Boolean).join('  ·  ');
      out.push({ gameId: ds.gameId, datasetId: ds.datasetId, itemId: it.id, icon, dsTitle, text });
    }
  }
  return out;
}

export function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Build the index lazily the first time the palette opens.
  const indexRef = useRef<Hit[] | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    if (open && !indexRef.current) {
      indexRef.current = buildIndex();
      force((n) => n + 1);
    }
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const results = useMemo(() => {
    const idx = indexRef.current ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return idx.slice(0, LIMIT);
    const out: Hit[] = [];
    for (const h of idx) {
      if (h.text.toLowerCase().includes(query) || h.text.includes(q.trim())) {
        out.push(h);
        if (out.length >= LIMIT) break;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, indexRef.current]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const pick = (h: Hit | undefined) => {
    if (!h) return;
    navigate(`${buildDatasetHref(h.gameId, h.datasetId)}?focus=${encodeURIComponent(h.itemId)}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--s-border-strong)] bg-[var(--s-elevated)] shadow-[var(--s-shadow)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--s-border)] px-4">
          <span className="text-[var(--s-dim)]">⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                pick(results[active]);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Search any word or phrase…"
            className="w-full bg-transparent py-3.5 text-sm text-[var(--s-text)] placeholder:text-[var(--s-dim)] outline-none"
          />
          <kbd className="rounded bg-[var(--s-panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--s-muted)]">Esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-auto py-1">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--s-dim)]">
              {indexRef.current ? 'No matches.' : 'Indexing…'}
            </p>
          ) : (
            results.map((h, i) => (
              <button
                key={`${h.gameId}/${h.datasetId}/${h.itemId}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h)}
                className={cx(
                  'flex w-full items-center gap-3 px-4 py-2 text-start',
                  i === active ? 'bg-[var(--s-accent-soft)]' : 'hover:bg-[var(--s-panel-2)]',
                )}
              >
                <span className="text-base">{h.icon}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--s-text)]">{h.text || <em className="text-[var(--s-dim)]">(empty)</em>}</span>
                <span className="shrink-0 text-xs text-[var(--s-dim)]">{h.dsTitle}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
