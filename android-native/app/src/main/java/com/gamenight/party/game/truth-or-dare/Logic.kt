package com.gamenight.party.game.truthordare

import com.gamenight.party.engine.DeckState
import com.gamenight.party.engine.RevealGateState
import com.gamenight.party.engine.Rng
import com.gamenight.party.engine.ScoreState
import com.gamenight.party.engine.add
import com.gamenight.party.engine.asPlayerId
import com.gamenight.party.engine.create
import com.gamenight.party.engine.deriveSeed
import com.gamenight.party.engine.discard
import com.gamenight.party.engine.draw
import com.gamenight.party.engine.holder
import com.gamenight.party.engine.init
import com.gamenight.party.engine.reveal
import com.gamenight.party.engine.total
import com.gamenight.party.model.ColorToken

/**
 * PURE logic for "Truth or Dare" — a faithful Kotlin port of src/games/truth-or-dare/logic.ts.
 *
 * No clock / RNG / IO here: seeds arrive on the actions (or [createInitialState]); the Compose layer
 * owns the impure boundary (sound, haptics, seed generation). The web reducer reads a module-global
 * `PROMPT_BY_ID` for a prompt's intensity; to keep this reducer self-contained and pure, that lookup
 * is captured into [ToDState.intensityById] at init time instead.
 */

enum class ToDPhase { IDLE, CHOOSING, REVEALING, RESOLVING, GAME_OVER, ERROR }

enum class Outcome { DONE, SKIP }

enum class ToDErrorCode { EMPTY_POOL, NOT_ENOUGH_PLAYERS }

/** One completed turn, appended to [ToDState.history] (src `TurnRecord`). */
data class TurnRecord(
    val turnIndex: Int,
    val playerId: String,
    val kind: PromptKind,
    val promptId: String,
    val intensity: Intensity,
    val outcome: Outcome,
    val pointsDelta: Int,
)

/** The whole game state (src `ToDState`, which extends `GameStateBase` with `v` + `finished`). */
data class ToDState(
    val v: Int = 1,
    val finished: Boolean = false,
    val phase: ToDPhase,
    val options: ToDOptions,
    val playerIds: List<String>,
    val playerNames: Map<String, String>,
    val playerColors: Map<String, ColorToken?>,
    val activePlayerId: String? = null,
    val lastPlayerId: String? = null,
    /** sequential rotation pointer. */
    val cursor: Int = -1,
    val currentKind: PromptKind? = null,
    val currentPromptId: String? = null,
    val truthDeck: DeckState<String>,
    val dareDeck: DeckState<String>,
    val scores: ScoreState,
    val reveal: RevealGateState? = null,
    val turnIndex: Int = 0,
    val roundIndex: Int = 0,
    val spinSerial: Int = 0,
    val history: List<TurnRecord> = emptyList(),
    val endReason: EndType? = null,
    val errorCode: ToDErrorCode? = null,
    /** Localized mirror of the web's `PROMPT_BY_ID[id].intensity`, covering both active pools. */
    val intensityById: Map<String, Intensity> = emptyMap(),
)

/** src `ToDAction`. */
sealed interface ToDAction {
    data class Spin(val seed: Int) : ToDAction
    data object NextPlayer : ToDAction
    data class Choose(val kind: PromptKind, val seed: Int) : ToDAction
    data object Reveal : ToDAction
    data class Resolve(val outcome: Outcome) : ToDAction
    data class Redraw(val seed: Int) : ToDAction
    data object EndGame : ToDAction
}

/** src `pickSpinTarget`. Deterministic given the seed; avoids the last player when possible. */
fun pickSpinTarget(
    playerIds: List<String>,
    lastPlayerId: String?,
    avoid: Boolean,
    seed: Int,
): String {
    var candidates = playerIds
    if (avoid && playerIds.size > 1 && lastPlayerId != null) {
        val filtered = playerIds.filter { it != lastPlayerId }
        if (filtered.isNotEmpty()) candidates = filtered
    }
    return Rng(seed).pick(candidates)
}

private fun shouldGate(options: ToDOptions, intensity: Intensity): Boolean = when (options.privateReveal) {
    PrivateReveal.ALWAYS -> true
    PrivateReveal.SPICY_ONLY -> intensity == Intensity.SPICY
    PrivateReveal.NEVER -> false
}

private fun computeDelta(options: ToDOptions, kind: PromptKind, outcome: Outcome): Int {
    if (options.scoringMode != ScoringMode.POINTS) return 0
    if (outcome == Outcome.SKIP) return options.pointsForSkip
    return if (kind == PromptKind.DARE) options.pointsForDare else options.pointsForTruth
}

private fun evalEnd(options: ToDOptions, scores: ScoreState, roundIndex: Int): EndType? = when (options.endType) {
    EndType.ROUNDS -> if (roundIndex >= options.endValue) EndType.ROUNDS else null
    EndType.TARGET -> {
        if (options.scoringMode != ScoringMode.POINTS) {
            null
        } else {
            val max = (scores.totals.values + 0).maxOrNull() ?: 0
            if (max >= options.endValue) EndType.TARGET else null
        }
    }
    EndType.ENDLESS -> null
}

/** Draw one prompt id off [d], discarding it back so the deck recycles after exhaustion. */
private fun drawPrompt(d: DeckState<String>, seed: Int): Pair<String?, DeckState<String>> {
    val r = draw(d, 1, seed)
    val promptId = r.drawn.firstOrNull()
    val next = if (promptId != null) discard(r.deck, promptId) else r.deck
    return promptId to next
}

/** src `createInitialState`. Content is fed in (web reads it from a module global). */
fun createInitialState(content: ToDContent, config: ToDConfig, seed: Int): ToDState {
    val options = readOptions(config)
    val playerIds = config.players.map { it.id }
    val playerNames = config.players.associate { it.id to it.name }
    val playerColors = config.players.associate { it.id to it.color }

    val pc = maxOf(2, playerIds.size)
    val truthPool = content.getPool(PromptKind.TRUTH, options.intensities, pc)
    val darePool = content.getPool(PromptKind.DARE, options.intensities, pc)

    val errorCode = when {
        playerIds.size < 2 -> ToDErrorCode.NOT_ENOUGH_PLAYERS
        truthPool.isEmpty() || darePool.isEmpty() -> ToDErrorCode.EMPTY_POOL
        else -> null
    }

    val intensityById = (truthPool + darePool).associate { it.id to it.intensity }

    return ToDState(
        v = 1,
        phase = if (errorCode != null) ToDPhase.ERROR else ToDPhase.IDLE,
        finished = false,
        options = options,
        playerIds = playerIds,
        playerNames = playerNames,
        playerColors = playerColors,
        activePlayerId = null,
        lastPlayerId = null,
        cursor = -1,
        currentKind = null,
        currentPromptId = null,
        truthDeck = create(truthPool.map { it.id }, seed),
        dareDeck = create(darePool.map { it.id }, deriveSeed(seed, 1)),
        scores = create(playerIds),
        reveal = null,
        turnIndex = 0,
        roundIndex = 0,
        spinSerial = 0,
        history = emptyList(),
        endReason = null,
        errorCode = errorCode,
        intensityById = intensityById,
    )
}

private fun startTurn(s: ToDState, target: String): ToDState = s.copy(
    phase = ToDPhase.CHOOSING,
    lastPlayerId = s.activePlayerId,
    activePlayerId = target,
    currentKind = null,
    currentPromptId = null,
    reveal = null,
    spinSerial = s.spinSerial + 1,
)

private fun drawInto(s: ToDState, kind: PromptKind, seed: Int): ToDState {
    val isTruth = kind == PromptKind.TRUTH
    val sourceDeck = if (isTruth) s.truthDeck else s.dareDeck
    val (promptId, nextDeck) = drawPrompt(sourceDeck, seed)
    if (promptId == null) return s
    val intensity = s.intensityById[promptId] ?: Intensity.MILD
    val gate = shouldGate(s.options, intensity)
    return s.copy(
        currentKind = kind,
        currentPromptId = promptId,
        truthDeck = if (isTruth) nextDeck else s.truthDeck,
        dareDeck = if (isTruth) s.dareDeck else nextDeck,
        reveal = if (gate) init(listOf(asPlayerId(s.activePlayerId ?: ""))) else null,
        phase = if (gate) ToDPhase.REVEALING else ToDPhase.RESOLVING,
    )
}

/** src `reducer`. Pure: same input always yields the same output. */
fun reducer(state: ToDState, action: ToDAction): ToDState {
    val s = state
    return when (action) {
        is ToDAction.Spin -> {
            if (s.phase != ToDPhase.IDLE ||
                (s.options.selectionMode != SelectionMode.SPINNER && s.options.selectionMode != SelectionMode.BOTTLE)
            ) {
                s
            } else {
                val target = pickSpinTarget(s.playerIds, s.lastPlayerId, s.options.avoidImmediateRepeat, action.seed)
                startTurn(s, target)
            }
        }

        is ToDAction.NextPlayer -> {
            if (s.phase != ToDPhase.IDLE || s.options.selectionMode != SelectionMode.SEQUENTIAL || s.playerIds.isEmpty()) {
                s
            } else {
                val cursor = (s.cursor + 1) % s.playerIds.size
                startTurn(s, s.playerIds[cursor]).copy(cursor = cursor)
            }
        }

        is ToDAction.Choose -> {
            if (s.phase != ToDPhase.CHOOSING || s.activePlayerId == null) s
            else drawInto(s, action.kind, action.seed)
        }

        is ToDAction.Reveal -> {
            val rev = s.reveal
            if (s.phase != ToDPhase.REVEALING || rev == null) s
            else s.copy(reveal = reveal(rev), phase = ToDPhase.RESOLVING)
        }

        is ToDAction.Redraw -> {
            val kind = s.currentKind
            if ((s.phase != ToDPhase.REVEALING && s.phase != ToDPhase.RESOLVING) || kind == null) s
            else drawInto(s, kind, action.seed)
        }

        is ToDAction.Resolve -> {
            val active = s.activePlayerId
            val kind = s.currentKind
            val promptId = s.currentPromptId
            val okPhase =
                s.phase == ToDPhase.RESOLVING || (s.phase == ToDPhase.REVEALING && action.outcome == Outcome.SKIP)
            if (!okPhase || active == null || kind == null || promptId == null) {
                s
            } else {
                val intensity = s.intensityById[promptId] ?: Intensity.MILD
                val delta = computeDelta(s.options, kind, action.outcome)
                val reason = if (action.outcome == Outcome.SKIP) "skip" else "done"
                val scores = add(s.scores, active, delta, reason, 0L)
                val record = TurnRecord(
                    turnIndex = s.turnIndex,
                    playerId = active,
                    kind = kind,
                    promptId = promptId,
                    intensity = intensity,
                    outcome = action.outcome,
                    pointsDelta = delta,
                )
                val turnIndex = s.turnIndex + 1
                val roundIndex = if (turnIndex % s.playerIds.size == 0) s.roundIndex + 1 else s.roundIndex
                val endReason = evalEnd(s.options, scores, roundIndex)
                s.copy(
                    scores = scores,
                    history = s.history + record,
                    turnIndex = turnIndex,
                    roundIndex = roundIndex,
                    currentKind = null,
                    currentPromptId = null,
                    reveal = null,
                    phase = if (endReason != null) ToDPhase.GAME_OVER else ToDPhase.IDLE,
                    endReason = endReason,
                    finished = endReason != null,
                )
            }
        }

        is ToDAction.EndGame -> {
            if (s.phase == ToDPhase.GAME_OVER) s
            else s.copy(phase = ToDPhase.GAME_OVER, endReason = EndType.ENDLESS, finished = true)
        }
    }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

/** One ranked row (src `ToDStanding`). */
data class ToDStanding(val id: String, val score: Int, val rank: Int)

/** src `standings` — total desc, original seat order as the tiebreak, with dense-ish ranking. */
fun standings(s: ToDState): List<ToDStanding> {
    val order = s.playerIds.withIndex().associate { (i, id) -> id to i }
    val sorted = s.playerIds.sortedWith(
        compareByDescending<String> { total(s.scores, it) }.thenBy { order[it] ?: 0 },
    )
    var rank = 0
    var prev: Int? = null
    return sorted.mapIndexed { i, id ->
        val sc = total(s.scores, id)
        if (sc != prev) {
            rank = i + 1
            prev = sc
        }
        ToDStanding(id, sc, rank)
    }
}

/** src `computeWinners` — only meaningful in points mode (everyone tied at rank 1). */
fun computeWinners(s: ToDState): List<String> {
    if (s.options.scoringMode != ScoringMode.POINTS) return emptyList()
    return standings(s).filter { it.rank == 1 }.map { it.id }
}

/** src `nextSequentialId`. */
fun nextSequentialId(s: ToDState): String =
    if (s.playerIds.isEmpty()) "" else s.playerIds[(s.cursor + 1) % s.playerIds.size]

/** src `promptRevealed`. */
fun promptRevealed(s: ToDState): Boolean {
    val rev = s.reveal
    return s.phase == ToDPhase.RESOLVING || (rev != null && holder(rev) == null)
}
