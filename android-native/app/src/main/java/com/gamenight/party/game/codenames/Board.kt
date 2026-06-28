package com.gamenight.party.game.codenames

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.Lang
import com.gamenight.party.ui.components.EaseOut
import com.gamenight.party.ui.components.pressScale
import com.gamenight.party.ui.theme.Assassin
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.NeutralCard
import com.gamenight.party.ui.theme.TeamA
import com.gamenight.party.ui.theme.TeamB

// Ink readable on the gold/neutral tile (mirrors --on-gold).
private val NeutralInk = Color(0xFF160F30)
private val CellShape = RoundedCornerShape(10.dp)

/** (fill, ink) for a revealed/key-visible cell of [role]. Mirrors PlayScreen.tsx `roleClass`. */
internal fun roleColors(role: CardRole): Pair<Color, Color> = when (role) {
    CardRole.TEAM_A -> TeamA to Color.White
    CardRole.TEAM_B -> TeamB to Color.White
    CardRole.NEUTRAL -> NeutralCard to NeutralInk
    CardRole.ASSASSIN -> Assassin to Color.White
}

/**
 * The 5×5 word grid. When [spymaster] is true every cell shows its key colour and is non-tappable
 * (the spymaster / results view); otherwise hidden cells read as the sunken surface and revealed
 * cells flip to their role colour. Pass [onTap] to make hidden cells guessable.
 */
@Composable
internal fun CnGrid(
    cells: List<BoardCell>,
    spymaster: Boolean,
    lang: Lang,
    modifier: Modifier = Modifier,
    onTap: ((Int) -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        for (r in 0 until 5) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (c in 0 until 5) {
                    val idx = r * 5 + c
                    val cell = cells.getOrNull(idx)
                    if (cell == null) {
                        Box(modifier = Modifier.weight(1f).aspectRatio(1f))
                    } else {
                        CnCell(cell = cell, spymaster = spymaster, lang = lang, onTap = onTap)
                    }
                }
            }
        }
    }
}

@Composable
private fun RowScope.CnCell(
    cell: BoardCell,
    spymaster: Boolean,
    lang: Lang,
    onTap: ((Int) -> Unit)?,
) {
    val palette = LocalPalette.current
    val show = spymaster || cell.revealed
    val (bg, fg) = if (show) roleColors(cell.role) else (palette.surfaceSunk to palette.text)
    val disabled = spymaster || cell.revealed || onTap == null
    val interaction = remember { MutableInteractionSource() }
    val scale = if (!disabled) pressScale(interaction) else 1f

    // A card "flip" pop the moment a hidden cell is revealed by a guess (mirrors the web's
    // scale [1.14, 1] reveal). Spymaster / key views show every cell up-front, so they don't pop.
    val revealPop = remember { Animatable(1f) }
    LaunchedEffect(cell.revealed) {
        if (cell.revealed && !spymaster) {
            revealPop.snapTo(1.16f)
            revealPop.animateTo(1f, tween(durationMillis = 380, easing = EaseOut))
        }
    }

    var shell = Modifier
        .weight(1f)
        .aspectRatio(1f)
        .graphicsLayer { scaleX = scale * revealPop.value; scaleY = scale * revealPop.value }
        .clip(CellShape)
        .background(bg, CellShape)
    if (!disabled) {
        shell = shell.clickable(interactionSource = interaction, indication = null) { onTap?.invoke(cell.index) }
    }

    Box(modifier = shell.padding(3.dp), contentAlignment = Alignment.Center) {
        Text(
            text = cell.word.resolve(lang),
            color = fg,
            fontSize = 10.sp,
            lineHeight = 11.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
