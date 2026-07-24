package com.gamenight.party.engine

import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.PlayerSeat

/**
 * Port of src/engine/roster.ts — a pure roster model: players + saved groups.
 *
 * No clock / RNG: `now` arrives as an argument and ids are supplied by the caller. Operations
 * never mutate input — they return new immutable state.
 */

data class Player(
    val id: String,
    val name: String,
    val emoji: String? = null,
    val color: ColorToken? = null,
    val createdAt: Long,
)

data class SavedGroup(
    val id: String,
    val name: String,
    val memberIds: List<String>,
    val createdAt: Long,
)

data class RosterState(
    val players: List<Player>,
    val groups: List<SavedGroup>,
)

/**
 * The fields needed to create a [Player], i.e. the web's `Omit<Player, 'id' | 'createdAt'>` —
 * the caller supplies `id` and `now` separately to [addPlayer].
 */
data class PlayerDraft(
    val name: String,
    val emoji: String? = null,
    val color: ColorToken? = null,
)

/**
 * A patch for [updatePlayer] (the web's `Partial<Omit<Player, 'id'>>`). A `null` field means
 * "leave unchanged"; non-null fields are merged over the existing player. The id cannot change.
 */
data class PlayerPatch(
    val name: String? = null,
    val emoji: String? = null,
    val color: ColorToken? = null,
    val createdAt: Long? = null,
)

/** A fresh, empty roster. */
fun emptyRoster(): RosterState = RosterState(players = emptyList(), groups = emptyList())

/**
 * Append a new player built from [p], with caller-supplied [id] and [now] timestamp.
 * If a player with [id] already exists, this is a no-op (returns the input unchanged).
 */
fun addPlayer(s: RosterState, p: PlayerDraft, id: String, now: Long): RosterState {
    if (s.players.any { it.id == id }) return s
    val player = Player(id = id, name = p.name, emoji = p.emoji, color = p.color, createdAt = now)
    return s.copy(players = s.players + player)
}

/**
 * Merge [patch] into the player with [id] (id cannot change). Unknown id is a no-op (returns the
 * input unchanged).
 */
fun updatePlayer(s: RosterState, id: String, patch: PlayerPatch): RosterState {
    val idx = s.players.indexOfFirst { it.id == id }
    if (idx == -1) return s
    val cur = s.players[idx]
    val merged = cur.copy(
        name = patch.name ?: cur.name,
        emoji = patch.emoji ?: cur.emoji,
        color = patch.color ?: cur.color,
        createdAt = patch.createdAt ?: cur.createdAt,
    )
    val next = s.players.toMutableList()
    next[idx] = merged
    return s.copy(players = next)
}

/**
 * Remove the player with [id] and strip the id from every saved group's memberIds.
 * Unknown id is a no-op (returns the input unchanged).
 */
fun removePlayer(s: RosterState, id: String): RosterState {
    if (s.players.none { it.id == id }) return s
    val players = s.players.filter { it.id != id }
    val groups = s.groups.map { g ->
        if (id in g.memberIds) g.copy(memberIds = g.memberIds.filter { it != id }) else g
    }
    return RosterState(players, groups)
}

/**
 * Reorder players to match [orderedIds]. Listed players come first in that order; any not mentioned
 * keep their relative order at the end. Unknown / duplicate ids are ignored. Returns the input
 * unchanged if the order does not change.
 */
fun reorderPlayers(s: RosterState, orderedIds: List<String>): RosterState {
    val byId = s.players.associateBy { it.id }
    val seen = LinkedHashSet<String>()
    val ordered = ArrayList<Player>()
    for (id in orderedIds) {
        val pl = byId[id]
        if (pl != null && id !in seen) {
            seen.add(id)
            ordered.add(pl)
        }
    }
    for (pl in s.players) {
        if (pl.id !in seen) ordered.add(pl)
    }

    val unchanged = ordered.size == s.players.size &&
        ordered.indices.all { ordered[it] === s.players[it] }
    if (unchanged) return s

    return s.copy(players = ordered)
}

/**
 * Save (create or replace) a group with [id]. An existing group is replaced in place (preserving
 * its position); otherwise the new group is appended. [memberIds] is copied.
 */
fun saveGroup(
    s: RosterState,
    name: String,
    memberIds: List<String>,
    id: String,
    now: Long,
): RosterState {
    val group = SavedGroup(id = id, name = name, memberIds = memberIds.toList(), createdAt = now)
    val idx = s.groups.indexOfFirst { it.id == id }
    if (idx == -1) {
        return s.copy(groups = s.groups + group)
    }
    val next = s.groups.toMutableList()
    next[idx] = group
    return s.copy(groups = next)
}

/** Delete the group with [id]. Unknown id is a no-op (returns the input unchanged). */
fun deleteGroup(s: RosterState, id: String): RosterState {
    if (s.groups.none { it.id == id }) return s
    return s.copy(groups = s.groups.filter { it.id != id })
}

/**
 * Map [memberIds] to [PlayerSeat] snapshots, preserving the order of [memberIds] and skipping any
 * id not present in the roster.
 */
fun toSeats(s: RosterState, memberIds: List<String>): List<PlayerSeat> {
    val byId = s.players.associateBy { it.id }
    val seats = ArrayList<PlayerSeat>()
    for (id in memberIds) {
        val pl = byId[id] ?: continue
        seats.add(PlayerSeat(id = pl.id, name = pl.name, emoji = pl.emoji, color = pl.color))
    }
    return seats
}
