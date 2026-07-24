package com.gamenight.party.ui.components

import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.gamenight.party.ui.theme.GamePalette
import com.gamenight.party.ui.theme.LocalPalette

/**
 * Shared visual primitives for the Disco Persian component library — a 1:1 native port of the
 * design tokens in src/index.css (`--radius-*`, `--glass-*`, `--control-fill`) and the framer
 * `springSnappy` feel, so every native control wears the exact same identity as the webapp.
 */

/** `--radius-pill` (999px) — fully rounded pill. */
val PillShape: Shape = RoundedCornerShape(percent = 50)

/** `--radius-card` (1.5rem ≈ 24dp) — the standard glass-card corner. */
val CardShape: Shape = RoundedCornerShape(24.dp)

/**
 * The shared "settle" spring for presses, toggles, cards, steppers and pops. Tuned for a slower,
 * smoother feel than a snappy UI: a low stiffness so motion eases in/out over a relaxed ~0.4s, and a
 * high damping ratio so it glides to rest with almost no bounce. (Was stiffness 900 / damping 0.72.)
 */
fun <T> springSnappy(): SpringSpec<T> = spring(dampingRatio = 0.9f, stiffness = 300f)

// ── Glass / control fills (mirror :root and .dark in src/index.css). ──
// There is no live backdrop behind native surfaces, so we lean toward the opaque fallback the CSS
// itself uses when backdrop-filter is unavailable, keeping text legible over the solid page bg.

/** `--glass-bg` — frosted card fill. */
fun glassBg(p: GamePalette): Color =
    if (p.isDark) p.surface2.copy(alpha = 0.62f) else p.surface.copy(alpha = 0.72f)

/** `--glass-bg-2` — secondary frosted fill (chips, segmented track). */
fun glassBg2(p: GamePalette): Color =
    if (p.isDark) p.surface.copy(alpha = 0.60f) else p.surface2.copy(alpha = 0.66f)

/** `--glass-border` — day: white over the warm border-glow; night: a faint white rim. */
fun glassBorder(p: GamePalette): Color =
    if (p.isDark) Color.White.copy(alpha = 0.14f) else lerp(p.borderGlow, Color.White, 0.6f)

/** `--control-fill` — resting/unselected control surface. */
fun controlFill(p: GamePalette): Color =
    if (p.isDark) p.surface2.copy(alpha = 0.55f) else p.surface2.copy(alpha = 0.70f)

/** `.dp-glass`: frosted fill + rim + card shadow, clipped to [shape]. */
fun Modifier.glassSurface(palette: GamePalette, shape: Shape = CardShape, elevation: Dp = 14.dp): Modifier =
    this
        .shadow(elevation, shape, clip = false)
        .clip(shape)
        .background(glassBg(palette), shape)
        .border(1.dp, glassBorder(palette), shape)

/** `.dp-glass-2`: lighter frosted fill + rim (no heavy shadow). */
fun Modifier.glass2Surface(palette: GamePalette, shape: Shape): Modifier =
    this
        .clip(shape)
        .background(glassBg2(palette), shape)
        .border(1.dp, glassBorder(palette), shape)

/**
 * The framer `whileTap={{ scale }}` tactile press: scales toward [pressedScale] while the
 * [interactionSource] is pressed, springing back on release. Returns the live scale to feed into a
 * [graphicsLayer].
 */
@Composable
fun pressScale(interactionSource: InteractionSource, pressedScale: Float = 0.95f): Float {
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) pressedScale else 1f,
        animationSpec = springSnappy(),
        label = "pressScale",
    )
    return scale
}

/**
 * A round, frosted icon button (the Stepper ±, generic chrome affordances). Mirrors the webapp's
 * `grid h-10 w-10 place-items-center rounded-full bg-[var(--control-fill)]` icon controls.
 */
@Composable
fun IconCircleButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    size: Dp = 40.dp,
    content: @Composable () -> Unit,
) {
    val palette = LocalPalette.current
    val interaction = remember { MutableInteractionSource() }
    val scale = pressScale(interaction, pressedScale = 0.88f)
    Box(
        modifier = modifier
            .size(size)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                alpha = if (enabled) 1f else 0.4f
            }
            .clip(PillShape)
            .background(controlFill(palette), PillShape)
            .border(1.dp, glassBorder(palette), PillShape)
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = enabled,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.runtime.CompositionLocalProvider(
            LocalContentColor provides palette.text,
        ) { content() }
    }
}
