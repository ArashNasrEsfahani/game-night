package com.gamenight.party.game.spyfall

import com.gamenight.party.engine.Rng
import com.gamenight.party.engine.deriveSeed
import com.gamenight.party.model.ColorToken

/**
 * PURE Spyfall logic — a 1:1 port of src/games/spyfall/logic.ts. No clock / entropy / IO: every
 * source of randomness is a seed threaded in via [createInitialState] or [SpyfallAction.NextRound],
 * and consumed through a fresh [Rng] (the native mirror of the web's `shuffle(items, seed)` /
 * `int(min, max, seed)`). Side effects (sound, haptics, the QA countdown) live in the Compose layer.
 */

enum class SpyfallPhase { REVEAL, QA, ACCUSATION, VOTING, SPY_GUESS, ROUND_END, MATCH_END, ERROR }

enum class RoundOutcome { SPY_CAUGHT, SPY_SURVIVED, SPY_GUESSED_RIGHT, SPY_GUESSED_WRONG }

enum class SpyfallErrorCode { EMPTY_CATALOG, BAD_PLAYERS }

data class SecretCard(
    val isSpy: Boolean,
    val locationId: String,
    val roleId: String? = null,
)

data class RoundState(
    val index: Int,
    val locationId: String,
    val spyIds: List<String>,
    val cards: Map<String, SecretCard>,
    val firstAskerId: String,
    val nomineeId: String? = null,
    val accuserId: String? = null,
    val votes: Map<String, String?> = emptyMap(),
    val votedOutId: String? = null,
    val noMajority: Boolean = false,
    val spyGuessLocationId: String? = null,
    val spyGuessById: String? = null,
    val outcome: RoundOutcome? = null,
    val roundScores: Map<String, Int> = emptyMap(),
)

data class SpyfallState(
    val phase: SpyfallPhase,
    val finished: Boolean,
    val options: SpyfallOptions,
    val playerIds: List<String>,
    val playerNames: Map<String, String>,
    val playerColors: Map<String, ColorToken?>,
    val catalogIds: List<String>,
    val totals: Map<String, Int>,
    val round: RoundState,
    val roundHistory: List<RoundState> = emptyList(),
    val revealCursor: Int = 0,
    val errorCode: SpyfallErrorCode? = null,
)

sealed interface SpyfallAction {
    data object RevealNext : SpyfallAction
    data class CallVote(val accuserId: String, val nomineeId: String) : SpyfallAction
    data object TimerExpired : SpyfallAction
    data object CancelVote : SpyfallAction
    data object OpenVoting : SpyfallAction
    data class CastVote(val voterId: String, val targetId: String?) : SpyfallAction
    data object LockVotes : SpyfallAction
    data class SpyGuess(val spyId: String, val locationId: String) : SpyfallAction
    data object SkipSpyGuess : SpyfallAction
    data class NextRound(val seed: Int) : SpyfallAction
}

private const val POINTS_PER_NONSPY_ON_CATCH = 1
private const val POINTS_ACCUSER_BONUS = 1
private const val POINTS_PER_SPY_ON_SURVIVE = 2
private const val POINTS_PER_SPY_ON_GUESS = 2

private fun assignRound(
    playerIds: List<String>,
    spyCount: Int,
    catalog: List<SpyfallLocation>,
    index: Int,
    seed: Int,
    avoidLocationId: String?,
): RoundState {
    var locIdx = Rng(deriveSeed(seed, 2)).int(0, catalog.size - 1)
    if (catalog.getOrNull(locIdx)?.id == avoidLocationId && catalog.size > 1) {
        locIdx = (locIdx + 1) % catalog.size
    }
    val location = catalog[locIdx]
    val shuffled = Rng(seed).shuffle(playerIds)
    val spyIds = shuffled.take(spyCount)
    val nonSpies = shuffled.drop(spyCount)
    val rolePool = Rng(deriveSeed(seed, 1)).shuffle(location.roles)

    val cards = LinkedHashMap<String, SecretCard>()
    spyIds.forEach { p -> cards[p] = SecretCard(isSpy = true, locationId = location.id) }
    nonSpies.forEachIndexed { i, p ->
        val role = rolePool[i % rolePool.size]
        cards[p] = SecretCard(isSpy = false, locationId = location.id, roleId = role.id)
    }

    return RoundState(
        index = index,
        locationId = location.id,
        spyIds = spyIds,
        cards = cards,
        firstAskerId = shuffled[0],
    )
}

private fun emptyRound(): RoundState = RoundState(
    index = 0,
    locationId = "",
    spyIds = emptyList(),
    cards = emptyMap(),
    firstAskerId = "",
)

fun createInitialState(config: SpyfallConfig, seed: Int): SpyfallState {
    val options = readOptions(config)
    val playerIds = config.players.map { it.id }
    val playerNames = config.players.associate { it.id to it.name }
    val playerColors: Map<String, ColorToken?> = config.players.associate { it.id to it.color }

    val catalog = SpyfallContent.buildCatalog(options.enabledPackIds)
    val totals = playerIds.associateWith { 0 }

    val badPlayers = playerIds.size < 3 || playerIds.size - options.spyCount < 2
    val errorCode = when {
        badPlayers -> SpyfallErrorCode.BAD_PLAYERS
        catalog.isEmpty() -> SpyfallErrorCode.EMPTY_CATALOG
        else -> null
    }

    val round = if (errorCode != null) {
        emptyRound()
    } else {
        assignRound(playerIds, options.spyCount, catalog, 0, seed, null)
    }

    return SpyfallState(
        phase = if (errorCode != null) SpyfallPhase.ERROR else SpyfallPhase.REVEAL,
        finished = false,
        options = options,
        playerIds = playerIds,
        playerNames = playerNames,
        playerColors = playerColors,
        catalogIds = catalog.map { it.id },
        totals = totals,
        round = round,
        roundHistory = emptyList(),
        revealCursor = 0,
        errorCode = errorCode,
    )
}

private fun tallyVotes(votes: Map<String, String?>, playerIds: List<String>): String? {
    val counts = HashMap<String, Int>()
    votes.values.forEach { t -> if (t != null) counts[t] = (counts[t] ?: 0) + 1 }
    val threshold = playerIds.size / 2.0
    var result: String? = null
    for (id in playerIds) {
        if ((counts[id] ?: 0) > threshold) result = id
    }
    return result
}

private fun resolveRound(state: SpyfallState): SpyfallState {
    val r = state.round
    val nonSpies = state.playerIds.filter { it !in r.spyIds }
    val votedSpy = r.votedOutId != null && r.votedOutId in r.spyIds
    val guessRight = r.spyGuessLocationId != null && r.spyGuessLocationId == r.locationId
    val outcome = when {
        guessRight -> RoundOutcome.SPY_GUESSED_RIGHT
        r.spyGuessLocationId != null -> RoundOutcome.SPY_GUESSED_WRONG
        votedSpy -> RoundOutcome.SPY_CAUGHT
        else -> RoundOutcome.SPY_SURVIVED
    }

    val roundScores = HashMap<String, Int>()
    state.playerIds.forEach { roundScores[it] = 0 }
    if (votedSpy) {
        nonSpies.forEach { roundScores[it] = (roundScores[it] ?: 0) + POINTS_PER_NONSPY_ON_CATCH }
        val acc = r.accuserId
        if (!acc.isNullOrEmpty() && r.nomineeId == r.votedOutId) {
            roundScores[acc] = (roundScores[acc] ?: 0) + POINTS_ACCUSER_BONUS
        }
    }
    r.spyIds.forEach { if (it != r.votedOutId) roundScores[it] = (roundScores[it] ?: 0) + POINTS_PER_SPY_ON_SURVIVE }
    if (guessRight) r.spyIds.forEach { roundScores[it] = (roundScores[it] ?: 0) + POINTS_PER_SPY_ON_GUESS }

    val totals = HashMap(state.totals)
    state.playerIds.forEach { totals[it] = (totals[it] ?: 0) + (roundScores[it] ?: 0) }

    val resolvedRound = r.copy(outcome = outcome, roundScores = roundScores)
    return state.copy(
        phase = SpyfallPhase.ROUND_END,
        round = resolvedRound,
        totals = totals,
        roundHistory = state.roundHistory + resolvedRound,
    )
}

fun reducer(state: SpyfallState, action: SpyfallAction): SpyfallState {
    val s = state
    return when (action) {
        is SpyfallAction.RevealNext -> {
            if (s.phase != SpyfallPhase.REVEAL) return s
            val cursor = s.revealCursor + 1
            if (cursor >= s.playerIds.size) s.copy(phase = SpyfallPhase.QA, revealCursor = cursor)
            else s.copy(revealCursor = cursor)
        }
        is SpyfallAction.CallVote -> {
            if (s.phase != SpyfallPhase.QA) return s
            s.copy(
                phase = SpyfallPhase.ACCUSATION,
                round = s.round.copy(accuserId = action.accuserId, nomineeId = action.nomineeId),
            )
        }
        is SpyfallAction.TimerExpired -> {
            if (s.phase != SpyfallPhase.QA) return s
            s.copy(
                phase = SpyfallPhase.ACCUSATION,
                round = s.round.copy(accuserId = null, nomineeId = null),
            )
        }
        is SpyfallAction.CancelVote -> {
            if (s.phase != SpyfallPhase.ACCUSATION) return s
            s.copy(phase = SpyfallPhase.QA, round = s.round.copy(accuserId = null, nomineeId = null))
        }
        is SpyfallAction.OpenVoting -> {
            if (s.phase != SpyfallPhase.ACCUSATION) return s
            s.copy(phase = SpyfallPhase.VOTING, round = s.round.copy(votes = emptyMap()))
        }
        is SpyfallAction.CastVote -> {
            if (s.phase != SpyfallPhase.VOTING) return s
            s.copy(round = s.round.copy(votes = s.round.votes + (action.voterId to action.targetId)))
        }
        is SpyfallAction.LockVotes -> {
            if (s.phase != SpyfallPhase.VOTING) return s
            val votedOutId = tallyVotes(s.round.votes, s.playerIds)
            val round = s.round.copy(votedOutId = votedOutId, noMajority = votedOutId == null)
            val spiesInPlay = round.spyIds.filter { it != votedOutId }
            val withVote = s.copy(round = round)
            if (s.options.allowSpyGuess && spiesInPlay.isNotEmpty()) {
                withVote.copy(phase = SpyfallPhase.SPY_GUESS)
            } else {
                resolveRound(withVote)
            }
        }
        is SpyfallAction.SpyGuess -> {
            if (s.phase != SpyfallPhase.SPY_GUESS) return s
            if (s.round.spyGuessLocationId != null) return s // first guess wins
            resolveRound(
                s.copy(round = s.round.copy(spyGuessLocationId = action.locationId, spyGuessById = action.spyId)),
            )
        }
        is SpyfallAction.SkipSpyGuess -> {
            if (s.phase != SpyfallPhase.SPY_GUESS) return s
            resolveRound(s)
        }
        is SpyfallAction.NextRound -> {
            if (s.phase != SpyfallPhase.ROUND_END) return s
            if (s.round.index + 1 >= s.options.totalRounds) {
                s.copy(phase = SpyfallPhase.MATCH_END, finished = true)
            } else {
                val catalog = SpyfallContent.buildCatalog(s.options.enabledPackIds)
                val round = assignRound(
                    s.playerIds,
                    s.options.spyCount,
                    catalog,
                    s.round.index + 1,
                    action.seed,
                    s.round.locationId,
                )
                s.copy(phase = SpyfallPhase.REVEAL, revealCursor = 0, round = round)
            }
        }
    }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

fun currentRevealPlayerId(s: SpyfallState): String? = s.playerIds.getOrNull(s.revealCursor)

data class SpyfallStanding(val id: String, val score: Int, val rank: Int)

/** Players ranked by total (desc), ties broken by original seat order — mirrors logic.ts#standings. */
fun standings(s: SpyfallState): List<SpyfallStanding> {
    val order = s.playerIds.withIndex().associate { (i, id) -> id to i }
    val sorted = s.playerIds.sortedWith(
        compareByDescending<String> { s.totals[it] ?: 0 }.thenBy { order[it] ?: 0 },
    )
    var rank = 0
    var prev = 0
    var hasPrev = false
    return sorted.mapIndexed { i, id ->
        val sc = s.totals[id] ?: 0
        if (!hasPrev || sc != prev) {
            rank = i + 1
            prev = sc
            hasPrev = true
        }
        SpyfallStanding(id, sc, rank)
    }
}

fun computeWinners(s: SpyfallState): List<String> =
    standings(s).filter { it.rank == 1 }.map { it.id }
