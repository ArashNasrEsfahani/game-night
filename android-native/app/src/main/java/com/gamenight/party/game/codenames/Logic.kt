package com.gamenight.party.game.codenames

import com.gamenight.party.engine.Rng
import com.gamenight.party.engine.deriveSeed
import com.gamenight.party.model.LocalizedString

/**
 * PURE game logic for "Codenames" — a faithful Kotlin port of src/games/codenames/logic.ts. No
 * clock / RNG / IO except the [seed] threaded into [createInitialState] via [Rng]. Side effects
 * (sound/haptics/clock) live in the Compose layer. Win conditions, phases and the forgive-one-wrong
 * rule mirror the web reducer exactly.
 */

/** The two sides. (Web: `TeamId = 'teamA' | 'teamB'`.) */
enum class TeamId { TEAM_A, TEAM_B }

/** What a board cell belongs to. (Web: `CardRole`.) */
enum class CardRole { TEAM_A, TEAM_B, NEUTRAL, ASSASSIN }

enum class CodenamesPhase {
    ORIENTATION,
    SPYMASTER_HANDOFF,
    CLUE,
    GUESSER_HANDOFF,
    GUESSING,
    TURN_END,
    GAME_OVER,
    ERROR,
}

enum class GuessOutcome { CORRECT, WRONG_TEAM, NEUTRAL, ASSASSIN }

/** Why a turn ended. (Web: union | null; here null = "none yet".) */
enum class TurnEndReason { GUESSED_WRONG, USED_ALL_GUESSES, STOPPED, TIME_UP }

enum class WinReason { CLEARED_WORDS, OPPONENT_HIT_ASSASSIN }

enum class CnErrorCode { BAD_TEAMS, SMALL_POOL }

data class BoardCell(
    val index: Int,
    val word: LocalizedString,
    val wordId: String,
    val role: CardRole,
    val revealed: Boolean,
)

data class ClueRecord(
    val team: TeamId,
    val count: Int,
    val guessesAllowed: Int,
    val guessesMade: Int,
)

data class TeamMeta(
    val name: String,
    val spymasterId: String,
    val memberIds: List<String>,
)

data class LastReveal(
    val cellIndex: Int,
    val role: CardRole,
    val outcome: GuessOutcome,
)

data class CodenamesState(
    val phase: CodenamesPhase,
    val finished: Boolean,
    val mode: CodenamesMode,
    val turnSeconds: Int,
    val allowBonusGuess: Boolean,
    val forgiveFirstWrong: Boolean,
    /** Wrong guesses made in the current turn (reset each clue). One is forgiven if enabled. */
    val wrongGuessesThisTurn: Int,
    val board: List<BoardCell>,
    /** Quarter-turns (0–3) the first team rotated the random key before play. */
    val orientation: Int,
    val startingTeam: TeamId,
    val currentTeam: TeamId,
    val remaining: Map<TeamId, Int>,
    val activeClue: ClueRecord?,
    val clueLog: List<ClueRecord>,
    val lastReveal: LastReveal?,
    val turnEndReason: TurnEndReason?,
    val winner: TeamId?,
    val loser: TeamId?,
    val winReason: WinReason?,
    val teamMeta: Map<TeamId, TeamMeta>,
    val playerNames: Map<String, String>,
    val boardSerial: Int,
    val errorCode: CnErrorCode?,
)

sealed interface CodenamesAction {
    data class ChooseOrientation(val rotation: Int) : CodenamesAction
    data object RevealKeyToSpymaster : CodenamesAction
    data class GiveClue(val count: Int) : CodenamesAction
    data object HandoffToGuessers : CodenamesAction
    data class GuessCell(val cellIndex: Int) : CodenamesAction
    data object StopGuessing : CodenamesAction
    data object TimerExpired : CodenamesAction
    data object AdvanceTurn : CodenamesAction
    data object EndGame : CodenamesAction
}

// ──────────────────────────── Helpers ────────────────────────────

internal fun other(t: TeamId): TeamId = if (t == TeamId.TEAM_A) TeamId.TEAM_B else TeamId.TEAM_A

/** The CardRole that a team owns. */
internal fun TeamId.asRole(): CardRole = if (this == TeamId.TEAM_A) CardRole.TEAM_A else CardRole.TEAM_B

/** The team a role belongs to, or null for neutral/assassin. */
internal fun CardRole.asTeamOrNull(): TeamId? = when (this) {
    CardRole.TEAM_A -> TeamId.TEAM_A
    CardRole.TEAM_B -> TeamId.TEAM_B
    else -> null
}

private fun keyComposition(start: TeamId): List<CardRole> {
    val startRole = start.asRole()
    val otherRole = other(start).asRole()
    return buildList {
        repeat(9) { add(startRole) }
        repeat(8) { add(otherRole) }
        repeat(7) { add(CardRole.NEUTRAL) }
        add(CardRole.ASSASSIN)
    }
}

private const val BOARD_N = 5

/**
 * Rotate a 25-length, row-major role grid clockwise by [k] quarter-turns. The WORDS never move
 * (they're fixed on the table) — only the key (roles) rotates, exactly like turning a key card.
 */
fun rotateRoles(roles: List<CardRole>, k: Int): List<CardRole> {
    val turns = ((k % 4) + 4) % 4
    var out = roles
    repeat(turns) {
        val next = out.toMutableList() // every index is overwritten below
        for (r in 0 until BOARD_N) {
            for (c in 0 until BOARD_N) {
                next[r * BOARD_N + c] = out[(BOARD_N - 1 - c) * BOARD_N + r]
            }
        }
        out = next
    }
    return out
}

/** Build the 25-cell board: words shuffled by [seed], roles shuffled by a derived seed. */
fun generateBoard(pool: List<CnWordEntry>, start: TeamId, seed: Int): List<BoardCell> {
    val words = Rng(seed).shuffle(pool).take(25)
    val roles = Rng(deriveSeed(seed, 1)).shuffle(keyComposition(start))
    return words.mapIndexed { i, w ->
        BoardCell(index = i, word = w.text, wordId = w.id, role = roles[i], revealed = false)
    }
}

// ──────────────────────────── Initial state ────────────────────────────

fun createInitialState(config: CodenamesConfig, seed: Int): CodenamesState {
    val options = config.options
    val playerNames: Map<String, String> = config.players.associate { it.id to it.name }

    val teams = config.teams
    val pool = config.content.mergedPool(options.packIds)
    val badTeams = teams.size != 2 || teams.any { it.memberIds.size < 2 }
    val errorCode: CnErrorCode? = when {
        badTeams -> CnErrorCode.BAD_TEAMS
        pool.size < 25 -> CnErrorCode.SMALL_POOL
        else -> null
    }

    val a = teams.getOrNull(0)
    val b = teams.getOrNull(1)
    val teamMeta = mapOf(
        TeamId.TEAM_A to TeamMeta(
            name = a?.name?.resolve(config.lang) ?: "Red",
            spymasterId = a?.memberIds?.getOrNull(0) ?: "",
            memberIds = a?.memberIds ?: emptyList(),
        ),
        TeamId.TEAM_B to TeamMeta(
            name = b?.name?.resolve(config.lang) ?: "Blue",
            spymasterId = b?.memberIds?.getOrNull(0) ?: "",
            memberIds = b?.memberIds ?: emptyList(),
        ),
    )

    val start: TeamId = when (options.startingTeam) {
        StartingTeam.RANDOM -> if (Rng(seed).int(0, 1) == 0) TeamId.TEAM_A else TeamId.TEAM_B
        StartingTeam.TEAM_A -> TeamId.TEAM_A
        StartingTeam.TEAM_B -> TeamId.TEAM_B
    }

    val board = if (errorCode != null) emptyList() else generateBoard(pool, start, seed)

    return CodenamesState(
        phase = when {
            errorCode != null -> CodenamesPhase.ERROR
            options.chooseOrientation -> CodenamesPhase.ORIENTATION
            else -> CodenamesPhase.SPYMASTER_HANDOFF
        },
        finished = false,
        mode = options.mode,
        turnSeconds = options.turnSeconds,
        allowBonusGuess = options.allowBonusGuess,
        forgiveFirstWrong = options.forgiveFirstWrong,
        wrongGuessesThisTurn = 0,
        board = board,
        orientation = 0,
        startingTeam = start,
        currentTeam = start,
        remaining = mapOf(
            TeamId.TEAM_A to if (start == TeamId.TEAM_A) 9 else 8,
            TeamId.TEAM_B to if (start == TeamId.TEAM_B) 9 else 8,
        ),
        activeClue = null,
        clueLog = emptyList(),
        lastReveal = null,
        turnEndReason = null,
        winner = null,
        loser = null,
        winReason = null,
        teamMeta = teamMeta,
        playerNames = playerNames,
        boardSerial = 0,
        errorCode = errorCode,
    )
}

// ──────────────────────────── Reducer ────────────────────────────

private fun applyGuess(s: CodenamesState, cellIndex: Int): CodenamesState {
    val cell = s.board.getOrNull(cellIndex)
    val activeClue0 = s.activeClue
    if (cell == null || cell.revealed || activeClue0 == null) return s

    val board = s.board.map { if (it.index == cellIndex) it.copy(revealed = true) else it }
    val activeClue = activeClue0.copy(guessesMade = activeClue0.guessesMade + 1)
    val outcome: GuessOutcome = when {
        cell.role.asTeamOrNull() == s.currentTeam -> GuessOutcome.CORRECT
        cell.role == CardRole.ASSASSIN -> GuessOutcome.ASSASSIN
        cell.role == CardRole.NEUTRAL -> GuessOutcome.NEUTRAL
        else -> GuessOutcome.WRONG_TEAM
    }

    val remaining = s.remaining.toMutableMap()
    cell.role.asTeamOrNull()?.let { remaining[it] = (remaining[it] ?: 0) - 1 }

    val base = s.copy(
        board = board,
        activeClue = activeClue,
        remaining = remaining,
        lastReveal = LastReveal(cellIndex = cellIndex, role = cell.role, outcome = outcome),
    )

    if (outcome == GuessOutcome.ASSASSIN) {
        return base.copy(
            phase = CodenamesPhase.GAME_OVER,
            finished = true,
            loser = s.currentTeam,
            winner = other(s.currentTeam),
            winReason = WinReason.OPPONENT_HIT_ASSASSIN,
        )
    }
    if (outcome == GuessOutcome.CORRECT) {
        if (remaining[s.currentTeam] == 0) {
            return base.copy(
                phase = CodenamesPhase.GAME_OVER,
                finished = true,
                winner = s.currentTeam,
                winReason = WinReason.CLEARED_WORDS,
            )
        }
        if (activeClue.guessesMade >= activeClue.guessesAllowed) {
            return base.copy(phase = CodenamesPhase.TURN_END, turnEndReason = TurnEndReason.USED_ALL_GUESSES)
        }
        return base // keep guessing
    }
    // wrongTeam or neutral
    val ownerTeam = cell.role.asTeamOrNull()
    if (ownerTeam != null && remaining[ownerTeam] == 0) {
        return base.copy(
            phase = CodenamesPhase.GAME_OVER,
            finished = true,
            winner = ownerTeam,
            winReason = WinReason.CLEARED_WORDS,
        )
    }
    // Forgive the first wrong guess of the turn: keep guessing and grant one extra guess so a single
    // mistake doesn't eat into the clue. A second wrong guess (or the assassin) ends the turn.
    if (s.forgiveFirstWrong && s.wrongGuessesThisTurn < 1) {
        return base.copy(
            wrongGuessesThisTurn = s.wrongGuessesThisTurn + 1,
            activeClue = activeClue.copy(guessesAllowed = activeClue.guessesAllowed + 1),
        )
    }
    return base.copy(phase = CodenamesPhase.TURN_END, turnEndReason = TurnEndReason.GUESSED_WRONG)
}

fun reducer(state: CodenamesState, action: CodenamesAction): CodenamesState {
    val s = state
    return when (action) {
        is CodenamesAction.ChooseOrientation -> {
            if (s.phase != CodenamesPhase.ORIENTATION) return s
            val turns = ((action.rotation % 4) + 4) % 4
            val rotated = rotateRoles(s.board.map { it.role }, turns)
            val board = s.board.mapIndexed { i, c -> c.copy(role = rotated[i]) }
            s.copy(board = board, orientation = turns, phase = CodenamesPhase.SPYMASTER_HANDOFF)
        }

        CodenamesAction.RevealKeyToSpymaster -> {
            if (s.phase != CodenamesPhase.SPYMASTER_HANDOFF) return s
            s.copy(phase = CodenamesPhase.CLUE)
        }

        is CodenamesAction.GiveClue -> {
            if (s.phase != CodenamesPhase.CLUE) return s
            val max = s.remaining[s.currentTeam] ?: 0
            val count = action.count.coerceIn(0, maxOf(0, max))
            val guessesAllowed = if (count == 0) max else count + (if (s.allowBonusGuess) 1 else 0)
            val clue = ClueRecord(team = s.currentTeam, count = count, guessesAllowed = guessesAllowed, guessesMade = 0)
            s.copy(
                phase = CodenamesPhase.GUESSER_HANDOFF,
                activeClue = clue,
                clueLog = s.clueLog + clue,
                wrongGuessesThisTurn = 0,
            )
        }

        CodenamesAction.HandoffToGuessers -> {
            if (s.phase != CodenamesPhase.GUESSER_HANDOFF) return s
            s.copy(phase = CodenamesPhase.GUESSING)
        }

        is CodenamesAction.GuessCell -> {
            if (s.phase != CodenamesPhase.GUESSING) return s
            applyGuess(s, action.cellIndex)
        }

        CodenamesAction.StopGuessing -> {
            val clue = s.activeClue
            if (s.phase != CodenamesPhase.GUESSING || clue == null || clue.guessesMade < 1) return s
            s.copy(phase = CodenamesPhase.TURN_END, turnEndReason = TurnEndReason.STOPPED)
        }

        CodenamesAction.TimerExpired -> {
            if (s.phase != CodenamesPhase.GUESSING) return s
            s.copy(phase = CodenamesPhase.TURN_END, turnEndReason = TurnEndReason.TIME_UP)
        }

        CodenamesAction.AdvanceTurn -> {
            if (s.phase != CodenamesPhase.TURN_END) return s
            s.copy(
                phase = CodenamesPhase.SPYMASTER_HANDOFF,
                currentTeam = other(s.currentTeam),
                activeClue = null,
                lastReveal = null,
                turnEndReason = null,
                wrongGuessesThisTurn = 0,
            )
        }

        CodenamesAction.EndGame -> {
            // End the match now and show the results with the standings so far: the team closest to
            // clearing its words (fewer remaining) is the winner; an exact tie has no winner.
            // winReason stays null so the Results screen knows this was a manual early end.
            if (s.finished || s.phase == CodenamesPhase.ERROR) return s
            val a = s.remaining[TeamId.TEAM_A] ?: 0
            val b = s.remaining[TeamId.TEAM_B] ?: 0
            val winner: TeamId? = when {
                a < b -> TeamId.TEAM_A
                b < a -> TeamId.TEAM_B
                else -> null
            }
            s.copy(
                phase = CodenamesPhase.GAME_OVER,
                finished = true,
                winner = winner,
                loser = winner?.let { other(it) },
                winReason = null,
            )
        }
    }
}

// ──────────────────────────── Pure selectors ────────────────────────────

fun currentSpymasterId(s: CodenamesState): String = s.teamMeta.getValue(s.currentTeam).spymasterId

fun currentTeamName(s: CodenamesState): String = s.teamMeta.getValue(s.currentTeam).name

fun guessesLeft(s: CodenamesState): Int =
    s.activeClue?.let { maxOf(0, it.guessesAllowed - it.guessesMade) } ?: 0
