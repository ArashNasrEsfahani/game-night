package com.gamenight.party.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.rotate
import com.gamenight.party.ui.theme.Accents
import kotlin.random.Random

private val ConfettiColors = listOf(
    Accents.Grape, Accents.Tangerine, Accents.Lime, Accents.Sky,
    Accents.Rose, Accents.Gold, Accents.Teal, Accents.Violet,
)

private data class ConfettiPiece(
    val left: Float,
    val delay: Float,
    val drift: Float,
    val spin: Float,
    val colorIndex: Int,
    val width: Float,
    val height: Float,
    val round: Boolean,
)

/**
 * A one-shot confetti burst that rains down once on mount — a native port of src/sdk/ui/Confetti.tsx
 * (a festive mix of dots and flakes). Overlay it at the top of a Box stack.
 */
@Composable
fun Confetti(modifier: Modifier = Modifier, pieceCount: Int = 44) {
    val pieces = remember(pieceCount) {
        val rnd = Random(0xC0FFEE)
        List(pieceCount) {
            val round = rnd.nextFloat() > 0.5f
            val w = 6f + rnd.nextFloat() * 8f
            ConfettiPiece(
                left = rnd.nextFloat(),
                delay = rnd.nextFloat() * 0.25f,
                drift = (rnd.nextFloat() - 0.5f) * 0.3f,
                spin = 360f + rnd.nextFloat() * 720f,
                colorIndex = it % ConfettiColors.size,
                width = w,
                height = if (round) w else w * 0.5f,
                round = round,
            )
        }
    }

    val progress = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        progress.animateTo(1f, animationSpec = tween(durationMillis = 2600, easing = LinearEasing))
    }

    Canvas(modifier = modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        pieces.forEach { p ->
            val t = ((progress.value - p.delay) / (1f - p.delay)).coerceIn(0f, 1f)
            if (t <= 0f) return@forEach
            val y = (-0.08f + 1.2f * t) * h
            val x = p.left * w + p.drift * w * t
            val alpha = if (t > 0.8f) (1f - (t - 0.8f) / 0.2f).coerceIn(0f, 1f) else 1f
            val color = ConfettiColors[p.colorIndex].copy(alpha = alpha)
            rotate(degrees = p.spin * t, pivot = Offset(x + p.width / 2f, y + p.height / 2f)) {
                if (p.round) {
                    drawCircle(color = color, radius = p.width / 2f, center = Offset(x + p.width / 2f, y + p.height / 2f))
                } else {
                    drawRect(color = color, topLeft = Offset(x, y), size = Size(p.width, p.height))
                }
            }
        }
    }
}
