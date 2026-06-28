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
 * Applies the right reading direction for [lang] (RTL for Persian) to [content]. The host wraps the
 * navigation host in this so the whole app mirrors when the user switches to فارسی.
 */
@Composable
fun ProvideAppDirection(lang: Lang, content: @Composable () -> Unit) {
    val direction = if (lang == Lang.FA) LayoutDirection.Rtl else LayoutDirection.Ltr
    CompositionLocalProvider(LocalLayoutDirection provides direction, content = content)
}
