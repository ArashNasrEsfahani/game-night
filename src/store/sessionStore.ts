// src/store/sessionStore.ts — one in-progress match per gameId (PERSISTED; resume mid-match).
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './persist/idbStorage';
import { STORE_KEYS } from './persist/keys';
import type { GameConfig, GameStateBase, GameId } from '../sdk/types';

export type HostScreen = 'setup' | 'play' | 'results';

export interface GameSession {
  gameId: GameId;
  config: GameConfig;
  state: GameStateBase;
  screen: HostScreen;
  stateVersion: number;
  startedAt: number;
  updatedAt: number;
}

interface SessionStore {
  sessions: Record<GameId, GameSession>;
  hydrated: boolean;
  start: (gameId: GameId, init: Omit<GameSession, 'gameId' | 'startedAt'>) => void;
  update: (gameId: GameId, patch: Partial<GameSession>) => void;
  setScreen: (gameId: GameId, screen: HostScreen) => void;
  clear: (gameId: GameId) => void;
  getSession: (gameId: GameId) => GameSession | undefined;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      hydrated: false,
      start: (gameId, init) =>
        set((s) => ({
          sessions: { ...s.sessions, [gameId]: { ...init, gameId, startedAt: Date.now() } },
        })),
      update: (gameId, patch) =>
        set((s) => {
          const cur = s.sessions[gameId];
          if (!cur) return s;
          return { sessions: { ...s.sessions, [gameId]: { ...cur, ...patch } } };
        }),
      setScreen: (gameId, screen) =>
        set((s) => {
          const cur = s.sessions[gameId];
          if (!cur) return s;
          return { sessions: { ...s.sessions, [gameId]: { ...cur, screen } } };
        }),
      clear: (gameId) =>
        set((s) => {
          const next = { ...s.sessions };
          delete next[gameId];
          return { sessions: next };
        }),
      getSession: (gameId) => get().sessions[gameId],
    }),
    {
      name: STORE_KEYS.sessions,
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      partialize: (s) => ({ sessions: s.sessions }),
      onRehydrateStorage: () => () => {
        useSessionStore.setState({ hydrated: true });
      },
    },
  ),
);
