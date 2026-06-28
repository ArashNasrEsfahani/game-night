package com.gamenight.party.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import com.gamenight.party.model.ColorToken

/** The active day/night surfaces & text, available anywhere via [LocalPalette]. */
val LocalPalette = staticCompositionLocalOf { DayPalette }

/** The active per-game accent set, available anywhere via [LocalAccent]. */
val LocalAccent = staticCompositionLocalOf { ColorToken.TEAL.accent() }

/**
 * Wraps content in the Disco Persian identity. Pass a game's [accent] when inside a game so every
 * control recolors automatically (mirrors the webapp's per-game --game-accent override).
 */
@Composable
fun GameNightTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    accent: ColorToken = if (darkTheme) ColorToken.GOLD else ColorToken.TEAL,
    content: @Composable () -> Unit,
) {
    val palette = if (darkTheme) NightPalette else DayPalette
    val accentColors = accent.accent()

    val scheme = if (darkTheme) {
        darkColorScheme(
            primary = accentColors.base,
            onPrimary = accentColors.onAccent,
            secondary = accentColors.strong,
            background = palette.bg,
            onBackground = palette.text,
            surface = palette.surface,
            onSurface = palette.text,
            surfaceVariant = palette.surface2,
            onSurfaceVariant = palette.textMuted,
            outline = palette.border,
        )
    } else {
        lightColorScheme(
            primary = accentColors.base,
            onPrimary = accentColors.onAccent,
            secondary = accentColors.strong,
            background = palette.bg,
            onBackground = palette.text,
            surface = palette.surface,
            onSurface = palette.text,
            surfaceVariant = palette.surface2,
            onSurfaceVariant = palette.textMuted,
            outline = palette.border,
        )
    }

    CompositionLocalProvider(
        LocalPalette provides palette,
        LocalAccent provides accentColors,
    ) {
        MaterialTheme(
            colorScheme = scheme,
            typography = AppTypography,
            content = content,
        )
    }
}
