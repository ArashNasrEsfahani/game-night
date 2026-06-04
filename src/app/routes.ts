export const ROUTES = {
  home: '/',
  players: '/players',
  settings: '/settings',
  game: '/g/:gameId',
} as const;

export const buildGamePath = (gameId: string) => `/g/${gameId}`;
