package com.gamenight.party.engine

/**
 * Port of src/engine/ids.ts — the centralized place where "branded" ids are constructed.
 *
 * In the web SDK PlayerId / TeamId are branded strings; in Kotlin they are plain [String]
 * (per the porting contract), so [asPlayerId] / [asTeamId] are identity helpers kept only to
 * mirror the call sites of the web reducers.
 */

/** Pass-through cast for a player id (PlayerId is a plain String in Kotlin). */
fun asPlayerId(s: String): String = s

/** Pass-through cast for a team id (TeamId is a plain String in Kotlin). */
fun asTeamId(s: String): String = s

private var counter: Int = 0

/**
 * Generate a collision-resistant id string from an entropy [seed] (host-side use only — never
 * called inside a pure reducer; reducers build ids deterministically from action seeds).
 *
 * Mirrors the web's `(seed >>> 0).toString(36) + '-' + counter.toString(36)`. Both halves are
 * rendered as unsigned 32-bit base-36, matching the JS `>>> 0` semantics.
 */
fun makeId(seed: Int): String {
    counter += 1 // wraps naturally; rendered unsigned below to mirror `>>> 0`
    val seedPart = (seed.toLong() and 0xFFFFFFFFL).toString(36)
    val counterPart = (counter.toLong() and 0xFFFFFFFFL).toString(36)
    return "$seedPart-$counterPart"
}

/** Deterministic indexed team-id builder for [createTeams] / [autoBalance]. */
fun teamIdAt(i: Int): String = "team-$i"
