package com.gamenight.party.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette

/** The five button intents from src/sdk/ui/Button.tsx. */
enum class ButtonVariant { PRIMARY, SECONDARY, GHOST, DANGER, SUCCESS }

/** The three button sizes from src/sdk/ui/Button.tsx (`sm`/`md`/`lg`). */
enum class ButtonSize { SM, MD, LG }

// Ink readable on the rose (danger) / lime (success) gradients — theme-independent (--on-rose / --on-lime).
private val InkOnRose = Color(0xFFFDF6E6)
private val InkOnLime = Color(0xFF160F30)

/**
 * The accent-aware pill button — a 1:1 port of src/sdk/ui/Button.tsx. PRIMARY/DANGER/SUCCESS are
 * vibrant 135° gradients with a coloured glow; SECONDARY is frosted glass; GHOST is bare accent
 * text. The whole control springs on press ([pressScale]).
 */
@Composable
fun AppButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.PRIMARY,
    size: ButtonSize = ButtonSize.MD,
    enabled: Boolean = true,
    fullWidth: Boolean = false,
    content: @Composable RowScope.() -> Unit,
) {
    val accent = LocalAccent.current
    val palette = LocalPalette.current
    val interaction = remember { MutableInteractionSource() }
    val scale = pressScale(interaction)
    val tap = tactile(SoundId.TAP)

    val (height, horizontalPad, fontSize) = when (size) {
        ButtonSize.SM -> Triple(36.dp, 12.dp, 14.sp)
        ButtonSize.MD -> Triple(48.dp, 20.dp, 16.sp)
        ButtonSize.LG -> Triple(56.dp, 24.dp, 18.sp)
    }

    // Resolve fill, text colour and glow per variant.
    val gradient: Brush? = when (variant) {
        ButtonVariant.PRIMARY -> Brush.linearGradient(listOf(accent.base, accent.strong))
        ButtonVariant.DANGER -> Brush.linearGradient(listOf(Accents.Rose, Accents.RoseStrong))
        ButtonVariant.SUCCESS -> Brush.linearGradient(listOf(Accents.Lime, Accents.LimeStrong))
        ButtonVariant.SECONDARY, ButtonVariant.GHOST -> null
    }
    val textColor: Color = when (variant) {
        ButtonVariant.PRIMARY -> accent.onAccent
        ButtonVariant.DANGER -> InkOnRose
        ButtonVariant.SUCCESS -> InkOnLime
        ButtonVariant.SECONDARY -> palette.text
        ButtonVariant.GHOST -> accent.base
    }
    val glow: Color = when (variant) {
        ButtonVariant.PRIMARY -> accent.glow
        ButtonVariant.DANGER -> Accents.Rose.copy(alpha = 0.55f)
        ButtonVariant.SUCCESS -> Accents.Lime.copy(alpha = 0.55f)
        else -> Color.Transparent
    }

    var shell = modifier
        .then(if (fullWidth) Modifier.fillMaxWidth() else Modifier)
        .height(height)
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
            alpha = if (enabled) 1f else 0.5f
        }

    if (gradient != null) {
        shell = shell
            .shadow(12.dp, PillShape, clip = false, spotColor = glow, ambientColor = glow)
            .clip(PillShape)
            .background(gradient, PillShape)
    } else if (variant == ButtonVariant.SECONDARY) {
        shell = shell
            .clip(PillShape)
            .background(controlFill(palette), PillShape)
            .border(1.5.dp, glassBorder(palette), PillShape)
    } else {
        shell = shell.clip(PillShape) // GHOST: bare
    }

    Row(
        modifier = shell
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = enabled,
                onClick = { tap(); onClick() },
            )
            .padding(horizontal = horizontalPad),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val rowScope = this
        CompositionLocalProvider(
            LocalContentColor provides textColor,
            LocalTextStyle provides TextStyle(
                color = textColor,
                fontWeight = FontWeight.Bold,
                fontSize = fontSize,
            ),
        ) {
            rowScope.content()
        }
    }
}

/** Text convenience overload mirroring `<Button>{label}</Button>`. */
@Composable
fun AppButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.PRIMARY,
    size: ButtonSize = ButtonSize.MD,
    enabled: Boolean = true,
    fullWidth: Boolean = false,
) {
    AppButton(
        onClick = onClick,
        modifier = modifier,
        variant = variant,
        size = size,
        enabled = enabled,
        fullWidth = fullWidth,
    ) {
        Text(text = text)
    }
}
