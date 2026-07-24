package com.gamenight.party.engine

/**
 * Port of src/engine/turnOrder.ts — a pure turn-order primitive.
 *
 * All randomness comes from a numeric seed via [Rng.shuffle] (a fresh [Rng] per call). Operations
 * never mutate input — they return new immutable state. Callers must supply a non-empty [order];
 * the degenerate empty-order paths return an empty-string id (mirroring the web's `undefined`).
 */

enum class TurnMode { SEQUENTIAL, CIRCULAR, RANDOM }

data class TurnOrderState(
    val mode: TurnMode,
    /** The seat order (fixed for sequential/circular; the source pool for random refills). */
    val order: List<String>,
    /** Cursor into [order] for sequential/circular. Unused (kept at 0) for random. */
    val index: Int,
    /** How many full cycles have completed (incremented on wrap / refill). */
    val round: Int,
    /** RANDOM mode only: the shuffled draw pile. `current` reads the last element; `next` pops it. */
    val remaining: List<String>? = null,
)

/**
 * Build the initial turn-order state. For [TurnMode.RANDOM], [TurnOrderState.remaining] is prefilled
 * with a seeded shuffle of [order]. The input [order] is copied.
 */
fun init(order: List<String>, mode: TurnMode, seed: Int): TurnOrderState {
    val copy = order.toList()
    return if (mode == TurnMode.RANDOM) {
        TurnOrderState(mode = mode, order = copy, index = 0, round = 0, remaining = Rng(seed).shuffle(copy))
    } else {
        TurnOrderState(mode = mode, order = copy, index = 0, round = 0)
    }
}

/** The player whose turn it currently is. With a non-empty order this always yields a valid id. */
fun current(s: TurnOrderState): String {
    if (s.mode == TurnMode.RANDOM) {
        val remaining = s.remaining ?: emptyList()
        if (remaining.isEmpty()) {
            // Defensive: nothing drawn yet — fall back to the source pool's last element.
            return s.order.lastOrNull() ?: ""
        }
        return remaining.last()
    }
    if (s.order.isEmpty()) return s.order.firstOrNull() ?: ""
    // Clamp the cursor into range so an end-stopped sequential index still resolves a player.
    val i = minOf(maxOf(s.index, 0), s.order.size - 1)
    return s.order[i]
}

/**
 * Advance to the next turn, returning a NEW state (input untouched).
 * - sequential: index+1, stopping at the end (index === order.size means "done").
 * - circular: index+1 wrapping to 0, incrementing round on each wrap.
 * - random: pop the drawn player off `remaining`; when emptied, refill with a fresh seeded shuffle
 *   and increment round.
 */
fun next(s: TurnOrderState, seed: Int): TurnOrderState {
    if (s.mode == TurnMode.RANDOM) {
        val remaining = (s.remaining ?: emptyList()).toMutableList()
        // Remove the just-played player (the one `current` reported).
        if (remaining.isNotEmpty()) remaining.removeAt(remaining.size - 1)
        if (remaining.isEmpty()) {
            // Refill a fresh round.
            return s.copy(index = 0, round = s.round + 1, remaining = Rng(seed).shuffle(s.order))
        }
        return s.copy(remaining = remaining.toList())
    }

    if (s.order.isEmpty()) return s.copy()

    if (s.mode == TurnMode.CIRCULAR) {
        val ni = s.index + 1
        return if (ni >= s.order.size) s.copy(index = 0, round = s.round + 1) else s.copy(index = ni)
    }

    // sequential: advance but stop at the end (index can reach order.size).
    if (s.index >= s.order.size) return s.copy()
    return s.copy(index = s.index + 1)
}

/**
 * Whether the current round has completed.
 * - sequential: index has reached/passed the end of order.
 * - circular: completes precisely when the cursor wraps back to 0 (index===0 and round>0).
 * - random: the draw pile is empty (everyone has been drawn this round).
 */
fun isRoundComplete(s: TurnOrderState): Boolean {
    if (s.mode == TurnMode.RANDOM) {
        return (s.remaining ?: emptyList()).isEmpty()
    }
    if (s.order.isEmpty()) return true
    if (s.mode == TurnMode.SEQUENTIAL) {
        return s.index >= s.order.size
    }
    return s.index == 0 && s.round > 0
}

/**
 * Reset to the start of order for sequential/circular, or a freshly shuffled pile for random.
 * Round counter is reset to 0. Returns a NEW state (input untouched).
 */
fun reset(s: TurnOrderState, seed: Int): TurnOrderState {
    if (s.mode == TurnMode.RANDOM) {
        return s.copy(index = 0, round = 0, remaining = Rng(seed).shuffle(s.order))
    }
    // drop any stray remaining from a prior random phase
    return s.copy(index = 0, round = 0, remaining = null)
}

/**
 * Who comes next ("pass to X") WITHOUT mutating state. Computes the same player
 * `current(next(s, seed))` would report.
 */
fun peekNext(s: TurnOrderState, seed: Int): String {
    if (s.mode == TurnMode.RANDOM) {
        val remaining = (s.remaining ?: emptyList()).toMutableList()
        if (remaining.isNotEmpty()) remaining.removeAt(remaining.size - 1)
        if (remaining.isEmpty()) {
            // Next draw comes from a fresh refill; its current is the refill's last element.
            val refilled = Rng(seed).shuffle(s.order)
            return refilled.lastOrNull() ?: (s.order.lastOrNull() ?: "")
        }
        return remaining.last()
    }

    if (s.order.isEmpty()) return s.order.firstOrNull() ?: ""

    if (s.mode == TurnMode.CIRCULAR) {
        val ni = (s.index + 1) % s.order.size
        return s.order[ni]
    }

    // sequential: clamp at the last seat (no wrap).
    val ni = minOf(s.index + 1, s.order.size - 1)
    return s.order[ni]
}
