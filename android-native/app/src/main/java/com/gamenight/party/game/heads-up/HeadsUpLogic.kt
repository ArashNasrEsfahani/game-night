package com.gamenight.party.game.headsup

import com.gamenight.party.engine.Rng
import com.gamenight.party.model.ColorToken
import kotlin.random.Random

/**
 * PURE Heads Up! logic — a 1:1 port of src/games/heads-up/logic.ts. No clock / RNG / IO: seconds
 * and seeds arrive via action payloads; every randomness call is `Rng(seed).shuffle(...)` (a fresh
 * instance per call == the web `shuffle(items, seed)`). State is immutable; guard cases return the
 * same instance (===) to mirror the TS reference-equality tests.
 */

enum class HeadsUpPhase { HANDOFF, COUNTDOWN, PLAYING, ROUND_END, FINISHED, ERROR }
enum class InputMode { MOTION, BUTTON }
enum class ParticipantKind { PLAYER, TEAM }
enum class EntryResult { GOT, PASSED }
enum class ErrorCode { EMPTY_DECK, NOT_ENOUGH_PLAYERS }

data class Participant(
    val id: String,
    val kind: ParticipantKind,
    val name: String,
    val color: ColorToken? = null,
    val memberIds: List<String>,
    val guesserCursor: Int,
)

data class RoundEntry(val cardKey: String, val result: EntryResult)

data class RoundResult(
    val participantId: String,
    val guesserId: String,
    val roundIndex: Int,
    val entries: List<RoundEntry>,
    val got: Int,
    val passed: Int,
)

data class HeadsUpState(
    val v: Int,
    val phase: HeadsUpPhase,
    val finished: Boolean,
    val mode: HeadsUpMode,
    val participants: List<Participant>,
    val turnIndex: Int,
    val roundOfParticipant: Map<String, Int>,
    val totalRoundsPerParticipant: Int,
    val playerNames: Map<String, String>,
    val cardPool: List<String>,
    val deck: List<String>,
    val deckCursor: Int,
    val currentCardId: String?,
    /** null == no flash. */
    val flash: EntryResult?,
    val currentEntries: List<RoundEntry>,
    val roundSeconds: Int,
    val secondsLeft: Int,
    val countdownLeft: Int,
    val rounds: List<RoundResult>,
    val inputMode: InputMode,
    val passPenalty: Int,
    val recycleDeck: Boolean,
    val matchOver: Boolean,
    val errorCode: ErrorCode?,
)

sealed interface HeadsUpAction {
    data object ConfirmReady : HeadsUpAction
    data object CountdownTick : HeadsUpAction
    data class Tick(val secondsLeft: Int) : HeadsUpAction
    data class MarkGot(val seed: Int) : HeadsUpAction
    data class MarkPass(val seed: Int) : HeadsUpAction
    data object ClearFlash : HeadsUpAction
    data object TimeUp : HeadsUpAction
    data class NextParticipant(val seed: Int) : HeadsUpAction
    data class SetInputMode(val mode: InputMode) : HeadsUpAction
}

/** A fresh seed at the impure boundary (the composables call this; the reducer never does). */
fun freshSeed(): Int = Random.nextInt()

private val TEAM_COLORS: List<ColorToken> =
    listOf(ColorToken.ROSE, ColorToken.SKY, ColorToken.LIME, ColorToken.GOLD)

/** One ranked standing row, mirroring `HeadsUpStanding`. */
data class HeadsUpStanding(
    val participantId: String,
    val got: Int,
    val passed: Int,
    val score: Int,
    val rank: Int,
)

object HeadsUpLogic {

    fun guesserId(p: Participant): String =
        if (p.memberIds.isNotEmpty()) p.memberIds[p.guesserCursor % p.memberIds.size] else ""

    fun currentParticipant(s: HeadsUpState): Participant? = s.participants.getOrNull(s.turnIndex)

    private data class CardAdvance(val deck: List<String>, val deckCursor: Int, val currentCardId: String?)

    private fun advanceCard(deck: List<String>, cursor: Int, recycle: Boolean, seed: Int): CardAdvance {
        var nextCursor = cursor + 1
        var nextDeck = deck
        if (nextCursor >= deck.size) {
            if (recycle && deck.isNotEmpty()) {
                nextDeck = Rng(seed).shuffle(deck)
                nextCursor = 0
            } else {
                return CardAdvance(deck, nextCursor, null)
            }
        }
        return CardAdvance(nextDeck, nextCursor, nextDeck.getOrNull(nextCursor))
    }

    fun createInitialState(config: HeadsUpConfig, seed: Int): HeadsUpState {
        val options = config.options
        val playerNames = LinkedHashMap<String, String>()
        config.players.forEach { playerNames[it.id] = it.name }

        val participants: List<Participant> = if (options.mode == HeadsUpMode.TEAMS) {
            val teamList = config.teams ?: emptyList()
            teamList.mapIndexed { i, t ->
                Participant(
                    id = t.id,
                    kind = ParticipantKind.TEAM,
                    name = t.name.resolve(config.lang),
                    color = TEAM_COLORS[i % TEAM_COLORS.size],
                    memberIds = t.memberIds,
                    guesserCursor = 0,
                )
            }
        } else {
            config.players.map { p ->
                Participant(
                    id = p.id,
                    kind = ParticipantKind.PLAYER,
                    name = p.name,
                    color = p.color,
                    memberIds = listOf(p.id),
                    guesserCursor = 0,
                )
            }
        }

        val cardPool = config.cardPool
        val deck = Rng(seed).shuffle(cardPool)
        val roundOfParticipant = LinkedHashMap<String, Int>()
        participants.forEach { roundOfParticipant[it.id] = 0 }

        val badTeams = options.mode == HeadsUpMode.TEAMS && participants.any { it.memberIds.size < 2 }
        val errorCode: ErrorCode? = when {
            participants.size < 2 || badTeams -> ErrorCode.NOT_ENOUGH_PLAYERS
            cardPool.isEmpty() -> ErrorCode.EMPTY_DECK
            else -> null
        }

        return HeadsUpState(
            v = 1,
            phase = if (errorCode != null) HeadsUpPhase.ERROR else HeadsUpPhase.HANDOFF,
            finished = false,
            mode = options.mode,
            participants = participants,
            turnIndex = 0,
            roundOfParticipant = roundOfParticipant,
            totalRoundsPerParticipant = options.rounds,
            playerNames = playerNames,
            cardPool = cardPool,
            deck = deck,
            deckCursor = 0,
            currentCardId = null,
            flash = null,
            currentEntries = emptyList(),
            roundSeconds = options.roundSeconds,
            secondsLeft = options.roundSeconds,
            countdownLeft = 3,
            rounds = emptyList(),
            inputMode = if (options.motionEnabled) InputMode.MOTION else InputMode.BUTTON,
            passPenalty = options.passPenalty,
            recycleDeck = options.recycleDeck,
            matchOver = false,
            errorCode = errorCode,
        )
    }

    private fun mark(s: HeadsUpState, result: EntryResult, seed: Int): HeadsUpState {
        val cur = s.currentCardId
        if (s.phase != HeadsUpPhase.PLAYING || cur == null) return s
        val entries = s.currentEntries + RoundEntry(cur, result)
        val adv = advanceCard(s.deck, s.deckCursor, s.recycleDeck, seed)
        return s.copy(
            currentEntries = entries,
            flash = result,
            deck = adv.deck,
            deckCursor = adv.deckCursor,
            currentCardId = adv.currentCardId,
        )
    }

    fun reducer(state: HeadsUpState, action: HeadsUpAction): HeadsUpState {
        val s = state
        return when (action) {
            is HeadsUpAction.ConfirmReady -> {
                if (s.phase != HeadsUpPhase.HANDOFF) s
                else s.copy(phase = HeadsUpPhase.COUNTDOWN, countdownLeft = 3)
            }

            is HeadsUpAction.CountdownTick -> {
                if (s.phase != HeadsUpPhase.COUNTDOWN) {
                    s
                } else {
                    val countdownLeft = s.countdownLeft - 1
                    if (countdownLeft > 0) {
                        s.copy(countdownLeft = countdownLeft)
                    } else {
                        s.copy(
                            phase = HeadsUpPhase.PLAYING,
                            countdownLeft = 0,
                            secondsLeft = s.roundSeconds,
                            currentEntries = emptyList(),
                            deckCursor = 0,
                            currentCardId = s.deck.getOrNull(0),
                        )
                    }
                }
            }

            is HeadsUpAction.Tick -> {
                if (s.phase != HeadsUpPhase.PLAYING) s
                else s.copy(secondsLeft = maxOf(0, action.secondsLeft))
            }

            is HeadsUpAction.MarkGot -> mark(s, EntryResult.GOT, action.seed)
            is HeadsUpAction.MarkPass -> mark(s, EntryResult.PASSED, action.seed)

            is HeadsUpAction.ClearFlash -> if (s.flash == null) s else s.copy(flash = null)

            is HeadsUpAction.TimeUp -> {
                if (s.phase != HeadsUpPhase.PLAYING) {
                    s
                } else {
                    val p = s.participants[s.turnIndex]
                    val got = s.currentEntries.count { it.result == EntryResult.GOT }
                    val passed = s.currentEntries.count { it.result == EntryResult.PASSED }
                    val result = RoundResult(
                        participantId = p.id,
                        guesserId = guesserId(p),
                        roundIndex = s.roundOfParticipant[p.id] ?: 0,
                        entries = s.currentEntries,
                        got = got,
                        passed = passed,
                    )
                    s.copy(
                        phase = HeadsUpPhase.ROUND_END,
                        flash = null,
                        currentCardId = null,
                        rounds = s.rounds + result,
                        roundOfParticipant = s.roundOfParticipant + (p.id to (s.roundOfParticipant[p.id] ?: 0) + 1),
                    )
                }
            }

            is HeadsUpAction.NextParticipant -> {
                if (s.phase != HeadsUpPhase.ROUND_END) {
                    s
                } else {
                    val allDone = s.participants.all {
                        (s.roundOfParticipant[it.id] ?: 0) >= s.totalRoundsPerParticipant
                    }
                    if (allDone) {
                        s.copy(phase = HeadsUpPhase.FINISHED, matchOver = true, finished = true)
                    } else {
                        val participants = s.participants.mapIndexed { i, p ->
                            if (i == s.turnIndex) p.copy(guesserCursor = p.guesserCursor + 1) else p
                        }
                        val turnIndex = (s.turnIndex + 1) % s.participants.size
                        s.copy(
                            participants = participants,
                            turnIndex = turnIndex,
                            phase = HeadsUpPhase.HANDOFF,
                            deck = Rng(action.seed).shuffle(s.cardPool),
                            deckCursor = 0,
                            currentCardId = null,
                            currentEntries = emptyList(),
                            flash = null,
                            countdownLeft = 3,
                            secondsLeft = s.roundSeconds,
                        )
                    }
                }
            }

            is HeadsUpAction.SetInputMode -> s.copy(inputMode = action.mode)
        }
    }

    /* ─────────────────────────  Pure selectors  ───────────────────────── */

    fun score(got: Int, passed: Int, penalty: Int): Int = got - passed * penalty

    private data class Row(val participantId: String, val got: Int, val passed: Int, val score: Int)

    fun standings(s: HeadsUpState): List<HeadsUpStanding> {
        val got = HashMap<String, Int>()
        val passed = HashMap<String, Int>()
        s.participants.forEach { got[it.id] = 0; passed[it.id] = 0 }
        s.rounds.forEach { r ->
            got[r.participantId] = (got[r.participantId] ?: 0) + r.got
            passed[r.participantId] = (passed[r.participantId] ?: 0) + r.passed
        }
        val order = s.participants.mapIndexed { i, p -> p.id to i }.toMap()
        val rows = s.participants
            .map { p ->
                val g = got[p.id] ?: 0
                val ps = passed[p.id] ?: 0
                Row(p.id, g, ps, score(g, ps, s.passPenalty))
            }
            .sortedWith(
                compareByDescending<Row> { it.score }
                    .thenByDescending { it.got }
                    .thenBy { order[it.participantId] ?: 0 },
            )

        var rank = 0
        var prev = 0
        var hasPrev = false
        return rows.mapIndexed { i, r ->
            if (!hasPrev || r.score != prev) {
                rank = i + 1
                prev = r.score
                hasPrev = true
            }
            HeadsUpStanding(r.participantId, r.got, r.passed, r.score, rank)
        }
    }

    fun computeWinners(s: HeadsUpState): List<String> =
        standings(s).filter { it.rank == 1 }.map { it.participantId }

    fun participantName(s: HeadsUpState, id: String): String =
        s.participants.firstOrNull { it.id == id }?.name ?: id
}
