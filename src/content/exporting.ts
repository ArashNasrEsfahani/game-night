// src/content/exporting.ts — download / import dataset JSON so edits can be committed back.
import type { DatasetDescriptor } from './types';
import { ALL_DATASETS } from './registry';

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Filename used when exporting a dataset (matches the repo source file when there is one). */
export function exportFilename(ds: DatasetDescriptor): string {
  return ds.sourcePath ? basename(ds.sourcePath) : `${ds.gameId}.${ds.datasetId}.json`;
}

export function toPrettyJSON(data: unknown): string {
  return JSON.stringify(data, null, 2) + '\n';
}

/** Trigger a browser download of arbitrary text (works in the dev browser + most webviews). */
export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download one dataset's effective JSON, ready to paste into its source file. */
export function downloadDataset(ds: DatasetDescriptor): void {
  downloadText(exportFilename(ds), toPrettyJSON(ds.readFile()));
}

export async function copyDataset(ds: DatasetDescriptor): Promise<void> {
  await navigator.clipboard.writeText(toPrettyJSON(ds.readFile()));
}

/** One bundle of every currently-overridden dataset, keyed by repo path. Handy as a backup. */
export function downloadAllOverrides(): { count: number } {
  const overridden = ALL_DATASETS.filter((d) => d.isOverridden());
  const bundle: Record<string, unknown> = {};
  for (const d of overridden) {
    bundle[d.sourcePath ?? `${d.gameId}/${d.datasetId}`] = d.readFile();
  }
  downloadText('content-overrides.json', toPrettyJSON(bundle));
  return { count: overridden.length };
}

/** Read + parse a user-selected JSON file. */
export function parseJSONFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error('That file is not valid JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsText(file);
  });
}
