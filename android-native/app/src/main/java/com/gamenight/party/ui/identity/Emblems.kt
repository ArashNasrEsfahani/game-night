package com.gamenight.party.ui.identity

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.gamenight.party.R

/**
 * Per-game heraldic emblems — the native port of [gameEmblem] in src/sdk/ui/emblems.ts.
 *
 * Each emblem vector bakes in its game's accent colour (the web used `currentColor` = the per-game
 * --game-accent, which is fixed per game) alongside the gold/ink heraldry, so it renders faithfully
 * with no tint. Pass [tint] to flatten an emblem to a single colour (e.g. on a coloured chip).
 */

/** The drawable resource for [gameId]'s emblem, or null if the id is unknown. */
@DrawableRes
fun emblemRes(gameId: String): Int? = when (gameId) {
    "would-you-rather" -> R.drawable.emblem_would_you_rather
    "most-likely-to" -> R.drawable.emblem_most_likely_to
    "never-have-i-ever" -> R.drawable.emblem_never_have_i_ever
    "truth-or-dare" -> R.drawable.emblem_truth_or_dare
    "heads-up" -> R.drawable.emblem_heads_up
    "spyfall" -> R.drawable.emblem_spyfall
    "pantomime" -> R.drawable.emblem_pantomime
    "codenames" -> R.drawable.emblem_codenames
    "dowr" -> R.drawable.emblem_dowr
    "minesweeper" -> R.drawable.emblem_minesweeper
    "mafia" -> R.drawable.emblem_mafia
    else -> null
}

/**
 * Renders [gameId]'s emblem. Renders nothing for an unknown id.
 * @param tint when non-null, recolours the whole emblem to this single colour.
 */
@Composable
fun Emblem(
    gameId: String,
    modifier: Modifier = Modifier,
    tint: Color? = null,
) {
    val res = emblemRes(gameId) ?: return
    Image(
        painter = painterResource(res),
        contentDescription = null,
        modifier = modifier,
        contentScale = ContentScale.Fit,
        colorFilter = tint?.let { ColorFilter.tint(it) },
    )
}
