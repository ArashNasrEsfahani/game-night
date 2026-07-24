package com.gamenight.party.game.minesweeper

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.ui.screens.LocalLanguage
import com.gamenight.party.ui.screens.fmtNum
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent

/** Resolve a bilingual UI label for this game's screens (chrome strings, not authored content). */
internal fun loc(lang: Lang, en: String, fa: String): String = if (lang == Lang.FA) fa else en

// Theme-aware clue colours: deep classic-minesweeper shades on the light (cream) tiles, bright
// shades on the dark sunk tiles — each stays high-contrast against its own background (mirrors the
// NUM_COLOR table in components/MineGrid.tsx). Index = adjacent count (1..8); 0 is unused.
private val ClueColorsLight = listOf(
    Color.Unspecified,
    Color(0xFF1D4ED8), // blue-700
    Color(0xFF047857), // emerald-700
    Color(0xFFB91C1C), // red-700
    Color(0xFF6D28D9), // violet-700
    Color(0xFFBE123C), // rose-700
    Color(0xFF0F766E), // teal-700
    Color(0xFFB45309), // amber-700
    Color(0xFF475569), // slate-600
)
private val ClueColorsDark = listOf(
    Color.Unspecified,
    Color(0xFF60A5FA), // blue-400
    Color(0xFF34D399), // emerald-400
    Color(0xFFF87171), // red-400
    Color(0xFFA78BFA), // violet-400
    Color(0xFFFB7185), // rose-400
    Color(0xFF2DD4BF), // teal-400
    Color(0xFFFBBF24), // amber-400
    Color(0xFF94A3B8), // slate-400
)

private fun clueColor(dark: Boolean, n: Int): Color {
    val table = if (dark) ClueColorsDark else ClueColorsLight
    return table.getOrElse(n) { table.last() }
}

private val CellShape = RoundedCornerShape(5.dp)

/**
 * The mine-hunt board — a native port of components/MineGrid.tsx. Tap a square to reveal it: a mine
 * is a find (💣, filled with the finder's colour, with a little pop), a safe square shows its number
 * clue (faintly tinted by whoever opened it). Pure presentation — all rules live in the reducer
 * (illegal taps are no-ops there).
 *
 * @param seatColors maps a seat id to its accent token (for tinting revealed cells by finder).
 */
@Composable
internal fun MineGrid(
    cells: List<Cell>,
    cols: Int,
    seatColors: Map<String, ColorToken?>,
    modifier: Modifier = Modifier,
    disabled: Boolean = false,
    onReveal: (Int) -> Unit = {},
) {
    if (cols <= 0) return
    val rows = cells.size / cols
    val fontSize: TextUnit = when {
        cols <= 8 -> 18.sp
        cols <= 10 -> 15.sp
        cols <= 12 -> 13.sp
        else -> 11.sp
    }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        for (r in 0 until rows) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                for (c in 0 until cols) {
                    val idx = r * cols + c
                    val cell = cells[idx]
                    MineCell(
                        cell = cell,
                        fontSize = fontSize,
                        disabled = disabled,
                        tintColor = cell.revealedBy?.let { seatColors[it]?.accent()?.base },
                        onReveal = onReveal,
                        modifier = Modifier.weight(1f).aspectRatio(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun MineCell(
    cell: Cell,
    fontSize: TextUnit,
    disabled: Boolean,
    tintColor: Color?,
    onReveal: (Int) -> Unit,
    modifier: Modifier,
) {
    val palette = LocalPalette.current
    val lang = LocalLanguage.current
    val revealed = cell.revealed

    // A found mine fills with the finder's colour (so each player's haul reads at a glance); a
    // revealed safe square gets only a faint finder tint.
    val bg: Color = when {
        !revealed -> palette.surface2
        cell.mine && tintColor != null -> lerp(palette.surfaceSunk, tintColor, 0.82f)
        !cell.mine && tintColor != null -> lerp(palette.surfaceSunk, tintColor, 0.18f)
        else -> palette.surfaceSunk
    }

    var m = modifier.clip(CellShape).background(bg, CellShape)
    m = when {
        revealed && cell.mine && tintColor != null -> m.border(2.dp, Color.White.copy(alpha = 0.35f), CellShape)
        !revealed -> m.border(1.dp, palette.border, CellShape)
        else -> m
    }
    if (!revealed && !disabled) {
        m = m.clickable { onReveal(cell.index) }
    }

    Box(modifier = m, contentAlignment = Alignment.Center) {
        when {
            revealed && cell.mine -> {
                val pop = remember(cell.index) { Animatable(0.3f) }
                LaunchedEffect(cell.index) {
                    pop.animateTo(1f, spring(dampingRatio = 0.8f, stiffness = 375f))
                }
                Text(
                    text = "💣",
                    fontSize = fontSize,
                    modifier = Modifier.graphicsLayer { scaleX = pop.value; scaleY = pop.value },
                )
            }
            revealed && cell.adjacent > 0 -> {
                Text(
                    text = fmtNum(cell.adjacent, lang),
                    color = clueColor(palette.isDark, cell.adjacent),
                    fontSize = fontSize,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}
