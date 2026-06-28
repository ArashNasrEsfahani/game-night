package com.gamenight.party.game.dowr

import com.gamenight.party.engine.DeckState
import com.gamenight.party.engine.Rng
import com.gamenight.party.engine.create
import com.gamenight.party.engine.deriveSeed
import com.gamenight.party.engine.discard
import com.gamenight.party.engine.draw
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat
import kotlin.math.roundToInt

/**
 * PURE game logic for "Dowr" — a faithful Kotlin port of src/games/dowr/{config.ts,logic.ts,deck.ts}.
 *
 * A FAST, CONTINUOUS timed relay. N players in N/2 teams of two. The phone races around the teams:
 * one member describes a word (without saying it) while their teammate guesses. A stopwatch runs the
 * whole time. The instant the teammate gets it, the view dispatches [DowrAction.Advance] and the next
 * team's word appears immediately. A bomb fuse runs each word; if it blows first, the team eats the
 * elapsed time plus a penalty. Changing a word also costs penalty time. After every team has had
 * `rounds` turns, the team with the LOWEST total time wins (turns mode), or — in time mode — the team
 * with the MOST words when the shared clock runs out.
 *
 * Timing lives in the SCREEN, not here: the view measures each segment against the wall clock and
 * passes `segmentMs` into the action, so this reducer stays pure and the match survives a resume.
 * State only ever holds banked totals. No clock / Math.random except the [seed] threaded into actions
 * via [Rng]. Side effects (sound/haptics) live in the Compose layer.
 */

// ──────────────────────────── Config / options ────────────────────────────

/** How a match ends: a fixed number of turns per team, or a shared time budget. */
enum class DowrEndMode { TURNS, TIME }

/** Total game-time choices (seconds) for the 'time' end mode. Most words wins. */
val TIME_LIMIT_CHOICES: List<Int> = listOf(120, 180, 300, 420)

/** Bomb-fuse length choices (seconds). The describing team must score before it blows. */
val FUSE_CHOICES: List<Int> = listOf(30, 45, 60, 90)

/** Extra seconds added to a team's total when the bomb explodes. */
val BOMB_PENALTY_CHOICES: List<Int> = listOf(10, 20, 30)

/** Time penalty (seconds) added each time the describer swaps the word. 0 = free. */
val CHANGE_PENALTY_CHOICES: List<Int> = listOf(0, 3, 5, 10)

data class DowrOptions(
    val categories: List<DowrCategory> = CATEGORIES,
    /** null == "Mixed/random" — no difficulty filter (mirrors the web 'random' selection). */
    val difficulty: DowrDifficulty? = null,
    val endMode: DowrEndMode = DowrEndMode.TURNS,
    /** Turns per team (TURNS mode). Lowest total time wins. */
    val rounds: Int = 3,
    /** Total shared game time in seconds (TIME mode). Most words guessed wins. */
    val timeLimitSeconds: Int = 180,
    /** Bomb fuse per turn, in seconds. */
    val fuseSeconds: Int = 60,
    /** Seconds added to the team's total if the bomb explodes. */
    val bombPenaltySeconds: Int = 20,
    /** Seconds added each time the team changes the word. */
    val changePenaltySeconds: Int = 5,
    /** Hide the countdown so nobody knows exactly when the bomb blows. */
    val surpriseBomb: Boolean = true,
)

val DEFAULT_OPTIONS: DowrOptions = DowrOptions()

private fun <T> oneOf(choices: List<T>, v: T, fallback: T): T = if (v in choices) v else fallback

/** Mirrors config.ts `normalizeOptions`. */
fun normalizeOptions(o: DowrOptions): DowrOptions {
    val cats = o.categories.filter { it in CATEGORIES }
    return o.copy(
        categories = cats.ifEmpty { CATEGORIES },
        rounds = o.rounds.coerceIn(1, 8),
        timeLimitSeconds = oneOf(TIME_LIMIT_CHOICES, o.timeLimitSeconds, DEFAULT_OPTIONS.timeLimitSeconds),
        fuseSeconds = oneOf(FUSE_CHOICES, o.fuseSeconds, DEFAULT_OPTIONS.fuseSeconds),
        bombPenaltySeconds = oneOf(BOMB_PENALTY_CHOICES, o.bombPenaltySeconds, DEFAULT_OPTIONS.bombPenaltySeconds),
        changePenaltySeconds = oneOf(CHANGE_PENALTY_CHOICES, o.changePenaltySeconds, DEFAULT_OPTIONS.changePenaltySeconds),
    )
}

/** A pre-assigned team (the web's `TeamSetup.teams`). Empty list -> auto-pair consecutive players. */
data class DowrTeamSpec(
    val id: String,
    val name: String? = null,
    val memberIds: List<String>,
)

/**
 * The match configuration. Mirrors the webapp's `GameConfig` slice this game reads, plus the loaded
 * [content] so [createInitialState] can resolve the deck purely (the web reads a module-level pool).
 */
data class DowrConfig(
    val players: List<PlayerSeat>,
    val content: DowrContent,
    val lang: Lang = Lang.EN,
    val options: DowrOptions = DEFAULT_OPTIONS,
    val teams: List<DowrTeamSpec> = emptyList(),
)

/** Mirrors config.ts `validateConfig`. Returns null when the config is playable. */
fun validateConfig(config: DowrConfig): List<LocalizedString>? {
    val o = normalizeOptions(config.options)
    val n = config.players.size
    val errors = mutableListOf<LocalizedString>()
    if (n < 4) {
        errors += LocalizedString("Add at least 4 players (2 teams)", "حداقل ۴ بازیکن اضافه کن (۲ تیم)")
    } else if (n % 2 != 0) {
        errors += LocalizedString(
            "Add an even number of players — teams of 2",
            "تعداد بازیکن‌ها باید زوج باشد — تیم‌های دونفره",
        )
    }
    if (n > 10) errors += LocalizedString("At most 10 players", "حداکثر ۱۰ بازیکن")
    if (config.content.buildPool(o.categories, o.difficulty).isEmpty()) {
        errors += LocalizedString("No words match these filters", "هیچ کلمه‌ای با این فیلترها نیست")
    }
    return errors.ifEmpty { null }
}

// ──────────────────────────── State ────────────────────────────

enum class DowrPhase { PLAYING, GAME_OVER, ERROR }

enum class TurnEndReason { GUESSED, BOMB, DECK_EXHAUSTED }

enum class DowrError { EMPTY_DECK, NEED_TEAMS }

data class DowrTeam(
    val id: String,
    val name: String,
    val color: ColorToken,
    /** Exactly two member player ids. */
    val memberIds: List<String>,
)

data class TurnRecord(
    val turnNo: Int,
    val round: Int, // 0-based
    val teamId: String,
    val describerId: String,
    val guesserId: String,
    val segmentMs: Long,
    val changes: Int,
    val changePenaltyMs: Long,
    val bombPenaltyMs: Long,
    val totalMs: Long, // what was added to the team's total this turn
    val reason: TurnEndReason,
    val solved: Boolean,
)

data class DowrState(
    val v: Int,
    val phase: DowrPhase,
    val finished: Boolean,
    val options: DowrOptions,
    val teams: List<DowrTeam>,
    val playerNames: Map<String, String>,
    val deck: DeckState<WordCard>,
    /** Global 0-based turn counter. team = teams[turnNo % teams.size]. */
    val turnNo: Int,
    val totalTurns: Int,
    /** The card "in play"; null means none (web stored an id + a global lookup; we carry the card). */
    val currentCard: WordCard?,
    /** Bomb fuse for the current word (ms) — jittered when surpriseBomb is on. */
    val fuseMs: Long,
    /** Word changes on the current word (reset each turn). */
    val turnChanges: Int,
    /** Accumulated change penalty for the current turn (ms), banked on Advance. */
    val changePenaltyMs: Long,
    /** teamId -> cumulative time in ms (lower is better). Preserves team insertion order. */
    val totals: Map<String, Long>,
    /** Transient: set for one render so the view can flash the explosion; cleared via ClearFlash. */
    val flashBomb: Boolean,
    val history: List<TurnRecord>,
    val lastRecord: TurnRecord?,
    val errorCode: DowrError?,
)

// ──────────────────────────── Actions ────────────────────────────

sealed interface DowrAction {
    /** End the current turn. [reason] is GUESSED or BOMB (the view supplies the measured [segmentMs]). */
    data class Advance(val reason: TurnEndReason, val segmentMs: Long, val seed: Int) : DowrAction
    data class ChangeWord(val seed: Int) : DowrAction
    /** TIME mode only: the shared clock ran out mid-word; bank the real seconds and end the match. */
    data class EndTime(val segmentMs: Long) : DowrAction
    data object ClearFlash : DowrAction
    data object Reset : DowrAction
}

// ──────────────────────────── Turn participants (derived) ────────────────────────────

fun teamForTurn(s: DowrState, turnNo: Int): DowrTeam = s.teams[turnNo % s.teams.size]
fun roundForTurn(s: DowrState, turnNo: Int): Int = turnNo / s.teams.size // floor for non-negative
fun currentTeam(s: DowrState): DowrTeam = teamForTurn(s, s.turnNo)

/** Within a team the describer alternates between its two members each round. */
fun describerPlayerId(s: DowrState): String =
    currentTeam(s).memberIds[roundForTurn(s, s.turnNo) % 2]

fun guesserPlayerId(s: DowrState): String =
    currentTeam(s).memberIds[(roundForTurn(s, s.turnNo) + 1) % 2]

// ──────────────────────────── Internal helpers ────────────────────────────

private val TEAM_COLORS: List<ColorToken> = listOf(
    ColorToken.ROSE,
    ColorToken.SKY,
    ColorToken.LIME,
    ColorToken.GOLD,
    ColorToken.VIOLET,
    ColorToken.TEAL,
)

/** The fuse for a turn: the configured length, jittered down to 60–100% when surpriseBomb is on. */
private fun computeFuseMs(o: DowrOptions, seed: Int): Long {
    if (!o.surpriseBomb) return o.fuseSeconds * 1000L
    val lo = maxOf(10, (o.fuseSeconds * 0.6).roundToInt())
    return Rng(seed).int(lo, o.fuseSeconds).toLong() * 1000L
}

private fun drawCard(d: DeckState<WordCard>, seed: Int): Pair<DeckState<WordCard>, WordCard?> {
    val r = draw(d, 1, seed)
    return r.deck to r.drawn.firstOrNull()
}

private fun makeRecord(
    s: DowrState,
    reason: TurnEndReason,
    segmentMs: Long,
    changePenaltyMs: Long,
    bombPenaltyMs: Long,
): TurnRecord = TurnRecord(
    turnNo = s.turnNo,
    round = roundForTurn(s, s.turnNo),
    teamId = currentTeam(s).id,
    describerId = describerPlayerId(s),
    guesserId = guesserPlayerId(s),
    segmentMs = segmentMs,
    changes = s.turnChanges,
    changePenaltyMs = changePenaltyMs,
    bombPenaltyMs = bombPenaltyMs,
    totalMs = segmentMs + changePenaltyMs + bombPenaltyMs,
    reason = reason,
    solved = reason == TurnEndReason.GUESSED,
)

// ──────────────────────────── Initial state ────────────────────────────

fun createInitialState(config: DowrConfig, seed: Int): DowrState {
    val options = normalizeOptions(config.options)
    val players = config.players
    val playerNames: Map<String, String> = players.associate { it.id to it.name }

    val supplied = config.teams
    val teams: List<DowrTeam> = if (supplied.isNotEmpty()) {
        supplied.mapIndexed { i, t ->
            DowrTeam(
                id = t.id,
                name = t.name ?: "Team ${i + 1}",
                color = TEAM_COLORS[i % TEAM_COLORS.size],
                memberIds = t.memberIds.take(2),
            )
        }
    } else {
        List(players.size / 2) { i ->
            DowrTeam(
                id = "t$i",
                name = "Team ${i + 1}",
                color = TEAM_COLORS[i % TEAM_COLORS.size],
                memberIds = listOf(players[2 * i].id, players[2 * i + 1].id),
            )
        }
    }

    val pool = config.content.buildPool(options.categories, options.difficulty)
    var deckState = create(pool, seed)
    val validTeams = teams.size >= 2 && teams.all { it.memberIds.size == 2 }
    val emptyDeck = pool.isEmpty()

    val totals: Map<String, Long> = teams.associate { it.id to 0L }

    var currentCard: WordCard? = null
    var fuseMs = options.fuseSeconds * 1000L
    if (!emptyDeck && validTeams) {
        val r = drawCard(deckState, seed)
        deckState = r.first
        currentCard = r.second
        fuseMs = computeFuseMs(options, deriveSeed(seed, 7))
    }

    return DowrState(
        v = 2,
        phase = if (emptyDeck || !validTeams) DowrPhase.ERROR else DowrPhase.PLAYING,
        finished = false,
        options = options,
        teams = teams,
        playerNames = playerNames,
        deck = deckState,
        turnNo = 0,
        totalTurns = teams.size * options.rounds,
        currentCard = currentCard,
        fuseMs = fuseMs,
        turnChanges = 0,
        changePenaltyMs = 0L,
        totals = totals,
        flashBomb = false,
        history = emptyList(),
        lastRecord = null,
        errorCode = when {
            emptyDeck -> DowrError.EMPTY_DECK
            !validTeams -> DowrError.NEED_TEAMS
            else -> null
        },
    )
}

// ──────────────────────────── Reducer ────────────────────────────

fun reducer(state: DowrState, action: DowrAction): DowrState {
    val s = state
    return when (action) {
        is DowrAction.Advance -> {
            val card = s.currentCard
            if (s.phase != DowrPhase.PLAYING || card == null) return s
            val timeMode = s.options.endMode == DowrEndMode.TIME
            val team = currentTeam(s)
            val segmentMs = action.segmentMs.coerceIn(0L, s.fuseMs)
            // In time mode the win condition is "most words", so artificial time penalties don't apply.
            val bombPenaltyMs =
                if (!timeMode && action.reason == TurnEndReason.BOMB) s.options.bombPenaltySeconds * 1000L else 0L
            val changePenaltyMs = if (timeMode) 0L else s.changePenaltyMs
            val addMs = segmentMs + changePenaltyMs + bombPenaltyMs
            val record = makeRecord(s, action.reason, segmentMs, changePenaltyMs, bombPenaltyMs)
            val totals = s.totals + (team.id to ((s.totals[team.id] ?: 0L) + addMs))
            val consumed = discard(s.deck, card)
            val nextTurnNo = s.turnNo + 1
            val common = s.copy(
                totals = totals,
                history = s.history + record,
                lastRecord = record,
                flashBomb = action.reason == TurnEndReason.BOMB,
                turnChanges = 0,
                changePenaltyMs = 0L,
            )
            val elapsed = totals.values.sum()
            val over = if (timeMode) {
                elapsed >= s.options.timeLimitSeconds * 1000L
            } else {
                nextTurnNo >= s.totalTurns
            }
            if (over) {
                return common.copy(
                    phase = DowrPhase.GAME_OVER,
                    finished = true,
                    deck = consumed,
                    currentCard = null,
                )
            }
            val (d, next) = drawCard(consumed, action.seed)
            if (next == null) {
                return common.copy(
                    phase = DowrPhase.GAME_OVER,
                    finished = true,
                    deck = consumed,
                    currentCard = null,
                )
            }
            common.copy(
                deck = d,
                currentCard = next,
                turnNo = nextTurnNo,
                fuseMs = computeFuseMs(s.options, action.seed),
            )
        }

        is DowrAction.ChangeWord -> {
            val card = s.currentCard
            if (s.phase != DowrPhase.PLAYING || card == null) return s
            val discarded = discard(s.deck, card)
            val (d, next) = drawCard(discarded, action.seed)
            if (next == null) return s // nothing to swap to; keep the current word
            s.copy(
                deck = d,
                currentCard = next,
                turnChanges = s.turnChanges + 1,
                changePenaltyMs = s.changePenaltyMs + s.options.changePenaltySeconds * 1000L,
            )
        }

        is DowrAction.EndTime -> {
            if (s.phase != DowrPhase.PLAYING || s.options.endMode != DowrEndMode.TIME) return s
            val team = currentTeam(s)
            val segmentMs = maxOf(0L, action.segmentMs)
            val totals = s.totals + (team.id to ((s.totals[team.id] ?: 0L) + segmentMs))
            s.copy(
                totals = totals,
                phase = DowrPhase.GAME_OVER,
                finished = true,
                currentCard = null,
                flashBomb = false,
                turnChanges = 0,
                changePenaltyMs = 0L,
            )
        }

        is DowrAction.ClearFlash -> if (!s.flashBomb) s else s.copy(flashBomb = false)

        is DowrAction.Reset -> s // no-op; "play again" is host-driven (re-creates with a fresh seed)
    }
}

// ──────────────────────────── Pure selectors ────────────────────────────

fun currentRound(s: DowrState): Int = roundForTurn(s, s.turnNo) + 1
fun describerName(s: DowrState): String = s.playerNames[describerPlayerId(s)] ?: ""
fun guesserName(s: DowrState): String = s.playerNames[guesserPlayerId(s)] ?: ""
fun isLastTurn(s: DowrState): Boolean = s.turnNo >= s.totalTurns - 1

/** Words a team has solved (TIME-mode win metric). */
fun teamWords(s: DowrState, teamId: String): Int =
    s.history.count { it.teamId == teamId && it.solved }

/** Total game time consumed so far (sum of every team's banked ms). */
fun elapsedMs(s: DowrState): Long = s.totals.values.sum()
fun timeLimitMs(s: DowrState): Long = s.options.timeLimitSeconds * 1000L

/** Ms left on the shared clock (TIME mode); pass the live in-progress segment. */
fun timeRemainingMs(s: DowrState, liveSegmentMs: Long = 0L): Long =
    maxOf(0L, timeLimitMs(s) - elapsedMs(s) - liveSegmentMs)

data class DowrStanding(
    val subjectId: String,
    val label: String,
    val color: ColorToken?,
    val totalMs: Long,
    val words: Int,
    val rank: Int,
)

/**
 * Standings. Turns mode: fastest total time first (ties share rank). Time mode: most words first,
 * ties broken by lower time. Mirrors logic.ts `selectStandings`.
 */
fun selectStandings(s: DowrState): List<DowrStanding> {
    val timeMode = s.options.endMode == DowrEndMode.TIME
    val rows = s.teams.map { t ->
        DowrStanding(
            subjectId = t.id,
            label = t.name,
            color = t.color,
            totalMs = s.totals[t.id] ?: 0L,
            words = teamWords(s, t.id),
            rank = 0,
        )
    }
    val sorted = if (timeMode) {
        rows.sortedWith(compareByDescending<DowrStanding> { it.words }.thenBy { it.totalMs })
    } else {
        rows.sortedBy { it.totalMs }
    }
    var rank = 0
    var prevKey: String? = null
    return sorted.mapIndexed { i, row ->
        val key = if (timeMode) "${row.words}|${row.totalMs}" else "${row.totalMs}"
        if (prevKey == null || key != prevKey) {
            rank = i + 1
            prevKey = key
        }
        row.copy(rank = rank)
    }
}

/** The winning team id(s). Turns mode: lowest total time. Time mode: most words (ties -> fastest). */
fun selectWinners(s: DowrState): List<String> {
    if (s.teams.isEmpty()) return emptyList()
    if (s.options.endMode == DowrEndMode.TIME) {
        val max = s.teams.maxOf { teamWords(s, it.id) }
        val top = s.teams.filter { teamWords(s, it.id) == max }
        if (top.size <= 1) return top.map { it.id }
        val min = top.minOf { s.totals[it.id] ?: 0L }
        return top.filter { (s.totals[it.id] ?: 0L) == min }.map { it.id }
    }
    val min = s.teams.minOf { s.totals[it.id] ?: 0L }
    return s.teams.filter { (s.totals[it.id] ?: 0L) == min }.map { it.id }
}
