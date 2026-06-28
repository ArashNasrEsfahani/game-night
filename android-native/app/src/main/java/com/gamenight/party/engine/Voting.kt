package com.gamenight.party.engine

/**
 * Port of src/engine/voting.ts — a pure voting primitive.
 *
 * No clock, no RNG. Operations never mutate input and are total (illegal ops are no-ops that
 * return the same instance). [VoteState.ballots] preserves insertion order.
 */

/** What the ballots point at: free-form option strings or player ids. */
enum class VoteTarget { OPTION, PLAYER }

/**
 * A single vote. [choices] are the legal targets (option strings, or candidate player-id strings).
 * [ballots] maps a voter id -> the choice id they picked. [voters] is the eligible electorate.
 */
data class VoteState(
    val target: VoteTarget,
    val choices: List<String>,
    val ballots: Map<String, String>,
    val voters: List<String>,
    val open: Boolean,
)

/** Open a vote over free-form option strings. Duplicates in inputs are de-duplicated. */
fun openOption(choices: List<String>, voters: List<String>): VoteState =
    VoteState(
        target = VoteTarget.OPTION,
        choices = choices.distinct(),
        ballots = emptyMap(),
        voters = voters.distinct(),
        open = true,
    )

/** Open a vote where each candidate is a player; choices = candidate id strings. */
fun openPlayer(candidates: List<String>, voters: List<String>): VoteState =
    VoteState(
        target = VoteTarget.PLAYER,
        choices = candidates.distinct(),
        ballots = emptyMap(),
        voters = voters.distinct(),
        open = true,
    )

/**
 * Record [voterId]'s vote for [choiceId]. Re-voting overwrites the prior ballot. No-op (returns
 * input unchanged) if the vote is closed, the voter is not eligible, the choice is invalid, or the
 * identical choice is already cast.
 */
fun cast(s: VoteState, voterId: String, choiceId: String): VoteState {
    if (!s.open) return s
    if (voterId !in s.voters) return s
    if (choiceId !in s.choices) return s
    if (s.ballots[voterId] == choiceId) return s // already identical -> no-op
    return s.copy(ballots = s.ballots + (voterId to choiceId))
}

/** Remove [voterId]'s ballot. No-op if they had not voted. */
fun retract(s: VoteState, voterId: String): VoteState {
    if (!s.ballots.containsKey(voterId)) return s
    return s.copy(ballots = s.ballots.filterKeys { it != voterId })
}

/** Close the vote so no further ballots can be cast. Idempotent. */
fun close(s: VoteState): VoteState {
    if (!s.open) return s
    return s.copy(open = false)
}

/** Count votes per choice. Every choice appears (0 if unvoted). Order follows [VoteState.choices]. */
fun tally(s: VoteState): Map<String, Int> {
    val counts = LinkedHashMap<String, Int>()
    for (choice in s.choices) counts[choice] = 0
    for ((_, choice) in s.ballots) {
        // Only count ballots whose choice is still a valid option.
        if (counts.containsKey(choice)) counts[choice] = counts.getValue(choice) + 1
    }
    return counts
}

/**
 * Choices with the maximum count. >1 entry means a tie. Order follows [VoteState.choices].
 * Returns an empty list only when there are no choices at all.
 */
fun winners(s: VoteState): List<String> {
    if (s.choices.isEmpty()) return emptyList()
    val counts = tally(s)
    var max = -1
    for (choice in s.choices) {
        val c = counts[choice] ?: 0
        if (c > max) max = c
    }
    return s.choices.filter { (counts[it] ?: 0) == max }
}

/** True when every eligible voter has cast a ballot. Vacuously true with no voters. */
fun allVoted(s: VoteState): Boolean = s.voters.all { s.ballots.containsKey(it) }

/** Fraction of eligible voters who have voted, in [0,1]. 0 when there are no voters. */
fun turnout(s: VoteState): Double {
    if (s.voters.isEmpty()) return 0.0
    val voted = s.voters.count { s.ballots.containsKey(it) }
    return voted.toDouble() / s.voters.size
}
