package com.gamenight.party.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.theme.LocalPalette

/**
 * A bounded numeric stepper — a 1:1 port of src/sdk/ui/Stepper.tsx: round − / + frosted icon
 * buttons (disabled at the bounds) flanking the value, which slides up as it changes. An optional
 * [label] lays it out as a labelled row (space-between).
 */
@Composable
fun Stepper(
    value: Int,
    onValueChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
    min: Int = 1,
    max: Int = 99,
    label: String? = null,
) {
    val palette = LocalPalette.current
    val tap = tactile(SoundId.TAP)

    val controls = @Composable {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            IconCircleButton(
                onClick = {
                    tap()
                    onValueChange((value - 1).coerceAtLeast(min))
                },
                enabled = value > min,
            ) {
                Text(text = "−", color = palette.text, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }

            Box(modifier = Modifier.width(32.dp), contentAlignment = Alignment.Center) {
                AnimatedContent(
                    targetState = value,
                    transitionSpec = {
                        (slideInVertically { it } + fadeIn()) togetherWith
                            (slideOutVertically { -it } + fadeOut())
                    },
                    label = "stepperValue",
                ) { shown ->
                    Text(
                        text = shown.toString(),
                        color = palette.text,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                }
            }

            IconCircleButton(
                onClick = {
                    tap()
                    onValueChange((value + 1).coerceAtMost(max))
                },
                enabled = value < max,
            ) {
                Text(text = "+", color = palette.text, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }
        }
    }

    if (label != null) {
        Row(
            modifier = modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(text = label, color = palette.text, fontSize = 16.sp)
            controls()
        }
    } else {
        Row(modifier = modifier) { controls() }
    }
}
