import { describe, it, expect } from 'vitest';
import {
  create,
  add,
  set,
  undoLast,
  total,
  standings,
  leader,
  type ScoreState,
} from './scoring';

describe('create', () => {
  it('starts every subject at 0 with an empty log', () => {
    const s = create(['a', 'b', 'c']);
    expect(s.totals).toEqual({ a: 0, b: 0, c: 0 });
    expect(s.log).toEqual([]);
  });
  it('handles empty subject list', () => {
    const s = create([]);
    expect(s.totals).toEqual({});
    expect(s.log).toEqual([]);
  });
  it('handles a single subject', () => {
    expect(create(['solo']).totals).toEqual({ solo: 0 });
  });
});

describe('add', () => {
  it('appends an event and updates the total without mutating input', () => {
    const s0 = create(['a', 'b']);
    const s1 = add(s0, 'a', 5, 'goal', 100);
    expect(total(s1, 'a')).toBe(5);
    expect(total(s1, 'b')).toBe(0);
    expect(s1.log).toEqual([{ subjectId: 'a', delta: 5, reason: 'goal', at: 100 }]);
    // input untouched
    expect(s0.totals).toEqual({ a: 0, b: 0 });
    expect(s0.log).toEqual([]);
    expect(s1).not.toBe(s0);
  });
  it('accumulates across multiple adds', () => {
    let s = create(['a']);
    s = add(s, 'a', 3, undefined, 1);
    s = add(s, 'a', 4, undefined, 2);
    expect(total(s, 'a')).toBe(7);
    expect(s.log).toHaveLength(2);
  });
  it('omits reason from the event when not provided', () => {
    const s = add(create(['a']), 'a', 2);
    expect(s.log[0]).toEqual({ subjectId: 'a', delta: 2, at: 0 });
    expect('reason' in s.log[0]).toBe(false);
  });
  it('defaults `at` to 0 when omitted', () => {
    const s = add(create(['a']), 'a', 2);
    expect(s.log[0].at).toBe(0);
  });
  it('introduces unknown subjects starting from 0', () => {
    const s = add(create(['a']), 'newcomer', 9, undefined, 5);
    expect(total(s, 'newcomer')).toBe(9);
    expect(s.totals.a).toBe(0);
  });
  it('supports negative deltas', () => {
    const s = add(create(['a']), 'a', -4, undefined, 1);
    expect(total(s, 'a')).toBe(-4);
  });
  it('is a no-op for a zero delta', () => {
    const s0 = create(['a']);
    const s1 = add(s0, 'a', 0, 'noop', 1);
    expect(s1).toBe(s0);
    expect(s1.log).toEqual([]);
  });
});

describe('set', () => {
  it('sets an absolute value and logs the equivalent delta', () => {
    const s0 = add(create(['a']), 'a', 3, undefined, 1);
    const s1 = set(s0, 'a', 10, 50);
    expect(total(s1, 'a')).toBe(10);
    expect(s1.log[s1.log.length - 1]).toEqual({
      subjectId: 'a',
      delta: 7,
      reason: 'set',
      at: 50,
    });
    // input untouched
    expect(total(s0, 'a')).toBe(3);
  });
  it('sets unknown subjects from a baseline of 0', () => {
    const s = set(create(['a']), 'b', 4, 1);
    expect(total(s, 'b')).toBe(4);
    expect(s.log[0]).toEqual({ subjectId: 'b', delta: 4, reason: 'set', at: 1 });
  });
  it('can set a negative value', () => {
    const s = set(create(['a']), 'a', -3, 1);
    expect(total(s, 'a')).toBe(-3);
  });
  it('defaults `at` to 0 when omitted', () => {
    const s = set(create(['a']), 'a', 5);
    expect(s.log[0].at).toBe(0);
  });
  it('is a no-op when the value already equals the current total', () => {
    const s0 = add(create(['a']), 'a', 5, undefined, 1);
    const s1 = set(s0, 'a', 5, 99);
    expect(s1).toBe(s0);
  });
  it('is a no-op when setting a zero subject to 0', () => {
    const s0 = create(['a']);
    expect(set(s0, 'a', 0, 1)).toBe(s0);
  });
});

describe('undoLast', () => {
  it('reverses the last add event and pops the log', () => {
    const s0 = create(['a']);
    const s1 = add(s0, 'a', 5, undefined, 1);
    const s2 = add(s1, 'a', 3, undefined, 2);
    const s3 = undoLast(s2);
    expect(total(s3, 'a')).toBe(5);
    expect(s3.log).toHaveLength(1);
    // does not mutate input
    expect(total(s2, 'a')).toBe(8);
    expect(s2.log).toHaveLength(2);
  });
  it('reverses a set event back to the prior value', () => {
    let s = add(create(['a']), 'a', 4, undefined, 1); // total 4
    s = set(s, 'a', 20, 2); // total 20
    s = undoLast(s);
    expect(total(s, 'a')).toBe(4);
    expect(s.log).toHaveLength(1);
  });
  it('is a no-op on an empty log', () => {
    const s0 = create(['a', 'b']);
    const s1 = undoLast(s0);
    expect(s1).toBe(s0);
  });
  it('fully unwinds a sequence back to zero', () => {
    let s: ScoreState = create(['a']);
    s = add(s, 'a', 2, undefined, 1);
    s = add(s, 'a', 7, undefined, 2);
    s = set(s, 'a', 100, 3);
    s = undoLast(s);
    s = undoLast(s);
    s = undoLast(s);
    expect(total(s, 'a')).toBe(0);
    expect(s.log).toEqual([]);
  });
});

describe('total', () => {
  it('returns the current total for a known subject', () => {
    const s = add(create(['a']), 'a', 6, undefined, 1);
    expect(total(s, 'a')).toBe(6);
  });
  it('returns 0 for an unknown subject', () => {
    expect(total(create(['a']), 'ghost')).toBe(0);
    expect(total(create([]), 'anyone')).toBe(0);
  });
});

describe('standings', () => {
  it('ranks by total descending', () => {
    let s = create(['a', 'b', 'c']);
    s = add(s, 'a', 1, undefined, 1);
    s = add(s, 'b', 3, undefined, 2);
    s = add(s, 'c', 2, undefined, 3);
    expect(standings(s)).toEqual([
      { subjectId: 'b', total: 3 },
      { subjectId: 'c', total: 2 },
      { subjectId: 'a', total: 1 },
    ]);
  });
  it('breaks ties stably by subjectId ascending', () => {
    let s = create(['z', 'a', 'm']);
    s = add(s, 'z', 5, undefined, 1);
    s = add(s, 'a', 5, undefined, 2);
    s = add(s, 'm', 5, undefined, 3);
    expect(standings(s)).toEqual([
      { subjectId: 'a', total: 5 },
      { subjectId: 'm', total: 5 },
      { subjectId: 'z', total: 5 },
    ]);
  });
  it('returns an empty array for an empty scoreboard', () => {
    expect(standings(create([]))).toEqual([]);
  });
  it('handles a single subject', () => {
    expect(standings(create(['solo']))).toEqual([{ subjectId: 'solo', total: 0 }]);
  });
  it('does not mutate the input state', () => {
    const s = add(create(['a', 'b']), 'a', 1, undefined, 1);
    standings(s);
    expect(s.totals).toEqual({ a: 1, b: 0 });
  });
});

describe('leader', () => {
  it('returns the top subject by total', () => {
    let s = create(['a', 'b']);
    s = add(s, 'a', 1, undefined, 1);
    s = add(s, 'b', 9, undefined, 2);
    expect(leader(s)).toBe('b');
  });
  it('breaks ties by subjectId ascending', () => {
    let s = create(['b', 'a']);
    s = add(s, 'a', 4, undefined, 1);
    s = add(s, 'b', 4, undefined, 2);
    expect(leader(s)).toBe('a');
  });
  it('returns undefined for an empty scoreboard', () => {
    expect(leader(create([]))).toBeUndefined();
  });
  it('returns the sole subject even at zero', () => {
    expect(leader(create(['only']))).toBe('only');
  });
});

describe('determinism and JSON-serializability', () => {
  it('produces identical state for identical operation sequences', () => {
    const build = (): ScoreState => {
      let s = create(['a', 'b', 'c']);
      s = add(s, 'a', 5, 'r', 10);
      s = add(s, 'b', 2, undefined, 11);
      s = set(s, 'c', 8, 12);
      s = undoLast(s);
      return s;
    };
    expect(build()).toEqual(build());
  });
  it('state survives a JSON round-trip unchanged', () => {
    let s = create(['a', 'b']);
    s = add(s, 'a', 3, 'goal', 1);
    s = set(s, 'b', 7, 2);
    const round = JSON.parse(JSON.stringify(s));
    expect(round).toEqual(s);
  });
});
