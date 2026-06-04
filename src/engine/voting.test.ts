import { describe, it, expect } from 'vitest';
import { asPlayerId } from './ids';
import {
  openOption,
  openPlayer,
  cast,
  retract,
  close,
  tally,
  winners,
  allVoted,
  turnout,
  type VoteState,
} from './voting';

const p = (s: string) => asPlayerId(s);
const voters3 = [p('a'), p('b'), p('c')];

describe('voting.openOption', () => {
  it('builds an open option vote with empty ballots', () => {
    const s = openOption(['x', 'y'], voters3);
    expect(s.target).toBe('option');
    expect(s.choices).toEqual(['x', 'y']);
    expect(s.ballots).toEqual({});
    expect(s.voters).toEqual(voters3);
    expect(s.open).toBe(true);
  });

  it('de-duplicates choices and voters', () => {
    const s = openOption(['x', 'x', 'y'], [p('a'), p('a'), p('b')]);
    expect(s.choices).toEqual(['x', 'y']);
    expect(s.voters).toEqual([p('a'), p('b')]);
  });

  it('handles empty inputs', () => {
    const s = openOption([], []);
    expect(s.choices).toEqual([]);
    expect(s.voters).toEqual([]);
    expect(s.open).toBe(true);
  });

  it('does not retain a reference to the input arrays (copy)', () => {
    const choices = ['x'];
    const s = openOption(choices, voters3);
    choices.push('mutated');
    expect(s.choices).toEqual(['x']);
  });
});

describe('voting.openPlayer', () => {
  it('uses candidate id strings as choices', () => {
    const s = openPlayer([p('a'), p('b')], voters3);
    expect(s.target).toBe('player');
    expect(s.choices).toEqual(['a', 'b']);
    expect(s.open).toBe(true);
  });

  it('de-duplicates candidates', () => {
    const s = openPlayer([p('a'), p('a'), p('b')], voters3);
    expect(s.choices).toEqual(['a', 'b']);
  });

  it('handles empty candidates', () => {
    const s = openPlayer([], voters3);
    expect(s.choices).toEqual([]);
  });
});

describe('voting.cast', () => {
  it('records a ballot and returns a new object (no mutation)', () => {
    const s0 = openOption(['x', 'y'], voters3);
    const s1 = cast(s0, p('a'), 'x');
    expect(s1).not.toBe(s0);
    expect(s0.ballots).toEqual({}); // input untouched
    expect(s1.ballots).toEqual({ a: 'x' });
  });

  it('re-vote overwrites the prior ballot', () => {
    let s = openOption(['x', 'y'], voters3);
    s = cast(s, p('a'), 'x');
    s = cast(s, p('a'), 'y');
    expect(s.ballots).toEqual({ a: 'y' });
  });

  it('is a no-op when casting the identical choice again', () => {
    const s1 = cast(openOption(['x'], voters3), p('a'), 'x');
    const s2 = cast(s1, p('a'), 'x');
    expect(s2).toBe(s1);
  });

  it('no-op when the vote is closed', () => {
    const s0 = close(openOption(['x'], voters3));
    const s1 = cast(s0, p('a'), 'x');
    expect(s1).toBe(s0);
    expect(s1.ballots).toEqual({});
  });

  it('no-op when the voter is not eligible', () => {
    const s0 = openOption(['x'], voters3);
    const s1 = cast(s0, p('zzz'), 'x');
    expect(s1).toBe(s0);
  });

  it('no-op when the choice is invalid', () => {
    const s0 = openOption(['x'], voters3);
    const s1 = cast(s0, p('a'), 'nope');
    expect(s1).toBe(s0);
  });
});

describe('voting.retract', () => {
  it('removes the voter ballot and returns a new object', () => {
    const s0 = cast(openOption(['x'], voters3), p('a'), 'x');
    const s1 = retract(s0, p('a'));
    expect(s1).not.toBe(s0);
    expect(s1.ballots).toEqual({});
    expect(s0.ballots).toEqual({ a: 'x' }); // input untouched
  });

  it('no-op when the voter had not voted', () => {
    const s0 = openOption(['x'], voters3);
    const s1 = retract(s0, p('a'));
    expect(s1).toBe(s0);
  });

  it('leaves other ballots intact', () => {
    let s = openOption(['x', 'y'], voters3);
    s = cast(s, p('a'), 'x');
    s = cast(s, p('b'), 'y');
    s = retract(s, p('a'));
    expect(s.ballots).toEqual({ b: 'y' });
  });
});

describe('voting.close', () => {
  it('closes an open vote', () => {
    const s0 = openOption(['x'], voters3);
    const s1 = close(s0);
    expect(s1).not.toBe(s0);
    expect(s1.open).toBe(false);
  });

  it('is idempotent (already-closed returns same reference)', () => {
    const s1 = close(openOption(['x'], voters3));
    const s2 = close(s1);
    expect(s2).toBe(s1);
  });
});

describe('voting.tally', () => {
  it('counts votes per choice with zeros for unvoted', () => {
    let s = openOption(['x', 'y', 'z'], voters3);
    s = cast(s, p('a'), 'x');
    s = cast(s, p('b'), 'x');
    s = cast(s, p('c'), 'y');
    expect(tally(s)).toEqual({ x: 2, y: 1, z: 0 });
  });

  it('returns an all-zero record with no ballots', () => {
    const s = openOption(['x', 'y'], voters3);
    expect(tally(s)).toEqual({ x: 0, y: 0 });
  });

  it('returns empty record with no choices', () => {
    const s = openOption([], voters3);
    expect(tally(s)).toEqual({});
  });
});

describe('voting.winners', () => {
  it('returns the single max choice', () => {
    let s = openOption(['x', 'y'], voters3);
    s = cast(s, p('a'), 'x');
    s = cast(s, p('b'), 'x');
    s = cast(s, p('c'), 'y');
    expect(winners(s)).toEqual(['x']);
  });

  it('returns all tied choices in choices order', () => {
    let s = openOption(['x', 'y', 'z'], voters3);
    s = cast(s, p('a'), 'y');
    s = cast(s, p('b'), 'x');
    expect(winners(s)).toEqual(['x', 'y']);
  });

  it('with no ballots every choice ties at zero', () => {
    const s = openOption(['x', 'y'], voters3);
    expect(winners(s)).toEqual(['x', 'y']);
  });

  it('returns [] when there are no choices', () => {
    const s = openOption([], voters3);
    expect(winners(s)).toEqual([]);
  });

  it('single choice single voter', () => {
    const s = cast(openOption(['only'], [p('a')]), p('a'), 'only');
    expect(winners(s)).toEqual(['only']);
  });
});

describe('voting.allVoted', () => {
  it('false until every eligible voter has voted', () => {
    let s = openOption(['x'], voters3);
    expect(allVoted(s)).toBe(false);
    s = cast(s, p('a'), 'x');
    s = cast(s, p('b'), 'x');
    expect(allVoted(s)).toBe(false);
    s = cast(s, p('c'), 'x');
    expect(allVoted(s)).toBe(true);
  });

  it('vacuously true with no voters', () => {
    expect(allVoted(openOption(['x'], []))).toBe(true);
  });
});

describe('voting.turnout', () => {
  it('is the fraction of eligible voters who voted', () => {
    let s = openOption(['x'], voters3);
    expect(turnout(s)).toBe(0);
    s = cast(s, p('a'), 'x');
    expect(turnout(s)).toBeCloseTo(1 / 3);
    s = cast(s, p('b'), 'x');
    s = cast(s, p('c'), 'x');
    expect(turnout(s)).toBe(1);
  });

  it('is 0 when there are no voters', () => {
    expect(turnout(openOption(['x'], []))).toBe(0);
  });

  it('ignores ballots from ineligible voters in count', () => {
    // ineligible casts are no-ops, so turnout reflects only eligible voters
    let s = openOption(['x'], [p('a'), p('b')]);
    s = cast(s, p('ghost'), 'x'); // no-op
    expect(turnout(s)).toBe(0);
  });
});

describe('voting determinism', () => {
  it('identical sequences of ops produce structurally identical state', () => {
    const build = (): VoteState => {
      let s = openOption(['x', 'y', 'z'], voters3);
      s = cast(s, p('a'), 'x');
      s = cast(s, p('b'), 'y');
      s = cast(s, p('c'), 'x');
      s = retract(s, p('b'));
      s = close(s);
      return s;
    };
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it('state is JSON-serializable (round-trips)', () => {
    let s = openPlayer([p('a'), p('b')], voters3);
    s = cast(s, p('a'), 'b');
    const round = JSON.parse(JSON.stringify(s)) as VoteState;
    expect(round).toEqual(s);
  });
});
