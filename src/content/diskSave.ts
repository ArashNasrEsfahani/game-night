// src/content/diskSave.ts — write an edited dataset straight to its source JSON on disk.
//
// The Content Studio dev server (vite.studio.config.ts) mounts the middleware in
// tools/vite-content-fs.ts, which exposes:
//   • GET  /__content/health  → { ok: true }      (capability probe)
//   • POST /__content/save    → writes the file    ({ sourcePath, content })
//
// When that endpoint is absent (a static build / `vite preview`), diskSaveAvailable() resolves
// false and callers fall back to a browser download (src/content/exporting.ts). No data is lost.
import { toPrettyJSON } from './exporting';

let cached: boolean | null = null;
let probe: Promise<boolean> | null = null;

/** True when the dev write-to-disk endpoint is reachable. Probed once, then cached. */
export function diskSaveAvailable(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  if (!probe) {
    probe = fetch('/__content/health', { method: 'GET' })
      .then((r) => r.ok)
      .catch(() => false)
      .then((ok) => (cached = ok));
  }
  return probe;
}

/** Write a dataset's file object to its repo-relative source path. Throws on a rejected write. */
export async function saveToDisk(sourcePath: string, file: unknown): Promise<void> {
  const res = await fetch('/__content/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // Send the already-pretty text so the on-disk formatting exactly matches the repo convention
    // (2-space indent + trailing newline, via toPrettyJSON) regardless of the server's JSON codec.
    body: JSON.stringify({ sourcePath, content: toPrettyJSON(file) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Could not save to ${sourcePath} (HTTP ${res.status}). ${detail}`.trim());
  }
}
