package com.gamenight.party.game.neverhaveiever

import com.gamenight.party.engine.Rng
import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat

/**
 * PURE game logic for "Never Have I Ever" — a faithful Kotlin port of
 * src/games/never-have-i-ever/{config.ts,logic.ts}. No clock / RNG / IO except the [seed] threaded
 * into [createInitialState] via [Rng]. Side effects (sound/haptics) live in the Compose layer.
 */

// ──────────────────────────── Config / options ────────────────────────────

enum class NhieMode { CLASSIC, POINTS }
enum class RevealMode { SEQUENTIAL, HONOR }

data class NhieOptions(
    val mode: NhieMode = NhieMode.CLASSIC,
    val revealMode: RevealMode = RevealMode.SEQUENTIAL,
    val intensities: List<NhieIntensity> = listOf(NhieIntensity.CLASSIC),
    /** Classic only: lives each player starts with. */
    val startingLives: Int = 5,
    /** Number of statements to play (clamped to available). */
    val deckSize: Int = 20,
)

val DEFAULT_OPTIONS: NhieOptions = NhieOptions()

/** Mirrors config.ts `normalizeOptions` (the clamps + the "default to classic" intensity rule). */
fun normalizeOptions(o: NhieOptions): NhieOptions {
    val intensities = o.intensities.filter { it in INTENSITIES }
    return o.copy(
        intensities = if (intensities.isNotEmpty()) intensities else listOf(NhieIntensity.CLASSIC),
        startingLives = o.startingLives.coerceIn(1, 20),
        deckSize = o.deckSize.coerceIn(1, 200),
    )
}

/**
 * The match configuration. Mirrors the webapp's `GameConfig` slice this game reads, plus the loaded
 * [content] so [createInitialState] can resolve the deck purely (the web reads a module-level pool).
 */
data class NhieConfig(
    val players: List<PlayerSeat>,
    val content: NhieContent,
    val lang: Lang = Lang.EN,
    val options: NhieOptions = DEFAULT_OPTIONS,
)

/** Mirrors config.ts `validateConfig`. Returns null when the config is playable. */
fun validateConfig(config: NhieConfig): List<LocalizedString>? {
    val o = normalizeOptions(config.options)
    val errors = mutableListOf<LocalizedString>()
    val n = config.players.size
    if (n < 3) errors += LocalizedString("Add at least 3 players", "حداقل ۳ بازیکن اضافه کن")
    if (n > 16) errors += LocalizedString("At most 16 players", "حداکثر ۱۶ بازیکن")
    if (o.intensities.isEmpty()) errors += LocalizedString("Pick at least one intensity", "حداقل یک شدت انتخاب کن")
    if (config.content.getDeck(o.intensities).isEmpty())
        errors += LocalizedString("No statements for this filter", "هیچ جمله‌ای با این فیلتر نیست")
    return errors.ifEmpty { null }
}

// ──────────────────────────── State ────────────────────────────

enum class NhiePhase { STATEMENT, ANSWERING, REVEAL, RESULTS, ERROR }

enum class NhieError { EMPTY_DECK, NOT_ENOUGH_PLAYERS }

data class PlayerRuntime(
    val id: String,
    val lives: Int, // classic: starts at startingLives; points: 0 (unused)
    val haveCount: Int,
    val eliminated: Boolean,
    val eliminatedAtRound: Int? = null,
)

data class RoundRecord(
    val index: Int,
    val statementId: String,
    val haveIds: List<String>,
    val participantIds: List<String>,
)

/** In-progress answering pass (sequential queue or honor count). `answers` preserves insertion order. */
data class Answering(
    val queue: List<String>,
    val cursor: Int,
    val answers: Map<String, Boolean>,
)

data class LastResult(
    val haveIds: List<String>,
    val livesLost: Map<String, Int>,
    val newlyEliminated: List<String>,
)

data class NhieState(
    val v: Int,
    val phase: NhiePhase,
    val finished: Boolean,
    val options: NhieOptions,
    val playerIds: List<String>,
    val playerNames: Map<String, String>,
    val drawOrder: List<String>,
    val drawIndex: Int,
    val currentStatementId: String?,
    val players: List<PlayerRuntime>,
    val answering: Answering?,
    val rounds: List<RoundRecord>,
    val roundIndex: Int,
    val lastResult: LastResult?,
    val winnerIds: List<String>,
    val errorCode: NhieError?,
)

// ──────────────────────────── Actions ────────────────────────────

sealed interface NhieAction {
    data object StartAnswering : NhieAction
    data class Answer(val playerId: String, val hasDone: Boolean) : NhieAction
    data object PassToNext : NhieAction
    data class SetHonorHaves(val playerIds: List<String>) : NhieAction
    data object ResolveRound : NhieAction
    data object NextStatement : NhieAction
    data object SkipStatement : NhieAction
    data object EndGame : NhieAction
}

// ──────────────────────────── Initial state ────────────────────────────

fun createInitialState(config: NhieConfig, seed: Int): NhieState {
    val options = normalizeOptions(config.options)
    val playerIds = config.players.map { it.id }
    val playerNames: Map<String, String> = config.players.associate { it.id to it.name }

    val pool = config.content.getDeck(options.intensities)
    // Fresh Rng per call mirrors the web's `shuffle(items, seed)`.
    val shuffled = Rng(seed).shuffle(pool.map { it.id })
    val drawOrder = shuffled.take(minOf(options.deckSize, shuffled.size))

    val players = playerIds.map { id ->
        PlayerRuntime(
            id = id,
            lives = if (options.mode == NhieMode.CLASSIC) options.startingLives else 0,
            haveCount = 0,
            eliminated = false,
        )
    }

    val errorCode: NhieError? = when {
        playerIds.size < 3 -> NhieError.NOT_ENOUGH_PLAYERS
        drawOrder.isEmpty() -> NhieError.EMPTY_DECK
        else -> null
    }

    return NhieState(
        v = 1,
        phase = if (errorCode != null) NhiePhase.ERROR else NhiePhase.STATEMENT,
        finished = false,
        options = options,
        playerIds = playerIds,
        playerNames = playerNames,
        drawOrder = drawOrder,
        drawIndex = 0,
        currentStatementId = drawOrder.firstOrNull(),
        players = players,
        answering = null,
        rounds = emptyList(),
        roundIndex = 0,
        lastResult = null,
        winnerIds = emptyList(),
        errorCode = errorCode,
    )
}

// ──────────────────────────── Derivations ────────────────────────────

private fun aliveIds(s: NhieState): List<String> =
    s.players.filter { !it.eliminated }.map { it.id }

fun computeWinners(state: NhieState): List<String> {
    val players = state.players
    if (state.options.mode == NhieMode.POINTS) {
        val min = players.minOf { it.haveCount }
        return players.filter { it.haveCount == min }.map { it.id }
    }
    // classic
    val alive = players.filter { !it.eliminated }
    if (alive.isNotEmpty()) {
        val maxLives = alive.maxOf { it.lives }
        val top = alive.filter { it.lives == maxLives }
        val minHaves = top.minOf { it.haveCount }
        return top.filter { it.haveCount == minHaves }.map { it.id }
    }
    // everyone eliminated — the last to fall (fewest confessions among them) wins
    val maxRound = players.maxOf { it.eliminatedAtRound ?: -1 }
    val latest = players.filter { (it.eliminatedAtRound ?: -1) == maxRound }
    val minHaves = latest.minOf { it.haveCount }
    return latest.filter { it.haveCount == minHaves }.map { it.id }
}

fun rankPlayers(state: NhieState): List<PlayerRuntime> {
    if (state.options.mode == NhieMode.POINTS) {
        return state.players.sortedBy { it.haveCount }
    }
    return state.players.sortedWith(Comparator { a, b ->
        if (a.eliminated != b.eliminated) return@Comparator if (a.eliminated) 1 else -1
        if (!a.eliminated) {
            val byLives = b.lives - a.lives
            if (byLives != 0) return@Comparator byLives
            return@Comparator a.haveCount - b.haveCount
        }
        val byRound = (b.eliminatedAtRound ?: -1) - (a.eliminatedAtRound ?: -1)
        if (byRound != 0) return@Comparator byRound
        a.haveCount - b.haveCount
    })
}

private fun applyGameOverIfAny(state: NhieState): NhieState {
    val over = if (state.options.mode == NhieMode.CLASSIC) {
        aliveIds(state).size <= 1
    } else {
        state.roundIndex + 1 >= state.drawOrder.size
    }
    if (!over) return state
    return state.copy(finished = true, winnerIds = computeWinners(state))
}

private fun advanceStatement(state: NhieState): NhieState {
    val drawIndex = state.drawIndex + 1
    if (drawIndex >= state.drawOrder.size) {
        return state.copy(
            phase = NhiePhase.RESULTS,
            finished = true,
            winnerIds = computeWinners(state),
        )
    }
    return state.copy(
        phase = NhiePhase.STATEMENT,
        drawIndex = drawIndex,
        currentStatementId = state.drawOrder[drawIndex],
        answering = null,
        lastResult = null,
    )
}

// ──────────────────────────── Reducer ────────────────────────────

fun reducer(state: NhieState, action: NhieAction): NhieState {
    val s = state
    return when (action) {
        is NhieAction.StartAnswering -> {
            if (s.phase != NhiePhase.STATEMENT) return s
            val queue = if (s.options.revealMode == RevealMode.SEQUENTIAL) aliveIds(s) else emptyList()
            s.copy(phase = NhiePhase.ANSWERING, answering = Answering(queue = queue, cursor = 0, answers = emptyMap()))
        }

        is NhieAction.Answer -> {
            val a = s.answering
            if (s.phase != NhiePhase.ANSWERING || a == null) return s
            if (a.queue.getOrNull(a.cursor) != action.playerId) return s
            s.copy(answering = a.copy(answers = a.answers + (action.playerId to action.hasDone)))
        }

        is NhieAction.PassToNext -> {
            val a = s.answering
            if (s.phase != NhiePhase.ANSWERING || a == null) return s
            val cursor = minOf(a.cursor + 1, a.queue.size)
            if (cursor == a.cursor) return s
            s.copy(answering = a.copy(cursor = cursor))
        }

        is NhieAction.SetHonorHaves -> {
            val a = s.answering
            if (s.phase != NhiePhase.ANSWERING || a == null) return s
            val alive = aliveIds(s).toHashSet()
            val answers = LinkedHashMap<String, Boolean>()
            action.playerIds.forEach { id -> if (id in alive) answers[id] = true }
            s.copy(answering = a.copy(answers = answers))
        }

        is NhieAction.ResolveRound -> {
            val a = s.answering
            if (s.phase != NhiePhase.ANSWERING || a == null) return s
            val haveIds = a.answers.filter { it.value }.keys.toList()
            val participantIds = aliveIds(s)
            val livesLost = LinkedHashMap<String, Int>()
            val newlyEliminated = mutableListOf<String>()
            val players = s.players.map { p ->
                if (p.id !in haveIds || p.eliminated) return@map p
                val haveCount = p.haveCount + 1
                if (s.options.mode == NhieMode.CLASSIC) {
                    val lives = p.lives - 1
                    livesLost[p.id] = 1
                    val eliminated = lives <= 0
                    if (eliminated) newlyEliminated += p.id
                    p.copy(
                        haveCount = haveCount,
                        lives = lives,
                        eliminated = eliminated,
                        eliminatedAtRound = if (eliminated) s.roundIndex else p.eliminatedAtRound,
                    )
                } else {
                    p.copy(haveCount = haveCount)
                }
            }
            val round = RoundRecord(
                index = s.roundIndex,
                statementId = s.currentStatementId ?: "",
                haveIds = haveIds,
                participantIds = participantIds,
            )
            val next = s.copy(
                players = players,
                rounds = s.rounds + round,
                answering = null,
                lastResult = LastResult(haveIds = haveIds, livesLost = livesLost, newlyEliminated = newlyEliminated),
                phase = NhiePhase.REVEAL,
            )
            applyGameOverIfAny(next)
        }

        is NhieAction.NextStatement -> {
            if (s.phase != NhiePhase.REVEAL) return s
            if (s.finished) return s.copy(phase = NhiePhase.RESULTS)
            advanceStatement(s).copy(roundIndex = s.roundIndex + 1)
        }

        is NhieAction.SkipStatement -> {
            if (s.phase != NhiePhase.STATEMENT && s.phase != NhiePhase.REVEAL) return s
            advanceStatement(s) // no roundIndex change
        }

        is NhieAction.EndGame -> {
            if (s.phase == NhiePhase.RESULTS) return s
            s.copy(phase = NhiePhase.RESULTS, finished = true, winnerIds = computeWinners(s))
        }
    }
}

// ──────────────────────────── Pure selectors ────────────────────────────

fun currentHolder(s: NhieState): String? =
    if (s.answering != null && s.options.revealMode == RevealMode.SEQUENTIAL)
        s.answering.queue.getOrNull(s.answering.cursor)
    else null

fun allAnswered(s: NhieState): Boolean =
    s.answering != null && s.answering.cursor >= s.answering.queue.size

fun honorHaveCount(s: NhieState): Int =
    s.answering?.answers?.values?.count { it } ?: 0
