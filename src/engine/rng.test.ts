import { describe, it, expect } from 'vitest';
import { rng, shuffle, int, pick, deriveSeed } from './rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = rng(123);
    const b = rng(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('produces floats in [0,1)', () => {
    const next = rng(7);
    for (let i = 0; i < 100; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('different seeds differ', () => {
    expect(rng(1)()).not.toEqual(rng(2)());
  });
});

describe('shuffle', () => {
  it('is a permutation, deterministic, and leaves input untouched', () => {
    const arr = [1, 2, 3, 4, 5];
    const s1 = shuffle(arr, 42);
    const s2 = shuffle(arr, 42);
    expect(s1).toEqual(s2);
    expect([...s1].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });
  it('different seeds usually differ', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(shuffle(arr, 1)).not.toEqual(shuffle(arr, 2));
  });
});

describe('int', () => {
  it('stays within the inclusive range', () => {
    for (let s = 0; s < 200; s++) {
      const v = int(1, 6, s);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
  it('handles reversed bounds', () => {
    const v = int(6, 1, 5);
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(6);
  });
});

describe('pick', () => {
  it('picks deterministically and throws on empty', () => {
    expect(pick(['a', 'b', 'c'], 9)).toEqual(pick(['a', 'b', 'c'], 9));
    expect(() => pick([], 1)).toThrow();
  });
});

describe('deriveSeed', () => {
  it('is deterministic and salt-sensitive', () => {
    expect(deriveSeed(100, 1)).toEqual(deriveSeed(100, 1));
    expect(deriveSeed(100, 1)).not.toEqual(deriveSeed(100, 2));
  });
});
