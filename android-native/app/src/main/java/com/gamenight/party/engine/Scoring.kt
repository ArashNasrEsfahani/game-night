package com.gamenight.party.engine

/**
 * Port of src/engine/scoring.ts — a pure scoring primitive: totals + an append-only event log.
 *
 * No clock, no RNG: all clock values arrive as `at`. Operations never mutate input — they return
 * new immutable state. Totals preserve insertion order ([LinkedHashMap] semantics via `Map.plus`).
 */

/** A single scoring delta applied to a subject (a PlayerId or TeamId, as a plain string). */
data class ScoreEvent(
    val subjectId: String,
    /** Signed change applied to the subject's total by this event. */
    val delta: Int,
    val reason: String? = null,
    /** Clock value supplied by the caller (never read from a runtime clock). */
    val at: Long = 0L,
)

/** Scoreboard: current totals per subject plus the ordered log that produced them. */
data class ScoreState(
    val totals: Map<String, Int>,
    val log: List<ScoreEvent>,
)

/** One ranked row produced by [standings]: a subject and its current total. */
data class ScoreStanding(
    val subjectId: String,
    val total: Int,
)

/** Build an empty scoreboard with every given subject starting at 0. */
fun create(subjectIds: List<String>): ScoreState =
    ScoreState(totals = subjectIds.associateWith { 0 }, log = emptyList())

/**
 * Append a [ScoreEvent] that moves [subjectId] by [delta] and return a NEW state. Unknown subjects
 * are introduced on the fly (starting from 0). A zero delta is a no-op (input returned unchanged).
 */
fun add(
    s: ScoreState,
    subjectId: String,
    delta: Int,
    reason: String? = null,
    at: Long = 0L,
): ScoreState {
    if (delta == 0) return s
    val prev = s.totals[subjectId] ?: 0
    val event = ScoreEvent(subjectId = subjectId, delta = delta, reason = reason, at = at)
    return ScoreState(
        totals = s.totals + (subjectId to (prev + delta)),
        log = s.log + event,
    )
}

/**
 * Set [subjectId]'s total to an absolute [value] and return a NEW state. Recorded in the log as a
 * delta event (value - prior), so [undoLast] can reverse it like any other event. A no-op set
 * (value already equals the current total) leaves the state unchanged.
 */
fun set(s: ScoreState, subjectId: String, value: Int, at: Long = 0L): ScoreState {
    val prev = s.totals[subjectId] ?: 0
    val delta = value - prev
    if (delta == 0) return s
    val event = ScoreEvent(subjectId = subjectId, delta = delta, reason = "set", at = at)
    return ScoreState(
        totals = s.totals + (subjectId to value),
        log = s.log + event,
    )
}

/**
 * Remove the most recent log entry and reverse its effect, returning a NEW state.
 * On an empty log this is a no-op (input returned unchanged).
 */
fun undoLast(s: ScoreState): ScoreState {
    if (s.log.isEmpty()) return s
    val last = s.log[s.log.size - 1]
    val prev = s.totals[last.subjectId] ?: 0
    return ScoreState(
        totals = s.totals + (last.subjectId to (prev - last.delta)),
        log = s.log.subList(0, s.log.size - 1).toList(),
    )
}

/** Current total for a subject; 0 if the subject is unknown. */
fun total(s: ScoreState, subjectId: String): Int = s.totals[subjectId] ?: 0

/** All subjects ranked by total descending, with a stable tiebreak by subjectId ascending. */
fun standings(s: ScoreState): List<ScoreStanding> =
    s.totals.map { (subjectId, total) -> ScoreStanding(subjectId, total) }
        .sortedWith(compareByDescending<ScoreStanding> { it.total }.thenBy { it.subjectId })

/** The subjectId with the highest total (ties broken by subjectId), or null if no subjects. */
fun leader(s: ScoreState): String? = standings(s).firstOrNull()?.subjectId
