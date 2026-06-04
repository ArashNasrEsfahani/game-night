import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerSeat } from '../../sdk/types';
import { asPlayerId } from '../../engine/ids';
import {
  createInitialState,
  reducer,
  buildNightQueue,
  checkWin,
  tallyVotes,
} from './logic';
import type { MafiaPlayer, MafiaState } from './logic';
import { DEFAULT_OPTIONS } from './config';
import type { MafiaOptions } from './config';
import { validateContent } from './content';
import { ROLES } from './roles';

const seat = (id: string): PlayerSeat => ({ id: asPlayerId(id), name: id.toUpperCase() });
const ids7 = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

function makeConfig(options: Partial<MafiaOptions> = {}, ids = ids7): GameConfig {
  return {
    players: ids.map(seat),
    options: {
      ...DEFAULT_OPTIONS,
      composition: { mafia: 2, detective: 1, doctor: 1, citizen: 3 },
      ...options,
    },
    lang: 'en',
  };
}

function dealAll(s: MafiaState): MafiaState {
  let i = 0;
  while (s.phase === 'deal' && i++ < 50) s = reducer(s, { type: 'DEAL_NEXT' });
  return s;
}
function stepNight(s: MafiaState, targets: Record<string, string>): MafiaState {
  let i = 0;
  while (s.phase === 'night' && i++ < 20) {
    const step = s.nightQueue[s.nightCursor];
    if (targets[step.key] !== undefined) {
      s = reducer(s, { type: 'RECORD_NIGHT_ACTION', actorId: step.actorIds[0], targetId: targets[step.key] });
    } else if (step.skippable) {
      s = reducer(s, { type: 'RECORD_NIGHT_ACTION', actorId: step.actorIds[0], targetId: null, skipped: true });
    }
    s = reducer(s, { type: 'NIGHT_STEP_NEXT' });
  }
  return s;
}
const player = (id: string, roleId: string, alive: boolean): MafiaPlayer => ({
  id,
  roleId,
  faction: ROLES[roleId]?.faction ?? 'town',
  alive,
  dealtAt: 0,
  diedRound: null,
  diedBy: null,
  uses: {},
  lastProtected: null,
});

describe('mafia content', () => {
  it('ships valid bilingual roles and presets', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('mafia createInitialState', () => {
  it('deals the exact composition, deterministically', () => {
    const s = createInitialState(makeConfig(), 42);
    expect(s.phase).toBe('deal');
    expect(s.players).toHaveLength(7);
    const byRole = (r: string) => s.players.filter((p) => p.roleId === r).length;
    expect(byRole('mafia')).toBe(2);
    expect(byRole('detective')).toBe(1);
    expect(byRole('doctor')).toBe(1);
    expect(byRole('citizen')).toBe(3);
    expect(createInitialState(makeConfig(), 42).players).toEqual(s.players);
  });

  it('rejects bad configs', () => {
    expect(createInitialState(makeConfig({}, ['a', 'b', 'c']), 1).phase).toBe('error');
    expect(createInitialState(makeConfig({ composition: { mafia: 1, citizen: 3 } }), 1).phase).toBe('error'); // sum 4 != 7
    expect(createInitialState(makeConfig({ composition: { mafia: 4, citizen: 3 } }), 1).phase).toBe('error'); // mafia parity
  });
});

describe('mafia checkWin', () => {
  it('decides town / mafia / draw / continue', () => {
    expect(checkWin([player('a', 'citizen', true), player('b', 'detective', true)])).toBe('town');
    expect(checkWin([player('a', 'mafia', true), player('b', 'citizen', true)])).toBe('mafia');
    expect(checkWin([player('a', 'mafia', false), player('b', 'citizen', false)])).toBe('draw');
    expect(checkWin([player('a', 'mafia', true), player('b', 'citizen', true), player('c', 'citizen', true)])).toBeNull();
  });
});

describe('mafia night', () => {
  it('builds a sorted queue with one shared mafia kill', () => {
    const s = dealAll(createInitialState(makeConfig(), 42));
    expect(s.phase).toBe('night');
    const q = buildNightQueue(s.players);
    const mafiaStep = q.find((st) => st.key === 'mafia.kill')!;
    expect(mafiaStep.actorIds).toHaveLength(2);
    expect(q.map((st) => st.order)).toEqual([...q.map((st) => st.order)].sort((a, b) => a - b));
  });

  it('mafia kill lands without a doctor save', () => {
    let s = dealAll(createInitialState(makeConfig(), 42));
    const victim = s.players.find((p) => p.roleId === 'citizen')!;
    s = stepNight(s, { 'mafia.kill': victim.id });
    expect(s.phase === 'night-result' || s.phase === 'ended').toBe(true);
    expect(s.lastNightDeaths).toContain(victim.id);
    expect(s.players.find((p) => p.id === victim.id)!.alive).toBe(false);
  });

  it('the doctor can cancel the kill', () => {
    let s = dealAll(createInitialState(makeConfig(), 42));
    const victim = s.players.find((p) => p.roleId === 'citizen')!;
    s = stepNight(s, { 'mafia.kill': victim.id, 'doctor.save': victim.id });
    expect(s.lastNightDeaths).toHaveLength(0);
    expect(s.players.find((p) => p.id === victim.id)!.alive).toBe(true);
  });

  it('the detective learns a target faction (godfather lies)', () => {
    let s = dealAll(createInitialState(makeConfig({ composition: { godfather: 1, mafia: 1, detective: 1, doctor: 1, citizen: 3 } }), 5));
    const gf = s.players.find((p) => p.roleId === 'godfather')!;
    // walk to the detective step and investigate the godfather
    let i = 0;
    while (s.phase === 'night' && i++ < 20) {
      const step = s.nightQueue[s.nightCursor];
      if (step.key === 'detective.check') {
        s = reducer(s, { type: 'RECORD_NIGHT_ACTION', actorId: step.actorIds[0], targetId: gf.id });
      } else if (step.key === 'mafia.kill') {
        const t = s.players.find((p) => p.roleId === 'citizen')!;
        s = reducer(s, { type: 'RECORD_NIGHT_ACTION', actorId: step.actorIds[0], targetId: t.id });
      } else if (step.skippable) {
        s = reducer(s, { type: 'RECORD_NIGHT_ACTION', actorId: step.actorIds[0], targetId: null, skipped: true });
      }
      s = reducer(s, { type: 'NIGHT_STEP_NEXT' });
    }
    const info = s.nightInfo.find((x) => x.targetId === gf.id)!;
    expect(info.seenFaction).toBe('town'); // godfather appears innocent
  });

  it('rejects a dead/illegal target and guards a missing required action', () => {
    let s = dealAll(createInitialState(makeConfig(), 42));
    const bad = reducer(s, { type: 'RECORD_NIGHT_ACTION', actorId: s.nightQueue[0].actorIds[0], targetId: 'ghost' });
    expect(bad.meta?.error).toBe('badTarget');
    // mafia step is not skippable: NEXT without a target is a guarded no-op
    expect(reducer(s, { type: 'NIGHT_STEP_NEXT' }).meta?.error).toBe('needTarget');
  });
});

describe('mafia day & voting', () => {
  it('tallyVotes resolves majority, plurality, and ties', () => {
    expect(tallyVotes({ a: 'x', b: 'x', c: 'x' }, ['x', 'y'], 4, 'majority', 'no-elimination', 1).eliminated).toBe('x');
    expect(tallyVotes({ a: 'x', b: 'y' }, ['x', 'y'], 4, 'majority', 'no-elimination', 1).eliminated).toBeNull();
    expect(tallyVotes({ a: 'x', b: 'x', c: 'y' }, ['x', 'y'], 3, 'plurality', 'no-elimination', 1).eliminated).toBe('x');
    expect(tallyVotes({ a: 'x', b: 'y' }, ['x', 'y'], 2, 'plurality', 'no-elimination', 1).eliminated).toBeNull();
    expect(tallyVotes({ a: 'x', b: 'y' }, ['x', 'y'], 2, 'plurality', 'random', 7).eliminated).not.toBeNull();
  });

  it('runs nominate -> vote -> elimination', () => {
    let s = dealAll(createInitialState(makeConfig({ votingMode: 'plurality', nominationsRequired: 2 }), 42));
    const victim = s.players.find((p) => p.roleId === 'citizen')!;
    s = stepNight(s, { 'mafia.kill': victim.id });
    if (s.phase === 'ended') return; // unlikely with this comp
    s = reducer(s, { type: 'ACK_NIGHT_RESULT' });
    expect(s.phase).toBe('day');
    s = reducer(s, { type: 'END_DISCUSSION' });
    const alive = s.players.filter((p) => p.alive);
    const target = alive.find((p) => p.roleId !== 'mafia')!;
    s = reducer(s, { type: 'NOMINATE', nomineeId: target.id });
    s = reducer(s, { type: 'NOMINATE', nomineeId: target.id });
    expect(s.ballot).toContain(target.id);
    s = reducer(s, { type: 'OPEN_VOTE' });
    expect(s.phase).toBe('vote');
    alive.forEach((p) => (s = reducer(s, { type: 'CAST_VOTE', voterId: p.id, nomineeId: target.id })));
    s = reducer(s, { type: 'RESOLVE_VOTE', seed: 1 });
    expect(s.phase === 'vote-result' || s.phase === 'ended').toBe(true);
    expect(s.players.find((p) => p.id === target.id)!.alive).toBe(false);
  });

  it('OPEN_VOTE with an empty ballot is a guarded no-op; reducer stays pure', () => {
    let s = dealAll(createInitialState(makeConfig(), 42));
    const victim = s.players.find((p) => p.roleId === 'citizen')!;
    s = stepNight(s, { 'mafia.kill': victim.id });
    s = reducer(s, { type: 'ACK_NIGHT_RESULT' });
    s = reducer(s, { type: 'END_DISCUSSION' });
    expect(reducer(s, { type: 'OPEN_VOTE' }).meta?.error).toBe('emptyBallot');

    const snap = structuredClone(s);
    reducer(s, { type: 'NOMINATE', nomineeId: s.players[0].id });
    expect(s).toEqual(snap);
  });
});
