package com.gamenight.party.game.codenames

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.gamenight.party.game.GameEntry
import com.gamenight.party.game.GameHost
import com.gamenight.party.model.PlayerSeat

/**
 * The mountable registry entry for Codenames. Bundles the [id], the pure [reducer] /
 * [createInitialState] (top-level in this package) and the three screens, driving the whole
 * Setup → Play → Results flow with its own seed-threaded state — a native mirror of how the webapp
 * routes a game's screens around its reducer.
 */
object CodenamesGame : GameEntry {
    override val id: String = "codenames"

    @Composable
    override fun Mount(players: List<PlayerSeat>, host: GameHost) {
        // Parse the shared word packs once from the runtime ContentStore.
        val content = remember(host.content) { CodenamesContent.load(host.content) }
        var state by remember { mutableStateOf<CodenamesState?>(null) }

        val current = state
        when {
            current == null -> CodenamesSetupScreen(
                content = content,
                players = players,
                lang = host.lang,
                onStart = { state = it },
                onExit = host::exit,
            )

            current.finished -> CodenamesResultsScreen(
                state = current,
                lang = host.lang,
                sound = host.sound,
                haptics = host.haptics,
                onPlayAgain = { state = null }, // back to setup for a fresh board
                onExit = host::exit,
            )

            else -> CodenamesPlayScreen(
                state = current,
                dispatch = { action -> state?.let { state = reducer(it, action) } },
                lang = host.lang,
                sound = host.sound,
                haptics = host.haptics,
                onExit = host::exit,
            )
        }
    }
}
