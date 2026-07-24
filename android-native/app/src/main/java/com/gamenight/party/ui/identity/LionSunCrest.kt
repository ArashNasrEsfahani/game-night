package com.gamenight.party.ui.identity

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.gamenight.party.R
import com.gamenight.party.ui.theme.Accents

/**
 * The Lion & Sun (شیر و خورشید) heraldry over sweeping disco rays — native port of
 * src/sdk/ui/LionSunCrest.tsx. A slow-spinning multi-accent sweep sits behind a warm gold halo and
 * the baked two-tone emblem.
 */
@Composable
fun LionSunCrest(
    size: Dp = 150.dp,
    modifier: Modifier = Modifier,
) {
    val transition = rememberInfiniteTransition(label = "lion-sun-crest")
    val angle by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 18000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "spin",
    )

    // conic sweep of the eight disco accents with gaps (mirrors DISCO_RAYS).
    val rays = Brush.sweepGradient(
        listOf(
            Accents.Gold, Color.Transparent,
            Accents.Rose, Color.Transparent,
            Accents.Teal, Color.Transparent,
            Accents.Sky, Color.Transparent,
            Accents.Lime, Color.Transparent,
            Accents.Grape, Color.Transparent,
            Accents.Tangerine, Color.Transparent,
            Accents.Violet, Color.Transparent,
            Accents.Gold,
        ),
    )

    Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
        // sweeping disco rays
        Box(
            modifier = Modifier
                .size(size * 1.28f)
                .rotate(angle)
                .alpha(0.55f)
                .blur(9.dp)
                .clip(CircleShape)
                .background(rays),
        )
        // warm gold halo
        Box(
            modifier = Modifier
                .size(size * 0.96f)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(Accents.Gold.copy(alpha = 0.24f), Color.Transparent),
                    ),
                ),
        )
        // the Lion & Sun emblem (baked two-tone: gold sun, fiery mane)
        Image(
            painter = painterResource(R.drawable.motif_lion_sun),
            contentDescription = null,
            modifier = Modifier.size(size * 0.82f),
        )
    }
}
