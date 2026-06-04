import { describe, it, expect } from 'vitest';
import { asPlayerId } from './ids';
import {
  init,
  holder,
  reveal,
  hide,
  pass,
  isDone,
  progress,
  type RevealGateState,
} from './revealGate';
import type { PlayerId } from '../sdk/types';

const ids = (...names: string[]): PlayerId[] => names.map(asPlayerId);

// Drive a single viewer's full turn: handoff -> revealed -> hidden -> pass.
const fullTurn = (s: RevealGateState): RevealGateState => pass(hide(reveal(s)));

describe('init', () => {
  it('starts at index 0 in handoff for a non-empty queue', () => {
    const s = init(ids('a', 'b', 'c'));
    expect(s.index).toBe(0);
    expect(s.phase).toBe('handoff');
    expect(s.queue).toEqual(ids('a', 'b', 'c'));
  });

  it('starts done for an empty queue', () => {
    const s = init([]);
    expect(s.phase).toBe('done');
    expect(s.index).toBe(0);
    expect(s.queue).toEqual([]);
    expect(isDone(s)).toBe(true);
  });

  it('handles a single-element queue', () => {
    const s = init(ids('solo'));
    expect(s.phase).toBe('handoff');
    expect(holder(s)).toBe(asPlayerId('solo'));
  });

  it('copies the queue (does not alias the caller array)', () => {
    const input = ids('a', 'b');
    const s = init(input);
    input.push(asPlayerId('c'));
    expect(s.queue).toEqual(ids('a', 'b'));
  });
});

describe('holder', () => {
  it('returns the current viewer', () => {
    const s = init(ids('a', 'b'));
    expect(holder(s)).toBe(asPlayerId('a'));
  });

  it('returns undefined when done', () => {
    expect(holder(init([]))).toBeUndefined();
  });

  it('follows the index as turns advance', () => {
    let s = init(ids('a', 'b', 'c'));
    expect(holder(s)).toBe(asPlayerId('a'));
    s = fullTurn(s);
    expect(holder(s)).toBe(asPlayerId('b'));
    s = fullTurn(s);
    expect(holder(s)).toBe(asPlayerId('c'));
    s = fullTurn(s);
    expect(holder(s)).toBeUndefined();
  });

  it('returns undefined for an out-of-range index', () => {
    const s: RevealGateState = { queue: ids('a'), index: 5, phase: 'handoff' };
    expect(holder(s)).toBeUndefined();
  });

  it('returns undefined for a negative index', () => {
    const s: RevealGateState = { queue: ids('a'), index: -1, phase: 'handoff' };
    expect(holder(s)).toBeUndefined();
  });
});

describe('reveal', () => {
  it('transitions handoff -> revealed', () => {
    const s = reveal(init(ids('a')));
    expect(s.phase).toBe('revealed');
  });

  it('is a no-op (same reference) outside handoff', () => {
    const revealed = reveal(init(ids('a')));
    expect(reveal(revealed)).toBe(revealed);
    const hidden = hide(revealed);
    expect(reveal(hidden)).toBe(hidden);
    const done = init([]);
    expect(reveal(done)).toBe(done);
  });

  it('does not mutate the input', () => {
    const s = init(ids('a'));
    reveal(s);
    expect(s.phase).toBe('handoff');
  });
});

describe('hide', () => {
  it('transitions revealed -> hidden', () => {
    const s = hide(reveal(init(ids('a'))));
    expect(s.phase).toBe('hidden');
  });

  it('is a no-op (same reference) outside revealed', () => {
    const handoff = init(ids('a'));
    expect(hide(handoff)).toBe(handoff);
    const hidden = hide(reveal(handoff));
    expect(hide(hidden)).toBe(hidden);
    const done = init([]);
    expect(hide(done)).toBe(done);
  });

  it('does not mutate the input', () => {
    const s = reveal(init(ids('a')));
    hide(s);
    expect(s.phase).toBe('revealed');
  });
});

describe('pass', () => {
  it('advances to the next viewer in handoff', () => {
    const s = pass(hide(reveal(init(ids('a', 'b')))));
    expect(s.index).toBe(1);
    expect(s.phase).toBe('handoff');
    expect(holder(s)).toBe(asPlayerId('b'));
  });

  it('moves to done after the last viewer', () => {
    const s = fullTurn(init(ids('only')));
    expect(s.phase).toBe('done');
    expect(s.index).toBe(1);
    expect(isDone(s)).toBe(true);
  });

  it('is a no-op (same reference) outside hidden', () => {
    const handoff = init(ids('a'));
    expect(pass(handoff)).toBe(handoff);
    const revealed = reveal(handoff);
    expect(pass(revealed)).toBe(revealed);
    const done = init([]);
    expect(pass(done)).toBe(done);
  });

  it('does not mutate the input', () => {
    const s = hide(reveal(init(ids('a', 'b'))));
    pass(s);
    expect(s.index).toBe(0);
    expect(s.phase).toBe('hidden');
  });
});

describe('isDone', () => {
  it('is true only in the done phase', () => {
    expect(isDone(init([]))).toBe(true);
    const handoff = init(ids('a'));
    expect(isDone(handoff)).toBe(false);
    expect(isDone(reveal(handoff))).toBe(false);
    expect(isDone(hide(reveal(handoff)))).toBe(false);
    expect(isDone(fullTurn(handoff))).toBe(true);
  });
});

describe('progress', () => {
  it('reports zero viewed at the start', () => {
    expect(progress(init(ids('a', 'b', 'c')))).toEqual({ viewed: 0, total: 3 });
  });

  it('counts completed turns', () => {
    let s = init(ids('a', 'b', 'c'));
    s = fullTurn(s);
    expect(progress(s)).toEqual({ viewed: 1, total: 3 });
    s = fullTurn(s);
    expect(progress(s)).toEqual({ viewed: 2, total: 3 });
    s = fullTurn(s);
    expect(progress(s)).toEqual({ viewed: 3, total: 3 });
  });

  it('handles the empty queue', () => {
    expect(progress(init([]))).toEqual({ viewed: 0, total: 0 });
  });

  it('clamps an over-large index to total', () => {
    const s: RevealGateState = { queue: ids('a', 'b'), index: 99, phase: 'done' };
    expect(progress(s)).toEqual({ viewed: 2, total: 2 });
  });

  it('clamps a negative index to zero', () => {
    const s: RevealGateState = { queue: ids('a', 'b'), index: -3, phase: 'handoff' };
    expect(progress(s)).toEqual({ viewed: 0, total: 2 });
  });

  it('does not advance while peeking mid-turn (still counts the current viewer as not-yet-viewed)', () => {
    const s = reveal(init(ids('a', 'b')));
    expect(progress(s)).toEqual({ viewed: 0, total: 2 });
  });
});

describe('full walkthrough / determinism', () => {
  it('walks a three-viewer queue cleanly to done', () => {
    let s = init(ids('a', 'b', 'c'));
    const seen: (PlayerId | undefined)[] = [];
    while (!isDone(s)) {
      seen.push(holder(s));
      s = pass(hide(reveal(s)));
    }
    expect(seen).toEqual(ids('a', 'b', 'c'));
    expect(progress(s)).toEqual({ viewed: 3, total: 3 });
    expect(holder(s)).toBeUndefined();
  });

  it('is deterministic: identical inputs produce identical output sequences', () => {
    const run = () => {
      let s = init(ids('x', 'y'));
      const trace: GatePhaseTrace[] = [];
      while (!isDone(s)) {
        trace.push({ phase: s.phase, index: s.index, holder: holder(s) });
        s = pass(hide(reveal(s)));
      }
      trace.push({ phase: s.phase, index: s.index, holder: holder(s) });
      return trace;
    };
    expect(run()).toEqual(run());
  });

  it('extra ops after done are no-ops', () => {
    let s = fullTurn(init(ids('a')));
    expect(isDone(s)).toBe(true);
    const before = s;
    s = pass(hide(reveal(s)));
    expect(s).toBe(before);
    expect(isDone(s)).toBe(true);
  });

  it('produces JSON-serializable state (arrays + plain records only)', () => {
    const s = reveal(init(ids('a', 'b')));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

interface GatePhaseTrace {
  phase: string;
  index: number;
  holder: PlayerId | undefined;
}
