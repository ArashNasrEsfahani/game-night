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
import com.gamenight.party.ui.theme.LocalAccent

/**
 * The Persian decorative vocabulary — native port of [motif] in src/sdk/ui/emblems.ts:
 * faravahar, lotus, tulip, tar, dome, crown, nightingale, gereh, boteh, lion-sun.
 *
 * Most motifs are monochrome line-art that tint to the active accent (the web drove them with
 * `currentColor` = --game-accent). The Lion & Sun is the one baked two-tone piece (gold sun over a
 * fiery mane) and is rendered untinted.
 */

/** The drawable resource for the named motif, or null if unknown. */
@DrawableRes
fun motifRes(name: String): Int? = when (name) {
    "faravahar" -> R.drawable.motif_faravahar
    "lotus" -> R.drawable.motif_lotus
    "tulip" -> R.drawable.motif_tulip
    "tar" -> R.drawable.motif_tar
    "dome" -> R.drawable.motif_dome
    "crown" -> R.drawable.motif_crown
    "nightingale" -> R.drawable.motif_nightingale
    "gereh" -> R.drawable.motif_gereh
    "boteh" -> R.drawable.motif_boteh
    "lion-sun", "lionsun" -> R.drawable.motif_lion_sun
    else -> null
}

private fun isBakedMotif(name: String) = name == "lion-sun" || name == "lionsun"

/**
 * Renders a Persian motif. Renders nothing for an unknown name.
 * @param accent the colour applied to the motif's line-art (defaults to the active game accent).
 *               Ignored for the inherently two-tone Lion & Sun.
 */
@Composable
fun Motif(
    name: String,
    modifier: Modifier = Modifier,
    accent: Color = LocalAccent.current.base,
) {
    val res = motifRes(name) ?: return
    Image(
        painter = painterResource(res),
        contentDescription = null,
        modifier = modifier,
        contentScale = ContentScale.Fit,
        colorFilter = if (isBakedMotif(name)) null else ColorFilter.tint(accent),
    )
}
