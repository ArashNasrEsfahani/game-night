// src/engine/rng.ts — pure, deterministic seeded randomness used INSIDE reducers.
// The impure entropy that produces seeds lives in services/random.ts. No Math.random / Date here.

/** mulberry32: returns a generator producing floats in [0,1) deterministically from `seed`. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates using a seed; returns a NEW shuffled array (input untouched). */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = items.slice();
  const next = rng(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Deterministic integer in [min, max] inclusive. */
export function int(min: number, max: number, seed: number): number {
  let lo = Math.ceil(min);
  let hi = Math.floor(max);
  if (hi < lo) [lo, hi] = [hi, lo];
  const next = rng(seed);
  return lo + Math.floor(next() * (hi - lo + 1));
}

/** Deterministic pick of one item. Throws on empty input. */
export function pick<T>(items: readonly T[], seed: number): T {
  if (items.length === 0) throw new Error('pick: empty array');
  return items[int(0, items.length - 1, seed)];
}

/** Derive a child seed deterministically (chain multiple draws from one action seed). */
export function deriveSeed(seed: number, salt: number): number {
  let h = (seed >>> 0) ^ Math.imul(salt >>> 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}
