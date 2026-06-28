package com.gamenight.party.game.truthordare

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
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.accent

/**
 * The mountable entry for Truth or Dare. Implements the shared [GameEntry] contract: it owns the
 * whole Setup -> Play -> Results flow and a single internal, seed-threaded [ToDState], driving every
 * transition through the PURE [reducer]. A registry just looks this up by [id] and calls [Mount].
 */
object TruthOrDareGame : GameEntry {
    override val id: String = ToDContent.GAME_ID

    @Composable
    override fun Mount(players: List<PlayerSeat>, host: GameHost) {
        ToDAccent {
            // The shared content DB is parsed once from assets and fed to the pure logic + screens.
            val content = remember(host.content) { ToDContent.load(host.content) }
            var state by remember { mutableStateOf<ToDState?>(null) }

            val s = state
            when {
                s == null -> TruthOrDareSetupScreen(
                    players = players,
                    lang = host.lang,
                    content = content,
                    onStart = { state = it },
                    onExit = { host.exit() },
                )

                s.finished -> TruthOrDareResultsScreen(
                    state = s,
                    lang = host.lang,
                    onPlayAgain = { state = null },
                    onExit = { host.exit() },
                    // UI-layer feedback cues (sound/haptics are effects, never fired in the reducer).
                    sound = host.sound,
                    haptics = host.haptics,
                )

                else -> TruthOrDarePlayScreen(
                    state = s,
                    lang = host.lang,
                    content = content,
                    // Reading `state` (not the captured `s`) keeps the reducer fed the latest value.
                    dispatch = { action -> state = state?.let { reducer(it, action) } },
                    onExit = { host.exit() },
                    // UI-layer feedback cues (sound/haptics are effects, never fired in the reducer).
                    sound = host.sound,
                    haptics = host.haptics,
                )
            }
        }
    }
}

/** Re-tints every control to this game's manifest accent (gold), mirroring the web --game-accent. */
@Composable
private fun ToDAccent(content: @Composable () -> Unit) {
    val color = GameCatalog.byId(ToDContent.GAME_ID)?.color ?: ColorToken.GOLD
    CompositionLocalProvider(LocalAccent provides color.accent(), content = content)
}

/**
 * A fresh entropy seed at the impure UI boundary (mirrors the web `ctx.random.seed()`). Everything
 * downstream of the reducer is deterministic from this value.
 */
internal fun freshSeed(): Int = kotlin.random.Random.nextInt()
