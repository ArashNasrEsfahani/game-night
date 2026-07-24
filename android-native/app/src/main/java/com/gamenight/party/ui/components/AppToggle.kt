package com.gamenight.party.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette

/**
 * An on/off switch — a 1:1 port of src/sdk/ui/Toggle.tsx. The thumb springs across the track
 * (RTL-aware via [offset]) and the track fades to the accent-strong fill when on. An optional
 * [label] lays it out as a labelled row (space-between).
 */
@Composable
fun AppToggle(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    val interaction = remember { MutableInteractionSource() }
    val select = tactile(SoundId.SELECT)

    val trackColor by animateColorAsState(
        targetValue = if (checked) accent.strong else controlFill(palette),
        animationSpec = springSnappy(),
        label = "toggleTrack",
    )
    val thumbOffset by animateDpAsState(
        targetValue = if (checked) 20.dp else 0.dp,
        animationSpec = springSnappy(),
        label = "toggleThumb",
    )

    val switch = @Composable {
        Box(
            modifier = Modifier
                .width(48.dp)
                .height(28.dp)
                .clip(PillShape)
                .background(trackColor, PillShape)
                .clickable(interactionSource = interaction, indication = null) {
                    select()
                    onCheckedChange(!checked)
                }
                .padding(2.dp),
            contentAlignment = Alignment.CenterStart,
        ) {
            Box(
                modifier = Modifier
                    .offset(x = thumbOffset)
                    .size(24.dp)
                    .shadow(3.dp, CircleShape)
                    .background(Color.White, CircleShape),
            )
        }
    }

    if (label != null) {
        Row(
            modifier = modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(text = label, color = palette.text, fontSize = 16.sp)
            switch()
        }
    } else {
        Box(modifier = modifier) { switch() }
    }
}
