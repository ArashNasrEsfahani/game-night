package com.gamenight.party.ui.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette

/** One choice in a [SegmentedControl]. */
data class SegmentOption<T>(val value: T, val label: String)

/**
 * A pill segmented control — a 1:1 port of src/sdk/ui/SegmentedControl.tsx: a frosted track with a
 * single accent-gradient indicator that slides (springy) between options as the selection changes.
 */
@Composable
fun <T> SegmentedControl(
    options: List<SegmentOption<T>>,
    value: T,
    onChange: (T) -> Unit,
    modifier: Modifier = Modifier,
    height: androidx.compose.ui.unit.Dp = 44.dp,
) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    val count = options.size.coerceAtLeast(1)
    val selectedIndex = options.indexOfFirst { it.value == value }.coerceAtLeast(0)
    val pad = 4.dp
    val select = tactile(SoundId.SELECT)

    BoxWithConstraints(
        modifier = modifier
            .height(height)
            .glass2Surface(palette, PillShape),
    ) {
        val segWidth = (maxWidth - pad * 2) / count.toFloat()
        val indicatorOffset by animateDpAsState(
            targetValue = segWidth * selectedIndex.toFloat(),
            animationSpec = springSnappy(),
            label = "segIndicator",
        )

        // Sliding accent indicator (drawn behind the labels).
        Box(
            modifier = Modifier
                .padding(pad)
                .offset(x = indicatorOffset)
                .width(segWidth)
                .fillMaxHeight()
                .clip(PillShape)
                .shadow(6.dp, PillShape, clip = false, spotColor = accent.glow, ambientColor = accent.glow)
                .background(Brush.linearGradient(listOf(accent.base, accent.strong)), PillShape),
        )

        // Tappable labels on top.
        Row(modifier = Modifier.fillMaxSize().padding(pad)) {
            options.forEach { option ->
                val selected = option.value == value
                val interaction = remember(option.value) { MutableInteractionSource() }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(PillShape)
                        .clickable(interactionSource = interaction, indication = null) {
                            if (!selected) {
                                select()
                                onChange(option.value)
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = option.label,
                        color = if (selected) accent.onAccent else palette.textMuted,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                    )
                }
            }
        }
    }
}
