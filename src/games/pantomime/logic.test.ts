import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerId, PlayerSeat } from '../../sdk/types';
import { asPlayerId, asTeamId } from '../../engine/ids';
import * as timer from '../../engine/timer';
import {
  createInitialState,
  reducer,
  activeTeam,
  actorId,
} from './logic';
import type { PantomimeState } from './logic';
import { DEFAULT_OPTIONS } from './config';
import type { PantomimeOptions } from './config';
import { validateContent } from './content';

const seat = (id: string, name = id): PlayerSeat => ({ id: asPlayerId(id), name });

function makeConfig(options: Partial<PantomimeOptions> = {}): GameConfig {
  return {
    players: [seat('a1'), seat('a2'), seat('b1'), seat('b2')],
    teams: {
      mode: 'auto',
      teams: [
        { id: asTeamId('A'), name: 'A', memberIds: [asPlayerId('a1'), asPlayerId('a2')] as PlayerId[] },
        { id: asTeamId('B'), name: 'B', memberIds: [asPlayerId('b1'), asPlayerId('b2')] as PlayerId[] },
      ],
    },
    options: { ...DEFAULT_OPTIONS, endMode: 'rounds', totalRounds: 2, ...options },
    lang: 'en',
  };
}

const POOL = 16; // mixed × all difficulties

/** Drive a full turn: handoff → reveal → acting → (corrects) → end → advance. */
function runTurn(s: PantomimeState, corrects: number, now = 1000, seed = 1): PantomimeState {
  s = reducer(s, { type: 'HANDOFF_READY' });
  s = reducer(s, { type: 'REVEAL' });
  s = reducer(s, { type: 'START_ACTING', now });
  for (let i = 0; i < corrects; i++) s = reducer(s, { type: 'CORRECT' });
  s = reducer(s, { type: 'END_TURN_EARLY', now: now + 1000 });
  return reducer(s, { type: 'NEXT_TURN', seed });
}

describe('pantomime content', () => {
  it('ships valid bilingual content', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('pantomime createInitialState', () => {
  it('starts in handoff with two teams and a full shuffled deck', () => {
    const s = createInitialState(makeConfig(), 42);
    expect(s.phase).toBe('handoff');
    expect(s.finished).toBe(false);
    expect(s.teams).toHaveLength(2);
    expect(Object.values(s.score.totals)).toEqual([0, 0]);
    expect(s.deck.drawPile).toHaveLength(POOL);
    expect(s.deck.discardPile).toHaveLength(0);
    expect(s.currentPromptId).toBeNull();
    expect(s.clock.running).toBe(false);
    expect(s.turn.round).toBe(0);
    expect(s.turn.index).toBe(0);
    expect(s.errorCode).toBeNull();
  });

  it('produces an error state on bad teams (defensive; Setup prevents it)', () => {
    const cfg = makeConfig();
    cfg.teams = { mode: 'auto', teams: [] };
    const s = createInitialState(cfg, 1);
    expect(s.phase).toBe('error');
    expect(s.errorCode).toBe('BAD_TEAMS');
  });

  it('seeded shuffle is deterministic and seed-sensitive', () => {
    const a = createInitialState(makeConfig(), 42);
    const b = createInitialState(makeConfig(), 42);
    const c = createInitialState(makeConfig(), 7);
    expect(a.deck.drawPile).toEqual(b.deck.drawPile);
    expect(a.deck.drawPile).not.toEqual(c.deck.drawPile);
  });
});

describe('pantomime turn flow', () => {
  it('HANDOFF_READY draws the first prompt and moves to reveal', () => {
    const s0 = createInitialState(makeConfig(), 42);
    const s = reducer(s0, { type: 'HANDOFF_READY' });
    expect(s.phase).toBe('reveal');
    expect(s.currentPromptId).not.toBeNull();
    expect(s.deck.drawPile).toHaveLength(POOL - 1);
  });

  it('REVEAL opens the gate; START_ACTING starts the timer', () => {
    let s = createInitialState(makeConfig(), 42);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    expect(s.phase).toBe('reveal');
    expect(s.gate.phase).toBe('revealed');
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    expect(s.phase).toBe('acting');
    expect(s.clock.running).toBe(true);
    expect(s.clock.startedAt).toBe(1000);
  });

  it('CORRECT scores the active team and draws the next prompt', () => {
    let s = createInitialState(makeConfig(), 42);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    const prev = s.currentPromptId;
    s = reducer(s, { type: 'CORRECT' });
    const teamId = s.teams[0].teamId;
    expect(s.score.totals[teamId]).toBe(1);
    expect(s.teams[0].correctCount).toBe(1);
    expect(s.turnCorrect).toBe(1);
    expect(s.deck.discardPile).toContain(prev);
    expect(s.currentPromptId).not.toBe(prev);
    expect(s.phase).toBe('acting');
    expect(s.clock.running).toBe(true);
  });

  it('multiple CORRECTs in one turn accumulate', () => {
    let s = createInitialState(makeConfig(), 42);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    s = reducer(s, { type: 'CORRECT' });
    s = reducer(s, { type: 'CORRECT' });
    s = reducer(s, { type: 'CORRECT' });
    expect(s.turnCorrect).toBe(3);
    expect(s.score.totals[s.teams[0].teamId]).toBe(3);
  });

  it('SKIP within cap advances without scoring', () => {
    let s = createInitialState(makeConfig(), 42);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    s = reducer(s, { type: 'SKIP' });
    expect(s.turnSkipped).toBe(1);
    expect(s.teams[0].skipCount).toBe(1);
    expect(s.score.totals[s.teams[0].teamId]).toBe(0);
    expect(s.phase).toBe('acting');
  });

  it('SKIP beyond the cap is a no-op', () => {
    let s = createInitialState(makeConfig({ maxSkipsPerTurn: 2 }), 42);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    s = reducer(s, { type: 'SKIP' });
    s = reducer(s, { type: 'SKIP' });
    const before = s;
    const after = reducer(s, { type: 'SKIP' });
    expect(after).toBe(before); // same reference: no-op
    expect(after.turnSkipped).toBe(2);
  });

  it('SKIP with penalty subtracts a point, floored at 0', () => {
    let s = createInitialState(makeConfig({ skipPenalty: true, maxSkipsPerTurn: -1 }), 42);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    const teamId = s.teams[0].teamId;
    // skip at 0 stays 0
    s = reducer(s, { type: 'SKIP' });
    expect(s.score.totals[teamId]).toBe(0);
    // score then skip -> -1
    s = reducer(s, { type: 'CORRECT' });
    expect(s.score.totals[teamId]).toBe(1);
    s = reducer(s, { type: 'SKIP' });
    expect(s.score.totals[teamId]).toBe(0);
  });
});

describe('pantomime timer', () => {
  it('TICK before expiry is a no-op (same reference)', () => {
    let s = createInitialState(makeConfig(), 42);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    const after = reducer(s, { type: 'TICK', now: 1000 + 5000 });
    expect(after).toBe(s);
    expect(after.phase).toBe('acting');
  });

  it('TICK at/after expiry folds to turnEnd and records the turn', () => {
    let s = createInitialState(makeConfig(), 42);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    s = reducer(s, { type: 'CORRECT' });
    s = reducer(s, { type: 'TICK', now: 1000 + s.options.roundSeconds * 1000 });
    expect(s.phase).toBe('turnEnd');
    expect(s.clock.running).toBe(false);
    expect(s.history).toHaveLength(1);
    expect(s.history[0].correct).toBe(1);
    expect(s.lastTurnEndReason).toBe('timeExpired');
  });

  it('returns the unresolved current prompt to the draw pile on time-up', () => {
    let s = createInitialState(makeConfig(), 42);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    const current = s.currentPromptId!;
    s = reducer(s, { type: 'TICK', now: 1000 + s.options.roundSeconds * 1000 });
    expect(s.currentPromptId).toBeNull();
    expect(s.deck.drawPile).toContain(current);
    expect(s.deck.drawPile).toHaveLength(POOL);
  });

  it('PAUSE/RESUME preserve elapsed time', () => {
    let s = createInitialState(makeConfig(), 42);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    s = reducer(s, { type: 'PAUSE', now: 5000 });
    expect(s.clock.running).toBe(false);
    expect(s.clock.accumulatedMs).toBe(4000);
    s = reducer(s, { type: 'RESUME', now: 10000 });
    expect(s.clock.running).toBe(true);
    expect(timer.elapsedMs(s.clock, 12000)).toBe(6000);
  });
});

describe('pantomime advancement & end conditions', () => {
  it('NEXT_TURN advances the team, increments actor cursor, resets turn counters', () => {
    let s = createInitialState(makeConfig(), 42);
    expect(actorId(s)).toBe('a1');
    s = runTurn(s, 2);
    expect(s.phase).toBe('handoff');
    expect(s.turn.index).toBe(1); // team B now
    expect(s.teams[0].actorCursor).toBe(1); // team A rotated
    expect(s.teams[1].actorCursor).toBe(0); // team B untouched
    expect(s.turnCorrect).toBe(0);
    expect(s.turnSkipped).toBe(0);
    expect(activeTeam(s).teamId).toBe('B');
  });

  it('round index increments when the order wraps', () => {
    let s = createInitialState(makeConfig(), 42);
    s = runTurn(s, 0); // A
    s = runTurn(s, 0); // B -> wraps
    expect(s.turn.round).toBe(1);
  });

  it('targetScore end is deferred until the round completes (fairness)', () => {
    let s = createInitialState(makeConfig({ endMode: 'targetScore', targetScore: 1 }), 42);
    s = runTurn(s, 1); // A reaches target -> endRequested, but B still owes a turn
    expect(s.endRequested).toBe(true);
    expect(s.phase).toBe('handoff');
    s = runTurn(s, 0); // B plays -> round complete -> finish
    expect(s.phase).toBe('results');
    expect(s.finished).toBe(true);
    expect(s.winnerTeamIds).toEqual(['A']);
  });

  it('rounds mode ends after totalRounds full rounds', () => {
    let s = createInitialState(makeConfig({ endMode: 'rounds', totalRounds: 2 }), 42);
    s = runTurn(s, 1); // A r0
    s = runTurn(s, 0); // B r0
    s = runTurn(s, 0); // A r1
    expect(s.phase).toBe('handoff');
    s = runTurn(s, 0); // B r1 -> finish
    expect(s.phase).toBe('results');
    expect(s.finished).toBe(true);
  });

  it('resolves a single winner by score', () => {
    let s = createInitialState(makeConfig({ endMode: 'rounds', totalRounds: 1 }), 42);
    s = runTurn(s, 3); // A
    s = runTurn(s, 1); // B -> finish
    expect(s.phase).toBe('results');
    expect(s.winnerTeamIds).toEqual(['A']);
  });

  it('resolves a tie as multiple winners', () => {
    let s = createInitialState(makeConfig({ endMode: 'rounds', totalRounds: 1 }), 42);
    s = runTurn(s, 2); // A
    s = runTurn(s, 2); // B -> finish, tie
    expect(s.phase).toBe('results');
    expect(s.winnerTeamIds).toHaveLength(2);
  });
});

describe('pantomime edge cases', () => {
  it('recycles the discard pile so a turn never runs dry while prompts exist', () => {
    // movies × hard == exactly one prompt ("the-matrix").
    let s = createInitialState(makeConfig({ categories: ['movies'], difficulties: ['hard'] }), 42);
    expect(s.deck.drawPile).toHaveLength(1);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    for (let i = 0; i < 10; i++) {
      s = reducer(s, { type: 'CORRECT' });
      expect(s.currentPromptId).not.toBeNull();
      expect(s.phase).toBe('acting');
    }
    expect(s.score.totals[s.teams[0].teamId]).toBe(10);
  });

  it('guards an empty deck by folding to turnEnd (no throw)', () => {
    let s = createInitialState(makeConfig(), 42);
    s = { ...s, deck: { drawPile: [], discardPile: [] }, currentPromptId: null };
    s = reducer(s, { type: 'HANDOFF_READY' });
    expect(s.phase).toBe('turnEnd');
    expect(s.lastTurnEndReason).toBe('deckExhausted');
  });

  it('ignores actions dispatched in the wrong phase', () => {
    const s = createInitialState(makeConfig(), 42);
    expect(reducer(s, { type: 'CORRECT' })).toBe(s); // CORRECT in handoff
    const reveal = reducer(s, { type: 'HANDOFF_READY' });
    expect(reducer(reveal, { type: 'HANDOFF_READY' })).toBe(reveal); // HANDOFF in reveal
  });

  it('does not mutate the input state (purity)', () => {
    let s = createInitialState(makeConfig(), 42);
    s = reducer(s, { type: 'HANDOFF_READY' });
    s = reducer(s, { type: 'REVEAL' });
    s = reducer(s, { type: 'START_ACTING', now: 1000 });
    const snapshot = structuredClone(s);
    reducer(s, { type: 'CORRECT' });
    expect(s).toEqual(snapshot);
  });
});
