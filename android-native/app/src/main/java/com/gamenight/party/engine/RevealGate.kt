package com.gamenight.party.engine

/**
 * Port of src/engine/revealGate.ts — a pure pass-the-phone "curtain" gate primitive.
 *
 * Walks a queue of viewers through a handoff -> reveal -> hide -> pass cycle, finishing in [DONE]
 * once every viewer has had their turn. No I/O / clock / RNG: ordering is fully determined by the
 * supplied queue. Operations never mutate input.
 */

/**
 * Lifecycle of a single viewer's turn:
 *  - [HANDOFF]  : phone is being passed; secret is hidden, waiting for the holder to peek.
 *  - [REVEALED] : the holder is currently looking at their secret.
 *  - [HIDDEN]   : the holder has dismissed the secret; ready to pass to the next viewer.
 *  - [DONE]     : every viewer in the queue has finished (terminal).
 */
enum class GatePhase { HANDOFF, REVEALED, HIDDEN, DONE }

data class RevealGateState(
    val queue: List<String>,
    val index: Int,
    val phase: GatePhase,
)

/** How far through the queue we are: [viewed] (clamped to [0, total]) and [total]. */
data class GateProgress(
    val viewed: Int,
    val total: Int,
)

/** Build a fresh gate. Starts at index 0 in [GatePhase.HANDOFF], or [GatePhase.DONE] if empty. */
fun init(queue: List<String>): RevealGateState =
    RevealGateState(
        queue = queue.toList(),
        index = 0,
        phase = if (queue.isEmpty()) GatePhase.DONE else GatePhase.HANDOFF,
    )

/** The viewer whose turn it currently is, or null when done / out of range. */
fun holder(s: RevealGateState): String? {
    if (s.phase == GatePhase.DONE) return null
    if (s.index < 0 || s.index >= s.queue.size) return null
    return s.queue[s.index]
}

/** handoff -> revealed. Any other phase is a no-op (returns the input unchanged). */
fun reveal(s: RevealGateState): RevealGateState {
    if (s.phase != GatePhase.HANDOFF) return s
    return s.copy(phase = GatePhase.REVEALED)
}

/** revealed -> hidden. Any other phase is a no-op (returns the input unchanged). */
fun hide(s: RevealGateState): RevealGateState {
    if (s.phase != GatePhase.REVEALED) return s
    return s.copy(phase = GatePhase.HIDDEN)
}

/**
 * hidden -> advance to the next viewer ([GatePhase.HANDOFF]), or [GatePhase.DONE] when the last
 * viewer has just passed. Any other phase is a no-op (returns the input unchanged).
 */
fun pass(s: RevealGateState): RevealGateState {
    if (s.phase != GatePhase.HIDDEN) return s
    val nextIndex = s.index + 1
    if (nextIndex >= s.queue.size) {
        return s.copy(index = s.queue.size, phase = GatePhase.DONE)
    }
    return s.copy(index = nextIndex, phase = GatePhase.HANDOFF)
}

/** True once every viewer has finished their turn. */
fun isDone(s: RevealGateState): Boolean = s.phase == GatePhase.DONE

/**
 * How far through the queue we are. [GateProgress.viewed] counts viewers who have completed their
 * turn (clamped to [0, total]); [GateProgress.total] is the queue length.
 */
fun progress(s: RevealGateState): GateProgress {
    val total = s.queue.size
    val viewed = if (s.index < 0) 0 else if (s.index > total) total else s.index
    return GateProgress(viewed = viewed, total = total)
}
