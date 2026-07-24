package com.gamenight.party.game.neverhaveiever

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
 * The mountable registry entry for "Never Have I Ever". Exposes the game [id], the pure
 * [createInitialState]/[reducer] (re-surfaced as [initialState]/[reduce]) and — via [Mount] — the
 * three screens [NeverHaveIEverSetupScreen] / [NeverHaveIEverPlayScreen] /
 * [NeverHaveIEverResultsScreen]. A registry keeps a list of [GameEntry] and calls [Mount].
 */
object NeverHaveIEverGame : GameEntry {
    override val id: String = NhieContent.GAME_ID

    /** Pure, seed-threaded initial state (mirrors logic.ts createInitialState). */
    fun initialState(config: NhieConfig, seed: Int): NhieState = createInitialState(config, seed)

    /** Pure reducer (mirrors logic.ts reducer). */
    fun reduce(state: NhieState, action: NhieAction): NhieState = reducer(state, action)

    @Composable
    override fun Mount(players: List<PlayerSeat>, host: GameHost) {
        // Parse the three shared decks once from the SHARED content pipeline.
        val content = remember { NhieContent.load(host.content) }

        var config by remember { mutableStateOf<NhieConfig?>(null) }
        // Bumping the nonce reseeds + rebuilds the match (the web's nav.playAgain()).
        var matchNonce by remember { mutableStateOf(0) }

        val cfg = config
        if (cfg == null) {
            NeverHaveIEverSetupScreen(
                players = players,
                content = content,
                lang = host.lang,
                manifest = host.manifest,
                onClose = host::requestExit,
                onStart = { config = it },
            )
            return
        }

        // Fresh seed per match at the impure boundary; everything downstream is reproducible.
        val seed = remember(matchNonce, cfg) { Random.nextInt() }
        var state by remember(matchNonce, cfg) { mutableStateOf(createInitialState(cfg, seed)) }
        val dispatch: (NhieAction) -> Unit = { action -> state = reducer(state, action) }

        if (state.phase == NhiePhase.RESULTS) {
            NeverHaveIEverResultsScreen(
                state = state,
                lang = host.lang,
                sound = host.sound,
                haptics = host.haptics,
                manifest = host.manifest,
                // Match is over — the chrome X and Home both go straight home (nothing left to confirm).
                onClose = host::exit,
                onExit = host::exit,
                onRematch = { matchNonce++ },
            )
        } else {
            NeverHaveIEverPlayScreen(
                state = state,
                content = content,
                lang = host.lang,
                sound = host.sound,
                haptics = host.haptics,
                manifest = host.manifest,
                dispatch = dispatch,
                onClose = host::requestExit,
                onRematch = { matchNonce++ },
            )
        }
    }
}
