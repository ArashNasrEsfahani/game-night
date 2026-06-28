package com.gamenight.party.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette

/**
 * The frosted glass card — a 1:1 port of src/sdk/ui/Card.tsx (`.dp-glass rounded-[--radius-card]
 * p-4`). Pass [onClick] to make it a soft, pressable surface.
 */
@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    val palette = LocalPalette.current
    val interaction = remember { MutableInteractionSource() }
    val scale = if (onClick != null) pressScale(interaction, pressedScale = 0.985f) else 1f

    var shell = modifier.graphicsLayer { scaleX = scale; scaleY = scale }
        .glassSurface(palette, CardShape)
    if (onClick != null) {
        shell = shell.clickable(interactionSource = interaction, indication = null, onClick = onClick)
    }
    Column(modifier = shell.padding(contentPadding), content = content)
}

/**
 * A read-only frosted pill tag — a 1:1 port of src/sdk/ui/Chip.tsx (`.dp-glass-2 rounded-full px-2.5
 * py-1 text-xs text-[--text-muted]`).
 */
@Composable
fun Chip(text: String, modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    Box(
        modifier = modifier
            .glass2Surface(palette, PillShape)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(text = text, color = palette.textMuted, fontWeight = FontWeight.Medium, fontSize = 12.sp)
    }
}

/**
 * A toggleable multi-select chip — a 1:1 port of src/sdk/ui/SelectChip.tsx. Selected → translucent
 * accent fill with on-accent ink; unselected → frosted glass with muted text.
 */
@Composable
fun SelectChip(
    selected: Boolean,
    onClick: () -> Unit,
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    val interaction = remember { MutableInteractionSource() }
    val scale = pressScale(interaction)
    val select = tactile(SoundId.SELECT)

    val bg: Color = if (selected) accent.base else glassBg2(palette)
    val fg: Color = if (selected) accent.onAccent else palette.textMuted

    var shell = modifier
        .graphicsLayer { scaleX = scale; scaleY = scale; alpha = if (enabled) 1f else 0.4f }
        .clip(PillShape)
        .background(bg, PillShape)
    if (!selected) shell = shell.border(1.dp, glassBorder(palette), PillShape)

    Box(
        modifier = shell
            .clickable(interactionSource = interaction, indication = null, enabled = enabled) {
                select()
                onClick()
            }
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(text = text, color = fg, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
    }
}
