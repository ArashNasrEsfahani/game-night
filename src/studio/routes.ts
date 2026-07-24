// src/studio/routes.ts — the Studio's own (hash) routes. Independent of the games app.
export const buildDatasetHref = (gameId: string, datasetId: string): string =>
  `/${gameId}/${encodeURIComponent(datasetId)}`;
