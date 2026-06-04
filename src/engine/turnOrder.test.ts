import { describe, it, expect } from 'vitest';
import { asPlayerId } from './ids';
import {
  init,
  current,
  next,
  isRoundComplete,
  reset,
  peekNext,
  type TurnOrderState,
  type TurnMode,
} from './turnOrder';
import type { PlayerId } from '../sdk/types';

const P = (n: number): PlayerId => asPlayerId(`p${n}`);
const ORDER = [P(0), P(1), P(2), P(3)];

describe('init', () => {
  it('builds a sequential state at the start', () => {
    const s = init(ORDER, 'sequential', 1);
    expect(s.mode).toBe('sequential');
    expect(s.order).toEqual(ORDER);
    expect(s.index).toBe(0);
    expect(s.round).toBe(0);
    expect(s.remaining).toBeUndefined();
  });

  it('builds a circular state at the start', () => {
    const s = init(ORDER, 'circular', 1);
    expect(s.mode).toBe('circular');
    expect(s.index).toBe(0);
    expect(s.round).toBe(0);
    expect(s.remaining).toBeUndefined();
  });

  it('prefills a shuffled remaining for random mode', () => {
    const s = init(ORDER, 'random', 42);
    expect(s.mode).toBe('random');
    expect(s.remaining).toBeDefined();
    expect(s.remaining!.length).toBe(ORDER.length);
    // it is a permutation of order
    expect([...s.remaining!].sort()).toEqual([...ORDER].sort());
  });

  it('does not alias or mutate the input order array', () => {
    const input = ORDER.slice();
    const s = init(input, 'sequential', 1);
    expect(s.order).not.toBe(input);
    s.order.push(P(99));
    expect(input).toEqual(ORDER);
  });

  it('is deterministic for random mode under a fixed seed', () => {
    const a = init(ORDER, 'random', 7);
    const b = init(ORDER, 'random', 7);
    expect(a).toEqual(b);
  });

  it('different seeds usually produce different random orders', () => {
    const a = init(ORDER, 'random', 1);
    const b = init(ORDER, 'random', 2);
    expect(a.remaining).not.toEqual(b.remaining);
  });

  it('handles an empty order', () => {
    const s = init([], 'sequential', 1);
    expect(s.order).toEqual([]);
    const r = init([], 'random', 1);
    expect(r.remaining).toEqual([]);
  });

  it('handles a single-element order', () => {
    const s = init([P(0)], 'random', 5);
    expect(s.remaining).toEqual([P(0)]);
  });
});

describe('current', () => {
  it('returns order[index] for sequential', () => {
    const s = init(ORDER, 'sequential', 1);
    expect(current(s)).toBe(P(0));
    expect(current({ ...s, index: 2 })).toBe(P(2));
  });

  it('returns order[index] for circular', () => {
    const s = init(ORDER, 'circular', 1);
    expect(current(s)).toBe(P(0));
    expect(current({ ...s, index: 3 })).toBe(P(3));
  });

  it('clamps an out-of-range sequential index (end-stopped state)', () => {
    const s: TurnOrderState = { mode: 'sequential', order: ORDER, index: ORDER.length, round: 0 };
    expect(current(s)).toBe(P(ORDER.length - 1));
  });

  it('clamps a negative index', () => {
    const s: TurnOrderState = { mode: 'sequential', order: ORDER, index: -5, round: 0 };
    expect(current(s)).toBe(P(0));
  });

  it('reads the top of the remaining pile for random', () => {
    const s = init(ORDER, 'random', 9);
    const top = s.remaining![s.remaining!.length - 1];
    expect(current(s)).toBe(top);
  });
});

describe('next — sequential', () => {
  it('increments index and stops at the end', () => {
    let s = init(ORDER, 'sequential', 1);
    expect(s.index).toBe(0);
    s = next(s, 1);
    expect(s.index).toBe(1);
    s = next(s, 1);
    s = next(s, 1);
    expect(s.index).toBe(3);
    s = next(s, 1); // reaches end => index === order.length
    expect(s.index).toBe(ORDER.length);
    // stays put (no-op) once at the end
    const stopped = next(s, 1);
    expect(stopped.index).toBe(ORDER.length);
  });

  it('does not mutate the input state', () => {
    const s = init(ORDER, 'sequential', 1);
    const before = { ...s };
    next(s, 1);
    expect(s).toEqual(before);
  });
});

describe('next — circular', () => {
  it('wraps to 0 and bumps round on wrap', () => {
    let s = init(ORDER, 'circular', 1);
    for (let i = 1; i < ORDER.length; i++) {
      s = next(s, 1);
      expect(s.index).toBe(i);
      expect(s.round).toBe(0);
    }
    s = next(s, 1); // wrap
    expect(s.index).toBe(0);
    expect(s.round).toBe(1);
  });

  it('keeps wrapping over many rounds', () => {
    let s = init(ORDER, 'circular', 1);
    for (let k = 0; k < ORDER.length * 3; k++) s = next(s, 1);
    expect(s.index).toBe(0);
    expect(s.round).toBe(3);
  });
});

describe('next — random', () => {
  it('pops the pile one at a time, refilling + bumping round when empty', () => {
    let s = init(ORDER, 'random', 99);
    const seen: PlayerId[] = [current(s)];
    for (let i = 0; i < ORDER.length - 1; i++) {
      s = next(s, 99);
      seen.push(current(s));
    }
    // saw every player exactly once this round
    expect([...seen].sort()).toEqual([...ORDER].sort());
    expect(s.round).toBe(0);
    // last pop empties the pile and refills => round advances
    s = next(s, 99);
    expect(s.round).toBe(1);
    expect(s.remaining!.length).toBe(ORDER.length);
  });

  it('is deterministic across the whole sequence under a fixed seed', () => {
    const run = () => {
      let s = init(ORDER, 'random', 123);
      const out: PlayerId[] = [];
      for (let i = 0; i < ORDER.length * 2; i++) {
        out.push(current(s));
        s = next(s, 123);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('does not mutate the input state', () => {
    const s = init(ORDER, 'random', 5);
    const before = JSON.parse(JSON.stringify(s));
    next(s, 5);
    expect(JSON.parse(JSON.stringify(s))).toEqual(before);
  });

  it('handles a single-element random pile (refills every step)', () => {
    let s = init([P(0)], 'random', 3);
    expect(current(s)).toBe(P(0));
    s = next(s, 3);
    expect(s.round).toBe(1);
    expect(current(s)).toBe(P(0));
  });
});

describe('next — empty order', () => {
  it('is a no-op for empty sequential/circular', () => {
    const seq = init([], 'sequential', 1);
    expect(next(seq, 1)).toEqual(seq);
    const cir = init([], 'circular', 1);
    expect(next(cir, 1)).toEqual(cir);
  });
});

describe('isRoundComplete', () => {
  it('sequential: true only once index reaches the end', () => {
    let s = init(ORDER, 'sequential', 1);
    expect(isRoundComplete(s)).toBe(false);
    for (let i = 0; i < ORDER.length; i++) s = next(s, 1);
    expect(s.index).toBe(ORDER.length);
    expect(isRoundComplete(s)).toBe(true);
  });

  it('circular: true exactly after a wrap (round>0 and index===0)', () => {
    let s = init(ORDER, 'circular', 1);
    expect(isRoundComplete(s)).toBe(false); // round 0, index 0 at very start
    for (let i = 0; i < ORDER.length; i++) s = next(s, 1);
    expect(isRoundComplete(s)).toBe(true); // wrapped
    s = next(s, 1);
    expect(isRoundComplete(s)).toBe(false); // mid-round again
  });

  it('random: true exactly when the pile is empty', () => {
    let s = init(ORDER, 'random', 7);
    expect(isRoundComplete(s)).toBe(false);
    // emptying happens via the refill path; force an empty pile to assert the predicate
    const empty: TurnOrderState = { ...s, remaining: [] };
    expect(isRoundComplete(empty)).toBe(true);
    // a normal full pile is not complete
    expect(isRoundComplete(s)).toBe(false);
    s = next(s, 7);
    expect(isRoundComplete(s)).toBe(false);
  });

  it('empty order is considered complete for seq/circular', () => {
    expect(isRoundComplete(init([], 'sequential', 1))).toBe(true);
    expect(isRoundComplete(init([], 'circular', 1))).toBe(true);
  });
});

describe('reset', () => {
  it('sequential: returns to index 0 / round 0 and clears remaining', () => {
    let s = init(ORDER, 'sequential', 1);
    s = next(s, 1);
    s = next(s, 1);
    const r = reset(s, 1);
    expect(r.index).toBe(0);
    expect(r.round).toBe(0);
    expect(r.remaining).toBeUndefined();
  });

  it('circular: returns to index 0 / round 0', () => {
    let s = init(ORDER, 'circular', 1);
    for (let i = 0; i < ORDER.length + 2; i++) s = next(s, 1);
    const r = reset(s, 1);
    expect(r.index).toBe(0);
    expect(r.round).toBe(0);
  });

  it('random: re-shuffles a fresh full pile and resets round', () => {
    let s = init(ORDER, 'random', 1);
    s = next(s, 1);
    s = next(s, 1);
    const r = reset(s, 55);
    expect(r.round).toBe(0);
    expect(r.remaining!.length).toBe(ORDER.length);
    expect([...r.remaining!].sort()).toEqual([...ORDER].sort());
  });

  it('random reset is deterministic for a fixed seed', () => {
    const s = init(ORDER, 'random', 1);
    expect(reset(s, 8)).toEqual(reset(s, 8));
  });

  it('does not mutate the input state', () => {
    const s = init(ORDER, 'random', 1);
    const before = JSON.parse(JSON.stringify(s));
    reset(s, 2);
    expect(JSON.parse(JSON.stringify(s))).toEqual(before);
  });
});

describe('peekNext', () => {
  it('sequential: reports the next seat without mutating, clamped at the last seat', () => {
    const s = init(ORDER, 'sequential', 1);
    expect(peekNext(s, 1)).toBe(P(1));
    expect(s.index).toBe(0); // untouched
    const last: TurnOrderState = { mode: 'sequential', order: ORDER, index: ORDER.length - 1, round: 0 };
    expect(peekNext(last, 1)).toBe(P(ORDER.length - 1)); // clamped, no wrap
  });

  it('circular: reports the wrapped next seat', () => {
    const last: TurnOrderState = { mode: 'circular', order: ORDER, index: ORDER.length - 1, round: 0 };
    expect(peekNext(last, 1)).toBe(P(0));
  });

  it('matches current(next(s)) for sequential', () => {
    let s = init(ORDER, 'sequential', 1);
    for (let i = 0; i < ORDER.length; i++) {
      expect(peekNext(s, 1)).toBe(current(next(s, 1)));
      s = next(s, 1);
    }
  });

  it('matches current(next(s)) for circular across a wrap', () => {
    let s = init(ORDER, 'circular', 1);
    for (let i = 0; i < ORDER.length + 2; i++) {
      expect(peekNext(s, 1)).toBe(current(next(s, 1)));
      s = next(s, 1);
    }
  });

  it('matches current(next(s)) for random, including the refill boundary', () => {
    let s = init(ORDER, 'random', 321);
    for (let i = 0; i < ORDER.length * 2; i++) {
      expect(peekNext(s, 321)).toBe(current(next(s, 321)));
      s = next(s, 321);
    }
  });

  it('does not mutate state for random', () => {
    const s = init(ORDER, 'random', 11);
    const before = JSON.parse(JSON.stringify(s));
    peekNext(s, 11);
    expect(JSON.parse(JSON.stringify(s))).toEqual(before);
  });

  it('single-element order: peekNext stays on that player', () => {
    const seq = init([P(0)], 'sequential', 1);
    expect(peekNext(seq, 1)).toBe(P(0));
    const cir = init([P(0)], 'circular', 1);
    expect(peekNext(cir, 1)).toBe(P(0));
  });
});

describe('mode coverage sanity', () => {
  it('supports all declared modes', () => {
    const modes: TurnMode[] = ['sequential', 'circular', 'random'];
    for (const m of modes) {
      const s = init(ORDER, m, 1);
      expect(s.mode).toBe(m);
      expect(current(s)).toBeDefined();
    }
  });
});
