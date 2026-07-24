// src/content/config.ts — single switch for who may edit the game datasets.
//
// DEV (npm run dev) → the Content Studio is available and on-device overrides are loaded.
// RELEASE (vite build / the Android app) → editing is OFF: the entry points and routes are
// hidden AND overrides are never read, so the shipped games use ONLY the built-in JSON that
// was committed to the repo. End users cannot change the database.
//
// To allow on-device editing in a release later (e.g. behind a hidden unlock), change this to
// your own condition — it is the only place that decides.
export const CONTENT_EDITING_ENABLED: boolean = import.meta.env.DEV;
