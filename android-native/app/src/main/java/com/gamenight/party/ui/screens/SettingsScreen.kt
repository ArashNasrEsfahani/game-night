package com.gamenight.party.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.Lang
import com.gamenight.party.store.MotionPref
import com.gamenight.party.store.SettingsStore
import com.gamenight.party.store.ThemePref
import com.gamenight.party.ui.components.AppBar
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.AppToggle
import com.gamenight.party.ui.components.SegmentOption
import com.gamenight.party.ui.components.SegmentedControl
import com.gamenight.party.ui.theme.LocalPalette

/**
 * The Settings screen — a 1:1 port of src/app/pages/SettingsPage.tsx. Day/night theme, EN/FA
 * language (the host applies RTL via [ProvideAppDirection]), reduce-motion, and sound / haptics /
 * guidance toggles. Reads & writes the persisted [SettingsStore].
 */
@Composable
fun SettingsScreen(
    settings: SettingsStore,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by settings.state.collectAsState()
    val lang = state.language

    AppScreen(
        modifier = modifier,
        scrollable = true,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        AppBar(title = uiText(lang, "Settings", "تنظیمات"), onBack = onBack)

        LabeledCard(label = uiText(lang, "Theme", "پوسته")) {
            SegmentedControl(
                options = listOf(
                    SegmentOption(ThemePref.SYSTEM, uiText(lang, "System", "سیستم")),
                    SegmentOption(ThemePref.LIGHT, uiText(lang, "Light", "روشن")),
                    SegmentOption(ThemePref.DARK, uiText(lang, "Dark", "تیره")),
                ),
                value = state.theme,
                onChange = settings::setTheme,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        LabeledCard(label = uiText(lang, "Language", "زبان")) {
            SegmentedControl(
                options = listOf(
                    SegmentOption(Lang.EN, "English"),
                    SegmentOption(Lang.FA, "فارسی"),
                ),
                value = state.language,
                onChange = settings::setLanguage,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        LabeledCard(label = uiText(lang, "Reduce motion", "کاهش حرکت")) {
            SegmentedControl(
                options = listOf(
                    SegmentOption(MotionPref.SYSTEM, uiText(lang, "System", "سیستم")),
                    SegmentOption(MotionPref.ON, uiText(lang, "On", "روشن")),
                    SegmentOption(MotionPref.OFF, uiText(lang, "Off", "خاموش")),
                ),
                value = state.reducedMotion,
                onChange = settings::setReducedMotion,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        AppCard {
            AppToggle(
                checked = !state.muted,
                onCheckedChange = { on -> settings.setMuted(!on) },
                label = uiText(lang, "Sound", "صدا"),
            )
        }

        AppCard {
            AppToggle(
                checked = state.haptics,
                onCheckedChange = settings::setHaptics,
                label = uiText(lang, "Vibration", "لرزش"),
            )
        }

        AppCard {
            AppToggle(
                checked = state.guidance,
                onCheckedChange = settings::setGuidance,
                label = "💡 " + uiText(lang, "Guidance", "راهنما"),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = uiText(lang, "Show step-by-step help boxes", "نمایش جعبه‌های راهنمای مرحله‌به‌مرحله"),
                color = LocalPalette.current.textMuted,
                fontSize = 12.sp,
            )
        }

        Spacer(Modifier.height(16.dp))
    }
}

/** A settings card with a muted caption above its control. */
@Composable
private fun LabeledCard(label: String, content: @Composable ColumnScope.() -> Unit) {
    AppCard {
        Text(
            text = label,
            color = LocalPalette.current.textMuted,
            fontWeight = FontWeight.Medium,
            fontSize = 13.sp,
        )
        Spacer(Modifier.height(8.dp))
        content()
    }
}
