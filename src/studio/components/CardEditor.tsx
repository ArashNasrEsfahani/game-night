// src/studio/components/CardEditor.tsx — stacked-card editor for nested datasets (Spyfall
// location → roles) that can't be flattened into the grid. Filters come from the parent toolbar.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { DatasetDescriptor, DatasetItem, EnumFieldDef, LocFieldDef } from '../../content/types';
import type { LocalizedString } from '../../sdk/types';
import type { Flag } from '../../content/flagging';
import type { DatasetEditing } from '../lib/useDatasetEditing';
import { cx, en } from '../lib/format';

const FIELD =
  'w-full rounded-lg border border-[var(--s-border)] bg-[var(--s-sunk)] px-3 py-2 text-sm text-[var(--s-text)] outline-none placeholder:text-[var(--s-dim)]';

function LocFieldEditor({
  value,
  label,
  multiline,
  onChange,
}: {
  value: LocalizedString;
  label: string;
  multiline?: boolean;
  onChange: (lang: 'en' | 'fa', v: string) => void;
}) {
  const v = value ?? { en: '', fa: '' };
  const render = (lang: 'en' | 'fa') => {
    const common = {
      dir: lang === 'en' ? ('ltr' as const) : ('rtl' as const),
      lang,
      placeholder: lang === 'en' ? 'English' : 'فارسی',
      value: v[lang] ?? '',
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(lang, e.target.value),
      className: cx(FIELD, 'text-start'),
    };
    return multiline ? <textarea rows={2} {...common} /> : <input {...common} />;
  };
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-[var(--s-muted)]">{label}</span>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {render('en')}
        {render('fa')}
      </div>
    </div>
  );
}

function EnumPicker({ field, value, onChange }: { field: EnumFieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-[var(--s-muted)]">{en(field.label)}</span>
      <div className="flex flex-wrap gap-1.5">
        {field.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cx(
              'rounded-full px-3 py-1 text-sm font-medium transition-colors',
              value === opt.value
                ? 'bg-[var(--s-accent)] text-[var(--s-on-accent)]'
                : 'bg-[var(--s-panel-2)] text-[var(--s-text)] hover:bg-[var(--s-sunk)]',
            )}
          >
            {en(opt.label)}
          </button>
        ))}
      </div>
    </div>
  );
}

const ItemCard = memo(function ItemCard({
  item,
  index,
  ds,
  flags,
  ed,
  flash,
}: {
  item: DatasetItem;
  index: number;
  ds: DatasetDescriptor;
  flags: Flag[] | undefined;
  ed: DatasetEditing;
  flash: boolean;
}) {
  const sub = ds.subList;
  const subItems = sub ? ((item[sub.key] as DatasetItem[]) ?? []) : [];
  return (
    <div
      className={cx(
        'rounded-xl border bg-[var(--s-panel)] p-3',
        flags ? 'border-[var(--s-danger)]/40' : 'border-[var(--s-border)]',
        flash && 'ring-2 ring-[var(--s-accent)]',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-bold text-[var(--s-accent-2)]">#{index + 1}</span>
        <code className="flex-1 truncate text-[10px] text-[var(--s-dim)]">{item.id}</code>
        {flags && (
          <span title={flags.map((f) => en(f.label)).join(', ')} className="cursor-help text-[var(--s-danger)]">
            ⚠
          </span>
        )}
        <button
          onClick={() => ed.duplicateItem(item.id)}
          aria-label="Duplicate"
          className="grid h-7 w-7 place-items-center rounded-full bg-[var(--s-panel-2)] text-[var(--s-dim)] hover:text-[var(--s-text)]"
        >
          ⧉
        </button>
        <button
          onClick={() => ed.remove(item.id)}
          aria-label="Delete"
          className="grid h-7 w-7 place-items-center rounded-full bg-[var(--s-panel-2)] text-[var(--s-danger)]"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {ds.locFields.map((f: LocFieldDef) => (
          <LocFieldEditor
            key={f.key}
            label={en(f.label)}
            multiline={f.multiline}
            value={item[f.key] as LocalizedString}
            onChange={(lang, v) => ed.setLoc(item.id, f.key, lang, v)}
          />
        ))}

        {(ds.textFields ?? []).map((f) => (
          <div key={f.key}>
            <span className="mb-1 block text-xs font-semibold text-[var(--s-muted)]">{en(f.label)}</span>
            <input
              value={(item[f.key] as string) ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => ed.setText(item.id, f.key, e.target.value)}
              className={FIELD}
            />
          </div>
        ))}

        {(ds.enumFields ?? []).map((f) => (
          <EnumPicker key={f.key} field={f} value={(item[f.key] as string) ?? f.default} onChange={(v) => ed.setEnum(item.id, f.key, v)} />
        ))}

        {sub && (
          <div className="rounded-xl border border-[var(--s-border)] bg-[var(--s-sunk)]/60 p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--s-muted)]">
                {en(sub.itemNoun)} ({subItems.length})
              </span>
              <button
                onClick={() => ed.addSub(item.id)}
                className="rounded-full bg-[var(--s-panel-2)] px-2 py-0.5 text-xs font-semibold text-[var(--s-accent-2)] hover:bg-[var(--s-panel)]"
              >
                + {en(sub.itemNoun)}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {subItems.map((srow) => (
                <div key={srow.id} className="flex items-start gap-1.5">
                  <div className="flex-1">
                    {sub.locFields.map((sf) => (
                      <LocFieldEditor
                        key={sf.key}
                        label={en(sf.label)}
                        value={srow[sf.key] as LocalizedString}
                        onChange={(lang, v) => ed.setSubLoc(item.id, sub.key, srow.id, sf.key, lang, v)}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => ed.removeSub(item.id, srow.id)}
                    aria-label="Delete role"
                    className="mt-6 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--s-panel-2)] text-[var(--s-danger)]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

const PAGE = 40;

export function CardEditor({
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
  const [limit, setLimit] = useState(PAGE);
  const flashRef = useRef<HTMLDivElement>(null);

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

  // Ensure a Ctrl+K target is within the rendered window, then scroll to it.
  useEffect(() => {
    if (!focusId) return;
    const idx = filtered.findIndex((it) => it.id === focusId);
    if (idx >= 0 && idx + 1 > limit) setLimit(idx + 1);
    const t = setTimeout(() => flashRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, filtered]);

  const visible = filtered.slice(0, limit);

  return (
    <div className="min-h-0 flex-1 overflow-auto pb-24">
      <div className="flex flex-col gap-2">
        {visible.map((it) => {
          const isFocus = focusId === it.id;
          return (
            <div key={it.id} ref={isFocus ? flashRef : undefined}>
              <ItemCard item={it} index={ed.items.indexOf(it)} ds={ds} flags={ed.flags.get(it.id)} ed={ed} flash={isFocus} />
            </div>
          );
        })}
        {filtered.length === 0 && <p className="py-10 text-center text-sm text-[var(--s-dim)]">No matches.</p>}
        {visible.length < filtered.length && (
          <button
            onClick={() => setLimit((n) => n + PAGE)}
            className="self-start rounded-lg border border-[var(--s-border)] bg-[var(--s-panel-2)] px-3 py-1.5 text-sm font-medium text-[var(--s-text)] hover:bg-[var(--s-sunk)]"
          >
            Show more ({filtered.length - visible.length})
          </button>
        )}
      </div>
    </div>
  );
}
