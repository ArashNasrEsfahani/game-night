// src/engine/revealGate.ts — pure pass-the-phone "curtain" gate primitive.
// Walks a queue of viewers through a handoff -> reveal -> hide -> pass cycle,
// finishing in 'done' once every viewer has had their turn. No I/O, no clock,
// no RNG: ordering is fully determined by the supplied queue.
import type { PlayerId } from '../sdk/types';

/**
 * Lifecycle of a single viewer's turn:
 *  - 'handoff'  : phone is being passed; secret is hidden, waiting for the holder to peek.
 *  - 'revealed' : the holder is currently looking at their secret.
 *  - 'hidden'   : the holder has dismissed the secret; ready to pass to the next viewer.
 *  - 'done'     : every viewer in the queue has finished (terminal).
 */
export type GatePhase = 'handoff' | 'revealed' | 'hidden' | 'done';

export interface RevealGateState {
  queue: PlayerId[];
  index: number;
  phase: GatePhase;
}

/** Build a fresh gate. Starts at index 0 in 'handoff', or 'done' if the queue is empty. */
export function init(queue: PlayerId[]): RevealGateState {
  return {
    queue: queue.slice(),
    index: 0,
    phase: queue.length === 0 ? 'done' : 'handoff',
  };
}

/** The viewer whose turn it currently is, or undefined when done / out of range. */
export function holder(s: RevealGateState): PlayerId | undefined {
  if (s.phase === 'done') return undefined;
  if (s.index < 0 || s.index >= s.queue.length) return undefined;
  return s.queue[s.index];
}

/** handoff -> revealed. Any other phase is a no-op (returns the input unchanged). */
export function reveal(s: RevealGateState): RevealGateState {
  if (s.phase !== 'handoff') return s;
  return { ...s, phase: 'revealed' };
}

/** revealed -> hidden. Any other phase is a no-op (returns the input unchanged). */
export function hide(s: RevealGateState): RevealGateState {
  if (s.phase !== 'revealed') return s;
  return { ...s, phase: 'hidden' };
}

/**
 * hidden -> advance to the next viewer ('handoff'), or 'done' when the last viewer
 * has just passed. Any other phase is a no-op (returns the input unchanged).
 */
export function pass(s: RevealGateState): RevealGateState {
  if (s.phase !== 'hidden') return s;
  const nextIndex = s.index + 1;
  if (nextIndex >= s.queue.length) {
    return { ...s, index: s.queue.length, phase: 'done' };
  }
  return { ...s, index: nextIndex, phase: 'handoff' };
}

/** True once every viewer has finished their turn. */
export function isDone(s: RevealGateState): boolean {
  return s.phase === 'done';
}

/**
 * How far through the queue we are. `viewed` counts viewers who have completed
 * their turn (clamped to [0, total]); `total` is the queue length.
 */
export function progress(s: RevealGateState): { viewed: number; total: number } {
  const total = s.queue.length;
  const viewed = s.index < 0 ? 0 : s.index > total ? total : s.index;
  return { viewed, total };
}
