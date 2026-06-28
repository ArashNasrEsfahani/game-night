package com.gamenight.party.game.pantomime

import com.gamenight.party.engine.DeckState
import com.gamenight.party.engine.PhaseMachine
import com.gamenight.party.engine.PhaseNode
import com.gamenight.party.engine.RevealGateState
import com.gamenight.party.engine.ScoreState
import com.gamenight.party.engine.Standing
import com.gamenight.party.engine.TimerMode
import com.gamenight.party.engine.TimerState
import com.gamenight.party.engine.TurnMode
import com.gamenight.party.engine.TurnOrderState
import com.gamenight.party.engine.add
import com.gamenight.party.engine.asPlayerId
import com.gamenight.party.engine.create
import com.gamenight.party.engine.defineMachine
import com.gamenight.party.engine.discard
import com.gamenight.party.engine.draw
import com.gamenight.party.engine.fromScores
import com.gamenight.party.engine.go
import com.gamenight.party.engine.init
import com.gamenight.party.engine.isExpired
import com.gamenight.party.engine.next
import com.gamenight.party.engine.pause
import com.gamenight.party.engine.reveal
import com.gamenight.party.engine.start
import com.gamenight.party.engine.tick
import com.gamenight.party.engine.total
import com.gamenight.party.model.ColorToken

/**
 * PURE game logic for Pantomime — a faithful Kotlin port of src/games/pantomime/logic.ts. No
 * clock / RNG / IO: timestamps (`now`) and shuffle seeds arrive in actions / [createInitialState].
 * Side effects (sound/haptics/the wall clock) live in the Compose layer, never here. No-op cases
 * return the SAME state instance to mirror the web reducer's `=== input` semantics.
 */

enum class PantomimePhase {
    HANDOFF, // "Pass the phone to <Actor> of <Team>"
    REVEAL,  // gate closed: actor taps to privately read the prompt
    ACTING,  // prompt revealed, timer running, team guessing
    TURN_END, // turn over: show turn summary
    RESULTS, // game over
    ERROR,   // bad config / empty pool (never reachable from a valid Setup)
}

enum class TurnEndReason { TIME_EXPIRED, DECK_EXHAUSTED, MANUAL_END }

enum class TurnResult { CORRECT, SKIP }

enum class PantomimeErrorCode { EMPTY_DECK, BAD_TEAMS }

data class TurnEvent(val promptId: String, val result: TurnResult)

data class PantomimeTeamState(
    val teamId: String,
    val name: String,
    val color: ColorToken? = null,
    val playerIds: List<String>,
    /** Index into [playerIds] of who acts on this team's NEXT turn. */
    val actorCursor: Int,
    val correctCount: Int,
    val skipCount: Int,
)

data class PantomimeTurnRecord(
    val turnIndex: Int, // global, 0-based
    val roundIndex: Int, // 0-based
    val teamId: String,
    val actorId: String,
    val correct: Int,
    val skipped: Int,
    val endReason: TurnEndReason,
    val promptIds: List<String>, // resolved this turn (correct + skipped)
)

data class PantomimeState(
    val v: Int = 1,
    val phase: PantomimePhase,
    val finished: Boolean,
    val options: PantomimeOptions,
    val playerNames: Map<String, String>,
    /** Teams in fixed turn order. */
    val teams: List<PantomimeTeamState>,
    /** Turn order over teamIds (index = active team, round = completed cycles). */
    val turn: TurnOrderState,
    val deck: DeckState<String>,
    val currentPromptId: String?,
    val gate: RevealGateState,
    val clock: TimerState,
    val turnCorrect: Int,
    val turnSkipped: Int,
    val turnEvents: List<TurnEvent>,
    val lastTurnEndReason: TurnEndReason?,
    val history: List<PantomimeTurnRecord>,
    val score: ScoreState, // keyed by teamId
    /** Set when a target-score end condition fires; the round still finishes (fairness). */
    val endRequested: Boolean,
    val winnerTeamIds: List<String>,
    val errorCode: PantomimeErrorCode?,
)

sealed interface PantomimeAction {
    data object HandoffReady : PantomimeAction
    data object Reveal : PantomimeAction
    data class StartActing(val now: Long) : PantomimeAction
    data class Tick(val now: Long) : PantomimeAction
    data object Correct : PantomimeAction
    data object Skip : PantomimeAction
    data class Pause(val now: Long) : PantomimeAction
    data class Resume(val now: Long) : PantomimeAction
    data class EndTurnEarly(val now: Long) : PantomimeAction
    data class NextTurn(val seed: Int) : PantomimeAction
    data object Reset : PantomimeAction
}

private val MACHINE: PhaseMachine<PantomimePhase> = defineMachine(
    PhaseMachine(
        initial = PantomimePhase.HANDOFF,
        nodes = mapOf(
            PantomimePhase.HANDOFF to PhaseNode(PantomimePhase.HANDOFF, listOf(PantomimePhase.REVEAL, PantomimePhase.TURN_END)),
            PantomimePhase.REVEAL to PhaseNode(PantomimePhase.REVEAL, listOf(PantomimePhase.ACTING, PantomimePhase.TURN_END)),
            PantomimePhase.ACTING to PhaseNode(PantomimePhase.ACTING, listOf(PantomimePhase.TURN_END)),
            PantomimePhase.TURN_END to PhaseNode(PantomimePhase.TURN_END, listOf(PantomimePhase.HANDOFF, PantomimePhase.RESULTS)),
            PantomimePhase.RESULTS to PhaseNode(PantomimePhase.RESULTS, emptyList(), terminal = true),
            PantomimePhase.ERROR to PhaseNode(PantomimePhase.ERROR, emptyList(), terminal = true),
        ),
    ),
)

private val TEAM_COLORS: List<ColorToken> =
    listOf(ColorToken.ROSE, ColorToken.SKY, ColorToken.LIME, ColorToken.GOLD)

/** Seed used for in-game deck reshuffles. Deterministic (the initial shuffle uses the host seed). */
private const val DRAW_SEED: Int = 0

private fun drawNext(d: DeckState<String>): Pair<DeckState<String>, String?> {
    val r = draw(d, 1, DRAW_SEED)
    return r.deck to r.drawn.firstOrNull()
}

private fun updateTeam(
    teams: List<PantomimeTeamState>,
    index: Int,
    patch: (PantomimeTeamState) -> PantomimeTeamState,
): List<PantomimeTeamState> = teams.mapIndexed { i, t -> if (i == index) patch(t) else t }

// ──────────────────────────── Pure selectors ────────────────────────────

fun activeTeam(s: PantomimeState): PantomimeTeamState? = s.teams.getOrNull(s.turn.index)

fun actorId(s: PantomimeState): String {
    val team = s.teams.getOrNull(s.turn.index) ?: return ""
    return team.playerIds.getOrNull(team.actorCursor) ?: ""
}

fun actorName(s: PantomimeState): String = s.playerNames[actorId(s)] ?: ""

fun currentRound(s: PantomimeState): Int = s.turn.round + 1

/** Skips left this turn; [Int.MAX_VALUE] models the web's `Infinity` for unlimited skips. */
fun skipsLeft(s: PantomimeState): Int =
    if (s.options.maxSkipsPerTurn == -1) Int.MAX_VALUE else s.options.maxSkipsPerTurn - s.turnSkipped

fun selectStandings(s: PantomimeState): List<Standing> = fromScores(s.score).standings

fun selectWinners(s: PantomimeState): List<String> = fromScores(s.score).winners

fun teamLabel(s: PantomimeState, teamId: String): String =
    s.teams.firstOrNull { it.teamId == teamId }?.name ?: teamId

fun teamColor(s: PantomimeState, teamId: String): ColorToken? =
    s.teams.firstOrNull { it.teamId == teamId }?.color

// ──────────────────────────── Finalize / init ────────────────────────────

private fun finalizeTurn(s: PantomimeState, reason: TurnEndReason, now: Long): PantomimeState {
    val team = s.teams[s.turn.index]
    // Return any unresolved current prompt to the draw pile (not counted, not lost).
    var d = s.deck
    val current = s.currentPromptId
    if (current != null) {
        d = s.deck.copy(drawPile = s.deck.drawPile + current)
    }
    val record = PantomimeTurnRecord(
        turnIndex = s.history.size,
        roundIndex = s.turn.round,
        teamId = team.teamId,
        actorId = actorId(s),
        correct = s.turnCorrect,
        skipped = s.turnSkipped,
        endReason = reason,
        promptIds = s.turnEvents.map { it.promptId },
    )
    return s.copy(
        phase = PantomimePhase.TURN_END,
        deck = d,
        currentPromptId = null,
        lastTurnEndReason = reason,
        history = s.history + record,
        clock = pause(s.clock, now),
    )
}

fun createInitialState(config: PantomimeConfig, content: PantomimeContent, seed: Int): PantomimeState {
    val options = normalizeOptions(config.options)
    val playerNames: Map<String, String> = config.players.associate { it.id to it.name }

    val teams: List<PantomimeTeamState> = config.teams.mapIndexed { i, t ->
        PantomimeTeamState(
            teamId = t.id,
            name = t.name.ifBlank { "Team ${i + 1}" },
            color = TEAM_COLORS[i % TEAM_COLORS.size],
            playerIds = t.memberIds,
            actorCursor = 0,
            correctCount = 0,
            skipCount = 0,
        )
    }

    val pool = buildPool(content, options)
    val deckState = create(pool.map { it.id }, seed)
    val teamIds = teams.map { it.teamId }
    val turn = init(teamIds, TurnMode.CIRCULAR, seed)

    val badTeams = teams.size < 2 || teams.any { it.playerIds.size < 2 }
    val empty = pool.isEmpty()
    val errorCode: PantomimeErrorCode? = when {
        badTeams -> PantomimeErrorCode.BAD_TEAMS
        empty -> PantomimeErrorCode.EMPTY_DECK
        else -> null
    }

    return PantomimeState(
        v = 1,
        phase = if (errorCode != null) PantomimePhase.ERROR else PantomimePhase.HANDOFF,
        finished = false,
        options = options,
        playerNames = playerNames,
        teams = teams,
        turn = turn,
        deck = deckState,
        currentPromptId = null,
        gate = init(emptyList<String>()),
        clock = create(TimerMode.COUNTDOWN, options.roundSeconds * 1000L),
        turnCorrect = 0,
        turnSkipped = 0,
        turnEvents = emptyList(),
        lastTurnEndReason = null,
        history = emptyList(),
        score = create(teamIds),
        endRequested = false,
        winnerTeamIds = emptyList(),
        errorCode = errorCode,
    )
}

// ──────────────────────────── Reducer ────────────────────────────

fun reducer(state: PantomimeState, action: PantomimeAction): PantomimeState {
    val s = state
    return when (action) {
        is PantomimeAction.HandoffReady -> {
            if (s.phase != PantomimePhase.HANDOFF) return s
            val base = s.copy(
                turnCorrect = 0,
                turnSkipped = 0,
                turnEvents = emptyList(),
                lastTurnEndReason = null,
                gate = init(listOf(asPlayerId(actorId(s)))),
                clock = create(TimerMode.COUNTDOWN, s.options.roundSeconds * 1000L),
            )
            val (d, promptId) = drawNext(base.deck)
            if (promptId == null) {
                finalizeTurn(base.copy(currentPromptId = null), TurnEndReason.DECK_EXHAUSTED, 0L)
            } else {
                base.copy(
                    deck = d,
                    currentPromptId = promptId,
                    phase = go(MACHINE, s.phase, PantomimePhase.REVEAL),
                )
            }
        }

        is PantomimeAction.Reveal -> {
            if (s.phase != PantomimePhase.REVEAL) return s
            s.copy(gate = reveal(s.gate))
        }

        is PantomimeAction.StartActing -> {
            if (s.phase != PantomimePhase.REVEAL) return s
            s.copy(
                phase = go(MACHINE, s.phase, PantomimePhase.ACTING),
                clock = start(create(TimerMode.COUNTDOWN, s.options.roundSeconds * 1000L), action.now),
            )
        }

        is PantomimeAction.Tick -> {
            if (s.phase != PantomimePhase.ACTING) return s
            val clock = tick(s.clock, action.now)
            if (isExpired(clock, action.now)) {
                finalizeTurn(s.copy(clock = clock), TurnEndReason.TIME_EXPIRED, action.now)
            } else if (clock === s.clock) {
                s
            } else {
                s.copy(clock = clock)
            }
        }

        is PantomimeAction.Correct -> {
            val current = s.currentPromptId
            if (s.phase != PantomimePhase.ACTING || current == null) return s
            val teamIdx = s.turn.index
            val teamId = s.teams[teamIdx].teamId
            val turnEvents = s.turnEvents + TurnEvent(current, TurnResult.CORRECT)
            val teams = updateTeam(s.teams, teamIdx) { it.copy(correctCount = it.correctCount + 1) }
            val score = add(s.score, teamId, 1, "correct", 0L)
            val endRequested = s.endRequested ||
                (s.options.endMode == PantomimeEndMode.TARGET_SCORE && total(score, teamId) >= s.options.targetScore)
            val discarded = discard(s.deck, current)
            val (d, promptId) = drawNext(discarded)
            val next = s.copy(
                teams = teams,
                score = score,
                endRequested = endRequested,
                turnCorrect = s.turnCorrect + 1,
                turnEvents = turnEvents,
            )
            if (promptId == null) {
                finalizeTurn(next.copy(deck = d, currentPromptId = null), TurnEndReason.DECK_EXHAUSTED, 0L)
            } else {
                next.copy(deck = d, currentPromptId = promptId)
            }
        }

        is PantomimeAction.Skip -> {
            val current = s.currentPromptId
            if (s.phase != PantomimePhase.ACTING || current == null) return s
            // Skip-cap guard: no-op once the cap is reached (unless unlimited).
            if (s.options.maxSkipsPerTurn != -1 && s.turnSkipped >= s.options.maxSkipsPerTurn) return s
            val teamIdx = s.turn.index
            val teamId = s.teams[teamIdx].teamId
            val turnEvents = s.turnEvents + TurnEvent(current, TurnResult.SKIP)
            val teams = updateTeam(s.teams, teamIdx) { it.copy(skipCount = it.skipCount + 1) }
            var score = s.score
            if (s.options.skipPenalty && total(score, teamId) > 0) {
                score = add(score, teamId, -1, "skipPenalty", 0L)
            }
            val discarded = discard(s.deck, current)
            val (d, promptId) = drawNext(discarded)
            val next = s.copy(
                teams = teams,
                score = score,
                turnSkipped = s.turnSkipped + 1,
                turnEvents = turnEvents,
            )
            if (promptId == null) {
                finalizeTurn(next.copy(deck = d, currentPromptId = null), TurnEndReason.DECK_EXHAUSTED, 0L)
            } else {
                next.copy(deck = d, currentPromptId = promptId)
            }
        }

        is PantomimeAction.Pause -> {
            if (s.phase != PantomimePhase.ACTING) return s
            s.copy(clock = pause(s.clock, action.now))
        }

        is PantomimeAction.Resume -> {
            if (s.phase != PantomimePhase.ACTING) return s
            s.copy(clock = start(s.clock, action.now))
        }

        is PantomimeAction.EndTurnEarly -> {
            if (s.phase != PantomimePhase.ACTING) return s
            finalizeTurn(s, TurnEndReason.MANUAL_END, action.now)
        }

        is PantomimeAction.NextTurn -> {
            if (s.phase != PantomimePhase.TURN_END) return s
            val playedIdx = s.turn.index
            val teams = updateTeam(s.teams, playedIdx) {
                it.copy(actorCursor = if (it.playerIds.isNotEmpty()) (it.actorCursor + 1) % it.playerIds.size else 0)
            }
            val turn = next(s.turn, action.seed)
            val roundComplete = turn.index == 0 // wrapped back to the first team
            val finish = if (s.options.endMode == PantomimeEndMode.ROUNDS) {
                turn.round >= s.options.totalRounds
            } else {
                s.endRequested && roundComplete
            }
            if (finish) {
                val res = fromScores(s.score)
                s.copy(
                    teams = teams,
                    turn = turn,
                    phase = PantomimePhase.RESULTS,
                    finished = true,
                    winnerTeamIds = res.winners,
                )
            } else {
                s.copy(
                    teams = teams,
                    turn = turn,
                    phase = go(MACHINE, s.phase, PantomimePhase.HANDOFF),
                    currentPromptId = null,
                    turnCorrect = 0,
                    turnSkipped = 0,
                    turnEvents = emptyList(),
                    lastTurnEndReason = null,
                    gate = init(emptyList<String>()),
                    clock = create(TimerMode.COUNTDOWN, s.options.roundSeconds * 1000L),
                )
            }
        }

        is PantomimeAction.Reset -> s // no-op; "play again" is host-driven (re-create with a fresh seed)
    }
}
