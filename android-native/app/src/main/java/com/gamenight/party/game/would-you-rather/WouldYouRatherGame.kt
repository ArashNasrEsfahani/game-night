package com.gamenight.party.game.wouldyourather

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.gamenight.party.game.GameEntry
import com.gamenight.party.game.GameHost
import com.gamenight.party.model.PlayerSeat

/**
 * The mountable "Would You Rather" game. Implements the shared [GameEntry] contract: a registry
 * looks it up by [id] (matching its GameManifest in GameCatalog) and calls [Mount], which drives the
 * whole Setup → Play → Results flow with its own internal, seed-threaded [WyrState].
 *
 * The pure logic lives in Logic.kt ([createInitialState] + [reducer]); the screens live in
 * Screens.kt ([WouldYouRatherSetupScreen] / [WouldYouRatherPlayScreen] /
 * [WouldYouRatherResultsScreen]); the shared content DB is parsed once via [WyrContent.load].
 */
object WouldYouRatherGame : GameEntry {

    override val id: String = WyrContent.GAME_ID

    @Composable
    override fun Mount(players: List<PlayerSeat>, host: GameHost) {
        // Parse the shared JSON decks once (host supplies the app-wide ContentStore).
        val content = remember(host.content) { WyrContent.load(host.content) }
        var state by remember { mutableStateOf<WyrState?>(null) }

        val current = state
        when {
            current == null -> WouldYouRatherSetupScreen(
                content = content,
                players = players,
                host = host,
                onStart = { state = it },
            )

            current.phase == WyrPhase.RESULTS -> WouldYouRatherResultsScreen(
                state = current,
                host = host,
                onExit = host::exit,
                onPlayAgain = { state = null },
            )

            else -> WouldYouRatherPlayScreen(
                state = current,
                content = content,
                host = host,
                // Read the LATEST state at dispatch time so multi-dispatch handlers (CHOOSE then
                // ADVANCE_HANDOFF in one tap) compose correctly instead of racing a stale snapshot.
                dispatch = { action -> state = state?.let { reducer(it, action) } },
                onPlayAgain = { state = null },
            )
        }
    }
}
