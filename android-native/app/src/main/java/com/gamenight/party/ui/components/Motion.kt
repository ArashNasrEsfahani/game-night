package com.gamenight.party.ui.components

import androidx.compose.animation.ContentTransform
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.gamenight.party.sound.LocalHaptics
import com.gamenight.party.sound.LocalSoundEngine
import com.gamenight.party.sound.SoundId

/**
 * Shared motion primitives for the Disco Persian native UI — a port of the CSS eases / framer
 * presets in `src/index.css` and `src/sdk/motion`, so transitions feel identical to the webapp.
 */

/** `--ease-out` cubic-bezier(0.22, 1, 0.36, 1) — smooth deceleration. */
val EaseOut: Easing = CubicBezierEasing(0.22f, 1f, 0.36f, 1f)

/** `--ease-pop` cubic-bezier(0.34, 1.56, 0.64, 1) — gentle overshoot ("pop"). */
val EasePop: Easing = CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f)

/**
 * The web "dp-rise"/"dp-pop" entrance (mirrors the `rise`/`reveal` framer variants): the node fades
 * in while easing up a few dp and scaling from slightly small to settled — once, the first time it
 * enters the composition. Apply to a screen's content so every screen eases in.
 */
fun Modifier.screenEntrance(
    translateY: Dp = 12.dp,
    fromScale: Float = 0.98f,
    durationMillis: Int = 360,
): Modifier = composed {
    var shown by remember { mutableStateOf(false) }
    val progress by animateFloatAsState(
        targetValue = if (shown) 1f else 0f,
        animationSpec = tween(durationMillis, easing = EasePop),
        label = "screenEntrance",
    )
    LaunchedEffect(Unit) { shown = true }
    val dy = with(LocalDensity.current) { translateY.toPx() }
    graphicsLayer {
        alpha = progress.coerceIn(0f, 1f)
        translationY = (1f - progress) * dy
        val s = fromScale + (1f - fromScale) * progress
        scaleX = s
        scaleY = s
    }
}

/**
 * The app-shell route [ContentTransform] for an [androidx.compose.animation.AnimatedContent].
 *
 * - [forward] (opening a game / sub-page from home): the incoming pane slides up + scales + fades in
 *   (easeOut) while the outgoing pane fades + scales back, mirroring `routeShell`/`sheet`.
 * - reverse (returning home): the incoming pane settles in while the outgoing pane slides down + fades.
 */
fun routeTransform(forward: Boolean): ContentTransform = if (forward) {
    (
        fadeIn(tween(300, easing = EaseOut)) +
            slideInVertically(tween(300, easing = EaseOut)) { full -> full / 8 } +
            scaleIn(tween(300, easing = EaseOut), initialScale = 0.96f)
    ) togetherWith (
        fadeOut(tween(180, easing = EaseOut)) +
            scaleOut(tween(180, easing = EaseOut), targetScale = 0.99f)
    )
} else {
    (
        fadeIn(tween(300, easing = EaseOut)) +
            scaleIn(tween(300, easing = EaseOut), initialScale = 1.02f)
    ) togetherWith (
        fadeOut(tween(220, easing = EaseOut)) +
            slideOutVertically(tween(220, easing = EaseOut)) { full -> full / 8 } +
            scaleOut(tween(220, easing = EaseOut), targetScale = 0.98f)
    )
}

/**
 * Reads the app-wide [LocalSoundEngine] / [LocalHaptics] and returns a stable click-feedback action:
 * plays [id] and a light haptic. Both honour the user's settings (a muted engine / disabled haptics
 * no-op), and the composition-local defaults are no-ops, so this is safe even with no host present.
 *
 * Used by the shared interactive controls so chrome can click without a `GameHost`.
 */
@Composable
fun tactile(id: SoundId = SoundId.TAP): () -> Unit {
    val engine = LocalSoundEngine.current
    val haptics = LocalHaptics.current
    return remember(engine, haptics, id) {
        {
            engine.play(id)
            haptics.light()
        }
    }
}
