package com.gamenight.party.game.mostlikelyto

import com.gamenight.party.engine.Rng
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat

/**
 * PURE game logic for "Most Likely To" — a faithful Kotlin port of
 * src/games/most-likely-to/{config.ts,logic.ts}. No clock / RNG / IO except the seeds threaded into
 * [createInitialState] / [MltAction.SubmitVotes] via [Rng]. Side effects (sound/haptics) live in the
 * Compose layer.
 */

// ──────────────────────────── Config / options ────────────────────────────

enum class VotingStyle { PASS_DEVICE, SIMULTANEOUS }
enum class TieBreak { CO_WINNERS, RANDOM }

data class MltOptions(
    val deckId: String = "classic",
    /** Intensity ceiling: include prompts at or below this tier. */
    val intensity: Intensity = Intensity.CASUAL,
    val votingStyle: VotingStyle = VotingStyle.PASS_DEVICE,
    val roundCount: Int = 8,
    val allowSelfVote: Boolean = false,
    val tieBreak: TieBreak = TieBreak.CO_WINNERS,
    val showRunningScores: Boolean = true,
)

val DEFAULT_OPTIONS: MltOptions = MltOptions()

/** Mirrors config.ts `normalizeOptions` (the deck fallback + roundCount clamp). */
fun normalizeOptions(o: MltOptions, content: MltContent): MltOptions {
    val deckId = if (content.deckById.containsKey(o.deckId)) o.deckId else (content.decks.firstOrNull()?.id ?: o.deckId)
    val poolSize = content.getPool(deckId, o.intensity).size
    val roundCount = o.roundCount.coerceIn(1, maxOf(1, poolSize))
    return o.copy(deckId = deckId, roundCount = roundCount)
}

/**
 * The match configuration. Mirrors the webapp's `GameConfig` slice this game reads, plus the loaded
 * [content] so [createInitialState] can resolve the pool purely (the web reads a module-level pool).
 */
data class MltConfig(
    val players: List<PlayerSeat>,
    val content: MltContent,
    val lang: Lang = Lang.EN,
    val options: MltOptions = DEFAULT_OPTIONS,
)

/** Mirrors config.ts `validateConfig`. Returns null when the config is playable. */
fun validateConfig(config: MltConfig): List<LocalizedString>? {
    val o = normalizeOptions(config.options, config.content)
    val errors = mutableListOf<LocalizedString>()
    val n = config.players.size
    if (n < 3) errors += LocalizedString("Add at least 3 players", "حداقل ۳ بازیکن اضافه کن")
    if (n > 20) errors += LocalizedString("At most 20 players", "حداکثر ۲۰ بازیکن")
    if (config.content.getPool(o.deckId, o.intensity).isEmpty())
        errors += LocalizedString("No prompts at this intensity", "هیچ سوالی در این شدت نیست")
    return errors.ifEmpty { null }
}

// ──────────────────────────── State ────────────────────────────

enum class MltPhase { PROMPT, VOTING, REVEAL, FINISHED, ERROR }

enum class MltError { EMPTY_DECK, NOT_ENOUGH_PLAYERS }

data class MltRound(
    val index: Int,
    val promptId: String,
    val tally: Map<String, Int>,
    val winnerIds: List<String>,
    val wasTie: Boolean,
)

data class MltState(
    val v: Int = 1,
    val phase: MltPhase,
    val finished: Boolean = false,
    val options: MltOptions,
    /** Full shuffled prompt-id pool. */
    val pool: List<String>,
    /** The prompts actually played. */
    val orderedPromptIds: List<String>,
    /** Next unused pool index (for SKIP). */
    val poolNextIndex: Int,
    val playerIds: List<String>,
    val playerNames: Map<String, String>,
    val playerColors: Map<String, ColorToken?>,
    val currentRound: Int = 0,
    val activeVoterIndex: Int? = null,
    /** voterId -> targetId (pass-device; never surfaced). */
    val pendingVotes: Map<String, String> = emptyMap(),
    val rounds: List<MltRound> = emptyList(),
    /** Round wins. */
    val scores: Map<String, Int>,
    /** Total votes received. */
    val rawVotes: Map<String, Int>,
    val errorCode: MltError? = null,
)

// ──────────────────────────── Actions ────────────────────────────

sealed interface MltAction {
    data object BeginVoting : MltAction
    data class CastVote(val voterId: String, val targetId: String) : MltAction
    data object UndoLastVote : MltAction
    data class SubmitVotes(val tally: Map<String, Int>? = null, val seed: Int) : MltAction
    data object NextRound : MltAction
    data object SkipPrompt : MltAction
}

// ──────────────────────────── Initial state ────────────────────────────

fun createInitialState(config: MltConfig, seed: Int): MltState {
    val options = normalizeOptions(config.options, config.content)
    val playerIds = config.players.map { it.id }
    val playerNames = LinkedHashMap<String, String>()
    val playerColors = LinkedHashMap<String, ColorToken?>()
    config.players.forEach {
        playerNames[it.id] = it.name
        playerColors[it.id] = it.color
    }

    val poolPromptIds = config.content.getPool(options.deckId, options.intensity).map { it.id }
    // Fresh Rng per call mirrors the web's `shuffle(items, seed)`.
    val pool = Rng(seed).shuffle(poolPromptIds)
    val orderedPromptIds = pool.take(minOf(options.roundCount, pool.size))

    val scores = LinkedHashMap<String, Int>()
    val rawVotes = LinkedHashMap<String, Int>()
    playerIds.forEach {
        scores[it] = 0
        rawVotes[it] = 0
    }

    val errorCode: MltError? = when {
        playerIds.size < 3 -> MltError.NOT_ENOUGH_PLAYERS
        orderedPromptIds.isEmpty() -> MltError.EMPTY_DECK
        else -> null
    }

    return MltState(
        v = 1,
        phase = if (errorCode != null) MltPhase.ERROR else MltPhase.PROMPT,
        finished = false,
        options = options,
        pool = pool,
        orderedPromptIds = orderedPromptIds,
        poolNextIndex = orderedPromptIds.size,
        playerIds = playerIds,
        playerNames = playerNames,
        playerColors = playerColors,
        currentRound = 0,
        activeVoterIndex = null,
        pendingVotes = emptyMap(),
        rounds = emptyList(),
        scores = scores,
        rawVotes = rawVotes,
        errorCode = errorCode,
    )
}

// ──────────────────────────── Tally ────────────────────────────

/** Mirrors logic.ts `buildTally`. */
private fun buildTally(s: MltState, payload: Map<String, Int>?): Map<String, Int> {
    val tally = LinkedHashMap<String, Int>()
    s.playerIds.forEach { tally[it] = 0 }
    if (s.options.votingStyle == VotingStyle.SIMULTANEOUS) {
        s.playerIds.forEach { id -> tally[id] = maxOf(0, payload?.get(id) ?: 0) }
    } else {
        s.pendingVotes.values.forEach { target ->
            if (tally.containsKey(target)) tally[target] = (tally[target] ?: 0) + 1
        }
    }
    return tally
}

// ──────────────────────────── Reducer ────────────────────────────

fun reducer(state: MltState, action: MltAction): MltState {
    val s = state
    return when (action) {
        is MltAction.BeginVoting -> {
            if (s.phase != MltPhase.PROMPT) return s
            s.copy(
                phase = MltPhase.VOTING,
                pendingVotes = emptyMap(),
                activeVoterIndex = if (s.options.votingStyle == VotingStyle.PASS_DEVICE) 0 else null,
            )
        }

        is MltAction.CastVote -> {
            if (s.phase != MltPhase.VOTING || s.options.votingStyle != VotingStyle.PASS_DEVICE) return s
            val idx = s.activeVoterIndex ?: return s
            if (s.playerIds.getOrNull(idx) != action.voterId) return s
            val pending = LinkedHashMap(s.pendingVotes)
            val disallowedSelf = action.targetId == action.voterId && !s.options.allowSelfVote
            if (!disallowedSelf && s.playerIds.contains(action.targetId)) {
                pending[action.voterId] = action.targetId
            }
            s.copy(pendingVotes = pending, activeVoterIndex = idx + 1)
        }

        is MltAction.UndoLastVote -> {
            if (s.phase != MltPhase.VOTING || s.options.votingStyle != VotingStyle.PASS_DEVICE) return s
            val cur = s.activeVoterIndex ?: return s
            if (cur <= 0) return s
            val idx = cur - 1
            val pending = LinkedHashMap(s.pendingVotes)
            pending.remove(s.playerIds[idx])
            s.copy(pendingVotes = pending, activeVoterIndex = idx)
        }

        is MltAction.SubmitVotes -> {
            if (s.phase != MltPhase.VOTING) return s
            val tally = buildTally(s, action.tally)
            var max = 0
            s.playerIds.forEach { id -> val v = tally[id] ?: 0; if (v > max) max = v }
            val topPlayers = if (max > 0) s.playerIds.filter { (tally[it] ?: 0) == max } else emptyList()
            val wasTie = topPlayers.size > 1
            val winnerIds = if (wasTie && s.options.tieBreak == TieBreak.RANDOM) {
                listOf(Rng(action.seed).pick(topPlayers))
            } else {
                topPlayers
            }

            val scores = LinkedHashMap(s.scores)
            winnerIds.forEach { id -> scores[id] = (scores[id] ?: 0) + 1 }
            val rawVotes = LinkedHashMap(s.rawVotes)
            s.playerIds.forEach { id -> rawVotes[id] = (rawVotes[id] ?: 0) + (tally[id] ?: 0) }

            val round = MltRound(
                index = s.currentRound,
                promptId = s.orderedPromptIds.getOrNull(s.currentRound) ?: "",
                tally = tally,
                winnerIds = winnerIds,
                wasTie = wasTie,
            )
            s.copy(
                phase = MltPhase.REVEAL,
                pendingVotes = emptyMap(),
                activeVoterIndex = null,
                rounds = s.rounds + round,
                scores = scores,
                rawVotes = rawVotes,
            )
        }

        is MltAction.NextRound -> {
            if (s.phase != MltPhase.REVEAL) return s
            if (s.currentRound + 1 < s.orderedPromptIds.size) {
                s.copy(phase = MltPhase.PROMPT, currentRound = s.currentRound + 1)
            } else {
                s.copy(phase = MltPhase.FINISHED, finished = true)
            }
        }

        is MltAction.SkipPrompt -> {
            if (s.phase != MltPhase.PROMPT) return s
            if (s.poolNextIndex >= s.pool.size) return s
            val ordered = s.orderedPromptIds.toMutableList()
            ordered[s.currentRound] = s.pool[s.poolNextIndex]
            s.copy(orderedPromptIds = ordered, poolNextIndex = s.poolNextIndex + 1)
        }
    }
}

// ──────────────────────────── Pure selectors ────────────────────────────

fun currentPromptId(s: MltState): String? = s.orderedPromptIds.getOrNull(s.currentRound)

fun currentVoterId(s: MltState): String? =
    s.activeVoterIndex?.let { s.playerIds.getOrNull(it) }

fun allVoted(s: MltState): Boolean =
    s.activeVoterIndex != null && s.activeVoterIndex >= s.playerIds.size

data class MltStanding(
    val id: String,
    val score: Int,
    val rawVotes: Int,
    val rank: Int,
)

fun rankPlayers(s: MltState): List<MltStanding> {
    val order = s.playerIds.withIndex().associate { (i, id) -> id to i }
    val sorted = s.playerIds.sortedWith(
        compareByDescending<String> { s.scores[it] ?: 0 }
            .thenByDescending { s.rawVotes[it] ?: 0 }
            .thenBy { order[it] ?: 0 },
    )
    var rank = 0
    var prevKey = ""
    return sorted.mapIndexed { i, id ->
        val score = s.scores[id] ?: 0
        val raw = s.rawVotes[id] ?: 0
        val key = "$score|$raw"
        if (key != prevKey) {
            rank = i + 1
            prevKey = key
        }
        MltStanding(id = id, score = score, rawVotes = raw, rank = rank)
    }
}

fun computeOverallWinners(s: MltState): List<String> =
    rankPlayers(s).filter { it.rank == 1 }.map { it.id }
