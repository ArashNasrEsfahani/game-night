package com.gamenight.party.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.screens.LocalLanguage
import com.gamenight.party.ui.screens.fmtNum
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import kotlin.math.ceil

/**
 * A circular countdown ring — a 1:1 port of src/sdk/ui/TimerRing.tsx. The arc depletes clockwise;
 * the colour shifts accent → gold → rose as time runs low; the last five seconds pulse + glow red.
 */
@Composable
fun TimerRing(
    totalSeconds: Int,
    remainingSeconds: Float,
    modifier: Modifier = Modifier,
) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    val lang = LocalLanguage.current

    val pct = if (totalSeconds > 0) (remainingSeconds / totalSeconds).coerceIn(0f, 1f) else 0f
    val critical = remainingSeconds > 0f && remainingSeconds <= 5f

    // Audible (+ haptic) countdown for the final seconds: a soft tick each whole second from 5→1, so
    // the time pressure lands even when eyes are on the word/board. Fires once per second and only
    // while counting down (a round resetting up is silent); gated by the mute/haptics settings.
    val shown = ceil(remainingSeconds.coerceAtLeast(0f)).toInt()
    val tick = tactile(SoundId.TICK)
    val lastShown = remember { intArrayOf(-1) }
    LaunchedEffect(shown) {
        val prev = lastShown[0]
        if (prev >= 0 && shown < prev && shown in 1..5) tick()
        lastShown[0] = shown
    }

    val targetColor = when {
        remainingSeconds <= 5f -> Accents.RoseStrong
        remainingSeconds <= 15f -> Accents.GoldStrong
        else -> accent.strong
    }
    val strokeColor by animateColorAsState(targetColor, tween(300), label = "timerColor")
    val sweep by animateFloatAsState(pct, tween(300), label = "timerSweep")

    // Pulse the whole ring in the final tense seconds.
    val pulse = rememberInfiniteTransition(label = "timerPulse")
    val pulseScale by pulse.animateFloat(
        initialValue = 1f,
        targetValue = if (critical) 1.07f else 1f,
        animationSpec = infiniteRepeatable(tween(600), RepeatMode.Reverse),
        label = "timerPulseScale",
    )

    Box(
        modifier = modifier
            .size(128.dp)
            .graphicsLayer {
                if (critical) {
                    scaleX = pulseScale
                    scaleY = pulseScale
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(128.dp)) {
            val stroke = 10.dp.toPx()
            val diameter = size.minDimension - stroke
            val topLeft = Offset((size.width - diameter) / 2f, (size.height - diameter) / 2f)
            val arcSize = Size(diameter, diameter)
            // Track.
            drawArc(
                color = palette.surface2,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = stroke),
            )
            // Remaining time arc (starts at 12 o'clock).
            drawArc(
                color = strokeColor,
                startAngle = -90f,
                sweepAngle = 360f * sweep,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round),
            )
        }
        Text(
            text = fmtNum(shown, lang),
            color = if (critical) Accents.RoseStrong else palette.text,
            fontSize = 30.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}
