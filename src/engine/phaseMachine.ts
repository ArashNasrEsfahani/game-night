// src/engine/phaseMachine.ts — pure phase/state-machine primitive for game flow.
// A PhaseMachine is a plain, JSON-serializable description of allowed phase transitions.
// All functions are TOTAL: unknown phases / illegal transitions are no-ops, never throws.

/** A single phase in the machine: its id and the phases it may transition to. */
export interface PhaseNode<P extends string> {
  id: P;
  /** Phases reachable from this node. Empty for sinks. */
  to: P[];
  /** When true, this is an end state (a convenience flag; reachability is via `to`). */
  terminal?: boolean;
}

/** A declarative phase machine: a starting phase plus a node per phase id. */
export interface PhaseMachine<P extends string> {
  initial: P;
  nodes: Record<P, PhaseNode<P>>;
}

/** Identity helper that exists purely to infer/lock the literal phase type `P`. */
export function defineMachine<P extends string>(m: PhaseMachine<P>): PhaseMachine<P> {
  return m;
}

/**
 * True iff `from` is a known node whose `to` list contains `to`.
 * Unknown `from` (no node) or a `to` not listed yields false. Never throws.
 */
export function canGo<P extends string>(m: PhaseMachine<P>, from: P, to: P): boolean {
  const node = m.nodes[from];
  if (!node) return false;
  return node.to.indexOf(to) !== -1;
}

/**
 * Returns `to` when the transition is legal (see canGo), otherwise returns `from` unchanged.
 * Total: never throws on unknown or illegal transitions.
 */
export function go<P extends string>(m: PhaseMachine<P>, from: P, to: P): P {
  return canGo(m, from, to) ? to : from;
}

/**
 * True iff `phase` is a known node explicitly flagged `terminal`.
 * Unknown phases and unflagged nodes yield false. Never throws.
 */
export function isTerminal<P extends string>(m: PhaseMachine<P>, phase: P): boolean {
  const node = m.nodes[phase];
  return node ? node.terminal === true : false;
}
