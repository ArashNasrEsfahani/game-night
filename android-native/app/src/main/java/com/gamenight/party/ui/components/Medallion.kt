package com.gamenight.party.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette

/**
 * A gilded roundel framing an emblem — a 1:1 port of src/sdk/ui/Medallion.tsx: a deep accent-tinted
 * radial coin, gold rim rings, a dashed inner ring and a slow light glint sweeping the surface. The
 * [content] is tinted with the live accent.
 */
@Composable
fun Medallion(
    modifier: Modifier = Modifier,
    size: Dp = 120.dp,
    spin: Boolean = true,
    content: @Composable BoxScope.() -> Unit,
) {
    val accent = LocalAccent.current
    val palette = LocalPalette.current
    // --lapis / --night differ per theme; the coin reads light in day, deep blue at night.
    val lapis = if (palette.isDark) Color(0xFF14163F) else Color(0xFFEFE3C8)
    val night = if (palette.isDark) Color(0xFF07061A) else Color(0xFFFBF6EA)
    val gold = Accents.Gold

    val glintTransition = rememberInfiniteTransition(label = "glint")
    val glintAngle by glintTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(14000, easing = LinearEasing), RepeatMode.Restart),
        label = "glintAngle",
    )

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .drawBehind {
                val maxR = this.size.minDimension / 2f
                val center = Offset(this.size.width / 2f, this.size.height / 2f)
                val px = 1.dp.toPx()
                // Base coin gradient — accent-tinted lapis fading to night.
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(lerp(lapis, accent.base, 0.32f), night),
                        center = Offset(this.size.width / 2f, this.size.height * 0.36f),
                        radius = maxR * 1.4f,
                    ),
                    radius = maxR,
                    center = center,
                )
                // Outer gold rim.
                drawCircle(color = gold, radius = maxR - px, center = center, style = Stroke(width = 2 * px))
                // Accent ring just inside the rim.
                drawCircle(
                    color = lerp(night, accent.base, 0.40f),
                    radius = maxR - 5 * px,
                    center = center,
                    style = Stroke(width = 4 * px),
                )
                // Dashed inner ring (inset ~11dp).
                drawCircle(
                    color = gold.copy(alpha = 0.6f),
                    radius = maxR - 11 * px,
                    center = center,
                    style = Stroke(
                        width = 1.5f * px,
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(3 * px, 4 * px)),
                    ),
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        // Slow light glint sweeping the coin.
        Box(
            modifier = Modifier
                .matchParentSize()
                .graphicsLayer { if (spin) rotationZ = glintAngle }
                .background(
                    Brush.sweepGradient(listOf(Color.Transparent, Color.White.copy(alpha = 0.18f), Color.Transparent)),
                    CircleShape,
                ),
        )
        // The emblem, tinted with the accent.
        Box(modifier = Modifier.fillMaxSize(0.7f), contentAlignment = Alignment.Center) {
            val boxScope = this
            CompositionLocalProvider(LocalContentColor provides accent.base) {
                boxScope.content()
            }
        }
    }
}
