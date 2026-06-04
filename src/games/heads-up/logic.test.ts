import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerId, PlayerSeat } from '../../sdk/types';
import { asPlayerId, asTeamId } from '../../engine/ids';
import {
  createInitialState,
  reducer,
  guesserId,
  score,
  standings,
  computeWinners,
} from './logic';
import type { HeadsUpState } from './logic';
import { DEFAULT_OPTIONS } from './config';
import type { HeadsUpOptions } from './config';
import { mergedPool, validateContent } from './content';

const seat = (id: string): PlayerSeat => ({ id: asPlayerId(id), name: id.toUpperCase() });

function makeConfig(options: Partial<HeadsUpOptions> = {}, ids = ['a', 'b', 'c']): GameConfig {
  return {
    players: ids.map(seat),
    options: { ...DEFAULT_OPTIONS, deckIds: ['animals'], rounds: 1, ...options },
    lang: 'en',
  };
}

const POOL = mergedPool(['animals']).length; // animals deck

/** Drive one full round to TIME_UP. */
function playRound(s: HeadsUpState, gots: number, passes: number, seed = 3): HeadsUpState {
  s = reducer(s, { type: 'CONFIRM_READY' });
  s = reducer(s, { type: 'COUNTDOWN_TICK' });
  s = reducer(s, { type: 'COUNTDOWN_TICK' });
  s = reducer(s, { type: 'COUNTDOWN_TICK' }); // -> playing
  for (let i = 0; i < gots; i++) s = reducer(s, { type: 'MARK_GOT', seed });
  for (let i = 0; i < passes; i++) s = reducer(s, { type: 'MARK_PASS', seed });
  return reducer(s, { type: 'TIME_UP' });
}

describe('heads-up content', () => {
  it('ships valid bilingual content', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('heads-up createInitialState', () => {
  it('builds solo participants and a hidden first card', () => {
    const s = createInitialState(makeConfig(), 42);
    expect(s.phase).toBe('handoff');
    expect(s.participants).toHaveLength(3);
    expect(s.participants[0].kind).toBe('player');
    expect(s.currentCardId).toBeNull();
    expect(s.deck).toHaveLength(POOL);
    expect(createInitialState(makeConfig(), 42).deck).toEqual(s.deck);
    expect(createInitialState(makeConfig(), 7).deck).not.toEqual(s.deck);
  });

  it('builds team participants with a rotating guesser', () => {
    const cfg = makeConfig({ mode: 'teams' }, ['a', 'b', 'c', 'd']);
    cfg.teams = {
      mode: 'auto',
      teams: [
        { id: asTeamId('A'), name: 'A', memberIds: [asPlayerId('a'), asPlayerId('c')] as PlayerId[] },
        { id: asTeamId('B'), name: 'B', memberIds: [asPlayerId('b'), asPlayerId('d')] as PlayerId[] },
      ],
    };
    const s = createInitialState(cfg, 1);
    expect(s.participants).toHaveLength(2);
    expect(guesserId(s.participants[0])).toBe('a');
  });

  it('errors on too few players', () => {
    expect(createInitialState(makeConfig({}, ['a']), 1).phase).toBe('error');
  });
});

describe('heads-up round flow', () => {
  it('CONFIRM_READY then countdown reveals the first word', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'CONFIRM_READY' });
    expect(s.phase).toBe('countdown');
    expect(s.countdownLeft).toBe(3);
    s = reducer(s, { type: 'COUNTDOWN_TICK' });
    s = reducer(s, { type: 'COUNTDOWN_TICK' });
    s = reducer(s, { type: 'COUNTDOWN_TICK' });
    expect(s.phase).toBe('playing');
    expect(s.secondsLeft).toBe(s.roundSeconds);
    expect(s.currentCardId).toBe(s.deck[0]);
  });

  it('MARK_GOT/PASS append entries and advance; CLEAR_FLASH and TICK behave', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'CONFIRM_READY' });
    s = reducer(s, { type: 'COUNTDOWN_TICK' });
    s = reducer(s, { type: 'COUNTDOWN_TICK' });
    s = reducer(s, { type: 'COUNTDOWN_TICK' });
    const first = s.currentCardId;
    s = reducer(s, { type: 'MARK_GOT', seed: 1 });
    expect(s.currentEntries).toEqual([{ cardKey: first, result: 'got' }]);
    expect(s.flash).toBe('got');
    expect(s.currentCardId).toBe(s.deck[1]);
    s = reducer(s, { type: 'CLEAR_FLASH' });
    expect(s.flash).toBeNull();
    s = reducer(s, { type: 'MARK_PASS', seed: 1 });
    expect(s.currentEntries[1].result).toBe('passed');
    const before = s.currentCardId;
    s = reducer(s, { type: 'TICK', secondsLeft: 12 });
    expect(s.secondsLeft).toBe(12);
    expect(s.currentCardId).toBe(before);
  });

  it('recycles the deck when recycle is on, exhausts when off', () => {
    let on = createInitialState(makeConfig({ recycleDeck: true }), 1);
    on = reducer(on, { type: 'CONFIRM_READY' });
    on = reducer(on, { type: 'COUNTDOWN_TICK' });
    on = reducer(on, { type: 'COUNTDOWN_TICK' });
    on = reducer(on, { type: 'COUNTDOWN_TICK' });
    for (let i = 0; i < POOL + 1; i++) on = reducer(on, { type: 'MARK_GOT', seed: 5 });
    expect(on.currentCardId).not.toBeNull();

    let off = createInitialState(makeConfig({ recycleDeck: false }), 1);
    off = reducer(off, { type: 'CONFIRM_READY' });
    off = reducer(off, { type: 'COUNTDOWN_TICK' });
    off = reducer(off, { type: 'COUNTDOWN_TICK' });
    off = reducer(off, { type: 'COUNTDOWN_TICK' });
    for (let i = 0; i < POOL; i++) off = reducer(off, { type: 'MARK_GOT', seed: 5 });
    expect(off.currentCardId).toBeNull();
  });

  it('TIME_UP commits a round result with counts', () => {
    let s = createInitialState(makeConfig(), 1);
    s = playRound(s, 2, 1);
    expect(s.phase).toBe('roundEnd');
    expect(s.rounds).toHaveLength(1);
    expect(s.rounds[0].got).toBe(2);
    expect(s.rounds[0].passed).toBe(1);
    expect(s.roundOfParticipant[s.participants[0].id]).toBe(1);
  });
});

describe('heads-up advancement & scoring', () => {
  it('runs a round-robin of N×R rounds then finishes', () => {
    let s = createInitialState(makeConfig({ rounds: 1 }), 1);
    s = playRound(s, 3, 0);
    s = reducer(s, { type: 'NEXT_PARTICIPANT', seed: 1 });
    expect(s.turnIndex).toBe(1);
    s = playRound(s, 1, 0);
    s = reducer(s, { type: 'NEXT_PARTICIPANT', seed: 1 });
    s = playRound(s, 0, 0);
    s = reducer(s, { type: 'NEXT_PARTICIPANT', seed: 1 });
    expect(s.phase).toBe('finished');
    expect(s.finished).toBe(true);
    expect(s.rounds).toHaveLength(3);
  });

  it('scores and ranks correctly', () => {
    expect(score(5, 2, 0)).toBe(5);
    expect(score(5, 2, 1)).toBe(3);
    let s = createInitialState(makeConfig({ rounds: 1 }), 1);
    s = playRound(s, 3, 0);
    s = reducer(s, { type: 'NEXT_PARTICIPANT', seed: 1 });
    s = playRound(s, 1, 0);
    s = reducer(s, { type: 'NEXT_PARTICIPANT', seed: 1 });
    s = playRound(s, 0, 0);
    s = reducer(s, { type: 'NEXT_PARTICIPANT', seed: 1 });
    const ranked = standings(s);
    expect(ranked[0].participantId).toBe(s.participants[0].id);
    expect(computeWinners(s)).toEqual([s.participants[0].id]);
  });

  it('SET_INPUT_MODE flips input mode; guards & purity hold', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'SET_INPUT_MODE', mode: 'button' });
    expect(s.inputMode).toBe('button');
    expect(reducer(s, { type: 'MARK_GOT', seed: 1 })).toBe(s); // not playing
    const snap = structuredClone(s);
    reducer(s, { type: 'CONFIRM_READY' });
    expect(s).toEqual(snap);
  });
});
