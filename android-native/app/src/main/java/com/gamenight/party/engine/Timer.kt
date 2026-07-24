package com.gamenight.party.engine

/**
 * Port of src/engine/timer.ts — a pure, deterministic timer primitive.
 *
 * No clock access: every `now` (a wall-clock millisecond value) is passed in by the caller.
 * State is plain, immutable data. Operations never mutate their input.
 */

enum class TimerMode { COUNTDOWN, STOPWATCH }

data class TimerState(
    val mode: TimerMode,
    /** Target duration in ms; only meaningful for countdown (ignored otherwise). */
    val durationMs: Long,
    /** Time folded in from previously-ended segments. */
    val accumulatedMs: Long,
    /** Wall-clock value (passed in) when the current running segment began; null when paused. */
    val startedAt: Long?,
    val running: Boolean,
)

/** Build a fresh, stopped timer. [durationMs] is clamped to >= 0. */
fun create(mode: TimerMode, durationMs: Long): TimerState =
    TimerState(
        mode = mode,
        durationMs = if (durationMs > 0) durationMs else 0,
        accumulatedMs = 0,
        startedAt = null,
        running = false,
    )

/** Start (or resume) the timer. No-op (returns the same instance) if already running. */
fun start(s: TimerState, now: Long): TimerState {
    if (s.running) return s
    return s.copy(startedAt = now, running = true)
}

/** Pause: fold the current running segment into [TimerState.accumulatedMs]. No-op if not running. */
fun pause(s: TimerState, now: Long): TimerState {
    if (!s.running) return s
    val segment = if (s.startedAt == null) 0L else maxOf(0L, now - s.startedAt)
    return s.copy(
        accumulatedMs = s.accumulatedMs + segment,
        startedAt = null,
        running = false,
    )
}

/** Reset elapsed time to zero and stop. [now] is unused (kept for signature parity). */
fun reset(s: TimerState, now: Long): TimerState =
    s.copy(accumulatedMs = 0, startedAt = null, running = false)

/**
 * Idempotent per-frame tick. Elapsed is computed purely from `(now - startedAt)`, so a tick never
 * advances state and introduces no drift. Returns the input unchanged.
 */
fun tick(s: TimerState, now: Long): TimerState = s

/** Total elapsed ms: accumulated plus the in-flight running segment. Never negative. */
fun elapsedMs(s: TimerState, now: Long): Long {
    val segment =
        if (s.running && s.startedAt != null) maxOf(0L, now - s.startedAt) else 0L
    return s.accumulatedMs + segment
}

/** Countdown only: remaining ms, clamped to >= 0. Returns 0 for non-countdown timers. */
fun remainingMs(s: TimerState, now: Long): Long {
    if (s.mode != TimerMode.COUNTDOWN) return 0
    val remaining = s.durationMs - elapsedMs(s, now)
    return if (remaining > 0) remaining else 0
}

/** Countdown timers expire once elapsed reaches the duration; stopwatches never expire. */
fun isExpired(s: TimerState, now: Long): Boolean {
    if (s.mode != TimerMode.COUNTDOWN) return false
    return elapsedMs(s, now) >= s.durationMs
}
