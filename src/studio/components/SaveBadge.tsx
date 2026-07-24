// src/studio/components/SaveBadge.tsx — the live autosave indicator.
import type { SaveMode, SaveStatus } from '../lib/useDatasetEditing';
import { cx } from '../lib/format';

const DOT = 'inline-block h-1.5 w-1.5 rounded-full';

export function SaveBadge({
  status,
  mode,
  hasSource,
}: {
  status: SaveStatus;
  mode: SaveMode;
  hasSource: boolean;
}) {
  if (!hasSource) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--s-warn-soft)] px-2.5 py-1 text-xs font-medium text-[var(--s-warn)]">
        <span className={cx(DOT, 'bg-[var(--s-warn)]')} /> No file — download only
      </span>
    );
  }
  const map: Record<SaveStatus, { label: string; cls: string; dot: string }> = {
    idle:
      mode === 'download'
        ? { label: 'Download mode', cls: 'text-[var(--s-muted)]', dot: 'bg-[var(--s-muted)]' }
        : { label: 'Saving to disk', cls: 'text-[var(--s-muted)]', dot: 'bg-[var(--s-ok)]' },
    dirty: { label: 'Unsaved', cls: 'text-[var(--s-warn)]', dot: 'bg-[var(--s-warn)]' },
    saving: { label: 'Saving…', cls: 'text-[var(--s-muted)]', dot: 'bg-[var(--s-accent-2)] animate-pulse' },
    saved: { label: 'Saved', cls: 'text-[var(--s-ok)]', dot: 'bg-[var(--s-ok)]' },
    error: { label: 'Save failed', cls: 'text-[var(--s-danger)]', dot: 'bg-[var(--s-danger)]' },
  };
  const s = map[status];
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full bg-[var(--s-sunk)] px-2.5 py-1 text-xs font-medium', s.cls)}>
      <span className={cx(DOT, s.dot)} />
      {s.label}
      {status === 'saved' && <span aria-hidden>✓</span>}
    </span>
  );
}
