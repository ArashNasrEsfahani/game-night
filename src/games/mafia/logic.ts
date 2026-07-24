// src/games/mafia/logic.ts — PURE logic. No clock/RNG/IO; seeds via createInitialState / action payloads.
import type { GameConfig, GameStateBase } from '../../sdk/types';
import { shuffle, deriveSeed, pick } from '../../engine/rng';
import { ROLES, countsAsMafia, countsAsTown } from './roles';
import type { Faction, NightEffect, RoleId } from './roles';
import { compositionTotal, mafiaInComposition } from './content';
import { readOptions } from './config';
import type { MafiaOptions } from './config';

export type MafiaPhase =
  | 'deal'
  | 'night'
  | 'night-result'
  | 'day'
  | 'nominate'
  | 'vote'
  | 'vote-result'
  | 'ended'
  | 'error';

export type DeathCause = 'mafia' | 'vig' | 'vote';

export interface MafiaPlayer {
  id: string;
  roleId: RoleId;
  faction: Faction;
  alive: boolean;
  dealtAt: number;
  diedRound: number | null;
  diedBy: DeathCause | null;
  uses: Record<string, number>;
  lastProtected: string | null;
}

export interface NightStep {
  roleId: RoleId;
  key: string;
  actorIds: string[];
  order: number;
  effect: NightEffect;
  targetCount: 0 | 1;
  skippable: boolean;
  canTargetSelf: boolean;
}

export interface NightActionRecord {
  key: string;
  roleId: RoleId;
  actorId: string;
  targetId: string | null;
  skipped: boolean;
}

export interface NightInfoResult {
  actorId: string;
  targetId: string;
  seenFaction: Faction;
  /** Consigliere learns the exact role, not just the side. */
  seenRoleId?: RoleId;
}

export type MafiaWinner = Faction | 'draw' | 'jester';

export type MafiaLogEntry =
  | { t: 'night-death'; round: number; playerId: string; by: 'mafia' | 'vig' }
  | { t: 'night-quiet'; round: number }
  | { t: 'vote-out'; round: number; playerId: string }
  | { t: 'no-elim'; round: number }
  | { t: 'win'; round: number; winner: MafiaWinner };

export interface MafiaState extends GameStateBase {
  phase: MafiaPhase;
  options: MafiaOptions;
  round: number;
  players: MafiaPlayer[];
  playerNames: Record<string, string>;
  dealCursor: number;
  dealOrder: string[];
  nightQueue: NightStep[];
  nightCursor: number;
  nightActions: NightActionRecord[];
  nightInfo: NightInfoResult[];
  lastNightDeaths: string[];
  nominations: Record<string, number>;
  ballot: string[];
  votes: Record<string, string>;
  lastVoteEliminated: string | null;
  winner: MafiaWinner | null;
  log: MafiaLogEntry[];
  meta: { error?: string } | null;
  errorCode: 'BAD_CONFIG' | null;
}

export type MafiaAction =
  | { type: 'DEAL_NEXT' }
  | { type: 'RECORD_NIGHT_ACTION'; actorId: string; targetId: string | null; skipped?: boolean }
  | { type: 'NIGHT_STEP_NEXT' }
  | { type: 'NIGHT_STEP_BACK' }
  | { type: 'ACK_NIGHT_RESULT' }
  | { type: 'END_DISCUSSION' }
  | { type: 'NOMINATE'; nomineeId: string }
  | { type: 'UNNOMINATE'; nomineeId: string }
  | { type: 'OPEN_VOTE' }
  | { type: 'CAST_VOTE'; voterId: string; nomineeId: string }
  | { type: 'RETRACT_VOTE'; voterId: string }
  | { type: 'RESOLVE_VOTE'; seed: number }
  | { type: 'ACK_VOTE_RESULT' }
  | { type: 'ABORT_GAME'; winner?: MafiaWinner }
  | { type: 'END_GAME' };

/* ─────────────────────────  Pure helpers  ───────────────────────── */

export function checkWin(players: MafiaPlayer[]): Faction | 'draw' | null {
  const alive = players.filter((p) => p.alive);
  const mafiaAlive = alive.filter((p) => countsAsMafia(ROLES[p.roleId])).length;
  const townAlive = alive.filter((p) => countsAsTown(ROLES[p.roleId])).length;
  if (mafiaAlive === 0 && townAlive === 0) return 'draw';
  if (mafiaAlive === 0) return 'town';
  if (mafiaAlive > 0 && mafiaAlive >= townAlive) return 'mafia';
  return null;
}

export function buildNightQueue(players: MafiaPlayer[]): NightStep[] {
  const alive = players.filter((p) => p.alive);
  const steps: NightStep[] = [];

  const mafiaActors = alive.filter((p) => ROLES[p.roleId].faction === 'mafia' && ROLES[p.roleId].night?.effect === 'kill');
  if (mafiaActors.length > 0) {
    steps.push({
      roleId: 'mafia',
      key: 'mafia.kill',
      actorIds: mafiaActors.map((p) => p.id),
      order: 10,
      effect: 'kill',
      targetCount: 1,
      skippable: false,
      canTargetSelf: false,
    });
  }

  for (const p of alive) {
    const spec = ROLES[p.roleId].night;
    if (!spec || spec.effect === 'kill') continue; // mafia handled above
    if (spec.perGame && (p.uses[spec.key] ?? 0) >= spec.perGame) continue;
    steps.push({
      roleId: p.roleId,
      key: spec.key,
      actorIds: [p.id],
      order: spec.order,
      effect: spec.effect,
      targetCount: spec.effect === 'none' ? 0 : 1,
      skippable: spec.skippable,
      canTargetSelf: spec.canTargetSelf,
    });
  }

  return steps.sort((a, b) => a.order - b.order || a.roleId.localeCompare(b.roleId));
}

export function tallyVotes(
  votes: Record<string, string>,
  ballot: string[],
  aliveCount: number,
  mode: MafiaOptions['votingMode'],
  tieRule: MafiaOptions['tieRule'],
  seed: number,
): { eliminated: string | null; tied: string[] } {
  const counts: Record<string, number> = {};
  ballot.forEach((id) => (counts[id] = 0));
  Object.values(votes).forEach((t) => {
    if (t in counts) counts[t] += 1;
  });
  const max = Math.max(0, ...ballot.map((id) => counts[id]));
  const top = ballot.filter((id) => counts[id] === max && max > 0);
  if (mode === 'majority') {
    const threshold = Math.floor(aliveCount / 2);
    const winner = top.length === 1 && counts[top[0]] > threshold ? top[0] : null;
    return { eliminated: winner, tied: top.length > 1 ? top : [] };
  }
  // plurality
  if (top.length === 1) return { eliminated: top[0], tied: [] };
  if (top.length > 1 && tieRule === 'random') return { eliminated: pick(top, seed), tied: top };
  return { eliminated: null, tied: top };
}

/* ─────────────────────────  Init  ───────────────────────── */

export function createInitialState(config: GameConfig, seed: number): MafiaState {
  const options = readOptions(config);
  const playerIds = config.players.map((p) => p.id as string);
  const playerNames: Record<string, string> = {};
  config.players.forEach((p) => {
    playerNames[p.id] = p.name;
  });

  const n = playerIds.length;
  const total = compositionTotal(options.composition);
  const mafiaCount = mafiaInComposition(options.composition);
  const knownRoles = Object.keys(options.composition).every((id) => ROLES[id]);
  const badConfig =
    n < 5 || total !== n || mafiaCount < 1 || mafiaCount >= Math.ceil(n / 2) || !knownRoles;

  const base: MafiaState = {
    v: 1,
    phase: badConfig ? 'error' : 'deal',
    finished: false,
    options,
    round: 0,
    players: [],
    playerNames,
    dealCursor: 0,
    dealOrder: [],
    nightQueue: [],
    nightCursor: 0,
    nightActions: [],
    nightInfo: [],
    lastNightDeaths: [],
    nominations: {},
    ballot: [],
    votes: {},
    lastVoteEliminated: null,
    winner: null,
    log: [],
    meta: null,
    errorCode: badConfig ? 'BAD_CONFIG' : null,
  };
  if (badConfig) return base;

  const dealOrder = shuffle(playerIds, seed);
  const roleList = shuffle(
    Object.entries(options.composition)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .flatMap(([id, count]) => Array<RoleId>(count).fill(id)),
    deriveSeed(seed, 1),
  );
  const players: MafiaPlayer[] = dealOrder.map((id, i) => ({
    id,
    roleId: roleList[i],
    faction: ROLES[roleList[i]].faction,
    alive: true,
    dealtAt: i,
    diedRound: null,
    diedBy: null,
    uses: {},
    lastProtected: null,
  }));

  return { ...base, players, dealOrder };
}

/* ─────────────────────────  Resolution  ───────────────────────── */

function applyWinIfAny(s: MafiaState): MafiaState {
  const w = checkWin(s.players);
  if (!w) return s;
  return {
    ...s,
    phase: 'ended',
    finished: true,
    winner: w,
    log: [...s.log, { t: 'win', round: s.round, winner: w }],
  };
}

function resolveNight(s: MafiaState): MafiaState {
  const byKey = (k: string) => s.nightActions.find((a) => a.key === k && !a.skipped) ?? null;

  // 0. Roleblock — gather players prevented from acting tonight.
  const blocked = new Set<string>();
  const escort = byKey('escort.block');
  if (escort?.targetId) blocked.add(escort.targetId);
  const acts = (a: NightActionRecord | null): a is NightActionRecord => !!a?.targetId && !blocked.has(a.actorId);

  // 1. Frame — target reads as Mafia to the Detective this night.
  const framed = new Set<string>();
  const framer = byKey('framer.frame');
  if (acts(framer)) framed.add(framer.targetId!);

  // 2. Protect (doctor) + guard (bodyguard).
  const protectIds = new Set<string>();
  const doctor = byKey('doctor.save');
  if (acts(doctor)) protectIds.add(doctor.targetId!);
  const guard = byKey('bodyguard.guard');
  const guardedId = acts(guard) ? guard.targetId! : null;
  const guardActorId = acts(guard) ? guard.actorId : null;

  // 3. Investigations.
  const nightInfo: NightInfoResult[] = [];
  const det = byKey('detective.check');
  if (acts(det)) {
    const target = s.players.find((p) => p.id === det.targetId);
    if (target) {
      const seen: Faction = framed.has(target.id) ? 'mafia' : ROLES[target.roleId].appearsAs ?? target.faction;
      nightInfo.push({ actorId: det.actorId, targetId: det.targetId!, seenFaction: seen });
    }
  }
  const con = byKey('consigliere.check');
  if (acts(con)) {
    const target = s.players.find((p) => p.id === con.targetId);
    if (target) {
      nightInfo.push({ actorId: con.actorId, targetId: con.targetId!, seenFaction: target.faction, seenRoleId: target.roleId });
    }
  }

  // 4. Attacks (mafia + sniper) → resolved against protection and the bodyguard redirect.
  const attacks: { targetId: string; by: 'mafia' | 'vig' }[] = [];
  const mafiaKill = byKey('mafia.kill');
  // The mafia kill only fails if EVERY living mafia killer was blocked tonight.
  const mafiaKillers = s.players.filter(
    (p) => p.alive && ROLES[p.roleId].faction === 'mafia' && ROLES[p.roleId].night?.effect === 'kill',
  );
  const mafiaBlocked = mafiaKillers.length > 0 && mafiaKillers.every((p) => blocked.has(p.id));
  if (mafiaKill?.targetId && !mafiaBlocked) attacks.push({ targetId: mafiaKill.targetId, by: 'mafia' });
  const snipe = byKey('sniper.shoot');
  const sniperFires = acts(snipe);
  if (sniperFires) attacks.push({ targetId: snipe.targetId!, by: 'vig' });

  const deaths: { id: string; by: 'mafia' | 'vig' }[] = [];
  for (const atk of attacks) {
    if (protectIds.has(atk.targetId)) continue; // doctor shielded
    if (guardedId && atk.targetId === guardedId && guardActorId) {
      // Bodyguard intercepts: they die instead, and the guarded player survives the night.
      if (!deaths.some((d) => d.id === guardActorId)) deaths.push({ id: guardActorId, by: atk.by });
      continue;
    }
    if (!deaths.some((d) => d.id === atk.targetId)) deaths.push({ id: atk.targetId, by: atk.by });
  }

  const deadIds = deaths.map((d) => d.id);
  const players = s.players.map((p) => {
    const d = deaths.find((x) => x.id === p.id);
    let uses = p.uses;
    let lastProtected = p.lastProtected;
    // sniper consumes its one shot only when the shot actually fires (not when blocked)
    if (sniperFires && snipe.actorId === p.id) uses = { ...uses, 'sniper.shoot': (uses['sniper.shoot'] ?? 0) + 1 };
    if (acts(doctor) && doctor.actorId === p.id) lastProtected = doctor.targetId;
    if (d) return { ...p, alive: false, diedRound: s.round, diedBy: d.by, uses, lastProtected };
    if (uses !== p.uses || lastProtected !== p.lastProtected) return { ...p, uses, lastProtected };
    return p;
  });

  const log: MafiaLogEntry[] =
    deaths.length === 0
      ? [...s.log, { t: 'night-quiet', round: s.round }]
      : [...s.log, ...deaths.map((d) => ({ t: 'night-death' as const, round: s.round, playerId: d.id, by: d.by }))];

  return applyWinIfAny({
    ...s,
    players,
    nightInfo,
    lastNightDeaths: deadIds,
    log,
    phase: 'night-result',
    meta: null,
  });
}

function enterNight(s: MafiaState, round: number): MafiaState {
  const base: MafiaState = {
    ...s,
    round,
    nightActions: [],
    nightInfo: [],
    lastNightDeaths: [],
    nominations: {},
    ballot: [],
    votes: {},
    meta: null,
  };
  if (s.options.peacefulFirstNight && round === 1) {
    return applyWinIfAny({
      ...base,
      phase: 'night-result',
      lastNightDeaths: [],
      log: [...base.log, { t: 'night-quiet', round }],
    });
  }
  const queue = buildNightQueue(base.players);
  if (queue.length === 0) {
    return resolveNight({ ...base, nightQueue: [], nightCursor: 0 });
  }
  return { ...base, phase: 'night', nightQueue: queue, nightCursor: 0 };
}

/* ─────────────────────────  Reducer  ───────────────────────── */

const err = (s: MafiaState, error: string): MafiaState => ({ ...s, meta: { error } });

export function reducer(state: MafiaState, action: MafiaAction): MafiaState {
  const s = state.meta ? { ...state, meta: null } : state;
  switch (action.type) {
    case 'DEAL_NEXT': {
      if (s.phase !== 'deal') return s;
      const dealCursor = s.dealCursor + 1;
      if (dealCursor >= s.dealOrder.length) return enterNight(s, 1);
      return { ...s, dealCursor };
    }
    case 'RECORD_NIGHT_ACTION': {
      if (s.phase !== 'night') return s;
      const step = s.nightQueue[s.nightCursor];
      if (!step) return s;
      const record: NightActionRecord = {
        key: step.key,
        roleId: step.roleId,
        actorId: action.actorId || step.actorIds[0],
        targetId: action.targetId,
        skipped: !!action.skipped,
      };
      if (action.skipped) {
        if (!step.skippable) return err(s, 'cannotSkip');
      } else {
        const target = s.players.find((p) => p.id === action.targetId);
        if (!target || !target.alive) return err(s, 'badTarget');
        const isSelf = step.actorIds.includes(action.targetId!);
        if (isSelf && !step.canTargetSelf) return err(s, 'noSelf');
        if (isSelf && step.key === 'doctor.save') {
          const actor = s.players.find((p) => p.id === record.actorId);
          const used = actor?.uses['doctor.selfsave'] ?? 0;
          if (s.options.allowDoctorSelfSave === 'never') return err(s, 'noSelf');
          if (s.options.allowDoctorSelfSave === 'once' && used >= 1) return err(s, 'selfSaveUsed');
        }
      }
      let players = s.players;
      // track doctor self-save use immediately so a re-record can't bypass the cap
      if (!action.skipped && step.key === 'doctor.save' && step.actorIds.includes(action.targetId!)) {
        players = s.players.map((p) =>
          p.id === record.actorId ? { ...p, uses: { ...p.uses, 'doctor.selfsave': (p.uses['doctor.selfsave'] ?? 0) + 1 } } : p,
        );
      }
      const nightActions = [...s.nightActions.filter((a) => a.key !== step.key), record];
      return { ...s, nightActions, players };
    }
    case 'NIGHT_STEP_NEXT': {
      if (s.phase !== 'night') return s;
      const step = s.nightQueue[s.nightCursor];
      if (!step) return s;
      const recorded = s.nightActions.find((a) => a.key === step.key);
      if (!step.skippable && !recorded) return err(s, 'needTarget');
      const nightCursor = s.nightCursor + 1;
      if (nightCursor >= s.nightQueue.length) return resolveNight(s);
      return { ...s, nightCursor };
    }
    case 'NIGHT_STEP_BACK': {
      if (s.phase !== 'night') return s;
      return { ...s, nightCursor: Math.max(0, s.nightCursor - 1) };
    }
    case 'ACK_NIGHT_RESULT': {
      if (s.phase !== 'night-result') return s;
      return { ...s, phase: 'day', nominations: {}, ballot: [], votes: {} };
    }
    case 'END_DISCUSSION': {
      if (s.phase !== 'day') return s;
      return { ...s, phase: 'nominate' };
    }
    case 'NOMINATE': {
      if (s.phase !== 'nominate') return s;
      const target = s.players.find((p) => p.id === action.nomineeId);
      if (!target?.alive) return s;
      const count = (s.nominations[action.nomineeId] ?? 0) + 1;
      const nominations = { ...s.nominations, [action.nomineeId]: count };
      const ballot =
        count >= s.options.nominationsRequired && !s.ballot.includes(action.nomineeId)
          ? [...s.ballot, action.nomineeId]
          : s.ballot;
      return { ...s, nominations, ballot };
    }
    case 'UNNOMINATE': {
      if (s.phase !== 'nominate') return s;
      const count = Math.max(0, (s.nominations[action.nomineeId] ?? 0) - 1);
      const nominations = { ...s.nominations, [action.nomineeId]: count };
      const ballot = count < s.options.nominationsRequired ? s.ballot.filter((id) => id !== action.nomineeId) : s.ballot;
      return { ...s, nominations, ballot };
    }
    case 'OPEN_VOTE': {
      if (s.phase !== 'nominate') return s;
      if (s.ballot.length === 0) return err(s, 'emptyBallot');
      return { ...s, phase: 'vote', votes: {} };
    }
    case 'CAST_VOTE': {
      if (s.phase !== 'vote') return s;
      const voter = s.players.find((p) => p.id === action.voterId);
      if (!voter?.alive || !s.ballot.includes(action.nomineeId)) return s;
      return { ...s, votes: { ...s.votes, [action.voterId]: action.nomineeId } };
    }
    case 'RETRACT_VOTE': {
      if (s.phase !== 'vote') return s;
      if (!(action.voterId in s.votes)) return s;
      const votes = { ...s.votes };
      delete votes[action.voterId];
      return { ...s, votes };
    }
    case 'RESOLVE_VOTE': {
      if (s.phase !== 'vote') return s;
      const aliveCount = s.players.filter((p) => p.alive).length;
      const { eliminated } = tallyVotes(
        s.votes,
        s.ballot,
        aliveCount,
        s.options.votingMode,
        s.options.tieRule,
        action.seed,
      );
      if (!eliminated) {
        return { ...s, phase: 'vote-result', lastVoteEliminated: null, log: [...s.log, { t: 'no-elim', round: s.round }] };
      }
      const players = s.players.map((p) =>
        p.id === eliminated ? { ...p, alive: false, diedRound: s.round, diedBy: 'vote' as const } : p,
      );
      const withDeath: MafiaState = {
        ...s,
        players,
        phase: 'vote-result',
        lastVoteEliminated: eliminated,
        log: [...s.log, { t: 'vote-out', round: s.round, playerId: eliminated }],
      };
      // Jester (or any winsIfLynched role) wins immediately when the town votes them out.
      const lynched = s.players.find((p) => p.id === eliminated);
      if (lynched && ROLES[lynched.roleId]?.winsIfLynched) {
        return {
          ...withDeath,
          phase: 'ended',
          finished: true,
          winner: 'jester',
          log: [...withDeath.log, { t: 'win', round: s.round, winner: 'jester' }],
        };
      }
      return applyWinIfAny(withDeath);
    }
    case 'ACK_VOTE_RESULT': {
      if (s.phase !== 'vote-result') return s;
      return enterNight(s, s.round + 1);
    }
    case 'ABORT_GAME': {
      if (s.phase === 'ended') return s;
      return { ...s, phase: 'ended', finished: true, winner: action.winner ?? null };
    }
    case 'END_GAME': {
      // Manually end the match and show Results with the standings/winner so far.
      if (s.phase === 'ended') return s;
      const w = checkWin(s.players);
      return {
        ...s,
        phase: 'ended',
        finished: true,
        winner: w,
        log: w ? [...s.log, { t: 'win', round: s.round, winner: w }] : s.log,
      };
    }
    default:
      return s;
  }
}

/* ─────────────────────────  Selectors  ───────────────────────── */

export const alivePlayers = (s: MafiaState): MafiaPlayer[] => s.players.filter((p) => p.alive);
export const currentDealId = (s: MafiaState): string | null => s.dealOrder[s.dealCursor] ?? null;
export const currentStep = (s: MafiaState): NightStep | null => s.nightQueue[s.nightCursor] ?? null;
export const recordedTarget = (s: MafiaState, key: string): string | null =>
  s.nightActions.find((a) => a.key === key)?.targetId ?? null;
