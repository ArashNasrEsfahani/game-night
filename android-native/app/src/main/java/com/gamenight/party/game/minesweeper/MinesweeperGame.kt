package com.gamenight.party.game.minesweeper

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.gamenight.party.game.GameCatalog
import com.gamenight.party.game.GameEntry
import com.gamenight.party.game.GameHost
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.accent
import kotlin.random.Random

/**
 * Mine Hunt — the registry-mountable entry. Implements [GameEntry] (Setup -> Play -> Results), and
 * re-exposes the pure [reducer] / [createInitialState] and the three screen composables for tests and
 * direct embedding.
 *
 * Mirrors src/games/minesweeper/index.ts (the web `GameModule`): same id, same logic, same screens.
 */
object MinesweeperGame : GameEntry {

    override val id: String = "minesweeper"

    override val manifest: GameManifest =
        GameCatalog.byId("minesweeper") ?: error("minesweeper missing from GameCatalog")

    // ── Pure logic surface (thin wrappers over the top-level functions in Logic.kt). ──

    /** Build the hidden initial board for [config]. The layout seed arrives later, on first reveal. */
    fun createInitialState(config: MinesweeperConfig, seed: Int): MinesweeperState =
        com.gamenight.party.game.minesweeper.createInitialState(config, seed)

    /** The pure, deterministic reducer. */
    fun reducer(state: MinesweeperState, action: MinesweeperAction): MinesweeperState =
        com.gamenight.party.game.minesweeper.reducer(state, action)

    private enum class MountPhase { SETUP, PLAY, RESULTS }

    @Composable
    override fun Mount(players: List<PlayerSeat>, host: GameHost) {
        // Wrap the whole flow in this game's manifest accent (tangerine).
        CompositionLocalProvider(LocalAccent provides ColorToken.TANGERINE.accent()) {
            var phase by remember { mutableStateOf(MountPhase.SETUP) }
            var config by remember { mutableStateOf<MinesweeperConfig?>(null) }
            var state by remember { mutableStateOf<MinesweeperState?>(null) }

            when (phase) {
                MountPhase.SETUP -> MinesweeperSetupScreen(
                    roster = players,
                    lang = host.lang,
                    manifest = host.manifest,
                    onClose = host::requestExit,
                    onStart = { cfg ->
                        config = cfg
                        val st = createInitialState(cfg, Random.nextInt())
                        state = st
                        phase = if (st.phase == MinePhase.GAME_OVER) MountPhase.RESULTS else MountPhase.PLAY
                    },
                )

                MountPhase.PLAY -> MinesweeperPlayScreen(
                    state = state!!,
                    lang = host.lang,
                    manifest = host.manifest,
                    dispatch = { action ->
                        val cur = state
                        if (cur != null) {
                            val next = reducer(cur, action)
                            state = next
                            if (next.phase == MinePhase.GAME_OVER) phase = MountPhase.RESULTS
                        }
                    },
                    onClose = host::requestExit,
                    sound = host.sound,
                    haptics = host.haptics,
                )

                MountPhase.RESULTS -> MinesweeperResultsScreen(
                    state = state!!,
                    lang = host.lang,
                    manifest = host.manifest,
                    onClose = host::requestExit,
                    onExit = host::exit,
                    sound = host.sound,
                    haptics = host.haptics,
                    onPlayAgain = {
                        val cfg = config
                        if (cfg != null) {
                            // New board from the same config + a fresh layout seed (web nav.playAgain).
                            state = createInitialState(cfg, Random.nextInt())
                            phase = MountPhase.PLAY
                        } else {
                            phase = MountPhase.SETUP
                        }
                    },
                )
            }
        }
    }
}
