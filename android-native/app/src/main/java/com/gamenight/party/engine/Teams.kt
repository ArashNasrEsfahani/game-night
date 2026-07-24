package com.gamenight.party.engine

import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString

/**
 * Port of src/engine/teams.ts — a pure team-assignment primitive.
 *
 * All randomness flows from a numeric seed via [Rng.shuffle]; there is no clock dependency.
 * Operations never mutate input — they return new immutable state.
 */

/**
 * The web `Team.name` is the TS union `LocalizedString | string`. Kotlin has no union types, so it
 * is modelled as this sealed type. The engine factories ([createTeams] / [autoBalance]) always
 * produce [Text] names; games may substitute a [Localized] name.
 */
sealed interface TeamName {
    data class Text(val value: String) : TeamName
    data class Localized(val value: LocalizedString) : TeamName

    /** Resolve to a displayable string for [lang]. */
    fun resolve(lang: Lang): String = when (this) {
        is Text -> value
        is Localized -> value.resolve(lang)
    }
}

data class Team(
    val id: String,
    val name: TeamName,
    val memberIds: List<String>,
    val color: ColorToken? = null,
)

data class TeamSetState(
    val teams: List<Team>,
)

/** An empty team set (no teams). */
fun emptyTeamSet(): TeamSetState = TeamSetState(teams = emptyList())

/**
 * Build [count] empty teams named "Team 1".."Team n". Non-positive counts produce an empty set.
 * [makeId] builds each team's id from its index.
 */
fun createTeams(count: Int, makeId: (Int) -> String): TeamSetState {
    val n = maxOf(0, count)
    val teams = ArrayList<Team>(n)
    for (i in 0 until n) {
        teams.add(Team(id = makeId(i), name = TeamName.Text("Team ${i + 1}"), memberIds = emptyList()))
    }
    return TeamSetState(teams)
}

/**
 * Move [playerId] into [teamId], removing it from any other team first. No-op (returns the input
 * unchanged) when the target team does not exist or the player is already placed there and nowhere
 * else.
 */
fun assign(s: TeamSetState, teamId: String, playerId: String): TeamSetState {
    val targetExists = s.teams.any { it.id == teamId }
    if (!targetExists) return s

    // Already correctly placed (in the target team and not in any other team) -> no-op.
    val alreadyPlaced = s.teams.all { t ->
        if (t.id == teamId) playerId in t.memberIds else playerId !in t.memberIds
    }
    if (alreadyPlaced) return s

    val teams = s.teams.map { t ->
        when {
            t.id == teamId ->
                if (playerId in t.memberIds) t else t.copy(memberIds = t.memberIds + playerId)
            playerId in t.memberIds ->
                t.copy(memberIds = t.memberIds.filter { it != playerId })
            else -> t
        }
    }
    return TeamSetState(teams)
}

/** Remove [playerId] from whichever team contains it. No-op when the player is unassigned. */
fun unassign(s: TeamSetState, playerId: String): TeamSetState {
    val present = s.teams.any { playerId in it.memberIds }
    if (!present) return s
    val teams = s.teams.map { t ->
        if (playerId in t.memberIds) t.copy(memberIds = t.memberIds.filter { it != playerId }) else t
    }
    return TeamSetState(teams)
}

/**
 * Create [count] named empty teams, then deal a seed-shuffled copy of [playerIds] round-robin
 * across them. With count <= 0 returns an empty set (players are dropped).
 */
fun autoBalance(
    playerIds: List<String>,
    count: Int,
    seed: Int,
    makeId: (Int) -> String,
): TeamSetState {
    val base = createTeams(count, makeId)
    if (base.teams.isEmpty()) return base
    val dealt = Rng(seed).shuffle(playerIds)
    val buckets = List(base.teams.size) { ArrayList<String>() }
    for (i in dealt.indices) {
        buckets[i % buckets.size].add(dealt[i])
    }
    val teams = base.teams.mapIndexed { idx, t -> t.copy(memberIds = buckets[idx].toList()) }
    return TeamSetState(teams)
}

/** Return the id of the team containing [playerId], or null if unassigned. */
fun teamOf(s: TeamSetState, playerId: String): String? {
    for (t in s.teams) {
        if (playerId in t.memberIds) return t.id
    }
    return null
}

/** True when every id in [allPlayerIds] is assigned to some team. An empty roster is complete. */
fun isComplete(s: TeamSetState, allPlayerIds: List<String>): Boolean {
    if (allPlayerIds.isEmpty()) return true
    val assigned = HashSet<String>()
    for (t in s.teams) assigned.addAll(t.memberIds)
    return allPlayerIds.all { it in assigned }
}
