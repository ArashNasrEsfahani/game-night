// src/content/columns.ts — the flat column model shared by the grid editor and CSV round-trip.
import type { DatasetDescriptor, DatasetItem, EnumOption } from './types';
import type { LocalizedString } from '../sdk/types';

export type Column =
  | { kind: 'id'; header: string; label: LocalizedString }
  | { kind: 'loc'; key: string; lang: 'en' | 'fa'; header: string; label: LocalizedString; multiline?: boolean }
  | { kind: 'text'; key: string; header: string; label: LocalizedString }
  | { kind: 'enum'; key: string; header: string; label: LocalizedString; options: EnumOption[]; default: string };

/** Flat columns for a dataset. `header` is the stable CSV key; `label` is the human title. */
export function getColumns(ds: DatasetDescriptor): Column[] {
  const cols: Column[] = [{ kind: 'id', header: 'id', label: { en: 'id', fa: 'شناسه' } }];
  for (const f of ds.locFields) {
    cols.push({ kind: 'loc', key: f.key, lang: 'en', header: `${f.key}.en`, label: f.label, multiline: f.multiline });
    cols.push({ kind: 'loc', key: f.key, lang: 'fa', header: `${f.key}.fa`, label: f.label, multiline: f.multiline });
  }
  for (const f of ds.textFields ?? []) cols.push({ kind: 'text', key: f.key, header: f.key, label: f.label });
  for (const f of ds.enumFields ?? [])
    cols.push({ kind: 'enum', key: f.key, header: f.key, label: f.label, options: f.options, default: f.default });
  return cols;
}

/** Datasets with a nested sub-list (Spyfall roles) can't be flattened to a grid/CSV. */
export const isFlat = (ds: DatasetDescriptor): boolean => !ds.subList;

export function getCell(item: DatasetItem, col: Column): string {
  switch (col.kind) {
    case 'id':
      return item.id;
    case 'loc':
      return ((item[col.key] as LocalizedString | undefined)?.[col.lang]) ?? '';
    case 'text':
      return (item[col.key] as string) ?? '';
    case 'enum':
      return (item[col.key] as string) ?? col.default;
  }
}

export function setCell(item: DatasetItem, col: Column, value: string): void {
  switch (col.kind) {
    case 'id':
      item.id = value;
      break;
    case 'loc': {
      const cur = (item[col.key] as LocalizedString | undefined) ?? { en: '', fa: '' };
      item[col.key] = { ...cur, [col.lang]: value };
      break;
    }
    case 'text':
      item[col.key] = value;
      break;
    case 'enum':
      item[col.key] = value || col.default;
      break;
  }
}
