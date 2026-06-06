import { describe, it, expect, beforeEach } from 'vitest';
import { useLeaderboardStore, leaderboardRows } from './leaderboardStore';

const names = { a: 'Ava', b: 'Bo', c: 'Cy', d: 'Dax' };

describe('leaderboard store', () => {
  beforeEach(() => useLeaderboardStore.getState().reset());

  it('tallies individual + team wins, counts participation, and dedups by match key', () => {
    const s = useLeaderboardStore.getState();
    s.record('mlt:1', { mode: 'individual', winnerIds: ['a'], participantIds: ['a', 'b', 'c'] }, names);
    s.record('mlt:1', { mode: 'individual', winnerIds: ['a'], participantIds: ['a', 'b', 'c'] }, names); // dup → ignored
    s.record('cn:1', { mode: 'team', winnerIds: ['a', 'b'], participantIds: ['a', 'b', 'c', 'd'] }, names);

    const st = useLeaderboardStore.getState();
    expect(st.totalMatches).toBe(2);
    expect(st.tallies['a']).toMatchObject({ name: 'Ava', individual: 1, team: 1, played: 2 });
    expect(st.tallies['b']).toMatchObject({ individual: 0, team: 1, played: 2 });
    expect(st.tallies['c']).toMatchObject({ individual: 0, team: 0, played: 2 });
    expect(st.tallies['d']).toMatchObject({ played: 1, team: 0, individual: 0 });
  });

  it('ranks by total wins (individual + team) in leaderboardRows', () => {
    const s = useLeaderboardStore.getState();
    s.record('m1', { mode: 'individual', winnerIds: ['b'], participantIds: ['a', 'b'] }, names);
    s.record('m2', { mode: 'team', winnerIds: ['b'], participantIds: ['a', 'b'] }, names);
    s.record('m3', { mode: 'individual', winnerIds: ['a'], participantIds: ['a', 'b'] }, names);
    const rows = leaderboardRows(useLeaderboardStore.getState().tallies);
    expect(rows[0].id).toBe('b'); // 2 wins
    expect(rows[0].total).toBe(2);
    expect(rows[1].id).toBe('a'); // 1 win
  });
});
