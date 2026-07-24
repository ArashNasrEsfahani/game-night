package com.gamenight.party.store

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import com.gamenight.party.model.ColorToken
import com.gamenight.party.engine.Player
import com.gamenight.party.engine.PlayerDraft
import com.gamenight.party.engine.PlayerPatch
import com.gamenight.party.engine.RosterState
import com.gamenight.party.engine.SavedGroup
import com.gamenight.party.engine.emptyRoster
import com.gamenight.party.engine.makeId
import com.gamenight.party.engine.addPlayer as engineAddPlayer
import com.gamenight.party.engine.deleteGroup as engineDeleteGroup
import com.gamenight.party.engine.removePlayer as engineRemovePlayer
import com.gamenight.party.engine.reorderPlayers as engineReorder
import com.gamenight.party.engine.saveGroup as engineSaveGroup
import com.gamenight.party.engine.updatePlayer as engineUpdatePlayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import java.io.IOException

// ── On-disk shape. The pure engine types (Player/SavedGroup/RosterState) are intentionally NOT
// @Serializable, so we persist via DTOs that store ColorToken as its enum name. ──

@Serializable
private data class PlayerDto(
    val id: String,
    val name: String,
    val emoji: String? = null,
    val color: String? = null, // ColorToken.name, or null
    val createdAt: Long = 0L,
)

@Serializable
private data class GroupDto(
    val id: String,
    val name: String,
    val memberIds: List<String> = emptyList(),
    val createdAt: Long = 0L,
)

@Serializable
private data class RosterDto(
    val players: List<PlayerDto> = emptyList(),
    val groups: List<GroupDto> = emptyList(),
)

private fun RosterState.toDto() = RosterDto(
    players = players.map { PlayerDto(it.id, it.name, it.emoji, it.color?.name, it.createdAt) },
    groups = groups.map { GroupDto(it.id, it.name, it.memberIds, it.createdAt) },
)

private fun RosterDto.toState() = RosterState(
    players = players.map {
        Player(
            id = it.id,
            name = it.name,
            emoji = it.emoji,
            color = it.color?.let { c -> runCatching { ColorToken.valueOf(c) }.getOrNull() },
            createdAt = it.createdAt,
        )
    },
    groups = groups.map { SavedGroup(it.id, it.name, it.memberIds, it.createdAt) },
)

/**
 * Persisted roster store — the native port of the web `rosterStore`. All mutations delegate to the
 * pure `engine/roster` functions; this layer only supplies ids + timestamps and persists the result.
 *
 * The DataStore is the single source of truth: [state] (an engine [RosterState], the type Setup
 * screens and `engine.toSeats` consume) is derived from it, and every mutator is an atomic
 * read-modify-write transaction. Mutators are fire-and-forget (launched on [scope]).
 */
class RosterStore(
    private val dataStore: DataStore<Preferences>,
    private val scope: CoroutineScope,
) {
    private val key = stringPreferencesKey("roster")

    /** The live roster, ready to read anywhere via `collectAsState()`. */
    val state: StateFlow<RosterState> = dataStore.data
        .catch { e -> if (e is IOException) emit(emptyPreferences()) else throw e }
        .map { decode(it) }
        .stateIn(scope, SharingStarted.Eagerly, emptyRoster())

    /** true once the first value has been read back from disk. */
    val hydrated: StateFlow<Boolean> = dataStore.data
        .catch { e -> if (e is IOException) emit(emptyPreferences()) else throw e }
        .map { true }
        .stateIn(scope, SharingStarted.Eagerly, false)

    /** Append a player; returns the freshly minted id synchronously (persistence is async). */
    fun addPlayer(draft: PlayerDraft): String {
        val now = System.currentTimeMillis()
        val id = "p_" + makeId(now.toInt())
        update { engineAddPlayer(it, draft, id, now) }
        return id
    }

    fun updatePlayer(id: String, patch: PlayerPatch) = update { engineUpdatePlayer(it, id, patch) }

    fun removePlayer(id: String) = update { engineRemovePlayer(it, id) }

    /** Reorder players to match [orderedIds] (see `engine.reorderPlayers`). */
    fun reorder(orderedIds: List<String>) = update { engineReorder(it, orderedIds) }

    /** Save (create or replace) a named group; returns the group id synchronously. */
    fun saveGroup(name: String, memberIds: List<String>): String {
        val now = System.currentTimeMillis()
        val id = "g_" + makeId(now.toInt())
        update { engineSaveGroup(it, name, memberIds, id, now) }
        return id
    }

    fun deleteGroup(id: String) = update { engineDeleteGroup(it, id) }

    private fun decode(prefs: Preferences): RosterState {
        val raw = prefs[key] ?: return emptyRoster()
        return runCatching { storeJson.decodeFromString<RosterDto>(raw).toState() }
            .getOrElse { emptyRoster() }
    }

    private fun update(transform: (RosterState) -> RosterState) {
        scope.launch {
            dataStore.edit { prefs ->
                prefs[key] = storeJson.encodeToString(transform(decode(prefs)).toDto())
            }
        }
    }
}
