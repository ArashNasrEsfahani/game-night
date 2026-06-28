package com.gamenight.party.game.mafia

import com.gamenight.party.engine.Rng
import com.gamenight.party.engine.deriveSeed
import kotlin.math.ceil
import kotlin.math.floor

/**
 * Mafia — PURE, deterministic logic. A faithful Kotlin port of src/games/mafia/logic.ts. No clock /
 * IO; all randomness arrives through [createInitialState]'s `seed` and the [MafiaAction.ResolveVote]
 * seed, and is consumed via [Rng] (a fresh instance per draw == the web's `shuffle(items, seed)` /
 * `pick(items, seed)`). No-op cases return the same `state` reference, mirroring the TS reducer.
 */

enum class MafiaPhase {
    DEAL,
    NIGHT,
    NIGHT_RESULT,
    DAY,
    NOMINATE,
    VOTE,
    VOTE_RESULT,
    ENDED,
    ERROR,
}

/** mafia & vig kill at night; vote eliminates by day. (NightDeath only ever uses mafia/vig.) */
enum class DeathCause { MAFIA, VIG, VOTE }

/** The full set of possible winners: a faction, a draw, or the lynched Jester. */
enum class MafiaWinner { TOWN, MAFIA, NEUTRAL, DRAW, JESTER }

enum class MafiaErrorCode { BAD_CONFIG }

data class MafiaPlayer(
    val id: String,
    val roleId: RoleId,
    val faction: Faction,
    val alive: Boolean,
    val dealtAt: Int,
    val diedRound: Int? = null,
    val diedBy: DeathCause? = null,
    val uses: Map<String, Int> = emptyMap(),
    val lastProtected: String? = null,
)

data class NightStep(
    val roleId: RoleId,
    val key: String,
    val actorIds: List<String>,
    val order: Int,
    val effect: NightEffect,
    val targetCount: Int,
    val skippable: Boolean,
    val canTargetSelf: Boolean,
)

data class NightActionRecord(
    val key: String,
    val roleId: RoleId,
    val actorId: String,
    val targetId: String?,
    val skipped: Boolean,
)

data class NightInfoResult(
    val actorId: String,
    val targetId: String,
    val seenFaction: Faction,
    /** The Consigliere learns the exact role, not just the side. */
    val seenRoleId: RoleId? = null,
)

sealed interface MafiaLogEntry {
    data class NightDeath(val round: Int, val playerId: String, val by: DeathCause) : MafiaLogEntry
    data class NightQuiet(val round: Int) : MafiaLogEntry
    data class VoteOut(val round: Int, val playerId: String) : MafiaLogEntry
    data class NoElim(val round: Int) : MafiaLogEntry
    data class Win(val round: Int, val winner: MafiaWinner) : MafiaLogEntry
}

data class MafiaState(
    val version: Int,
    val phase: MafiaPhase,
    val finished: Boolean,
    val options: MafiaOptions,
    val round: Int,
    val players: List<MafiaPlayer>,
    val playerNames: Map<String, String>,
    val dealCursor: Int,
    val dealOrder: List<String>,
    val nightQueue: List<NightStep>,
    val nightCursor: Int,
    val nightActions: List<NightActionRecord>,
    val nightInfo: List<NightInfoResult>,
    val lastNightDeaths: List<String>,
    val nominations: Map<String, Int>,
    val ballot: List<String>,
    val votes: Map<String, String>,
    val lastVoteEliminated: String?,
    val winner: MafiaWinner?,
    val log: List<MafiaLogEntry>,
    /** Transient error code surfaced after a rejected action (cleared at the start of the next). */
    val meta: String?,
    val errorCode: MafiaErrorCode?,
)

sealed interface MafiaAction {
    object DealNext : MafiaAction
    data class RecordNightAction(
        val actorId: String,
        val targetId: String?,
        val skipped: Boolean = false,
    ) : MafiaAction
    object NightStepNext : MafiaAction
    object NightStepBack : MafiaAction
    object AckNightResult : MafiaAction
    object EndDiscussion : MafiaAction
    data class Nominate(val nomineeId: String) : MafiaAction
    data class Unnominate(val nomineeId: String) : MafiaAction
    object OpenVote : MafiaAction
    data class CastVote(val voterId: String, val nomineeId: String) : MafiaAction
    data class RetractVote(val voterId: String) : MafiaAction
    data class ResolveVote(val seed: Int) : MafiaAction
    object AckVoteResult : MafiaAction
    data class AbortGame(val winner: MafiaWinner? = null) : MafiaAction
    object EndGame : MafiaAction
}

/* ─────────────────────────  Pure helpers  ───────────────────────── */

/** Returns the winning faction or DRAW, or null while the game continues (Jester is handled apart). */
fun checkWin(players: List<MafiaPlayer>): MafiaWinner? {
    val alive = players.filter { it.alive }
    val mafiaAlive = alive.count { countsAsMafia(ROLES.getValue(it.roleId)) }
    val townAlive = alive.count { countsAsTown(ROLES.getValue(it.roleId)) }
    if (mafiaAlive == 0 && townAlive == 0) return MafiaWinner.DRAW
    if (mafiaAlive == 0) return MafiaWinner.TOWN
    if (mafiaAlive > 0 && mafiaAlive >= townAlive) return MafiaWinner.MAFIA
    return null
}

fun buildNightQueue(players: List<MafiaPlayer>): List<NightStep> {
    val alive = players.filter { it.alive }
    val steps = mutableListOf<NightStep>()

    val mafiaActors = alive.filter { p ->
        val role = ROLES.getValue(p.roleId)
        role.faction == Faction.MAFIA && role.night?.effect == NightEffect.KILL
    }
    if (mafiaActors.isNotEmpty()) {
        steps.add(
            NightStep(
                roleId = "mafia",
                key = "mafia.kill",
                actorIds = mafiaActors.map { it.id },
                order = 10,
                effect = NightEffect.KILL,
                targetCount = 1,
                skippable = false,
                canTargetSelf = false,
            ),
        )
    }

    for (p in alive) {
        val spec = ROLES.getValue(p.roleId).night ?: continue
        if (spec.effect == NightEffect.KILL) continue // mafia handled above
        if (spec.perGame != null && (p.uses[spec.key] ?: 0) >= spec.perGame) continue
        steps.add(
            NightStep(
                roleId = p.roleId,
                key = spec.key,
                actorIds = listOf(p.id),
                order = spec.order,
                effect = spec.effect,
                targetCount = if (spec.effect == NightEffect.NONE) 0 else 1,
                skippable = spec.skippable,
                canTargetSelf = spec.canTargetSelf,
            ),
        )
    }

    return steps.sortedWith(compareBy({ it.order }, { it.roleId }))
}

data class TallyResult(val eliminated: String?, val tied: List<String>)

fun tallyVotes(
    votes: Map<String, String>,
    ballot: List<String>,
    aliveCount: Int,
    mode: VotingMode,
    tieRule: TieRule,
    seed: Int,
): TallyResult {
    val counts = HashMap<String, Int>()
    ballot.forEach { counts[it] = 0 }
    votes.values.forEach { t -> if (counts.containsKey(t)) counts[t] = counts.getValue(t) + 1 }
    val max = maxOf(0, ballot.maxOfOrNull { counts.getValue(it) } ?: 0)
    val top = ballot.filter { counts.getValue(it) == max && max > 0 }
    if (mode == VotingMode.MAJORITY) {
        val threshold = floor(aliveCount / 2.0).toInt()
        val winner = if (top.size == 1 && counts.getValue(top[0]) > threshold) top[0] else null
        return TallyResult(winner, if (top.size > 1) top else emptyList())
    }
    // plurality
    if (top.size == 1) return TallyResult(top[0], emptyList())
    if (top.size > 1 && tieRule == TieRule.RANDOM) return TallyResult(Rng(seed).pick(top), top)
    return TallyResult(null, top)
}

/* ─────────────────────────  Init  ───────────────────────── */

fun createInitialState(config: MafiaConfig, seed: Int): MafiaState {
    val options = readOptions(config)
    val playerIds = config.players.map { it.id }
    val playerNames = LinkedHashMap<String, String>()
    config.players.forEach { playerNames[it.id] = it.name }

    val n = playerIds.size
    val total = compositionTotal(options.composition)
    val mafiaCount = mafiaInComposition(options.composition)
    val knownRoles = options.composition.keys.all { ROLES[it] != null }
    val badConfig =
        n < 5 || total != n || mafiaCount < 1 || mafiaCount >= ceil(n / 2.0).toInt() || !knownRoles

    val base = MafiaState(
        version = 1,
        phase = if (badConfig) MafiaPhase.ERROR else MafiaPhase.DEAL,
        finished = false,
        options = options,
        round = 0,
        players = emptyList(),
        playerNames = playerNames,
        dealCursor = 0,
        dealOrder = emptyList(),
        nightQueue = emptyList(),
        nightCursor = 0,
        nightActions = emptyList(),
        nightInfo = emptyList(),
        lastNightDeaths = emptyList(),
        nominations = emptyMap(),
        ballot = emptyList(),
        votes = emptyMap(),
        lastVoteEliminated = null,
        winner = null,
        log = emptyList(),
        meta = null,
        errorCode = if (badConfig) MafiaErrorCode.BAD_CONFIG else null,
    )
    if (badConfig) return base

    val dealOrder = Rng(seed).shuffle(playerIds)
    val roleList = Rng(deriveSeed(seed, 1)).shuffle(
        options.composition.entries
            .sortedBy { it.key }
            .flatMap { (id, count) -> List(count) { id } },
    )
    val players = dealOrder.mapIndexed { i, id ->
        MafiaPlayer(
            id = id,
            roleId = roleList[i],
            faction = ROLES.getValue(roleList[i]).faction,
            alive = true,
            dealtAt = i,
            diedRound = null,
            diedBy = null,
            uses = emptyMap(),
            lastProtected = null,
        )
    }

    return base.copy(players = players, dealOrder = dealOrder)
}

/* ─────────────────────────  Resolution  ───────────────────────── */

private data class Attack(val targetId: String, val by: DeathCause)
private data class Death(val id: String, val by: DeathCause)

private fun applyWinIfAny(s: MafiaState): MafiaState {
    val w = checkWin(s.players) ?: return s
    return s.copy(
        phase = MafiaPhase.ENDED,
        finished = true,
        winner = w,
        log = s.log + MafiaLogEntry.Win(round = s.round, winner = w),
    )
}

private fun resolveNight(s: MafiaState): MafiaState {
    fun byKey(k: String): NightActionRecord? = s.nightActions.firstOrNull { it.key == k && !it.skipped }

    // 0. Roleblock — gather players prevented from acting tonight.
    val blocked = HashSet<String>()
    val escort = byKey("escort.block")
    if (escort?.targetId != null) blocked.add(escort.targetId)
    fun acts(a: NightActionRecord?): Boolean = a?.targetId != null && !blocked.contains(a.actorId)

    // 1. Frame — target reads as Mafia to the Detective this night.
    val framed = HashSet<String>()
    val framer = byKey("framer.frame")
    if (acts(framer)) framed.add(framer!!.targetId!!)

    // 2. Protect (doctor) + guard (bodyguard).
    val protectIds = HashSet<String>()
    val doctor = byKey("doctor.save")
    val doctorActs = acts(doctor)
    if (doctorActs) protectIds.add(doctor!!.targetId!!)
    val guard = byKey("bodyguard.guard")
    val guardActs = acts(guard)
    val guardedId = if (guardActs) guard!!.targetId else null
    val guardActorId = if (guardActs) guard!!.actorId else null

    // 3. Investigations.
    val nightInfo = mutableListOf<NightInfoResult>()
    val det = byKey("detective.check")
    if (acts(det)) {
        val target = s.players.firstOrNull { it.id == det!!.targetId }
        if (target != null) {
            val seen = if (framed.contains(target.id)) {
                Faction.MAFIA
            } else {
                ROLES.getValue(target.roleId).appearsAs ?: target.faction
            }
            nightInfo.add(NightInfoResult(actorId = det!!.actorId, targetId = det.targetId!!, seenFaction = seen))
        }
    }
    val con = byKey("consigliere.check")
    if (acts(con)) {
        val target = s.players.firstOrNull { it.id == con!!.targetId }
        if (target != null) {
            nightInfo.add(
                NightInfoResult(
                    actorId = con!!.actorId,
                    targetId = con.targetId!!,
                    seenFaction = target.faction,
                    seenRoleId = target.roleId,
                ),
            )
        }
    }

    // 4. Attacks (mafia + sniper) → resolved against protection and the bodyguard redirect.
    val attacks = mutableListOf<Attack>()
    val mafiaKill = byKey("mafia.kill")
    // The mafia kill only fails if EVERY living mafia killer was blocked tonight.
    val mafiaKillers = s.players.filter { p ->
        val role = ROLES.getValue(p.roleId)
        p.alive && role.faction == Faction.MAFIA && role.night?.effect == NightEffect.KILL
    }
    val mafiaBlocked = mafiaKillers.isNotEmpty() && mafiaKillers.all { blocked.contains(it.id) }
    if (mafiaKill?.targetId != null && !mafiaBlocked) attacks.add(Attack(mafiaKill.targetId, DeathCause.MAFIA))
    val snipe = byKey("sniper.shoot")
    val sniperFires = acts(snipe)
    if (sniperFires) attacks.add(Attack(snipe!!.targetId!!, DeathCause.VIG))

    val deaths = mutableListOf<Death>()
    for (atk in attacks) {
        if (protectIds.contains(atk.targetId)) continue // doctor shielded
        if (guardedId != null && atk.targetId == guardedId && guardActorId != null) {
            // Bodyguard intercepts: they die instead, the guarded player survives the night.
            if (deaths.none { it.id == guardActorId }) deaths.add(Death(guardActorId, atk.by))
            continue
        }
        if (deaths.none { it.id == atk.targetId }) deaths.add(Death(atk.targetId, atk.by))
    }

    val deadIds = deaths.map { it.id }
    val sniperActorId = if (sniperFires) snipe!!.actorId else null
    val doctorActorId = if (doctorActs) doctor!!.actorId else null
    val doctorTargetId = if (doctorActs) doctor!!.targetId else null
    val players = s.players.map { p ->
        val d = deaths.firstOrNull { it.id == p.id }
        var uses = p.uses
        var lastProtected = p.lastProtected
        // The sniper consumes its one shot only when the shot actually fires (not when blocked).
        if (sniperActorId == p.id) {
            uses = uses + ("sniper.shoot" to (uses["sniper.shoot"] ?: 0) + 1)
        }
        if (doctorActorId == p.id) {
            lastProtected = doctorTargetId
        }
        when {
            d != null -> p.copy(
                alive = false,
                diedRound = s.round,
                diedBy = d.by,
                uses = uses,
                lastProtected = lastProtected,
            )
            uses !== p.uses || lastProtected != p.lastProtected -> p.copy(uses = uses, lastProtected = lastProtected)
            else -> p
        }
    }

    val log: List<MafiaLogEntry> =
        if (deaths.isEmpty()) {
            s.log + MafiaLogEntry.NightQuiet(round = s.round)
        } else {
            s.log + deaths.map { MafiaLogEntry.NightDeath(round = s.round, playerId = it.id, by = it.by) }
        }

    return applyWinIfAny(
        s.copy(
            players = players,
            nightInfo = nightInfo,
            lastNightDeaths = deadIds,
            log = log,
            phase = MafiaPhase.NIGHT_RESULT,
            meta = null,
        ),
    )
}

private fun enterNight(s: MafiaState, round: Int): MafiaState {
    val base = s.copy(
        round = round,
        nightActions = emptyList(),
        nightInfo = emptyList(),
        lastNightDeaths = emptyList(),
        nominations = emptyMap(),
        ballot = emptyList(),
        votes = emptyMap(),
        meta = null,
    )
    if (s.options.peacefulFirstNight && round == 1) {
        return applyWinIfAny(
            base.copy(
                phase = MafiaPhase.NIGHT_RESULT,
                lastNightDeaths = emptyList(),
                log = base.log + MafiaLogEntry.NightQuiet(round = round),
            ),
        )
    }
    val queue = buildNightQueue(base.players)
    if (queue.isEmpty()) {
        return resolveNight(base.copy(nightQueue = emptyList(), nightCursor = 0))
    }
    return base.copy(phase = MafiaPhase.NIGHT, nightQueue = queue, nightCursor = 0)
}

/* ─────────────────────────  Reducer  ───────────────────────── */

private fun err(s: MafiaState, error: String): MafiaState = s.copy(meta = error)

fun reducer(state: MafiaState, action: MafiaAction): MafiaState {
    val s = if (state.meta != null) state.copy(meta = null) else state
    return when (action) {
        is MafiaAction.DealNext -> {
            if (s.phase != MafiaPhase.DEAL) return s
            val dealCursor = s.dealCursor + 1
            if (dealCursor >= s.dealOrder.size) enterNight(s, 1) else s.copy(dealCursor = dealCursor)
        }

        is MafiaAction.RecordNightAction -> {
            if (s.phase != MafiaPhase.NIGHT) return s
            val step = s.nightQueue.getOrNull(s.nightCursor) ?: return s
            val actorId = action.actorId.ifBlank { step.actorIds.first() }
            val record = NightActionRecord(
                key = step.key,
                roleId = step.roleId,
                actorId = actorId,
                targetId = action.targetId,
                skipped = action.skipped,
            )
            if (action.skipped) {
                if (!step.skippable) return err(s, "cannotSkip")
            } else {
                val target = s.players.firstOrNull { it.id == action.targetId }
                if (target == null || !target.alive) return err(s, "badTarget")
                val isSelf = action.targetId != null && step.actorIds.contains(action.targetId)
                if (isSelf && !step.canTargetSelf) return err(s, "noSelf")
                if (isSelf && step.key == "doctor.save") {
                    val actor = s.players.firstOrNull { it.id == record.actorId }
                    val used = actor?.uses?.get("doctor.selfsave") ?: 0
                    if (s.options.allowDoctorSelfSave == DoctorSelfSave.NEVER) return err(s, "noSelf")
                    if (s.options.allowDoctorSelfSave == DoctorSelfSave.ONCE && used >= 1) return err(s, "selfSaveUsed")
                }
            }
            var players = s.players
            // Track the doctor self-save use immediately so a re-record can't bypass the cap.
            if (!action.skipped && step.key == "doctor.save" &&
                action.targetId != null && step.actorIds.contains(action.targetId)
            ) {
                players = s.players.map { p ->
                    if (p.id == record.actorId) {
                        p.copy(uses = p.uses + ("doctor.selfsave" to (p.uses["doctor.selfsave"] ?: 0) + 1))
                    } else {
                        p
                    }
                }
            }
            val nightActions = s.nightActions.filter { it.key != step.key } + record
            s.copy(nightActions = nightActions, players = players)
        }

        is MafiaAction.NightStepNext -> {
            if (s.phase != MafiaPhase.NIGHT) return s
            val step = s.nightQueue.getOrNull(s.nightCursor) ?: return s
            val recorded = s.nightActions.firstOrNull { it.key == step.key }
            if (!step.skippable && recorded == null) return err(s, "needTarget")
            val nightCursor = s.nightCursor + 1
            if (nightCursor >= s.nightQueue.size) resolveNight(s) else s.copy(nightCursor = nightCursor)
        }

        is MafiaAction.NightStepBack -> {
            if (s.phase != MafiaPhase.NIGHT) return s
            s.copy(nightCursor = maxOf(0, s.nightCursor - 1))
        }

        is MafiaAction.AckNightResult -> {
            if (s.phase != MafiaPhase.NIGHT_RESULT) return s
            s.copy(phase = MafiaPhase.DAY, nominations = emptyMap(), ballot = emptyList(), votes = emptyMap())
        }

        is MafiaAction.EndDiscussion -> {
            if (s.phase != MafiaPhase.DAY) return s
            s.copy(phase = MafiaPhase.NOMINATE)
        }

        is MafiaAction.Nominate -> {
            if (s.phase != MafiaPhase.NOMINATE) return s
            val target = s.players.firstOrNull { it.id == action.nomineeId }
            if (target == null || !target.alive) return s
            val count = (s.nominations[action.nomineeId] ?: 0) + 1
            val nominations = s.nominations + (action.nomineeId to count)
            val ballot =
                if (count >= s.options.nominationsRequired && !s.ballot.contains(action.nomineeId)) {
                    s.ballot + action.nomineeId
                } else {
                    s.ballot
                }
            s.copy(nominations = nominations, ballot = ballot)
        }

        is MafiaAction.Unnominate -> {
            if (s.phase != MafiaPhase.NOMINATE) return s
            val count = maxOf(0, (s.nominations[action.nomineeId] ?: 0) - 1)
            val nominations = s.nominations + (action.nomineeId to count)
            val ballot =
                if (count < s.options.nominationsRequired) s.ballot.filter { it != action.nomineeId } else s.ballot
            s.copy(nominations = nominations, ballot = ballot)
        }

        is MafiaAction.OpenVote -> {
            if (s.phase != MafiaPhase.NOMINATE) return s
            if (s.ballot.isEmpty()) return err(s, "emptyBallot")
            s.copy(phase = MafiaPhase.VOTE, votes = emptyMap())
        }

        is MafiaAction.CastVote -> {
            if (s.phase != MafiaPhase.VOTE) return s
            val voter = s.players.firstOrNull { it.id == action.voterId }
            if (voter == null || !voter.alive || !s.ballot.contains(action.nomineeId)) return s
            s.copy(votes = s.votes + (action.voterId to action.nomineeId))
        }

        is MafiaAction.RetractVote -> {
            if (s.phase != MafiaPhase.VOTE) return s
            if (!s.votes.containsKey(action.voterId)) return s
            s.copy(votes = s.votes - action.voterId)
        }

        is MafiaAction.ResolveVote -> {
            if (s.phase != MafiaPhase.VOTE) return s
            val aliveCount = s.players.count { it.alive }
            val eliminated = tallyVotes(
                s.votes,
                s.ballot,
                aliveCount,
                s.options.votingMode,
                s.options.tieRule,
                action.seed,
            ).eliminated
            if (eliminated == null) {
                return s.copy(
                    phase = MafiaPhase.VOTE_RESULT,
                    lastVoteEliminated = null,
                    log = s.log + MafiaLogEntry.NoElim(round = s.round),
                )
            }
            val players = s.players.map { p ->
                if (p.id == eliminated) {
                    p.copy(alive = false, diedRound = s.round, diedBy = DeathCause.VOTE)
                } else {
                    p
                }
            }
            val withDeath = s.copy(
                players = players,
                phase = MafiaPhase.VOTE_RESULT,
                lastVoteEliminated = eliminated,
                log = s.log + MafiaLogEntry.VoteOut(round = s.round, playerId = eliminated),
            )
            // Jester (any winsIfLynched role) wins immediately when the town votes them out.
            val lynched = s.players.firstOrNull { it.id == eliminated }
            if (lynched != null && ROLES[lynched.roleId]?.winsIfLynched == true) {
                return withDeath.copy(
                    phase = MafiaPhase.ENDED,
                    finished = true,
                    winner = MafiaWinner.JESTER,
                    log = withDeath.log + MafiaLogEntry.Win(round = s.round, winner = MafiaWinner.JESTER),
                )
            }
            applyWinIfAny(withDeath)
        }

        is MafiaAction.AckVoteResult -> {
            if (s.phase != MafiaPhase.VOTE_RESULT) return s
            enterNight(s, s.round + 1)
        }

        is MafiaAction.AbortGame -> {
            if (s.phase == MafiaPhase.ENDED) return s
            s.copy(phase = MafiaPhase.ENDED, finished = true, winner = action.winner)
        }

        is MafiaAction.EndGame -> {
            // Manually end the match and show Results with the standings/winner so far.
            if (s.phase == MafiaPhase.ENDED) return s
            val w = checkWin(s.players)
            s.copy(
                phase = MafiaPhase.ENDED,
                finished = true,
                winner = w,
                log = if (w != null) s.log + MafiaLogEntry.Win(round = s.round, winner = w) else s.log,
            )
        }
    }
}

/* ─────────────────────────  Selectors  ───────────────────────── */

fun alivePlayers(s: MafiaState): List<MafiaPlayer> = s.players.filter { it.alive }
fun currentDealId(s: MafiaState): String? = s.dealOrder.getOrNull(s.dealCursor)
fun currentStep(s: MafiaState): NightStep? = s.nightQueue.getOrNull(s.nightCursor)
fun recordedTarget(s: MafiaState, key: String): String? =
    s.nightActions.firstOrNull { it.key == key }?.targetId
