package com.gamenight.party.game.wouldyourather

import com.gamenight.party.engine.Rng
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat

/**
 * PURE game logic for "Would You Rather" — a faithful Kotlin port of
 * src/games/would-you-rather/{config.ts,logic.ts}. No clock / RNG / IO except the [seed] threaded
 * into [createInitialState] via [Rng] (a fresh instance per call == the web's `shuffle(items, seed)`).
 * Side effects (sound/haptics) live in the Compose layer, not here.
 *
 * No-op transitions return the SAME state reference, mirroring the web reducer's `=== input` tests.
 */

// ──────────────────────────── Config / options ────────────────────────────

enum class WyrMode { VOTE, QUICK }

data class WyrOptions(
    val deckId: String = "classic",
    val maxIntensity: Intensity = Intensity.MEDIUM,
    val mode: WyrMode = WyrMode.VOTE,
    /** Number of prompts to play (clamped to the pool; a very large value plays the whole deck). */
    val roundLength: Int = 10,
    val awardMajorityPoints: Boolean = false,
    val tieCountsForBoth: Boolean = true,
)

val DEFAULT_OPTIONS: WyrOptions = WyrOptions()

/**
 * Mirrors config.ts `normalizeOptions`. The mode/intensity/booleans are already type-safe in Kotlin
 * (enums), and the deck is chosen from the valid set in Setup, so this only clamps [roundLength].
 */
fun normalizeOptions(o: WyrOptions): WyrOptions = o.copy(roundLength = o.roundLength.coerceIn(1, 999))

/**
 * The match configuration. Mirrors the webapp's `GameConfig` slice this game reads, plus the loaded
 * [content] so [createInitialState] can resolve the pool purely (the web reads a module-level pool).
 */
data class WyrConfig(
    val players: List<PlayerSeat>,
    val content: WyrContent,
    val lang: Lang = Lang.EN,
    val options: WyrOptions = DEFAULT_OPTIONS,
)

/** Mirrors config.ts `validateConfig`. Returns null when the config is playable. */
fun validateConfig(config: WyrConfig): List<LocalizedString>? {
    val o = normalizeOptions(config.options)
    val errors = mutableListOf<LocalizedString>()
    val n = config.players.size
    if (n < 2) errors += LocalizedString("Add at least 2 players", "حداقل ۲ بازیکن اضافه کن")
    if (n > 20) errors += LocalizedString("At most 20 players", "حداکثر ۲۰ بازیکن")
    if (config.content.poolFor(o.deckId, o.maxIntensity).isEmpty())
        errors += LocalizedString("No prompts at this intensity", "هیچ سوالی در این شدت نیست")
    return errors.ifEmpty { null }
}

// ──────────────────────────── State ────────────────────────────

enum class WyrPhase { PROMPT, COLLECTING, REVEAL, RESULTS, ERROR }

enum class Side { A, B }

enum class Majority { A, B, TIE }

enum class WyrError { EMPTY_DECK, NOT_ENOUGH_PLAYERS }

data class QuickCounts(val a: Int, val b: Int)

data class RoundCurrent(val countA: Int, val countB: Int, val majority: Majority)

data class RoundRecord(
    val itemId: String,
    val countA: Int,
    val countB: Int,
    val majority: Majority,
    val choices: Map<String, Side>,
)

data class WyrState(
    val v: Int,
    val phase: WyrPhase,
    val finished: Boolean,
    val options: WyrOptions,
    val order: List<String>,
    val index: Int,
    val total: Int,
    val playerIds: List<String>,
    val playerNames: Map<String, String>,
    val playerColors: Map<String, ColorToken?>,
    val choices: Map<String, Side>,
    val quickCounts: QuickCounts?,
    val handoffIndex: Int,
    val current: RoundCurrent?,
    val history: List<RoundRecord>,
    val scores: Map<String, Int>,
    val errorCode: WyrError?,
)

// ──────────────────────────── Actions ────────────────────────────

sealed interface WyrAction {
    data object BeginCollection : WyrAction
    data class Choose(val playerId: String, val side: Side) : WyrAction
    data class UndoChoice(val playerId: String) : WyrAction
    data object AdvanceHandoff : WyrAction
    data class SetQuickCounts(val a: Int, val b: Int) : WyrAction
    data object Reveal : WyrAction
    data object Next : WyrAction
    data object Skip : WyrAction
    data object EndGame : WyrAction
}

// ──────────────────────────── Scoring helpers ────────────────────────────

private fun zeroScores(playerIds: List<String>): Map<String, Int> = playerIds.associateWith { 0 }

private fun tallyOf(s: WyrState): Pair<Int, Int> {
    if (s.options.mode == WyrMode.QUICK) {
        return Pair(s.quickCounts?.a ?: 0, s.quickCounts?.b ?: 0)
    }
    var countA = 0
    var countB = 0
    s.choices.values.forEach { if (it == Side.A) countA++ else countB++ }
    return Pair(countA, countB)
}

private fun majorityOf(countA: Int, countB: Int): Majority =
    if (countA > countB) Majority.A else if (countB > countA) Majority.B else Majority.TIE

private fun sideMatchesMajority(side: Side, majority: Majority): Boolean =
    (side == Side.A && majority == Majority.A) || (side == Side.B && majority == Majority.B)

private fun applyRoundPoints(
    base: Map<String, Int>,
    options: WyrOptions,
    choices: Map<String, Side>,
    majority: Majority,
): Map<String, Int> {
    if (!options.awardMajorityPoints || options.mode == WyrMode.QUICK) return base
    val scores = LinkedHashMap(base)
    for ((pid, side) in choices) {
        val win = if (majority == Majority.TIE) options.tieCountsForBoth else sideMatchesMajority(side, majority)
        if (win) scores[pid] = (scores[pid] ?: 0) + 1
    }
    return scores
}

private fun recomputeScores(
    playerIds: List<String>,
    options: WyrOptions,
    history: List<RoundRecord>,
): Map<String, Int> {
    var scores = zeroScores(playerIds)
    for (r in history) scores = applyRoundPoints(scores, options, r.choices, r.majority)
    return scores
}

// ──────────────────────────── Initial state ────────────────────────────

fun createInitialState(config: WyrConfig, seed: Int): WyrState {
    val options = normalizeOptions(config.options)
    val playerIds = config.players.map { it.id }
    val playerNames: Map<String, String> = config.players.associate { it.id to it.name }
    val playerColors: Map<String, ColorToken?> = config.players.associate { it.id to it.color }

    // Fresh Rng per call mirrors the web's `shuffle(poolFor(...).map(id), seed)`.
    val pool = Rng(seed).shuffle(config.content.poolFor(options.deckId, options.maxIntensity).map { it.id })
    val total = minOf(options.roundLength, pool.size)
    val order = pool.take(total)

    val errorCode: WyrError? = when {
        playerIds.size < 2 -> WyrError.NOT_ENOUGH_PLAYERS
        order.isEmpty() -> WyrError.EMPTY_DECK
        else -> null
    }

    return WyrState(
        v = 1,
        phase = if (errorCode != null) WyrPhase.ERROR else WyrPhase.PROMPT,
        finished = false,
        options = options,
        order = order,
        index = 0,
        total = total,
        playerIds = playerIds,
        playerNames = playerNames,
        playerColors = playerColors,
        choices = emptyMap(),
        quickCounts = null,
        handoffIndex = 0,
        current = null,
        history = emptyList(),
        scores = zeroScores(playerIds),
        errorCode = errorCode,
    )
}

// ──────────────────────────── Reducer ────────────────────────────

fun reducer(state: WyrState, action: WyrAction): WyrState {
    val s = state
    return when (action) {
        is WyrAction.BeginCollection -> {
            if (s.phase != WyrPhase.PROMPT) return s
            s.copy(phase = WyrPhase.COLLECTING, choices = emptyMap(), quickCounts = null, handoffIndex = 0)
        }

        is WyrAction.Choose -> {
            if (s.phase != WyrPhase.COLLECTING || s.options.mode != WyrMode.VOTE) return s
            if (action.playerId !in s.playerIds) return s
            s.copy(choices = s.choices + (action.playerId to action.side))
        }

        is WyrAction.UndoChoice -> {
            if (s.phase != WyrPhase.COLLECTING) return s
            if (action.playerId !in s.choices) return s
            s.copy(choices = s.choices - action.playerId)
        }

        is WyrAction.AdvanceHandoff -> {
            if (s.phase != WyrPhase.COLLECTING || s.options.mode != WyrMode.VOTE) return s
            s.copy(handoffIndex = minOf(s.handoffIndex + 1, s.playerIds.size))
        }

        is WyrAction.SetQuickCounts -> {
            if (s.phase != WyrPhase.COLLECTING || s.options.mode != WyrMode.QUICK) return s
            s.copy(quickCounts = QuickCounts(maxOf(0, action.a), maxOf(0, action.b)))
        }

        is WyrAction.Reveal -> {
            if (s.phase != WyrPhase.COLLECTING) return s
            val (countA, countB) = tallyOf(s)
            val majority = majorityOf(countA, countB)
            val scores = applyRoundPoints(s.scores, s.options, s.choices, majority)
            s.copy(phase = WyrPhase.REVEAL, current = RoundCurrent(countA, countB, majority), scores = scores)
        }

        is WyrAction.Next -> {
            if (s.phase != WyrPhase.REVEAL) return s
            val cur = s.current ?: RoundCurrent(0, 0, Majority.TIE)
            val record = RoundRecord(
                itemId = s.order.getOrElse(s.index) { "" },
                countA = cur.countA,
                countB = cur.countB,
                majority = cur.majority,
                choices = s.choices,
            )
            val history = s.history + record
            val index = s.index + 1
            val done = index >= s.total || index >= s.order.size
            s.copy(
                choices = emptyMap(),
                quickCounts = null,
                handoffIndex = 0,
                current = null,
                history = history,
                index = index,
                phase = if (done) WyrPhase.RESULTS else WyrPhase.PROMPT,
                finished = done,
            )
        }

        is WyrAction.Skip -> {
            if (s.phase != WyrPhase.PROMPT && s.phase != WyrPhase.COLLECTING && s.phase != WyrPhase.REVEAL) return s
            val index = s.index + 1
            val done = index >= s.total || index >= s.order.size
            // Roll back any points the (now-discarded) current round may have applied.
            val scores = recomputeScores(s.playerIds, s.options, s.history)
            s.copy(
                choices = emptyMap(),
                quickCounts = null,
                handoffIndex = 0,
                current = null,
                index = index,
                scores = scores,
                phase = if (done) WyrPhase.RESULTS else WyrPhase.PROMPT,
                finished = done,
            )
        }

        is WyrAction.EndGame -> {
            if (s.finished) return s
            // End the match now and show standings so far. Finalize scores from the COMPLETED rounds
            // only (mirrors Skip's rollback of the in-progress round) so the Results view — which reads
            // scores for standings/winners and history for side wins — stays internally consistent.
            val scores = recomputeScores(s.playerIds, s.options, s.history)
            s.copy(
                choices = emptyMap(),
                quickCounts = null,
                handoffIndex = 0,
                current = null,
                phase = WyrPhase.RESULTS,
                scores = scores,
                finished = true,
            )
        }
    }
}

// ──────────────────────────── Pure selectors ────────────────────────────

fun currentItemId(s: WyrState): String? = s.order.getOrNull(s.index)

fun currentVoterId(s: WyrState): String? =
    if (s.options.mode == WyrMode.VOTE && s.handoffIndex < s.playerIds.size) s.playerIds[s.handoffIndex] else null

fun everyoneVoted(s: WyrState): Boolean = s.handoffIndex >= s.playerIds.size

data class WyrStanding(val id: String, val score: Int, val rank: Int)

fun standings(s: WyrState): List<WyrStanding> {
    val orderIdx = s.playerIds.withIndex().associate { (i, id) -> id to i }
    val sorted = s.playerIds.sortedWith(
        compareByDescending<String> { s.scores[it] ?: 0 }.thenBy { orderIdx[it] ?: 0 },
    )
    var rank = 0
    var prev = 0
    var hasPrev = false
    return sorted.mapIndexed { i, id ->
        val sc = s.scores[id] ?: 0
        if (!hasPrev || sc != prev) {
            rank = i + 1
            prev = sc
            hasPrev = true
        }
        WyrStanding(id, sc, rank)
    }
}

fun computeWinners(s: WyrState): List<String> {
    if (!s.options.awardMajorityPoints || s.options.mode == WyrMode.QUICK) return emptyList()
    return standings(s).filter { it.rank == 1 && it.score > 0 }.map { it.id }
}

/** Total rounds each side won across [WyrState.history]. */
fun sideWins(s: WyrState): Pair<Int, Int> {
    var a = 0
    var b = 0
    s.history.forEach { if (it.majority == Majority.A) a++ else if (it.majority == Majority.B) b++ }
    return Pair(a, b)
}
