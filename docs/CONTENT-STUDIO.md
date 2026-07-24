# Content Studio — the standalone database editor

A separate little website for editing the datasets behind every game (words, prompts, dilemmas,
locations, role text…). It runs on its **own dev server and build**, shares the games' source JSON,
and **saves edits straight to those source files on disk** — so editing is fast and what you change
shows up in `git diff` immediately.

```bash
npm run studio          # dev server (http://localhost:5280) — saves to disk
npm run studio:build    # static build → dist-studio/
npm run studio:preview  # preview the static build (no disk writes; see "Hosting" below)
```

It is a **separate app from the games**: it loads the dataset descriptors + lightweight game
manifests, but none of the game screens/logic/sound. The player app (`npm run dev`) no longer has an
in-app editor.

## How saving works (write-to-disk)

1. You edit a cell/field. After ~600 ms of quiet, the Studio **autosaves**.
2. It POSTs the rebuilt file to `POST /__content/save`, a tiny dev-server plugin
   (`tools/vite-content-fs.ts`) that writes `JSON.stringify(file, null, 2) + "\n"` straight to the
   dataset's `sourcePath` under `src/games/**`.
3. The header badge shows **Saving… → Saved ✓**. The file on disk now matches — commit when ready.

Safety: the endpoint only runs on the local dev server and is hard-limited to `src/games/**/*.json`
(no path traversal, no other extensions). The Studio's own writes are excluded from the dev watcher,
so autosave never reloads the page mid-edit.

**Hosting / fallback.** If the Studio is served without that plugin (e.g. `studio:preview` or a
static host), it detects the missing endpoint and shows **Download mode** — Save degrades to a JSON
download you drop into the project. No data is lost.

## What you can edit

The Studio auto-discovers every game that exposes editable content — a game opts in simply by
exporting `DATASETS: DatasetDescriptor[]` from its content module (`src/content/registry.ts` globs
them). Today: Codenames, Dowr, Heads Up!, Most Likely To, Never Have I Ever, Pantomime, Spyfall,
Truth or Dare, Would You Rather, and Mafia.

Each dataset edits one source file. Add / edit / delete items, set per-item difficulty or intensity,
and (for Spyfall) edit a location's nested roles.

## The editor

- **Sidebar** — every game → its datasets, with item counts. `Ctrl/Cmd+K` opens a global search
  across **every** word/phrase; pick a hit to jump straight to that row.
- **Table view** (flat datasets) — a fast, **virtualized** grid (scrolls smoothly through thousands
  of rows, no pagination). Inline cells, Tab/Enter to move down a column, RTL Persian cells, add /
  duplicate / delete, and an **Undo** for structural changes.
- **Card view** (nested datasets, e.g. Spyfall locations → roles).
- **CSV round-trip** — **CSV ↓** exports (UTF-8 BOM, so Persian opens correctly in Excel/Sheets);
  edit there; **CSV ↑** imports it back (the `id` column matches rows). Then it autosaves.
- **Flagging** — the editor auto-flags likely problems (untranslated, no Persian script, duplicate
  id / duplicate text, gibberish, empty, a one-word term blown into a 3+ word Persian phrase, absurd
  length). Use **⚠ Flagged** to filter, then **Delete flagged** (with Undo). Nothing is ever deleted
  automatically.
- **Reset** restores a dataset to its built-in JSON.

## Mafia (the one exception)

Mafia's role text lives in `src/games/mafia/roles.ts`, not a JSON file (`sourcePath: null`), so it
**can't autosave to disk**. The Studio marks it ◇ and offers **JSON ↓** (download) instead. To make
it writable like the rest, extract its editable text into a JSON file that `roles.ts` imports.

## Adding a new editable dataset

In a game's content module, add a descriptor and rebuild from it (unchanged from before):

```ts
import { objectFileDataset } from '../../../content/datasetBuilders';
import { registerRebuilder } from '../../../content/overrides';

export const DATASETS = [
  objectFileDataset({
    gameId: 'my-game',
    datasetId: 'core',
    itemsKey: 'items',                 // file is { ..., items: [...] }  (use arrayFileDataset for a bare array)
    defaultFile: coreJson,
    sourcePath: 'src/games/my-game/content/core.json',
    title: { en: 'Core', fa: '…' },
    itemNoun: { en: 'item', fa: '…' },
    idPrefix: 'core-',
    locFields: [{ key: 'text', label: { en: 'Text', fa: 'متن' } }],
  }),
];

export const ITEMS = [];
function rebuild() { ITEMS.length = 0; ITEMS.push(...(DATASETS[0].readFile() as Any).items); }
registerRebuilder(rebuild);
```

The Studio picks it up automatically.

## Layout

```
studio.html                 editor entry
vite.studio.config.ts        studio dev server + build (own port, no PWA)
tools/vite-content-fs.ts     POST /__content/save → writes JSON to disk
src/studio/                  the editor app (UI)
src/content/                 shared kernel: descriptors, builders, flagging, CSV, columns, diskSave
src/games/*/content/*.json   the source data both the games and the Studio read
```
