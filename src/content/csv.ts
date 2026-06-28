// src/content/csv.ts — CSV round-trip so datasets can be edited in Excel / Google Sheets.
import type { DatasetDescriptor, DatasetItem } from './types';
import { getColumns, getCell, setCell } from './columns';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Encode a 2-D grid as CSV. Prepends a UTF-8 BOM so Excel reads Persian correctly. */
export function encodeCSV(rows: string[][]): string {
  const esc = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

/** Parse CSV text into a 2-D grid (handles quotes, embedded commas/newlines). */
export function parseCSV(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export function datasetToCSV(ds: DatasetDescriptor, items: DatasetItem[]): string {
  const cols = getColumns(ds);
  const rows = [cols.map((c) => c.header), ...items.map((it) => cols.map((c) => getCell(it, c)))];
  return encodeCSV(rows);
}

/** Build a full item list from CSV text (the CSV is the source of truth — handles deletions).
 *  Rows with an existing id update that item; new ids add rows (with file-wide constants kept). */
export function csvToItems(ds: DatasetDescriptor, text: string, current: DatasetItem[]): DatasetItem[] {
  const grid = parseCSV(text);
  if (grid.length < 2) throw new Error('CSV has no data rows.');
  const headers = grid[0].map((h) => h.trim());
  const idIdx = headers.indexOf('id');
  if (idIdx === -1) throw new Error('CSV must include an "id" column.');

  const cols = getColumns(ds);
  const colByHeader = new Map(cols.map((c) => [c.header, c]));
  const existing = new Map(current.map((it) => [it.id, it]));

  const out: DatasetItem[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const id = (cells[idIdx] ?? '').trim();
    const base: DatasetItem = id && existing.has(id) ? clone(existing.get(id)!) : ds.newItem();
    if (id) base.id = id;
    for (let c = 0; c < headers.length; c++) {
      const col = colByHeader.get(headers[c]);
      if (!col || col.kind === 'id') continue;
      setCell(base, col, cells[c] ?? '');
    }
    out.push(base);
  }
  return out;
}
