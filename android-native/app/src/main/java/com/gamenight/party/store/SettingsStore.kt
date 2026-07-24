package com.gamenight.party.store

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import com.gamenight.party.model.Lang
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import java.io.IOException

/** Theme preference — the native mirror of the web's `ThemePref` ('system' | 'light' | 'dark'). */
@Serializable
enum class ThemePref { SYSTEM, LIGHT, DARK }

/** Reduced-motion preference — the native mirror of the web's `MotionPref` ('system' | 'on' | 'off'). */
@Serializable
enum class MotionPref { SYSTEM, ON, OFF }

/**
 * The small, read-anywhere "AppSettings" state holder — a 1:1 port of the web `settingsStore`'s
 * persisted slice. Defaults match the web app (dark theme, Persian, sound on, haptics on).
 */
data class SettingsState(
    val theme: ThemePref = ThemePref.DARK,
    val language: Lang = Lang.FA,
    val muted: Boolean = false,
    val haptics: Boolean = true,
    val reducedMotion: MotionPref = MotionPref.SYSTEM,
    /** Show step-by-step guidance boxes throughout the app. */
    val guidance: Boolean = true,
) {
    /** Persian reads right-to-left; the host applies this as the layout direction. */
    val rtl: Boolean get() = language == Lang.FA

    /** Resolve the effective dark/light face given the current OS dark-mode flag. */
    fun darkTheme(systemDark: Boolean): Boolean = when (theme) {
        ThemePref.SYSTEM -> systemDark
        ThemePref.LIGHT -> false
        ThemePref.DARK -> true
    }

    /** Resolve the effective "reduce motion" flag given the OS accessibility preference. */
    fun reduceMotion(systemReduced: Boolean): Boolean = when (reducedMotion) {
        MotionPref.SYSTEM -> systemReduced
        MotionPref.ON -> true
        MotionPref.OFF -> false
    }
}

/** Disk shape (language stored as a stable "en"/"fa" tag, since [Lang] is not @Serializable). */
@Serializable
private data class SettingsDto(
    val theme: ThemePref = ThemePref.DARK,
    val language: String = "fa",
    val muted: Boolean = false,
    val haptics: Boolean = true,
    val reducedMotion: MotionPref = MotionPref.SYSTEM,
    val guidance: Boolean = true,
)

private fun SettingsState.toDto() = SettingsDto(
    theme = theme,
    language = if (language == Lang.FA) "fa" else "en",
    muted = muted,
    haptics = haptics,
    reducedMotion = reducedMotion,
    guidance = guidance,
)

private fun SettingsDto.toState() = SettingsState(
    theme = theme,
    language = if (language == "en") Lang.EN else Lang.FA,
    muted = muted,
    haptics = haptics,
    reducedMotion = reducedMotion,
    guidance = guidance,
)

/**
 * Persisted settings store. The DataStore is the single source of truth: [state] is derived from it
 * (so external writes re-emit), and every mutator runs an atomic read-modify-write transaction.
 * Mutators are fire-and-forget (launched on [scope]), mirroring the synchronous web setters.
 */
class SettingsStore(
    private val dataStore: DataStore<Preferences>,
    private val scope: CoroutineScope,
) {
    private val key = stringPreferencesKey("settings")

    /** The live settings, ready to read anywhere via `collectAsState()`. */
    val state: StateFlow<SettingsState> = dataStore.data
        .catch { e -> if (e is IOException) emit(emptyPreferences()) else throw e }
        .map { decode(it) }
        .stateIn(scope, SharingStarted.Eagerly, SettingsState())

    /** true once the first value has been read back from disk (host can gate first paint on this). */
    val hydrated: StateFlow<Boolean> = dataStore.data
        .catch { e -> if (e is IOException) emit(emptyPreferences()) else throw e }
        .map { true }
        .stateIn(scope, SharingStarted.Eagerly, false)

    fun setTheme(theme: ThemePref) = update { it.copy(theme = theme) }
    fun setLanguage(language: Lang) = update { it.copy(language = language) }
    fun setMuted(muted: Boolean) = update { it.copy(muted = muted) }
    fun setHaptics(haptics: Boolean) = update { it.copy(haptics = haptics) }
    fun setReducedMotion(reducedMotion: MotionPref) = update { it.copy(reducedMotion = reducedMotion) }
    fun setGuidance(guidance: Boolean) = update { it.copy(guidance = guidance) }

    private fun decode(prefs: Preferences): SettingsState {
        val raw = prefs[key] ?: return SettingsState()
        return runCatching { storeJson.decodeFromString<SettingsDto>(raw).toState() }
            .getOrElse { SettingsState() }
    }

    private fun update(transform: (SettingsState) -> SettingsState) {
        scope.launch {
            dataStore.edit { prefs ->
                prefs[key] = storeJson.encodeToString(transform(decode(prefs)).toDto())
            }
        }
    }
}
