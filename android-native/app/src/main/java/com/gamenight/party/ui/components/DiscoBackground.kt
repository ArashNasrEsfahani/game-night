package com.gamenight.party.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalPalette
import kotlin.math.cos
import kotlin.math.sin

/**
 * The full-screen Disco Persian backdrop — native take on the `body::before/::after` layers in
 * src/index.css. Reads [LocalPalette] to switch faces:
 *
 *  • NIGHT: a lapis radial sky under several large, soft accent "light blooms" that slowly DRIFT
 *    across the screen, plus twinkling starlight. (Earlier this was a rotating conic sweep with
 *    Modifier.blur — but blur is a no-op pre-API-31 and the hard color/transparent wedges looked
 *    glitchy while rotating, so it's now soft radial blooms: no blur, no hard edges, smooth.)
 *  • DAY:   warm parchment with a faint Persian tilework wash.
 *
 * Everything is drawn in a single [drawBehind] and the only animated inputs (a master phase + a
 * twinkle phase) are read inside the draw lambda, so motion is a draw-phase-only redraw — no
 * recomposition, cheap enough to live behind every screen.
 */
@Composable
fun DiscoBackground(modifier: Modifier = Modifier) {
    if (LocalPalette.current.isDark) NightSky(modifier) else DayWash(modifier)
}

// Night-only raw hues (mirror --night / --night-2 / --lapis-2).
private val Night = Color(0xFF07061A)
private val Night2 = Color(0xFF0D0B2B)
private val Lapis2 = Color(0xFF1B2466)

/** A drifting blob of coloured light. Position = base + amp*cos/sin(time*freq + phase); integer
 *  freqs keep it perfectly periodic over time∈[0,2π] so the loop never jumps. */
private data class Bloom(
    val color: Color,
    val baseX: Float, val baseY: Float,
    val ampX: Float, val ampY: Float,
    val freqX: Int, val freqY: Int,
    val phase: Float,
    val radius: Float, // × min(w,h)
    val alpha: Float,
)

private val BLOOMS = listOf(
    Bloom(Accents.Teal, 0.22f, 0.20f, 0.10f, 0.08f, 1, 2, 0.0f, 0.62f, 0.20f),
    Bloom(Accents.Rose, 0.82f, 0.30f, 0.09f, 0.10f, 2, 1, 1.7f, 0.55f, 0.18f),
    Bloom(Accents.Gold, 0.30f, 0.78f, 0.12f, 0.07f, 1, 1, 3.1f, 0.52f, 0.16f),
    Bloom(Accents.Violet, 0.74f, 0.80f, 0.10f, 0.09f, 2, 2, 4.6f, 0.58f, 0.18f),
    Bloom(Accents.Sky, 0.55f, 0.46f, 0.13f, 0.11f, 1, 2, 5.5f, 0.46f, 0.14f),
)

private data class Star(val fx: Float, val fy: Float, val color: Color, val r: Float, val off: Float)

private val STARS = listOf(
    Star(0.12f, 0.22f, Accents.Gold, 1.8f, 0.0f),
    Star(0.78f, 0.14f, Accents.Teal, 1.8f, 0.9f),
    Star(0.33f, 0.68f, Color.White, 1.3f, 1.8f),
    Star(0.62f, 0.82f, Accents.Rose, 1.8f, 2.7f),
    Star(0.88f, 0.54f, Accents.Sky, 1.3f, 3.6f),
    Star(0.45f, 0.38f, Color.White, 1.8f, 4.5f),
    Star(0.20f, 0.88f, Accents.Lime, 1.3f, 5.4f),
    Star(0.55f, 0.10f, Accents.Gold, 1.3f, 1.2f),
    Star(0.08f, 0.46f, Accents.Violet, 1.6f, 2.1f),
    Star(0.70f, 0.60f, Color.White, 1.2f, 3.3f),
    Star(0.40f, 0.94f, Accents.Sky, 1.4f, 4.1f),
    Star(0.92f, 0.30f, Accents.Rose, 1.4f, 5.0f),
)

private const val TAU = 6.2831855f

@Composable
private fun NightSky(modifier: Modifier) {
    val transition = rememberInfiniteTransition(label = "disco-bg")
    // Master drift phase, 0→2π over 30s. Positions are periodic in it, so Restart is seamless.
    val time by transition.animateFloat(
        initialValue = 0f,
        targetValue = TAU,
        animationSpec = infiniteRepeatable(tween(30_000, easing = LinearEasing), RepeatMode.Restart),
        label = "drift",
    )
    val twinkle by transition.animateFloat(
        initialValue = 0f,
        targetValue = TAU,
        animationSpec = infiniteRepeatable(tween(4_200, easing = LinearEasing), RepeatMode.Restart),
        label = "twinkle",
    )

    Box(
        modifier = modifier
            .fillMaxSize()
            .drawBehind {
                val w = size.width
                val h = size.height
                val minDim = minOf(w, h)
                // Base lapis sky, brightest at top-centre (web: `at 50% 0%`).
                drawRect(Night)
                drawRect(
                    Brush.radialGradient(
                        0.0f to Lapis2,
                        0.45f to Night2,
                        1.0f to Night,
                        center = Offset(w / 2f, 0f),
                        radius = maxOf(w * 0.7f, h * 0.95f),
                    ),
                )
                // Soft drifting light blooms — the smooth "disco lights".
                BLOOMS.forEach { b ->
                    val cx = w * (b.baseX + b.ampX * cos(time * b.freqX + b.phase))
                    val cy = h * (b.baseY + b.ampY * sin(time * b.freqY + b.phase))
                    val r = minDim * b.radius
                    drawRect(
                        Brush.radialGradient(
                            listOf(b.color.copy(alpha = b.alpha), Color.Transparent),
                            center = Offset(cx, cy),
                            radius = r,
                        ),
                    )
                }
                // Starlight dust — gentle per-star alpha pulse.
                STARS.forEach { star ->
                    val a = 0.30f + 0.40f * (0.5f + 0.5f * sin(twinkle + star.off))
                    drawCircle(
                        color = star.color.copy(alpha = a),
                        radius = star.r.dp.toPx(),
                        center = Offset(w * star.fx, h * star.fy),
                    )
                }
            },
    )
}

@Composable
private fun DayWash(modifier: Modifier) {
    val palette = LocalPalette.current
    Box(
        modifier = modifier
            .fillMaxSize()
            .drawBehind {
                val w = size.width
                val h = size.height
                drawRect(palette.bg)
                // Two soft tilework tints: turquoise top-left, gold bottom-right.
                drawRect(
                    Brush.radialGradient(
                        listOf(Accents.TealStrong.copy(alpha = 0.10f), Color.Transparent),
                        center = Offset(w * 0.22f, h * 0.24f),
                        radius = minOf(w, h) * 0.55f,
                    ),
                )
                drawRect(
                    Brush.radialGradient(
                        listOf(Accents.GoldStrong.copy(alpha = 0.10f), Color.Transparent),
                        center = Offset(w * 0.78f, h * 0.76f),
                        radius = minOf(w, h) * 0.55f,
                    ),
                )
                // Faint diagonal hairlines — a whisper of Persian tilework.
                val step = 34.dp.toPx()
                val rose = Accents.Rose.copy(alpha = 0.05f)
                val sky = Accents.Sky.copy(alpha = 0.05f)
                var o = -h
                while (o < w) {
                    drawLine(rose, Offset(o, 0f), Offset(o + h, h), strokeWidth = 1f)
                    drawLine(sky, Offset(o + h, 0f), Offset(o, h), strokeWidth = 1f)
                    o += step
                }
            },
    )
}
