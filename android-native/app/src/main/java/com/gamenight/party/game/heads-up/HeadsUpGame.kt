package com.gamenight.party.game.headsup

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.gamenight.party.game.GameCatalog
import com.gamenight.party.game.GameEntry
import com.gamenight.party.game.GameHost
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.PlayerSeat

/**
 * The mountable Heads Up! game — the native equivalent of src/games/heads-up/index.ts. Implements the
 * shared [GameEntry] contract so a registry can look it up by [id] and call [Mount]; it also exposes
 * the pure [createInitialState] / [reducer] (and the three screen composables
 * [HeadsUpSetupScreen] / [HeadsUpPlayScreen] / [HeadsUpResultsScreen]) for tests and custom hosts.
 *
 * [Mount] is the Setup -> Play -> Results state machine: it holds the resolved match config + the
 * reducer state, threads a [freshSeed] at every impure boundary, and dispatches updates reading the
 * LATEST state so multi-dispatch handlers compose correctly.
 */
object HeadsUpGame : GameEntry {
    override val id: String = "heads-up"

    /** Static catalog metadata for this game (titles, accent, player range). */
    override val manifest: GameManifest = requireNotNull(GameCatalog.byId(id)) { "heads-up missing from GameCatalog" }

    /** Pure, deterministic initial state (seed-threaded) — mirrors logic.ts. */
    fun createInitialState(config: HeadsUpConfig, seed: Int): HeadsUpState =
        HeadsUpLogic.createInitialState(config, seed)

    /** Pure reducer — mirrors logic.ts. */
    fun reducer(state: HeadsUpState, action: HeadsUpAction): HeadsUpState =
        HeadsUpLogic.reducer(state, action)

    @Composable
    override fun Mount(players: List<PlayerSeat>, host: GameHost) {
        var config by remember { mutableStateOf<HeadsUpConfig?>(null) }
        var state by remember { mutableStateOf<HeadsUpState?>(null) }

        val cfg = config
        val st = state
        when {
            cfg == null || st == null ->
                HeadsUpSetupScreen(
                    players = players,
                    content = host.content,
                    lang = host.lang,
                    onExit = host::exit,
                    onStart = { c ->
                        config = c
                        state = HeadsUpLogic.createInitialState(c, freshSeed())
                    },
                )

            st.finished ->
                HeadsUpResultsScreen(
                    content = host.content,
                    lang = host.lang,
                    state = st,
                    onPlayAgain = { state = HeadsUpLogic.createInitialState(cfg, freshSeed()) },
                    onExit = host::exit,
                    sound = host.sound,
                    haptics = host.haptics,
                )

            else ->
                HeadsUpPlayScreen(
                    content = host.content,
                    lang = host.lang,
                    state = st,
                    dispatch = { a -> state = state?.let { HeadsUpLogic.reducer(it, a) } },
                    onExit = host::exit,
                    sound = host.sound,
                    haptics = host.haptics,
                )
        }
    }
}
