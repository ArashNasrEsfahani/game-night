package com.gamenight.party.ui.theme

import androidx.compose.ui.graphics.Color
import com.gamenight.party.model.ColorToken

/**
 * Disco Persian palette — a 1:1 port of the design tokens in src/index.css so the native app wears
 * the exact same visual identity as the webapp.
 *   • Day:   classic Persian manuscript — warm ivory & gold, lapis ink.
 *   • Night: 80s disco over ancient Iran — lapis sky, neon under a mirror ball.
 */

// ── The 8 game accents ("disco lights"). Each: base + strong (for gradients). ──
object Accents {
    val Grape = Color(0xFFD633FF);     val GrapeStrong = Color(0xFF9B1FD6)
    val Tangerine = Color(0xFFFF8A2B); val TangerineStrong = Color(0xFFF4640A)
    val Lime = Color(0xFF4FE08A);      val LimeStrong = Color(0xFF1FB85F)
    val Sky = Color(0xFF36B6FF);       val SkyStrong = Color(0xFF1574E6)
    val Rose = Color(0xFFFF3D7F);      val RoseStrong = Color(0xFFE01154)
    val Gold = Color(0xFFFFC233);      val GoldStrong = Color(0xFFE89400)
    val Teal = Color(0xFF25E0C8);      val TealStrong = Color(0xFF08A896)
    val Violet = Color(0xFF8B7BFF);    val VioletStrong = Color(0xFF5A44E6)
}

val Brand = Color(0xFFFFC233)
val BrandStrong = Color(0xFFE89400)

// Readable ink ON each saturated accent fill (theme-independent): dark hues get ivory, bright get ink.
private val InkOnDark = Color(0xFFFDF6E6)   // --on-grape / sky / rose / violet
private val InkOnBright = Color(0xFF160F30) // --on-tangerine / lime / gold / teal

/** Resolved per-game accent set: the base + strong + derived glow/soft + the readable ink on it. */
data class AccentColors(
    val base: Color,
    val strong: Color,
    val onAccent: Color,
) {
    val glow: Color get() = base.copy(alpha = 0.45f)  // --game-accent-glow
    val soft: Color get() = base.copy(alpha = 0.14f)  // --game-accent-soft
}

fun ColorToken.accent(): AccentColors = when (this) {
    ColorToken.GRAPE -> AccentColors(Accents.Grape, Accents.GrapeStrong, InkOnDark)
    ColorToken.TANGERINE -> AccentColors(Accents.Tangerine, Accents.TangerineStrong, InkOnBright)
    ColorToken.LIME -> AccentColors(Accents.Lime, Accents.LimeStrong, InkOnBright)
    ColorToken.SKY -> AccentColors(Accents.Sky, Accents.SkyStrong, InkOnDark)
    ColorToken.ROSE -> AccentColors(Accents.Rose, Accents.RoseStrong, InkOnDark)
    ColorToken.GOLD -> AccentColors(Accents.Gold, Accents.GoldStrong, InkOnBright)
    ColorToken.TEAL -> AccentColors(Accents.Teal, Accents.TealStrong, InkOnBright)
    ColorToken.VIOLET -> AccentColors(Accents.Violet, Accents.VioletStrong, InkOnDark)
}

// ── Semantic surfaces & text, per theme face (mirrors :root and .dark). ──
data class GamePalette(
    val isDark: Boolean,
    val bg: Color,
    val surface: Color,
    val surface2: Color,
    val surfaceSunk: Color,
    val border: Color,
    val borderGlow: Color,
    val text: Color,
    val textMuted: Color,
    val textDim: Color,
    val onAccentInk: Color, // --on-accent (dark ink readable on bright gradients)
)

val DayPalette = GamePalette(
    isDark = false,
    bg = Color(0xFFFBF6EA),
    surface = Color(0xFFFFFDF7),
    surface2 = Color(0xFFF7EFDD),
    surfaceSunk = Color(0xFFECE1C6),
    border = Color(0xFFE4D5AD),
    borderGlow = Color(0xFFD3B878),
    text = Color(0xFF241B3F),
    textMuted = Color(0xFF5C5080),
    textDim = Color(0xFF877A9F),
    onAccentInk = Color(0xFF160F30),
)

val NightPalette = GamePalette(
    isDark = true,
    bg = Color(0xFF07061A),
    surface = Color(0xFF15123A),
    surface2 = Color(0xFF1D1950),
    surfaceSunk = Color(0xFF100D2E),
    border = Color(0xFF2C2768),
    borderGlow = Color(0xFF4A3FB0),
    text = Color(0xFFFDF6E6),
    textMuted = Color(0xFFB9ADD9),
    textDim = Color(0xFF7E74A8),
    onAccentInk = Color(0xFF0A0820),
)

// Codenames team colors.
val TeamA = Color(0xFFFF3D7F)
val TeamB = Color(0xFF2F6BF0)
val NeutralCard = Color(0xFFD6C7A1)
val Assassin = Color(0xFF0B0922)
