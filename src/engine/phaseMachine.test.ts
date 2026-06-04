import { describe, it, expect } from 'vitest';
import {
  defineMachine,
  canGo,
  go,
  isTerminal,
  type PhaseMachine,
} from './phaseMachine';

type P = 'setup' | 'play' | 'results';

const machine: PhaseMachine<P> = {
  initial: 'setup',
  nodes: {
    setup: { id: 'setup', to: ['play'] },
    play: { id: 'play', to: ['results', 'setup'] },
    results: { id: 'results', to: [], terminal: true },
  },
};

describe('defineMachine', () => {
  it('returns the same object reference (identity helper)', () => {
    expect(defineMachine(machine)).toBe(machine);
  });
  it('preserves structure for a single-node machine', () => {
    const m: PhaseMachine<'only'> = {
      initial: 'only',
      nodes: { only: { id: 'only', to: [], terminal: true } },
    };
    expect(defineMachine(m)).toBe(m);
    expect(defineMachine(m).initial).toBe('only');
  });
});

describe('canGo', () => {
  it('is true for declared transitions', () => {
    expect(canGo(machine, 'setup', 'play')).toBe(true);
    expect(canGo(machine, 'play', 'results')).toBe(true);
    expect(canGo(machine, 'play', 'setup')).toBe(true);
  });
  it('is false for undeclared transitions', () => {
    expect(canGo(machine, 'setup', 'results')).toBe(false);
    expect(canGo(machine, 'results', 'play')).toBe(false);
  });
  it('is false from a sink node (empty `to`)', () => {
    expect(canGo(machine, 'results', 'results')).toBe(false);
  });
  it('is false for self-transition unless declared', () => {
    expect(canGo(machine, 'setup', 'setup')).toBe(false);
  });
  it('is true for an explicitly declared self-transition', () => {
    const loop: PhaseMachine<'a'> = {
      initial: 'a',
      nodes: { a: { id: 'a', to: ['a'] } },
    };
    expect(canGo(loop, 'a', 'a')).toBe(true);
  });
  it('is false for an unknown `from` node', () => {
    // Cast to exercise the total/no-throw behavior on out-of-range ids.
    expect(canGo(machine, 'ghost' as P, 'play')).toBe(false);
  });
  it('is false for an unknown `to` target', () => {
    expect(canGo(machine, 'setup', 'ghost' as P)).toBe(false);
  });
  it('is deterministic / pure (repeat calls match)', () => {
    expect(canGo(machine, 'setup', 'play')).toBe(canGo(machine, 'setup', 'play'));
  });
});

describe('go', () => {
  it('returns the target on a legal transition', () => {
    expect(go(machine, 'setup', 'play')).toBe('play');
    expect(go(machine, 'play', 'results')).toBe('results');
  });
  it('returns the source unchanged on an illegal transition', () => {
    expect(go(machine, 'setup', 'results')).toBe('setup');
    expect(go(machine, 'results', 'play')).toBe('results');
  });
  it('returns the source for unknown from/to (never throws)', () => {
    expect(() => go(machine, 'ghost' as P, 'play')).not.toThrow();
    expect(go(machine, 'ghost' as P, 'play')).toBe('ghost');
    expect(go(machine, 'setup', 'ghost' as P)).toBe('setup');
  });
  it('is idempotent on a sink: go on a terminal stays put', () => {
    const once = go(machine, 'results', 'results');
    const twice = go(machine, once, 'results');
    expect(once).toBe('results');
    expect(twice).toBe('results');
  });
  it('agrees with canGo', () => {
    const from: P = 'play';
    const to: P = 'setup';
    expect(go(machine, from, to)).toBe(canGo(machine, from, to) ? to : from);
  });
});

describe('isTerminal', () => {
  it('is true for a node flagged terminal', () => {
    expect(isTerminal(machine, 'results')).toBe(true);
  });
  it('is false for non-terminal nodes', () => {
    expect(isTerminal(machine, 'setup')).toBe(false);
    expect(isTerminal(machine, 'play')).toBe(false);
  });
  it('is false for unknown phases (never throws)', () => {
    expect(() => isTerminal(machine, 'ghost' as P)).not.toThrow();
    expect(isTerminal(machine, 'ghost' as P)).toBe(false);
  });
  it('treats a sink without the terminal flag as non-terminal', () => {
    const m: PhaseMachine<'a' | 'b'> = {
      initial: 'a',
      nodes: {
        a: { id: 'a', to: ['b'] },
        b: { id: 'b', to: [] }, // sink, but not flagged terminal
      },
    };
    expect(isTerminal(m, 'b')).toBe(false);
  });
});
