package com.gamenight.party.sound

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * The native counterpart of `src/services/haptics.ts`: a thin [Vibrator] / [VibrationEffect] wrapper
 * exposing the same six cues the web app uses.
 *
 * Behavior:
 * - On API 29+ the three intensity cues use predefined effects (TICK / CLICK / HEAVY_CLICK); the
 *   patterned cues use amplitude waveforms. API 26-28 fall back to one-shots / waveforms, and
 *   API 24-25 fall back to legacy duration / pattern vibration.
 * - Honors [enabled]; every call no-ops when disabled.
 * - Degrades gracefully: a missing vibrator, no permission, or any platform exception is swallowed —
 *   it never throws.
 *
 * Like sound, haptics are *effects*: trigger them only from the Compose/UI layer, never in a reducer.
 *
 * Note: the host must declare `<uses-permission android:name="android.permission.VIBRATE" />` in the
 * manifest for vibration to actually fire; without it these calls are silently inert (no crash).
 */
class Haptics(context: Context?, enabled: Boolean = true) {

    /** When `false`, every cue is a no-op. */
    @Volatile
    var enabled: Boolean = enabled

    private val vibrator: Vibrator? = context?.let { resolve(it) }?.takeIf {
        runCatching { it.hasVibrator() }.getOrDefault(false)
    }

    /** True when a usable vibrator is present on this device. */
    val available: Boolean get() = vibrator != null

    fun light() = intensity(Cue.LIGHT, fallbackMs = 10L)

    fun medium() = intensity(Cue.MEDIUM, fallbackMs = 20L)

    fun heavy() = intensity(Cue.HEAVY, fallbackMs = 35L)

    fun success() = pattern(longArrayOf(12, 40, 12))

    fun warning() = pattern(longArrayOf(20, 60, 20))

    fun error() = pattern(longArrayOf(40, 30, 40, 30, 40))

    // ──────────────────────────────  internals  ──────────────────────────────

    private enum class Cue { LIGHT, MEDIUM, HEAVY }

    // VibrationEffect (API 26) and createPredefined (API 29) are referenced ONLY inside the matching
    // SDK_INT branch, so nothing in this method touches those classes on API 24/25.
    private fun intensity(cue: Cue, fallbackMs: Long) {
        val v = vibrator ?: return
        if (!enabled) return
        runCatching {
            when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> {
                    val effect = when (cue) {
                        Cue.LIGHT -> VibrationEffect.EFFECT_TICK
                        Cue.MEDIUM -> VibrationEffect.EFFECT_CLICK
                        Cue.HEAVY -> VibrationEffect.EFFECT_HEAVY_CLICK
                    }
                    v.vibrate(VibrationEffect.createPredefined(effect))
                }
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ->
                    v.vibrate(VibrationEffect.createOneShot(fallbackMs, VibrationEffect.DEFAULT_AMPLITUDE))
                else ->
                    @Suppress("DEPRECATION") v.vibrate(fallbackMs)
            }
        }
    }

    /** [onOff] alternates ON, OFF, ON, … durations (the web `navigator.vibrate` convention). */
    private fun pattern(onOff: LongArray) {
        val v = vibrator ?: return
        if (!enabled) return
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val amps = IntArray(onOff.size) { if (it % 2 == 0) 255 else 0 }
                v.vibrate(VibrationEffect.createWaveform(onOff, amps, -1))
            } else {
                // Legacy vibrate(long[], int) starts with an OFF delay; prepend 0 so element 0 is ON.
                val legacy = LongArray(onOff.size + 1)
                System.arraycopy(onOff, 0, legacy, 1, onOff.size)
                @Suppress("DEPRECATION") v.vibrate(legacy, -1)
            }
        }
    }

    private fun resolve(context: Context): Vibrator? = runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }.getOrNull()

    companion object {
        /** A safe no-op instance (no vibrator, disabled) — useful as a default before the host wires one. */
        fun none(): Haptics = Haptics(null, enabled = false)
    }
}
