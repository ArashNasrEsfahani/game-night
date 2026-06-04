// src/engine/turnOrder.ts — pure turn-order primitive.
// No React/DOM/I/O/clock/RNG-runtime here: all randomness comes from a numeric seed via ./rng.
import type { PlayerId } from '../sdk/types';
import { shuffle } from './rng';

export type TurnMode = 'sequential' | 'circular' | 'random';

export interface TurnOrderState {
  mode: TurnMode;
  /** The seat order (fixed for sequential/circular; the source pool for random refills). */
  order: PlayerId[];
  /** Cursor into `order` for sequential/circular. Unused (kept at 0) for random. */
  index: number;
  /** How many full cycles have completed (incremented on wrap / refill). */
  round: number;
  /**
   * RANDOM mode only: the shuffled draw pile. `current` reads the last element;
   * `next` pops it. When emptied, it is re-shuffled (refill) and `round` advances.
   */
  remaining?: PlayerId[];
}

/**
 * Build the initial turn-order state. For `random` mode, `remaining` is prefilled with a
 * seeded shuffle of `order`. The input `order` array is copied (never aliased/mutated).
 */
export function init(order: PlayerId[], mode: TurnMode, seed: number): TurnOrderState {
  const copy = order.slice();
  if (mode === 'random') {
    return {
      mode,
      order: copy,
      index: 0,
      round: 0,
      remaining: shuffle(copy, seed),
    };
  }
  return {
    mode,
    order: copy,
    index: 0,
    round: 0,
  };
}

/**
 * The player whose turn it currently is. Returns undefined-safe behavior by clamping:
 * for an empty order this returns undefined cast as PlayerId is impossible, so callers must
 * supply a non-empty order; with a non-empty order this always yields a valid PlayerId.
 */
export function current(s: TurnOrderState): PlayerId {
  if (s.mode === 'random') {
    const remaining = s.remaining ?? [];
    if (remaining.length === 0) {
      // Defensive: nothing drawn yet — fall back to the source pool's last element.
      return s.order[s.order.length - 1];
    }
    return remaining[remaining.length - 1];
  }
  if (s.order.length === 0) return s.order[0];
  // Clamp the cursor into range so an end-stopped sequential index still resolves a player.
  const i = Math.min(Math.max(s.index, 0), s.order.length - 1);
  return s.order[i];
}

/**
 * Advance to the next turn, returning a NEW state (input untouched).
 * - sequential: index+1, stopping at the end (index === order.length means "done").
 * - circular: index+1 wrapping to 0, incrementing round on each wrap.
 * - random: pop the drawn player off `remaining`; when emptied, refill with a fresh
 *   seeded shuffle and increment round.
 */
export function next(s: TurnOrderState, seed: number): TurnOrderState {
  if (s.mode === 'random') {
    const remaining = (s.remaining ?? []).slice();
    // Remove the just-played player (the one `current` reported).
    if (remaining.length > 0) remaining.pop();
    if (remaining.length === 0) {
      // Refill a fresh round.
      return {
        ...s,
        index: 0,
        round: s.round + 1,
        remaining: shuffle(s.order, seed),
      };
    }
    return { ...s, remaining };
  }

  if (s.order.length === 0) return { ...s };

  if (s.mode === 'circular') {
    const ni = s.index + 1;
    if (ni >= s.order.length) {
      return { ...s, index: 0, round: s.round + 1 };
    }
    return { ...s, index: ni };
  }

  // sequential: advance but stop at the end (index can reach order.length).
  if (s.index >= s.order.length) return { ...s };
  return { ...s, index: s.index + 1 };
}

/**
 * Whether the current round has completed.
 * - sequential: index has reached/passed the end of order.
 * - circular: a wrap just happened means index===0 with round>0; treat "complete" as the
 *   moment after the last seat — i.e. index===0 and round>0 reflects a finished prior round.
 *   For a simpler, total predicate we report completion when index is at the last seat is NOT
 *   used; instead we use the same end semantics as sequential via the cursor.
 * - random: the draw pile is empty (everyone has been drawn this round).
 */
export function isRoundComplete(s: TurnOrderState): boolean {
  if (s.mode === 'random') {
    return (s.remaining ?? []).length === 0;
  }
  if (s.order.length === 0) return true;
  if (s.mode === 'sequential') {
    return s.index >= s.order.length;
  }
  // circular never "stops"; a round completes precisely when the cursor wraps back to 0,
  // which is only meaningful once at least one round has elapsed.
  return s.index === 0 && s.round > 0;
}

/**
 * Reset to the start of order for sequential/circular, or a freshly shuffled pile for random.
 * Round counter is reset to 0. Returns a NEW state (input untouched).
 */
export function reset(s: TurnOrderState, seed: number): TurnOrderState {
  if (s.mode === 'random') {
    return {
      ...s,
      index: 0,
      round: 0,
      remaining: shuffle(s.order, seed),
    };
  }
  return {
    ...s,
    index: 0,
    round: 0,
    // drop any stray remaining from a prior random phase
    remaining: undefined,
  };
}

/**
 * Who comes next ("pass to X") WITHOUT mutating state.
 * Computes the same player `current(next(s, seed))` would report.
 */
export function peekNext(s: TurnOrderState, seed: number): PlayerId {
  if (s.mode === 'random') {
    const remaining = (s.remaining ?? []).slice();
    if (remaining.length > 0) remaining.pop();
    if (remaining.length === 0) {
      // Next draw comes from a fresh refill; its current is the refill's last element.
      const refilled = shuffle(s.order, seed);
      return refilled[refilled.length - 1] ?? s.order[s.order.length - 1];
    }
    return remaining[remaining.length - 1];
  }

  if (s.order.length === 0) return s.order[0];

  if (s.mode === 'circular') {
    const ni = (s.index + 1) % s.order.length;
    return s.order[ni];
  }

  // sequential: clamp at the last seat (no wrap).
  const ni = Math.min(s.index + 1, s.order.length - 1);
  return s.order[ni];
}
