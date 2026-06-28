package com.gamenight.party.store

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import com.gamenight.party.engine.fromValues
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

/** Whether a match win belongs to a team/faction or a free-for-all individual. */
enum class MatchMode { INDIVIDUAL, TEAM }

/**
 * The result of a finished match, used to update the cross-game overall leaderboard — the native
 * mirror of the web `MatchOutcome` (returned by a game module's `getOutcome`).
 */
data class MatchOutcome(
    val mode: MatchMode,
    /** Player ids who won (for a team game, the members of the winning team/faction). */
    val winnerIds: List<String>,
    /** All player ids who took part (drives the "games played" tally). */
    val participantIds: List<String>,
)

/** Per-player cross-game tally (names are snapshotted so the board survives roster edits). */
@Serializable
data class PlayerTally(
    val id: String,
    val name: String,
    val individual: Int = 0, // free-for-all wins
    val team: Int = 0,       // team/group wins
    val played: Int = 0,     // matches participated in
)

/** Persisted leaderboard slice (deduped by match key). */
@Serializable
data class LeaderboardData(
    val tallies: Map<String, PlayerTally> = emptyMap(),
    val recorded: List<String> = emptyList(), // match keys already counted (dedupe)
    val totalMatches: Int = 0,
)

/** One ranked display row produced by [leaderboardRows]: tally + total wins + competition rank. */
data class LeaderboardRow(
    val id: String,
    val name: String,
    val individual: Int,
    val team: Int,
    val played: Int,
    val total: Int,
    /** 1-based competition rank (ties share a rank), via the engine results model. */
    val rank: Int,
)

/**
 * Sorted, ranked standings (total wins desc, then individual wins, then name) — the native port of
 * the web `leaderboardRows`. Ranks come from the engine results model ([fromValues]) so ties share a
 * rank, fed in the already-sorted order so its stable tie-break preserves this ordering.
 */
fun leaderboardRows(tallies: Map<String, PlayerTally>): List<LeaderboardRow> {
    val sorted = tallies.values
        .map { it to (it.individual + it.team) }
        .sortedWith(
            compareByDescending<Pair<PlayerTally, Int>> { it.second }
                .thenByDescending { it.first.individual }
                .thenBy { it.first.name },
        )

    val values = LinkedHashMap<String, Int>()
    sorted.forEach { (tally, total) -> values[tally.id] = total }
    val rankById = fromValues(values).standings.associate { it.subjectId to it.rank }

    return sorted.map { (tally, total) ->
        LeaderboardRow(
            id = tally.id,
            name = tally.name,
            individual = tally.individual,
            team = tally.team,
            played = tally.played,
            total = total,
            rank = rankById[tally.id] ?: 0,
        )
    }
}

/**
 * Persisted cross-game leaderboard store — the native port of the web `leaderboardStore`. Each
 * finished match is recorded once (deduped by [MatchOutcome] key); per player we tally individual
 * wins, team wins, and games played.
 */
class LeaderboardStore(
    private val dataStore: DataStore<Preferences>,
    private val scope: CoroutineScope,
) {
    private val key = stringPreferencesKey("leaderboard")

    /** The live leaderboard data, ready to read anywhere via `collectAsState()`. */
    val state: StateFlow<LeaderboardData> = dataStore.data
        .catch { e -> if (e is IOException) emit(emptyPreferences()) else throw e }
        .map { decode(it) }
        .stateIn(scope, SharingStarted.Eagerly, LeaderboardData())

    /** true once the first value has been read back from disk. */
    val hydrated: StateFlow<Boolean> = dataStore.data
        .catch { e -> if (e is IOException) emit(emptyPreferences()) else throw e }
        .map { true }
        .stateIn(scope, SharingStarted.Eagerly, false)

    /**
     * Record a finished match. [names] maps player id -> display name (from the match config). A
     * repeated [matchKey] is ignored, so it is safe to call this idempotently from a Results screen.
     */
    fun record(matchKey: String, outcome: MatchOutcome, names: Map<String, String>) {
        scope.launch {
            dataStore.edit { prefs ->
                val cur = decode(prefs)
                if (cur.recorded.contains(matchKey)) return@edit

                val tallies = LinkedHashMap(cur.tallies)
                fun ensure(id: String): PlayerTally {
                    val base = tallies[id] ?: PlayerTally(id = id, name = names[id] ?: id)
                    val named = names[id]?.let { base.copy(name = it) } ?: base
                    tallies[id] = named
                    return named
                }

                for (id in outcome.participantIds) {
                    val t = ensure(id)
                    tallies[id] = t.copy(played = t.played + 1)
                }
                for (id in outcome.winnerIds) {
                    val t = ensure(id)
                    tallies[id] = if (outcome.mode == MatchMode.TEAM) {
                        t.copy(team = t.team + 1)
                    } else {
                        t.copy(individual = t.individual + 1)
                    }
                }

                val next = cur.copy(
                    tallies = tallies,
                    recorded = cur.recorded + matchKey,
                    totalMatches = cur.totalMatches + 1,
                )
                prefs[key] = storeJson.encodeToString(next)
            }
        }
    }

    /** Wipe the whole leaderboard back to empty. */
    fun reset() {
        scope.launch {
            dataStore.edit { prefs -> prefs[key] = storeJson.encodeToString(LeaderboardData()) }
        }
    }

    private fun decode(prefs: Preferences): LeaderboardData {
        val raw = prefs[key] ?: return LeaderboardData()
        return runCatching { storeJson.decodeFromString<LeaderboardData>(raw) }
            .getOrElse { LeaderboardData() }
    }
}
