package com.gamenight.party.game

import com.gamenight.party.game.codenames.CodenamesGame
import com.gamenight.party.game.dowr.DowrGame
import com.gamenight.party.game.headsup.HeadsUpGame
import com.gamenight.party.game.mafia.MafiaGame
import com.gamenight.party.game.minesweeper.MinesweeperGame
import com.gamenight.party.game.mostlikelyto.MostLikelyToGame
import com.gamenight.party.game.neverhaveiever.NeverHaveIEverGame
import com.gamenight.party.game.pantomime.PantomimeGame
import com.gamenight.party.game.spyfall.SpyfallGame
import com.gamenight.party.game.truthordare.TruthOrDareGame
import com.gamenight.party.game.wouldyourather.WouldYouRatherGame

/**
 * The registry of fully-ported, mountable native games. Each entry is the per-game singleton
 * implementing [GameEntry]; the shell looks one up by id (matching a [GameManifest][com.gamenight.party.model.GameManifest]
 * in [GameCatalog]) and calls [GameEntry.Mount].
 *
 * Every game in [GameCatalog] currently has a registered implementation, so [byId] resolves for all
 * eleven ids. Should a future catalog entry land without a port, [byId] returns `null` and the shell
 * shows a "coming soon" detail instead.
 */
object GameRegistry {

    /** All ported games, in catalog order. */
    val all: List<GameEntry> = listOf(
        CodenamesGame,
        DowrGame,
        HeadsUpGame,
        MafiaGame,
        MinesweeperGame,
        MostLikelyToGame,
        NeverHaveIEverGame,
        PantomimeGame,
        SpyfallGame,
        TruthOrDareGame,
        WouldYouRatherGame,
    )

    private val index: Map<String, GameEntry> = all.associateBy { it.id }

    /** The mountable game for [id], or `null` if that catalog game isn't ported yet. */
    fun byId(id: String): GameEntry? = index[id]
}
