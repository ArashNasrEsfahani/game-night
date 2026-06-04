import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerSeat } from '../../sdk/types';
import { asPlayerId } from '../../engine/ids';
import * as scoring from '../../engine/scoring';
import {
  createInitialState,
  reducer,
  pickSpinTarget,
  computeWinners,
} from './logic';
import type { Outcome, ToDState } from './logic';
import { DEFAULT_OPTIONS } from './config';
import type { ToDOptions, PromptKind } from './config';
import { PROMPT_BY_ID, validateContent } from './content';

const seat = (id: string): PlayerSeat => ({ id: asPlayerId(id), name: id.toUpperCase() });

function makeConfig(options: Partial<ToDOptions> = {}, ids = ['a', 'b', 'c', 'd']): GameConfig {
  return {
    players: ids.map(seat),
    options: {
      ...DEFAULT_OPTIONS,
      intensities: { mild: true, medium: true, spicy: true },
      selectionMode: 'sequential',
      scoringMode: 'points',
      ...options,
    } as ToDOptions,
    lang: 'en',
  };
}

/** Run a full sequential turn. */
function turn(s: ToDState, kind: PromptKind, outcome: Outcome, seed = 5): ToDState {
  s = reducer(s, { type: 'NEXT_PLAYER' });
  s = reducer(s, { type: 'CHOOSE', kind, seed });
  if (s.phase === 'revealing') s = reducer(s, { type: 'REVEAL' });
  return reducer(s, { type: 'RESOLVE', outcome });
}

describe('tod content', () => {
  it('ships valid bilingual content', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('tod createInitialState', () => {
  it('starts idle with shuffled decks and zeroed scores', () => {
    const s = createInitialState(makeConfig(), 42);
    expect(s.phase).toBe('idle');
    expect(s.activePlayerId).toBeNull();
    expect(s.truthDeck.drawPile.length).toBeGreaterThan(0);
    expect(s.dareDeck.drawPile.length).toBeGreaterThan(0);
    expect(scoring.total(s.scores, 'a')).toBe(0);
  });

  it('filters out spicy and minPlayers-gated prompts', () => {
    const noSpicy = createInitialState(
      makeConfig({ intensities: { mild: true, medium: true, spicy: false } }, ['a', 'b']),
      1,
    );
    // 2 players + no spicy: spicy items and any minPlayers-3 items are excluded
    const ids = noSpicy.truthDeck.drawPile;
    expect(ids.some((id) => PROMPT_BY_ID[id].intensity === 'spicy')).toBe(false);
    expect(ids.some((id) => (PROMPT_BY_ID[id].minPlayers ?? 2) > 2)).toBe(false);
  });

  it('errors on too few players', () => {
    expect(createInitialState(makeConfig({}, ['a']), 1).phase).toBe('error');
  });
});

describe('tod selection', () => {
  it('pickSpinTarget avoids the last player and is deterministic', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const t1 = pickSpinTarget(ids, 'a', true, 123);
    const t2 = pickSpinTarget(ids, 'a', true, 123);
    expect(t1).toBe(t2);
    expect(t1).not.toBe('a');
  });

  it('SPIN is ignored in sequential mode', () => {
    const s = createInitialState(makeConfig({ selectionMode: 'sequential' }), 1);
    expect(reducer(s, { type: 'SPIN', seed: 1 })).toBe(s);
  });

  it('NEXT_PLAYER advances and wraps', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'NEXT_PLAYER' });
    expect(s.phase).toBe('choosing');
    expect(s.activePlayerId).toBe('a');
    s = reducer(s, { type: 'CHOOSE', kind: 'truth', seed: 1 });
    s = reducer(s, { type: 'RESOLVE', outcome: 'done' });
    s = reducer(s, { type: 'NEXT_PLAYER' });
    expect(s.activePlayerId).toBe('b');
  });
});

describe('tod choose & resolve', () => {
  it('CHOOSE draws a prompt and (ungated) goes to resolving', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'NEXT_PLAYER' });
    s = reducer(s, { type: 'CHOOSE', kind: 'dare', seed: 7 });
    expect(s.phase).toBe('resolving');
    expect(s.currentKind).toBe('dare');
    expect(s.currentPromptId).not.toBeNull();
  });

  it('gates the reveal when privateReveal is always', () => {
    let s = createInitialState(makeConfig({ privateReveal: 'always' }), 1);
    s = reducer(s, { type: 'NEXT_PLAYER' });
    s = reducer(s, { type: 'CHOOSE', kind: 'truth', seed: 7 });
    expect(s.phase).toBe('revealing');
    expect(s.reveal).not.toBeNull();
    s = reducer(s, { type: 'REVEAL' });
    expect(s.phase).toBe('resolving');
  });

  it('scores points by kind and outcome; records history', () => {
    let s = createInitialState(makeConfig({ pointsForDare: 2, pointsForTruth: 1 }), 1);
    s = turn(s, 'dare', 'done');
    expect(scoring.total(s.scores, 'a')).toBe(2);
    s = turn(s, 'truth', 'done');
    expect(scoring.total(s.scores, 'b')).toBe(1);
    s = turn(s, 'dare', 'skip');
    expect(scoring.total(s.scores, 'c')).toBe(0);
    expect(s.history).toHaveLength(3);
    expect(s.turnIndex).toBe(3);
  });

  it('casual mode awards no points', () => {
    let s = createInitialState(makeConfig({ scoringMode: 'casual' }), 1);
    s = turn(s, 'dare', 'done');
    expect(scoring.total(s.scores, 'a')).toBe(0);
    expect(s.history[0].pointsDelta).toBe(0);
  });

  it('RESOLVE done is a no-op from revealing; skip is allowed', () => {
    let s = createInitialState(makeConfig({ privateReveal: 'always' }), 1);
    s = reducer(s, { type: 'NEXT_PLAYER' });
    s = reducer(s, { type: 'CHOOSE', kind: 'truth', seed: 7 });
    expect(reducer(s, { type: 'RESOLVE', outcome: 'done' })).toBe(s); // can't complete unseen
    const skipped = reducer(s, { type: 'RESOLVE', outcome: 'skip' });
    expect(skipped.history).toHaveLength(1);
  });
});

describe('tod end conditions', () => {
  it('ends after the configured number of rounds', () => {
    let s = createInitialState(makeConfig({ endType: 'rounds', endValue: 1 }), 1);
    for (let i = 0; i < 3; i++) s = turn(s, 'truth', 'done');
    expect(s.finished).toBe(false);
    s = turn(s, 'truth', 'done'); // completes the rotation (4 players)
    expect(s.phase).toBe('gameOver');
    expect(s.endReason).toBe('rounds');
    expect(s.finished).toBe(true);
  });

  it('ends when a player reaches the points target', () => {
    let s = createInitialState(makeConfig({ endType: 'target', endValue: 2, pointsForDare: 2 }), 1);
    s = turn(s, 'dare', 'done'); // a -> 2
    expect(s.phase).toBe('gameOver');
    expect(s.endReason).toBe('target');
    expect(computeWinners(s)).toEqual(['a']);
  });

  it('endless never auto-ends; END_GAME finishes', () => {
    let s = createInitialState(makeConfig({ endType: 'endless' }), 1);
    for (let i = 0; i < 6; i++) s = turn(s, 'truth', 'done');
    expect(s.finished).toBe(false);
    s = reducer(s, { type: 'END_GAME' });
    expect(s.phase).toBe('gameOver');
    expect(s.endReason).toBe('endless');
  });

  it('does not mutate input (purity)', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'NEXT_PLAYER' });
    const snap = structuredClone(s);
    reducer(s, { type: 'CHOOSE', kind: 'truth', seed: 1 });
    expect(s).toEqual(snap);
  });
});
