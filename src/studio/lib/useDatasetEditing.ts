// src/studio/lib/useDatasetEditing.ts — the Studio's editing engine.
//
// Unlike the old in-app editor (which wrote IDB overrides and made you download/commit), this
// autosaves edits straight to the dataset's source JSON on disk (debounced), so `git diff` updates
// as you type. When the disk endpoint isn't available (a static build), it degrades to a manual
// "Download JSON" with a dirty indicator. Reuses the framework-agnostic content kernel for flags,
// CSV round-trip and file shaping.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DatasetDescriptor, DatasetItem } from '../../content/types';
import type { LocalizedString } from '../../sdk/types';
import { computeFlags } from '../../content/flagging';
import type { Flag } from '../../content/flagging';
import { datasetToCSV, csvToItems } from '../../content/csv';
import { downloadText, exportFilename, toPrettyJSON } from '../../content/exporting';
import { diskSaveAvailable, saveToDisk } from '../../content/diskSave';

const AUTOSAVE_MS = 600;
const HISTORY_LIMIT = 100;

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
export type SaveMode = 'unknown' | 'disk' | 'download';

const emptyLoc = (): LocalizedString => ({ en: '', fa: '' });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function mintId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}${rand}`;
}

function firstDupId(items: DatasetItem[]): string | undefined {
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.id)) return it.id;
    seen.add(it.id);
  }
  return undefined;
}

export interface DatasetEditing {
  items: DatasetItem[];
  status: SaveStatus;
  error: string | null;
  mode: SaveMode;
  canDisk: boolean;
  // diagnostics
  flags: Map<string, Flag[]>;
  flaggedCount: number;
  dupIds: string[];
  emptyCount: number;
  // edits
  setLoc: (id: string, key: string, lang: 'en' | 'fa', v: string) => void;
  setText: (id: string, key: string, v: string) => void;
  setEnum: (id: string, key: string, v: string) => void;
  remove: (id: string) => void;
  addItem: () => DatasetItem;
  duplicateItem: (id: string) => void;
  deleteFlagged: () => void;
  replaceItems: (items: DatasetItem[]) => void;
  // nested (Spyfall roles)
  addSub: (id: string) => void;
  removeSub: (id: string, subId: string) => void;
  setSubLoc: (id: string, subKey: string, subId: string, key: string, lang: 'en' | 'fa', v: string) => void;
  // undo
  undo: () => void;
  canUndo: boolean;
  // persistence + io
  saveNow: () => Promise<void>;
  resetDefault: () => Promise<void>;
  download: () => void;
  exportCSV: () => void;
  importCSV: (file: File) => Promise<void>;
}

export function useDatasetEditing(ds: DatasetDescriptor): DatasetEditing {
  const [items, setItemsState] = useState<DatasetItem[]>(() => ds.readItems());
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SaveMode>('unknown');
  const [past, setPast] = useState<DatasetItem[][]>([]);

  const canDisk = mode === 'disk' && !!ds.sourcePath;

  const dirtyRef = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Probe whether the dev write-to-disk endpoint is reachable (once).
  useEffect(() => {
    let alive = true;
    diskSaveAvailable().then((ok) => alive && setMode(ok ? 'disk' : 'download'));
    return () => {
      alive = false;
    };
  }, []);

  // Push the current items onto the undo stack — called before structural changes.
  const snapshot = useCallback(() => {
    setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), clone(itemsRef.current)]);
  }, []);

  // Apply an edit: update items + mark dirty so the autosave effect fires.
  const edit = useCallback((next: (prev: DatasetItem[]) => DatasetItem[]) => {
    dirtyRef.current = true;
    setItemsState((prev) => next(prev));
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirtyRef.current) return;
    const dupe = firstDupId(itemsRef.current);
    if (dupe) {
      setStatus('error');
      setError(`Duplicate id "${dupe}" — fix it to save.`);
      return;
    }
    if (!ds.sourcePath) {
      // No JSON source (e.g. Mafia) — can't write to disk; leave it dirty for manual download.
      setStatus('dirty');
      return;
    }
    setStatus('saving');
    setError(null);
    try {
      await saveToDisk(ds.sourcePath, ds.toFile(itemsRef.current));
      dirtyRef.current = false;
      setStatus('saved');
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
    }
  }, [ds]);

  // Debounced autosave whenever items change (and we have a disk target).
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (!canDisk) {
      setStatus('dirty');
      return;
    }
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [items, canDisk, flush]);

  // ── field edits ─────────────────────────────────────────────────────────
  const setLoc = useCallback(
    (id: string, key: string, lang: 'en' | 'fa', v: string) =>
      edit((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, [key]: { ...((it[key] as LocalizedString) ?? emptyLoc()), [lang]: v } } : it,
        ),
      ),
    [edit],
  );

  const setText = useCallback(
    (id: string, key: string, v: string) =>
      edit((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: v } : it))),
    [edit],
  );

  const setEnum = useCallback(
    (id: string, key: string, v: string) =>
      edit((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: v } : it))),
    [edit],
  );

  const remove = useCallback(
    (id: string) => {
      snapshot();
      edit((prev) => prev.filter((it) => it.id !== id));
    },
    [edit, snapshot],
  );

  const addItem = useCallback(() => {
    const fresh = ds.newItem();
    snapshot();
    edit((prev) => [fresh, ...prev]);
    return fresh;
  }, [ds, edit, snapshot]);

  const duplicateItem = useCallback(
    (id: string) => {
      snapshot();
      edit((prev) => {
        const i = prev.findIndex((it) => it.id === id);
        if (i < 0) return prev;
        const copy = { ...clone(prev[i]), id: mintId(ds.idPrefix) };
        return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
      });
    },
    [ds, edit, snapshot],
  );

  const deleteFlagged = useCallback(() => {
    snapshot();
    edit((prev) => {
      const bad = computeFlags(prev, ds);
      return prev.filter((it) => !bad.has(it.id));
    });
  }, [ds, edit, snapshot]);

  const replaceItems = useCallback(
    (next: DatasetItem[]) => {
      snapshot();
      edit(() => next);
    },
    [edit, snapshot],
  );

  // ── nested sub-lists (Spyfall location → roles) ─────────────────────────
  const addSub = useCallback(
    (id: string) => {
      const sub = ds.subList;
      if (!sub) return;
      const fresh: DatasetItem = { id: mintId(sub.idPrefix) };
      for (const f of sub.locFields) fresh[f.key] = emptyLoc();
      edit((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, [sub.key]: [...((it[sub.key] as DatasetItem[]) ?? []), fresh] } : it,
        ),
      );
    },
    [ds, edit],
  );

  const removeSub = useCallback(
    (id: string, subId: string) => {
      const key = ds.subList?.key;
      if (!key) return;
      edit((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, [key]: ((it[key] as DatasetItem[]) ?? []).filter((s) => s.id !== subId) } : it,
        ),
      );
    },
    [ds, edit],
  );

  const setSubLoc = useCallback(
    (id: string, subKey: string, subId: string, key: string, lang: 'en' | 'fa', v: string) =>
      edit((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;
          const list = ((it[subKey] as DatasetItem[]) ?? []).map((s) =>
            s.id === subId ? { ...s, [key]: { ...((s[key] as LocalizedString) ?? emptyLoc()), [lang]: v } } : s,
          );
          return { ...it, [subKey]: list };
        }),
      ),
    [edit],
  );

  // ── undo ────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      dirtyRef.current = true;
      setItemsState(prev);
      return p.slice(0, -1);
    });
  }, []);

  // ── persistence + io ────────────────────────────────────────────────────
  const resetDefault = useCallback(async () => {
    snapshot();
    const fresh = ds.readItems();
    setItemsState(fresh);
    if (ds.sourcePath && mode === 'disk') {
      setStatus('saving');
      try {
        await saveToDisk(ds.sourcePath, ds.defaultFile());
        dirtyRef.current = false;
        setStatus('saved');
      } catch (e) {
        setStatus('error');
        setError((e as Error).message);
      }
    } else {
      dirtyRef.current = true;
      setStatus('dirty');
    }
  }, [ds, mode, snapshot]);

  const download = useCallback(() => {
    downloadText(exportFilename(ds), toPrettyJSON(ds.toFile(itemsRef.current)));
  }, [ds]);

  const exportCSV = useCallback(() => {
    const name = exportFilename(ds).replace(/\.json$/i, '.csv');
    downloadText(name, datasetToCSV(ds, itemsRef.current), 'text/csv');
  }, [ds]);

  const importCSV = useCallback(
    async (file: File) => {
      const text = await file.text();
      const next = csvToItems(ds, text, itemsRef.current);
      replaceItems(next);
    },
    [ds, replaceItems],
  );

  // ── derived diagnostics ─────────────────────────────────────────────────
  const flags = useMemo(() => computeFlags(items, ds), [items, ds]);
  const dupIds = useMemo(() => {
    const ids = items.map((it) => it.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  }, [items]);
  const emptyCount = useMemo(() => {
    const primary = ds.locFields[0]?.key;
    if (!primary) return 0;
    return items.filter((it) => {
      const ls = it[primary] as LocalizedString | undefined;
      return !ls?.en?.trim() || !ls?.fa?.trim();
    }).length;
  }, [items, ds]);

  return {
    items,
    status,
    error,
    mode,
    canDisk,
    flags,
    flaggedCount: flags.size,
    dupIds,
    emptyCount,
    setLoc,
    setText,
    setEnum,
    remove,
    addItem,
    duplicateItem,
    deleteFlagged,
    replaceItems,
    addSub,
    removeSub,
    setSubLoc,
    undo,
    canUndo: past.length > 0,
    saveNow: flush,
    resetDefault,
    download,
    exportCSV,
    importCSV,
  };
}
