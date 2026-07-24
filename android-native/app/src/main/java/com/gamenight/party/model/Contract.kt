package com.gamenight.party.model

import kotlinx.serialization.Serializable

/**
 * The native mirror of src/sdk/types.ts — the frozen game contract. Game CONTENT text is bilingual
 * ({en, fa}); UI chrome uses string resources instead.
 */

enum class Lang { EN, FA }

/** Every piece of game content text is bilingual. */
@Serializable
data class LocalizedString(val en: String, val fa: String) {
    fun resolve(lang: Lang): String = if (lang == Lang.FA) fa else en
}

/** Card accent color name; maps to an [Accents] entry / the --color-game-* tokens. */
enum class ColorToken { GRAPE, TANGERINE, LIME, SKY, ROSE, GOLD, TEAL, VIOLET }

enum class GameCategory { PARTY, WORD, DEDUCTION, DRAWING, TRIVIA, REACTION, CARDS, SOCIAL, VOTING }

/** Feature flags the host uses to decide which setup affordances to show. */
data class GameCapabilities(
    val usesTeams: Boolean = false,
    val usesTimer: Boolean = false,
    val usesDeck: Boolean = false,
    val usesVoting: Boolean = false,
    val usesRevealGate: Boolean = false, // pass-the-phone curtain
    val passAndPlay: Boolean = true,
)

/** Static, content-free description of a game. Read at startup to build the home grid. */
data class GameManifest(
    val id: String,
    val name: LocalizedString,
    val tagline: LocalizedString,
    val description: LocalizedString,
    val icon: String, // emoji rendered on the card
    val color: ColorToken,
    val category: GameCategory,
    val minPlayers: Int,
    val maxPlayers: Int,
    val estimatedMinutes: IntRange,
    val capabilities: GameCapabilities = GameCapabilities(),
    val howToPlay: LocalizedString? = null,
    val supportsCustomContent: Boolean = false,
    val experimental: Boolean = false,
)

/** A player taking part in a match, in seat order. */
data class PlayerSeat(
    val id: String,
    val name: String,
    val emoji: String? = null,
    val color: ColorToken? = null,
)
