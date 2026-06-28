package com.gamenight.party.game.dowr

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
 * The mountable native entry for "Dowr" — a registry keeps this in its `List<GameEntry>` and the
 * shell calls [Mount] when the user opens the matching [com.gamenight.party.model.GameManifest]
 * (`GameCatalog.byId("dowr")`).
 *
 * It owns the whole Setup -> Play -> Results state machine with its own seed-threaded [DowrState]:
 *   - the pure transition is [reducer]; the pure builder is [createInitialState].
 *   - fresh seeds (the web's `ctx.random.seed()`) come from [Random] at this impure boundary and are
 *     threaded into every action so the reducer downstream stays reproducible.
 *   - content is parsed once from the shared assets via [GameHost.content].
 */
object DowrGame : GameEntry {
    override val id: String = "dowr"

    @Composable
    override fun Mount(players: List<PlayerSeat>, host: GameHost) {
        val content = remember(host.content) { DowrContent.load(host.content) }
        var state by remember { mutableStateOf<DowrState?>(null) }

        val s = state
        when {
            s == null -> DowrSetupScreen(
                players = players,
                content = content,
                lang = host.lang,
                manifest = host.manifest,
                onClose = host::requestExit,
                onStart = { config -> state = createInitialState(config, Random.nextInt()) },
            )

            !s.finished -> DowrPlayScreen(
                state = s,
                lang = host.lang,
                manifest = host.manifest,
                nextSeed = { Random.nextInt() },
                dispatch = { action -> state = state?.let { reducer(it, action) } },
                onClose = host::requestExit,
                sound = host.sound,
                haptics = host.haptics,
            )

            else -> DowrResultsScreen(
                state = s,
                lang = host.lang,
                manifest = host.manifest,
                onPlayAgain = { state = null },
                onClose = host::requestExit,
                onExit = host::exit,
                sound = host.sound,
                haptics = host.haptics,
            )
        }
    }
}
