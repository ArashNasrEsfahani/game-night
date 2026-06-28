package com.gamenight.party.game.mostlikelyto

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.gamenight.party.game.GameEntry
import com.gamenight.party.game.GameHost
import com.gamenight.party.model.PlayerSeat
import kotlin.random.Random

/**
 * The mountable "Most Likely To" game — the registry entry that drives the whole
 * Setup → Play → Results flow with its own internal, seed-threaded [MltState].
 *
 * Exposes [id] plus (via the package) the three screen composables
 * [MostLikelyToSetupScreen]/[MostLikelyToPlayScreen]/[MostLikelyToResultsScreen] and the pure
 * [createInitialState]/[reducer]. Mirrors the webapp's GameModule wiring (index.ts).
 */
object MostLikelyToGame : GameEntry {

    override val id: String = MltContent.GAME_ID // "most-likely-to"

    @Composable
    override fun Mount(players: List<PlayerSeat>, host: GameHost) {
        // Parse the shared JSON content once for this mount.
        val content = remember(host.content) { MltContent.load(host.content) }

        var state by remember { mutableStateOf<MltState?>(null) }
        val current = state

        when {
            current == null -> MostLikelyToSetupScreen(
                roster = players,
                content = content,
                host = host,
                onStart = { config -> state = createInitialState(config, Random.nextInt()) },
            )

            current.finished -> MostLikelyToResultsScreen(
                state = current,
                host = host,
                onPlayAgain = { state = null },
            )

            else -> MostLikelyToPlayScreen(
                state = current,
                content = content,
                dispatch = { action -> state = state?.let { reducer(it, action) } },
                host = host,
            )
        }
    }
}
