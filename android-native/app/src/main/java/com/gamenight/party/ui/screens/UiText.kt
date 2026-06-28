package com.gamenight.party.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import com.gamenight.party.model.Lang

/**
 * Tiny bilingual helper for app-shell *chrome* (titles, button labels). Game CONTENT is bilingual
 * via `LocalizedString`; this is only for the handful of UI strings the shell needs, mirroring the
 * web i18n keys without pulling in a full resource layer.
 */
fun uiText(lang: Lang, en: String, fa: String): String = if (lang == Lang.FA) fa else en

/**
 * Localizes the ASCII digits 0–9 to Persian digits (۰–۹) when [lang] is [Lang.FA], leaving every
 * other character (separators, ranges like "3–8", units) untouched. Returns [value] unchanged for
 * English. Reuse this everywhere literal numbers appear in user-facing strings so Persian never
 * shows Latin digits.
 */
fun faDigits(value: String, lang: Lang): String {
    if (lang != Lang.FA) return value
    val out = StringBuilder(value.length)
    for (ch in value) out.append(if (ch in '0'..'9') '۰' + (ch - '0') else ch)
    return out.toString()
}

/** Formats an [Int] for display, mapping to Persian digits when [lang] is [Lang.FA]. */
fun fmtNum(value: Int, lang: Lang): String = faDigits(value.toString(), lang)

/**
 * Applies the right reading direction for [lang] (RTL for Persian) to [content]. The host wraps the
 * navigation host in this so the whole app mirrors when the user switches to فارسی.
 */
@Composable
fun ProvideAppDirection(lang: Lang, content: @Composable () -> Unit) {
    val direction = if (lang == Lang.FA) LayoutDirection.Rtl else LayoutDirection.Ltr
    CompositionLocalProvider(LocalLayoutDirection provides direction, content = content)
}
