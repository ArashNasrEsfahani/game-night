package com.gamenight.party.engine

import com.gamenight.party.model.LocalizedString

/**
 * Port of src/engine/results.ts — pure evaluation of a finished match into standings + outcome.
 *
 * Turns a final [ScoreState] (or an arbitrary subject->value map) into ranked standings and a
 * headline-friendly [Outcome]. No clock / RNG — fully deterministic.
 */

/** One ranked row. [rank] is 1-based (competition ranking; ties share a rank). */
data class Standing(
    val subjectId: String,
    val rank: Int,
    val total: Int,
    val isWinner: Boolean,
)

/** The headline outcome of a match (the web's `outcome` discriminated union). */
sealed interface Outcome {
    data class Winner(val subjectId: String) : Outcome
    data class Tie(val subjectIds: List<String>) : Outcome
    object NoContest : Outcome
}

data class MatchResult(
    val standings: List<Standing>,
    val winners: List<String>,
    val outcome: Outcome,
    val note: LocalizedString? = null,
)

private data class RankEntry(val subjectId: String, val total: Int, val order: Int)

/**
 * Build standings from an arbitrary subject->value map for non-score games.
 *
 * Ranking is *competition ranking*: subjects are ordered best-first (highest value, or lowest when
 * [lowerWins]), ties share a rank, and the next distinct value skips the appropriate number of
 * ranks (1,1,3 …). Order among tied subjects is stable: it follows the insertion order of [values]'
 * keys. [MatchResult.winners] is every subject sharing rank 1.
 *
 * Edge case: an empty map yields [Outcome.NoContest] with empty standings/winners.
 */
fun fromValues(values: Map<String, Int>, lowerWins: Boolean = false): MatchResult {
    // Preserve insertion order as the stable tie-break, then sort by value (best first).
    val entries = values.entries.mapIndexed { order, e -> RankEntry(e.key, e.value, order) }
        .sortedWith(Comparator { a, b ->
            if (a.total != b.total) {
                if (lowerWins) a.total - b.total else b.total - a.total
            } else {
                a.order - b.order // stable: earlier-inserted subject first
            }
        })

    val standings = ArrayList<Standing>()
    val winners = ArrayList<String>()
    var currentRank = 0 // last assigned rank
    var prevTotal: Int? = null

    for (i in entries.indices) {
        val e = entries[i]
        // First entry, or a different total than the previous one, starts a new (skipping) rank.
        if (prevTotal == null || e.total != prevTotal) {
            currentRank = i + 1 // competition ranking: rank = 1-based position of the tie group's first
            prevTotal = e.total
        }
        val isWinner = currentRank == 1
        standings.add(Standing(subjectId = e.subjectId, rank = currentRank, total = e.total, isWinner = isWinner))
        if (isWinner) winners.add(e.subjectId)
    }

    val outcome: Outcome = when {
        winners.isEmpty() -> Outcome.NoContest
        winners.size == 1 -> Outcome.Winner(winners[0])
        else -> Outcome.Tie(winners.toList())
    }

    return MatchResult(standings = standings, winners = winners, outcome = outcome)
}

/** Standard score-based evaluation; highest total wins (or lowest if [lowerWins]). */
fun fromScores(score: ScoreState, lowerWins: Boolean = false): MatchResult =
    fromValues(score.totals, lowerWins)
