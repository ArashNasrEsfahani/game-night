package com.gamenight.party.game.spyfall

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.gamenight.party.game.GameEntry
import com.gamenight.party.game.GameHost
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.accent
import kotlin.random.Random

/**
 * The mountable Spyfall game — the native equivalent of src/games/spyfall/index.ts. A registry holds
 * this in its `List<GameEntry>`; the shell looks it up by [id] (matching the violet "spyfall"
 * GameManifest in GameCatalog) and calls [Mount], which owns the whole Setup -> Play -> Results flow.
 *
 * The reducer + createInitialState stay PURE top-level functions ([reducer], [createInitialState]);
 * the impure boundary — fresh seeds (entropy) and the wall clock — lives here / in the screens.
 */
object SpyfallGame : GameEntry {
    override val id: String = "spyfall"

    /** Names of the three composables a registry/host can mount: see [SpyfallSetupScreen], [SpyfallPlayScreen], [SpyfallResultsScreen]. */
    @Composable
    override fun Mount(players: List<PlayerSeat>, host: GameHost) {
        // Parse the shared JSON once (idempotent) — the single source of truth shared with the webapp.
        remember(host.content) { SpyfallContent.load(host.content) }

        var state by remember { mutableStateOf<SpyfallState?>(null) }

        // Reads the latest state on every call (handles the timer's TIMER_EXPIRED multi-dispatch).
        val dispatch: (SpyfallAction) -> Unit = { action -> state = state?.let { reducer(it, action) } }

        // Mount everything inside the game's manifest accent (violet) so all controls recolor.
        CompositionLocalProvider(LocalAccent provides ColorToken.VIOLET.accent()) {
            val current = state
            when {
                current == null -> SpyfallSetupScreen(
                    players = players,
                    lang = host.lang,
                    manifest = host.manifest,
                    onClose = host::requestExit,
                    onStart = { config -> state = createInitialState(config, Random.nextInt()) },
                )
                current.finished -> SpyfallResultsScreen(
                    state = current,
                    lang = host.lang,
                    manifest = host.manifest,
                    onPlayAgain = { state = null },
                    onClose = host::requestExit,
                    onExit = host::exit,
                    sound = host.sound,
                    haptics = host.haptics,
                )
                else -> SpyfallPlayScreen(
                    state = current,
                    lang = host.lang,
                    manifest = host.manifest,
                    onClose = host::requestExit,
                    onExit = host::exit,
                    dispatch = dispatch,
                    sound = host.sound,
                    haptics = host.haptics,
                )
            }
        }
    }
}
