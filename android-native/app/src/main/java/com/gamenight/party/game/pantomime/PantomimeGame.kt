package com.gamenight.party.game.pantomime

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
 * Host-side entropy for the deterministic reducer/initial-state. Lives in the Compose layer (NOT the
 * reducer): every shuffle/seed the pure logic consumes is threaded in from here.
 */
fun pantomimeSeed(): Int = Random.nextInt()

/**
 * The mountable Pantomime game. A registry keeps this in its `List<GameEntry>`; the shell looks it up
 * by [id] (matching its GameManifest in GameCatalog) and calls [Mount], which owns the whole
 * Setup -> Play -> Results flow with its own internal, seed-threaded [PantomimeState].
 *
 * Also exposes the pure [reduce] reducer and the [initialState] factory for tests / a future
 * networked host. The Setup/Play/Results composables are top-level in this package:
 * [PantomimeSetupScreen], [PantomimePlayScreen], [PantomimeResultsScreen].
 */
object PantomimeGame : GameEntry {
    override val id: String = "pantomime"

    /** The pure reducer (logic.ts parity). */
    val reduce: (PantomimeState, PantomimeAction) -> PantomimeState = ::reducer

    /** Seeded initial-state factory from a config + the loaded content. */
    fun initialState(config: PantomimeConfig, content: PantomimeContent, seed: Int): PantomimeState =
        createInitialState(config, content, seed)

    @Composable
    override fun Mount(players: List<PlayerSeat>, host: GameHost) {
        // Parse the shared web JSON once (language-independent; the screens resolve EN/FA live).
        val content = remember { PantomimeContentLoader.load(host.content) }
        var config by remember { mutableStateOf<PantomimeConfig?>(null) }
        var state by remember { mutableStateOf<PantomimeState?>(null) }

        val s = state
        val cfg = config
        when {
            s == null || cfg == null -> {
                PantomimeSetupScreen(
                    players = players,
                    content = content,
                    lang = host.lang,
                    manifest = host.manifest,
                    onClose = host::requestExit,
                    onStart = { newConfig ->
                        config = newConfig
                        state = createInitialState(newConfig, content, pantomimeSeed())
                    },
                )
            }

            s.phase == PantomimePhase.RESULTS -> {
                PantomimeResultsScreen(
                    state = s,
                    lang = host.lang,
                    manifest = host.manifest,
                    sound = host.sound,
                    haptics = host.haptics,
                    onClose = host::requestExit,
                    onHome = host::exit,
                    onPlayAgain = { state = createInitialState(cfg, content, pantomimeSeed()) },
                )
            }

            else -> {
                PantomimePlayScreen(
                    state = s,
                    content = content,
                    lang = host.lang,
                    manifest = host.manifest,
                    sound = host.sound,
                    haptics = host.haptics,
                    dispatch = { action -> state = state?.let { reducer(it, action) } },
                    onClose = host::requestExit,
                    // Error phase offers "play again"; re-create the match from the same config.
                    onPlayAgain = { state = createInitialState(cfg, content, pantomimeSeed()) },
                )
            }
        }
    }
}
