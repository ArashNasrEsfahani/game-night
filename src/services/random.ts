// src/services/random.ts — crypto-backed entropy that produces SEEDS for action payloads.
// (The deterministic PRNG that consumes these seeds is the pure engine/rng.ts.)
import type { RandomService } from '../sdk/types';

function freshSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
  }
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

export const randomService: RandomService = { seed: freshSeed };
