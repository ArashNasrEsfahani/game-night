package com.gamenight.party.game.mafia

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
 * The mountable registry entry for "Mafia". Exposes the game [id], the pure
 * [createInitialState]/[reducer] (re-surfaced as [initialState]/[reduce]) and — via [Mount] — the
 * three screens [MafiaSetupScreen] / [MafiaPlayScreen] / [MafiaResultsScreen]. A registry keeps a
 * list of [GameEntry] and calls [Mount].
 *
 * Mafia has NO shared JSON content (its roles + presets live in code, see [Roles.kt]/[Content.kt]),
 * so [Mount] ignores `host.content`.
 */
object MafiaGame : GameEntry {
    override val id: String = "mafia"

    /** Pure, seed-threaded initial state (mirrors logic.ts createInitialState). */
    fun initialState(config: MafiaConfig, seed: Int): MafiaState = createInitialState(config, seed)

    /** Pure reducer (mirrors logic.ts reducer). */
    fun reduce(state: MafiaState, action: MafiaAction): MafiaState = reducer(state, action)

    @Composable
    override fun Mount(players: List<PlayerSeat>, host: GameHost) {
        var config by remember { mutableStateOf<MafiaConfig?>(null) }
        // Bumping the nonce reseeds + rebuilds the match (the web's nav.playAgain()).
        var matchNonce by remember { mutableStateOf(0) }

        val cfg = config
        if (cfg == null) {
            MafiaSetupScreen(
                players = players,
                lang = host.lang,
                onExit = host::exit,
                onStart = { config = it },
            )
            return
        }

        // Fresh seed per match at the impure boundary; everything downstream is reproducible.
        val seed = remember(matchNonce, cfg) { Random.nextInt() }
        var state by remember(matchNonce, cfg) { mutableStateOf(createInitialState(cfg, seed)) }
        val dispatch: (MafiaAction) -> Unit = { action -> state = reducer(state, action) }

        if (state.phase == MafiaPhase.ENDED) {
            MafiaResultsScreen(
                state = state,
                lang = host.lang,
                onExit = host::exit,
                onRematch = { matchNonce++ },
                sound = { host.sound.play(it) },
                haptics = host.haptics,
            )
        } else {
            MafiaPlayScreen(
                state = state,
                lang = host.lang,
                dispatch = dispatch,
                onExit = host::exit,
                onRematch = { matchNonce++ },
                sound = { host.sound.play(it) },
                haptics = host.haptics,
            )
        }
    }
}
