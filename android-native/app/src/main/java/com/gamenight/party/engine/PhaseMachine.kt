package com.gamenight.party.engine

/**
 * Port of src/engine/phaseMachine.ts — a pure phase/state-machine primitive for game flow.
 *
 * A [PhaseMachine] is a plain, immutable description of allowed phase transitions. All functions are
 * TOTAL: unknown phases / illegal transitions are no-ops, never throwing. The phase type [P] is
 * typically an enum or a [String] (the web used string-literal unions).
 */

/** A single phase in the machine: its id, the phases it may transition to, and a terminal flag. */
data class PhaseNode<P>(
    val id: P,
    /** Phases reachable from this node. Empty for sinks. */
    val to: List<P>,
    /** When true, this is an end state (a convenience flag; reachability is via [to]). */
    val terminal: Boolean = false,
)

/** A declarative phase machine: a starting phase plus a node per phase id. */
data class PhaseMachine<P>(
    val initial: P,
    val nodes: Map<P, PhaseNode<P>>,
)

/** Identity helper that exists purely to mirror the web call sites. Returns [m] unchanged. */
fun <P> defineMachine(m: PhaseMachine<P>): PhaseMachine<P> = m

/**
 * True iff [from] is a known node whose `to` list contains [to]. Unknown [from] or a [to] not
 * listed yields false. Never throws.
 */
fun <P> canGo(m: PhaseMachine<P>, from: P, to: P): Boolean {
    val node = m.nodes[from] ?: return false
    return node.to.contains(to)
}

/**
 * Returns [to] when the transition is legal (see [canGo]), otherwise returns [from] unchanged.
 * Total: never throws on unknown or illegal transitions.
 */
fun <P> go(m: PhaseMachine<P>, from: P, to: P): P = if (canGo(m, from, to)) to else from

/**
 * True iff [phase] is a known node explicitly flagged terminal. Unknown phases and unflagged nodes
 * yield false. Never throws.
 */
fun <P> isTerminal(m: PhaseMachine<P>, phase: P): Boolean {
    val node = m.nodes[phase] ?: return false
    return node.terminal
}
