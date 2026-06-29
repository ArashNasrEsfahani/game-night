package com.gamenight.party.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.Body
import com.gamenight.party.ui.theme.Display
import com.gamenight.party.ui.theme.LocalPalette
import kotlinx.coroutines.launch

// Gold-foil gradient (mirrors the `.dp-foil` utility) used for the winner title.
private val FoilBrush = Brush.linearGradient(
    listOf(Color(0xFFFFE9A8), Accents.Gold, Color(0xFFFFF3CF), Accents.GoldStrong, Color(0xFFFFCF57)),
)

/**
 * The victory flourish — a 1:1 port of src/sdk/ui/WinnerBanner.tsx: a confetti burst, a trophy in a
 * gilded [Medallion] that springs in, a gold-foil title and the winners' names.
 */
@Composable
fun WinnerBanner(title: String, names: List<String>, modifier: Modifier = Modifier, tie: Boolean = false) {
    val palette = LocalPalette.current

    val medScale = remember { Animatable(0f) }
    val medRotate = remember { Animatable(-25f) }
    val appear = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        launch { medScale.animateTo(1f, spring(dampingRatio = 0.5f, stiffness = 260f)) }
        launch { medRotate.animateTo(0f, spring(dampingRatio = 0.5f, stiffness = 260f)) }
        launch { appear.animateTo(1f, spring(dampingRatio = 0.85f, stiffness = 220f)) }
    }

    Box(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier = Modifier.graphicsLayer {
                    scaleX = medScale.value
                    scaleY = medScale.value
                    rotationZ = medRotate.value
                },
            ) {
                Medallion(size = 118.dp) {
                    Text(text = if (tie) "🤝" else "🏆", fontSize = 48.sp)
                }
            }

            Text(
                text = title,
                modifier = Modifier.graphicsLayer {
                    alpha = appear.value
                    translationY = (1f - appear.value) * 10f
                },
                style = TextStyle(
                    brush = FoilBrush,
                    fontFamily = Display,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 30.sp,
                ),
                textAlign = TextAlign.Center,
            )

            if (names.isNotEmpty()) {
                Text(
                    text = names.joinToString("، "),
                    modifier = Modifier.graphicsLayer { alpha = appear.value },
                    color = palette.textMuted,
                    fontFamily = Body,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center,
                )
            }
        }

        // Confetti rains over the whole banner.
        Confetti(modifier = Modifier.fillMaxWidth())
    }
}
