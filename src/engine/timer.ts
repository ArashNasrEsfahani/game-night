// src/engine/timer.ts — pure, deterministic timer primitive.
// No clock access: every now is passed in by the caller. State is plain JSON.

export type TimerMode = 'countdown' | 'stopwatch';

export interface TimerState {
  mode: TimerMode;
  /** Target duration in ms; only meaningful for countdown (ignored otherwise). */
  durationMs: number;
  /** Time folded in from previously-ended segments. */
  accumulatedMs: number;
  /** Wall-clock value (passed in) when the current running segment began; null when paused. */
  startedAt: number | null;
  running: boolean;
}

/** Build a fresh, stopped timer. durationMs is clamped to >= 0. */
export function create(mode: TimerMode, durationMs: number): TimerState {
  return {
    mode,
    durationMs: durationMs > 0 ? durationMs : 0,
    accumulatedMs: 0,
    startedAt: null,
    running: false,
  };
}

/** Start (or resume) the timer. No-op if already running. */
export function start(s: TimerState, now: number): TimerState {
  if (s.running) return s;
  return { ...s, startedAt: now, running: true };
}

/** Pause: fold the current running segment into accumulatedMs. No-op if not running. */
export function pause(s: TimerState, now: number): TimerState {
  if (!s.running) return s;
  const segment = s.startedAt === null ? 0 : Math.max(0, now - s.startedAt);
  return {
    ...s,
    accumulatedMs: s.accumulatedMs + segment,
    startedAt: null,
    running: false,
  };
}

/** Reset elapsed time to zero and stop. */
export function reset(s: TimerState, _now: number): TimerState {
  return { ...s, accumulatedMs: 0, startedAt: null, running: false };
}

/**
 * Idempotent per-frame tick. Keeps accumulatedMs + startedAt intact so elapsed is computed
 * purely from (now - startedAt); calling it never advances state and introduces no drift.
 * Returns the input unchanged.
 */
export function tick(s: TimerState, _now: number): TimerState {
  return s;
}

/** Total elapsed ms: accumulated plus the in-flight running segment. Never negative. */
export function elapsedMs(s: TimerState, now: number): number {
  const segment =
    s.running && s.startedAt !== null ? Math.max(0, now - s.startedAt) : 0;
  return s.accumulatedMs + segment;
}

/** Countdown only: remaining ms, clamped to >= 0. Returns 0 for non-countdown timers. */
export function remainingMs(s: TimerState, now: number): number {
  if (s.mode !== 'countdown') return 0;
  const remaining = s.durationMs - elapsedMs(s, now);
  return remaining > 0 ? remaining : 0;
}

/** Countdown timers expire once elapsed reaches the duration; stopwatches never expire. */
export function isExpired(s: TimerState, now: number): boolean {
  if (s.mode !== 'countdown') return false;
  return elapsedMs(s, now) >= s.durationMs;
}
