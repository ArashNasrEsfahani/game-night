import { describe, it, expect } from 'vitest';
import type { GameConfig, PlayerId, PlayerSeat } from '../../sdk/types';
import { asPlayerId, asTeamId } from '../../engine/ids';
import { createInitialState, reducer } from './logic';
import type { CardRole, CodenamesState } from './logic';
import { DEFAULT_OPTIONS } from './config';
import type { CodenamesOptions } from './config';
import { validateContent } from './content';

const seat = (id: string): PlayerSeat => ({ id: asPlayerId(id), name: id.toUpperCase() });

function makeConfig(options: Partial<CodenamesOptions> = {}): GameConfig {
  return {
    players: ['a', 'b', 'c', 'd'].map(seat),
    teams: {
      mode: 'auto',
      teams: [
        { id: asTeamId('teamA'), name: 'Red', memberIds: [asPlayerId('a'), asPlayerId('c')] as PlayerId[] },
        { id: asTeamId('teamB'), name: 'Blue', memberIds: [asPlayerId('b'), asPlayerId('d')] as PlayerId[] },
      ],
    },
    options: { ...DEFAULT_OPTIONS, startingTeam: 'teamA', ...options },
    lang: 'en',
  };
}

const cellsByRole = (s: CodenamesState, role: CardRole) => s.board.filter((c) => c.role === role);
function toGuessing(s: CodenamesState, count = 2): CodenamesState {
  s = reducer(s, { type: 'REVEAL_KEY_TO_SPYMASTER' });
  s = reducer(s, { type: 'GIVE_CLUE', count });
  return reducer(s, { type: 'HANDOFF_TO_GUESSERS' });
}

describe('codenames content', () => {
  it('ships a valid pool of 25+ words', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('codenames createInitialState', () => {
  it('builds a 25-cell board with the right key composition', () => {
    const s = createInitialState(makeConfig(), 42);
    expect(s.board).toHaveLength(25);
    expect(cellsByRole(s, 'teamA')).toHaveLength(9);
    expect(cellsByRole(s, 'teamB')).toHaveLength(8);
    expect(cellsByRole(s, 'neutral')).toHaveLength(7);
    expect(cellsByRole(s, 'assassin')).toHaveLength(1);
    expect(new Set(s.board.map((c) => c.wordId)).size).toBe(25);
    expect(s.remaining).toEqual({ teamA: 9, teamB: 8 });
    expect(s.currentTeam).toBe('teamA');
    expect(s.phase).toBe('spymasterHandoff');
    expect(createInitialState(makeConfig(), 42).board).toEqual(s.board);
  });

  it('errors when teams are invalid', () => {
    const cfg = makeConfig();
    cfg.teams = { mode: 'auto', teams: [] };
    expect(createInitialState(cfg, 1).phase).toBe('error');
  });
});

describe('codenames clue flow', () => {
  it('reveal -> clue -> give clue computes guesses and logs it', () => {
    let s = createInitialState(makeConfig(), 1);
    s = reducer(s, { type: 'REVEAL_KEY_TO_SPYMASTER' });
    expect(s.phase).toBe('clue');
    s = reducer(s, { type: 'GIVE_CLUE', count: 2 });
    expect(s.activeClue).toMatchObject({ count: 2, guessesAllowed: 3, guessesMade: 0 });
    expect(s.clueLog).toHaveLength(1);
    expect(s.phase).toBe('guesserHandoff');
    s = reducer(s, { type: 'HANDOFF_TO_GUESSERS' });
    expect(s.phase).toBe('guessing');
  });

  it('honors bonus-off, count 0, and clamping', () => {
    expect(reducer(reducer(createInitialState(makeConfig({ allowBonusGuess: false }), 1), { type: 'REVEAL_KEY_TO_SPYMASTER' }), { type: 'GIVE_CLUE', count: 2 }).activeClue!.guessesAllowed).toBe(2);
    expect(reducer(reducer(createInitialState(makeConfig(), 1), { type: 'REVEAL_KEY_TO_SPYMASTER' }), { type: 'GIVE_CLUE', count: 0 }).activeClue!.guessesAllowed).toBe(9);
    expect(reducer(reducer(createInitialState(makeConfig(), 1), { type: 'REVEAL_KEY_TO_SPYMASTER' }), { type: 'GIVE_CLUE', count: 99 }).activeClue!.count).toBe(9);
  });
});

describe('codenames guessing', () => {
  it('a correct guess reveals, decrements, and continues', () => {
    let s = toGuessing(createInitialState(makeConfig(), 1), 2);
    const cell = cellsByRole(s, 'teamA')[0];
    s = reducer(s, { type: 'GUESS_CELL', cellIndex: cell.index });
    expect(s.board[cell.index].revealed).toBe(true);
    expect(s.remaining.teamA).toBe(8);
    expect(s.phase).toBe('guessing');
    expect(s.lastReveal?.outcome).toBe('correct');
    expect(reducer(s, { type: 'GUESS_CELL', cellIndex: cell.index })).toBe(s); // double-tap no-op
  });

  it('clearing all words wins the game', () => {
    let s = toGuessing(createInitialState(makeConfig(), 1), 0); // unlimited
    for (const cell of cellsByRole(s, 'teamA')) {
      if (s.phase === 'gameOver') break;
      s = reducer(s, { type: 'GUESS_CELL', cellIndex: cell.index });
    }
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe('teamA');
    expect(s.winReason).toBe('clearedWords');
  });

  it('a neutral ends the turn', () => {
    let s = toGuessing(createInitialState(makeConfig(), 1), 2);
    s = reducer(s, { type: 'GUESS_CELL', cellIndex: cellsByRole(s, 'neutral')[0].index });
    expect(s.phase).toBe('turnEnd');
    expect(s.turnEndReason).toBe('guessedWrong');
  });

  it('the assassin loses instantly', () => {
    let s = toGuessing(createInitialState(makeConfig(), 1), 2);
    s = reducer(s, { type: 'GUESS_CELL', cellIndex: cellsByRole(s, 'assassin')[0].index });
    expect(s.phase).toBe('gameOver');
    expect(s.loser).toBe('teamA');
    expect(s.winner).toBe('teamB');
    expect(s.winReason).toBe('opponentHitAssassin');
  });

  it('hitting the enemy last word wins it for them', () => {
    let s = createInitialState(makeConfig(), 1);
    s = { ...s, remaining: { ...s.remaining, teamB: 1 } };
    s = toGuessing(s, 2);
    s = reducer(s, { type: 'GUESS_CELL', cellIndex: cellsByRole(s, 'teamB')[0].index });
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe('teamB');
    expect(s.winReason).toBe('clearedWords');
  });

  it('using all guesses ends the turn', () => {
    let s = toGuessing(createInitialState(makeConfig(), 1), 1); // guessesAllowed 2
    const a = cellsByRole(s, 'teamA');
    s = reducer(s, { type: 'GUESS_CELL', cellIndex: a[0].index });
    s = reducer(s, { type: 'GUESS_CELL', cellIndex: a[1].index });
    expect(s.phase).toBe('turnEnd');
    expect(s.turnEndReason).toBe('usedAllGuesses');
  });
});

describe('codenames turns', () => {
  it('STOP_GUESSING needs a guess; ADVANCE_TURN flips the team', () => {
    let s = toGuessing(createInitialState(makeConfig(), 1), 2);
    expect(reducer(s, { type: 'STOP_GUESSING' })).toBe(s); // no guesses yet
    s = reducer(s, { type: 'GUESS_CELL', cellIndex: cellsByRole(s, 'teamA')[0].index });
    s = reducer(s, { type: 'STOP_GUESSING' });
    expect(s.phase).toBe('turnEnd');
    s = reducer(s, { type: 'ADVANCE_TURN' });
    expect(s.phase).toBe('spymasterHandoff');
    expect(s.currentTeam).toBe('teamB');
    expect(s.activeClue).toBeNull();
  });

  it('timed mode times out to turnEnd; guards & purity hold', () => {
    let s = toGuessing(createInitialState(makeConfig({ mode: 'timed' }), 1), 2);
    s = reducer(s, { type: 'TIMER_EXPIRED' });
    expect(s.phase).toBe('turnEnd');
    expect(s.turnEndReason).toBe('timeUp');

    const fresh = createInitialState(makeConfig(), 1);
    expect(reducer(fresh, { type: 'GUESS_CELL', cellIndex: 0 })).toBe(fresh); // wrong phase
    const snap = structuredClone(fresh);
    reducer(fresh, { type: 'REVEAL_KEY_TO_SPYMASTER' });
    expect(fresh).toEqual(snap);
  });
});
