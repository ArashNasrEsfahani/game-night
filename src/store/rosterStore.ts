// src/store/rosterStore.ts — players + saved groups (persisted). Delegates to pure engine/roster.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './persist/idbStorage';
import { STORE_KEYS } from './persist/keys';
import * as roster from '../engine/roster';
import type { Player, RosterState } from '../engine/roster';
import { makeId, asPlayerId } from '../engine/ids';
import type { PlayerId } from '../sdk/types';

interface RosterStore extends RosterState {
  hydrated: boolean;
  addPlayer: (p: Omit<Player, 'id' | 'createdAt'>) => PlayerId;
  updatePlayer: (id: PlayerId, patch: Partial<Omit<Player, 'id'>>) => void;
  removePlayer: (id: PlayerId) => void;
  reorder: (orderedIds: PlayerId[]) => void;
  saveGroup: (name: string, memberIds: PlayerId[]) => string;
  deleteGroup: (id: string) => void;
}

export const useRosterStore = create<RosterStore>()(
  persist(
    (set) => ({
      players: [],
      groups: [],
      hydrated: false,
      addPlayer: (p) => {
        const id = asPlayerId('p_' + makeId(Date.now()));
        set((s) => roster.addPlayer(s, p, id, Date.now()));
        return id;
      },
      updatePlayer: (id, patch) => set((s) => roster.updatePlayer(s, id, patch)),
      removePlayer: (id) => set((s) => roster.removePlayer(s, id)),
      reorder: (orderedIds) => set((s) => roster.reorderPlayers(s, orderedIds)),
      saveGroup: (name, memberIds) => {
        const id = 'g_' + makeId(Date.now());
        set((s) => roster.saveGroup(s, name, memberIds, id, Date.now()));
        return id;
      },
      deleteGroup: (id) => set((s) => roster.deleteGroup(s, id)),
    }),
    {
      name: STORE_KEYS.roster,
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      partialize: (s) => ({ players: s.players, groups: s.groups }),
      onRehydrateStorage: () => () => {
        useRosterStore.setState({ hydrated: true });
      },
    },
  ),
);
