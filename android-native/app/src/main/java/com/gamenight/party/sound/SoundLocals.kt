package com.gamenight.party.sound

import androidx.compose.runtime.staticCompositionLocalOf

// Safe defaults so a game can fire effects even before the host provides real instances: a disabled
// SoundEngine never starts its worker thread, and a no-op Haptics never touches the vibrator.
private val NoopSoundEngine = SoundEngine(enabled = false)
private val NoopHaptics = Haptics.none()

/**
 * Provides the process [SoundEngine] to the composable tree. The host should override this with a live,
 * settings-driven engine (e.g. `CompositionLocalProvider(LocalSoundEngine provides engine) { … }`);
 * the default is a disabled no-op so reads never crash.
 */
val LocalSoundEngine = staticCompositionLocalOf { NoopSoundEngine }

/**
 * Provides the process [Haptics] to the composable tree. The host should override this with a live,
 * context-backed instance; the default is a no-op.
 */
val LocalHaptics = staticCompositionLocalOf { NoopHaptics }
