// src/store/leaderboardStore.ts — cross-game overall leaderboard (PERSISTED). Each finished match
// is recorded once (deduped by match key); per player we tally individual wins, team/group wins,
// and games played. Names are snapshotted so the board survives roster edits.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './persist/idbStorage';
import { STORE_KEYS } from './persist/keys';
import type { MatchOutcome } from '../sdk/types';

export interface PlayerTally {
  id: string;
  name: string;
  individual: number; // free-for-all wins
  team: number; // team/group wins
  played: number; // matches participated in
}

interface LeaderboardStore {
  tallies: Record<string, PlayerTally>;
  recorded: string[]; // match keys already counted (dedupe)
  totalMatches: number;
  hydrated: boolean;
  /** Record a finished match. `names` maps player id → display name (from the match config). */
  record: (matchKey: string, outcome: MatchOutcome, names: Record<string, string>) => void;
  reset: () => void;
}

export const useLeaderboardStore = create<LeaderboardStore>()(
  persist(
    (set) => ({
      tallies: {},
      recorded: [],
      totalMatches: 0,
      hydrated: false,
      record: (matchKey, outcome, names) =>
        set((s) => {
          if (s.recorded.includes(matchKey)) return s;
          const tallies = { ...s.tallies };
          const ensure = (id: string): PlayerTally => {
            const cur = tallies[id];
            const next: PlayerTally = cur
              ? { ...cur }
              : { id, name: names[id] ?? id, individual: 0, team: 0, played: 0 };
            if (names[id]) next.name = names[id];
            tallies[id] = next;
            return next;
          };
          for (const id of outcome.participantIds) ensure(id).played += 1;
          for (const id of outcome.winnerIds) {
            const t = ensure(id);
            if (outcome.mode === 'team') t.team += 1;
            else t.individual += 1;
          }
          return {
            tallies,
            recorded: [...s.recorded, matchKey],
            totalMatches: s.totalMatches + 1,
          };
        }),
      reset: () => set({ tallies: {}, recorded: [], totalMatches: 0 }),
    }),
    {
      name: STORE_KEYS.leaderboard,
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      partialize: (s) => ({
        tallies: s.tallies,
        recorded: s.recorded,
        totalMatches: s.totalMatches,
      }),
      onRehydrateStorage: () => () => {
        useLeaderboardStore.setState({ hydrated: true });
      },
    },
  ),
);

/** Sorted standings (total wins desc, then individual, then name). */
export function leaderboardRows(tallies: Record<string, PlayerTally>): (PlayerTally & { total: number })[] {
  return Object.values(tallies)
    .map((t) => ({ ...t, total: t.individual + t.team }))
    .sort((a, b) => b.total - a.total || b.individual - a.individual || a.name.localeCompare(b.name));
}
