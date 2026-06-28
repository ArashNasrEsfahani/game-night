package com.gamenight.party.sound

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Handler
import android.os.Looper
import java.util.Collections
import java.util.Random
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.sin

/**
 * The native counterpart of `src/services/sound.ts`: a self-contained SFX engine that **synthesizes**
 * every [SoundId] into a short 16-bit PCM clip at runtime (no audio asset files) and plays it through
 * [AudioTrack].
 *
 * Design notes / robustness:
 * - Clips are rendered lazily on a single background thread the first time they're played (or eagerly
 *   via [preload]) and cached, so playback never blocks the UI thread.
 * - Every AudioTrack interaction is wrapped — init / write / play failures are swallowed, never crash.
 * - Honors [enabled]: when `false`, [play] is a cheap no-op that allocates nothing and starts no thread.
 * - Sound/haptics are *effects*: call [play] only from the Compose/UI layer, never inside a reducer.
 *
 * Lifecycle: construct one instance (typically per-process), [preload] after first user gesture, and
 * call [release] when tearing down to free native tracks and the worker thread.
 */
class SoundEngine(enabled: Boolean = true) {

    /** When `false`, [play] returns immediately and no audio resources are touched. */
    @Volatile
    var enabled: Boolean = enabled

    private val clips = ConcurrentHashMap<SoundId, ShortArray>()
    private val active = Collections.synchronizedSet(mutableSetOf<AudioTrack>())

    @Volatile
    private var released = false

    // Created lazily so a disabled engine (e.g. the no-op composition-local default) never spins a thread.
    private var executor: ExecutorService? = null
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }

    @Synchronized
    private fun exec(): ExecutorService? {
        if (released) return null
        var e = executor
        if (e == null) {
            e = runCatching {
                Executors.newSingleThreadExecutor { r ->
                    Thread(r, "SfxEngine").apply { isDaemon = true }
                }
            }.getOrNull()
            executor = e
        }
        return e
    }

    /** Fire a one-shot. Cheap and safe to call from any thread; no-ops when disabled or released. */
    fun play(id: SoundId) {
        if (!enabled || released) return
        val e = exec() ?: return
        runCatching {
            e.execute {
                if (!enabled || released) return@execute
                val clip = clips.getOrPut(id) {
                    runCatching { render(id) }.getOrDefault(ShortArray(0))
                }
                if (clip.isNotEmpty()) playClip(clip)
            }
        }
    }

    /** Pre-render every clip off the main thread so the first play of each is instant. */
    fun preload() {
        if (released) return
        val e = exec() ?: return
        runCatching {
            e.execute {
                for (id in SoundId.values()) {
                    if (released) return@execute
                    clips.getOrPut(id) { runCatching { render(id) }.getOrDefault(ShortArray(0)) }
                }
            }
        }
    }

    /** Stop and free all native tracks and the worker thread. The engine is unusable afterwards. */
    fun release() {
        released = true
        enabled = false
        synchronized(active) { active.toList() }.forEach { finish(it) }
        executor?.let { runCatching { it.shutdownNow() } }
        executor = null
        clips.clear()
    }

    // ──────────────────────────────  playback  ──────────────────────────────

    private fun playClip(clip: ShortArray) {
        val track = buildTrack(clip.size) ?: return
        val wrote = runCatching { track.write(clip, 0, clip.size) }.getOrDefault(-1)
        if (wrote < 0) {
            runCatching { track.release() }
            return
        }
        active.add(track)
        val started = runCatching {
            track.setNotificationMarkerPosition(clip.size)
            track.setPlaybackPositionUpdateListener(object : AudioTrack.OnPlaybackPositionUpdateListener {
                override fun onMarkerReached(t: AudioTrack?) = finish(track)
                override fun onPeriodicNotification(t: AudioTrack?) {}
            })
            track.play()
            true
        }.getOrDefault(false)
        if (!started) {
            finish(track)
            return
        }
        // Belt-and-braces: if the marker callback never fires, release shortly after the clip ends.
        val ms = clip.size * 1000L / SAMPLE_RATE + 250L
        runCatching { mainHandler.postDelayed({ finish(track) }, ms) }
    }

    private fun buildTrack(samples: Int): AudioTrack? = runCatching {
        AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_GAME)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(SAMPLE_RATE)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build(),
            )
            .setBufferSizeInBytes(samples * 2)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()
    }.getOrNull()

    /** Idempotent: only the first caller (marker or fallback) actually stops + releases the track. */
    private fun finish(track: AudioTrack) {
        if (active.remove(track)) {
            runCatching { track.stop() }
            runCatching { track.release() }
        }
    }
}

// ───────────────────────────  offline synthesis  ───────────────────────────
// A tiny PCM port of the Web Audio primitives in src/services/sound.ts. Each builder mixes enveloped
// oscillators and filtered-noise bursts into a mono float buffer, then quantizes to 16-bit.

private const val SAMPLE_RATE = 44_100

/** Web master gain (master.gain.value = 0.32). */
private const val MASTER = 0.32

private enum class Osc { SINE, TRIANGLE, SQUARE, SAW }

// Note table — matches the web `N` map.
private const val C5 = 523.25
private const val E5 = 659.25
private const val G5 = 783.99
private const val A5 = 880.0
private const val C6 = 1046.5
private const val E6 = 1318.5
private const val G6 = 1568.0

/** Build one clip for [id]; mirrors `synth(id, ctx)` in the web service. */
private fun render(id: SoundId): ShortArray {
    val b = ClipBuilder()
    when (id) {
        SoundId.TAP -> b.tone(540.0, type = Osc.SQUARE, dur = 0.05, gain = 0.35)

        SoundId.CORRECT -> {
            // santur pluck with a quick grace-bend up into the note + an octave shimmer
            b.tone(E5 * 0.84, to = E5, type = Osc.TRIANGLE, dur = 0.06, gain = 0.3)
            b.pluck(E5, start = 0.05, gain = 0.46, dur = 0.12)
            b.pluck(A5, start = 0.12, gain = 0.46, dur = 0.16)
        }

        SoundId.SELECT -> b.pluck(G5, start = 0.0, gain = 0.5, dur = 0.16)

        SoundId.WRONG -> b.tone(200.0, to = 110.0, type = Osc.SAW, dur = 0.24, gain = 0.45)

        SoundId.FORGIVE -> {
            b.tone(520.0, to = 360.0, type = Osc.SINE, dur = 0.12, gain = 0.4)
            b.tone(360.0, to = 560.0, type = Osc.SINE, start = 0.1, dur = 0.18, gain = 0.4)
        }

        SoundId.TICK -> b.tone(1100.0, type = Osc.TRIANGLE, dur = 0.03, gain = 0.3)

        SoundId.TIME_UP -> {
            b.tone(A5, type = Osc.SQUARE, dur = 0.16, gain = 0.4)
            b.tone(A5, type = Osc.SQUARE, start = 0.2, dur = 0.16, gain = 0.4)
            b.tone(660.0, type = Osc.SQUARE, start = 0.42, dur = 0.26, gain = 0.4)
        }

        SoundId.REVEAL -> {
            b.noise(dur = 0.3, from = 500.0, to = 3200.0, gain = 0.32)
            b.tone(C5, to = C6, type = Osc.SINE, dur = 0.3, gain = 0.22)
            b.pluck(G5, start = 0.04, gain = 0.18, dur = 0.1)
            b.pluck(C6, start = 0.12, gain = 0.18, dur = 0.1)
        }

        SoundId.DRUM -> b.drumHit(start = 0.0)

        SoundId.BOING -> {
            b.tone(680.0, to = 220.0, type = Osc.SAW, dur = 0.12, gain = 0.4)
            b.tone(220.0, to = 520.0, type = Osc.SINE, start = 0.1, dur = 0.16, gain = 0.35)
        }

        SoundId.WIN -> {
            b.drumHit(start = 0.0, freq = 150.0, gain = 0.6)
            val run = doubleArrayOf(C5, E5, G5, C6, E6, G6)
            run.forEachIndexed { i, f -> b.pluck(f, start = 0.08 + i * 0.09, gain = 0.5, dur = 0.22) }
            b.tone(G6, start = 0.66, dur = 0.5, gain = 0.4, type = Osc.SINE)
            b.tone(C6, start = 0.66, dur = 0.5, gain = 0.3, type = Osc.TRIANGLE)
            b.noise(start = 0.6, dur = 0.5, from = 4000.0, to = 9000.0, gain = 0.12)
        }

        SoundId.SPARKLE -> {
            doubleArrayOf(C6, E6, G6, 2093.0).forEachIndexed { i, f ->
                b.tone(f, type = Osc.SINE, start = i * 0.05, dur = 0.18, gain = 0.3)
            }
            b.noise(dur = 0.3, from = 6000.0, to = 11000.0, gain = 0.1)
        }

        SoundId.LOSE -> {
            doubleArrayOf(G5, E5, C5, 392.0).forEachIndexed { i, f ->
                b.tone(f, start = i * 0.13, dur = 0.26, gain = 0.45, type = Osc.SAW)
            }
        }

        SoundId.EXPLOSION -> {
            // a real BOOM: sub-bass thump + broadband blast falling bright -> rumble + crackle
            b.tone(120.0, to = 36.0, type = Osc.SINE, dur = 0.6, gain = 0.95, attack = 0.005)
            b.tone(200.0, to = 48.0, type = Osc.SAW, dur = 0.45, gain = 0.6, attack = 0.005)
            b.noise(dur = 0.55, from = 1800.0, to = 60.0, gain = 0.7)
            b.noise(start = 0.04, dur = 0.3, from = 900.0, to = 120.0, gain = 0.4)
        }

        SoundId.SHUFFLE -> b.noise(dur = 0.32, from = 1200.0, to = 600.0, gain = 0.3)

        SoundId.PASS -> b.noise(dur = 0.14, from = 1800.0, to = 700.0, gain = 0.28)
    }
    return b.build()
}

/** Mixes synthesized voices into a growable mono float buffer; [build] quantizes to PCM-16. */
private class ClipBuilder {
    private var buf = FloatArray(SAMPLE_RATE / 4) // ~0.25s, grows as needed
    private var len = 0
    private val rng = Random()

    private fun ensure(samples: Int) {
        if (samples > buf.size) {
            var n = buf.size
            while (n < samples) n *= 2
            buf = buf.copyOf(n)
        }
        if (samples > len) len = samples
    }

    /** One enveloped oscillator note, mirroring web `tone()`. [to] > 0 glides exponentially. */
    fun tone(
        freq: Double,
        to: Double = 0.0,
        type: Osc = Osc.TRIANGLE,
        start: Double = 0.0,
        dur: Double = 0.18,
        gain: Double = 0.6,
        attack: Double = 0.008,
    ) {
        val t0 = (start * SAMPLE_RATE).toInt()
        val n = (dur * SAMPLE_RATE).toInt().coerceAtLeast(1)
        val atk = (attack * SAMPLE_RATE).toInt().coerceAtLeast(1).coerceAtMost(n)
        val decayN = (n - atk).coerceAtLeast(1)
        ensure(t0 + n + 1)
        val twoPiOverSr = 2.0 * PI / SAMPLE_RATE
        val flr = 0.0001
        var phase = 0.0
        for (i in 0 until n) {
            val u = i.toDouble() / SAMPLE_RATE
            val f = if (to > 0.0) freq * (to / freq).pow(u / dur) else freq
            phase += twoPiOverSr * f
            val g = if (i < atk) {
                flr * (gain / flr).pow(i.toDouble() / atk)
            } else {
                gain * (flr / gain).pow((i - atk).toDouble() / decayN)
            }
            val idx = t0 + i
            buf[idx] = (buf[idx] + MASTER * g * wave(type, phase)).toFloat()
        }
    }

    /** Band-pass-filtered white-noise burst with a swept center frequency, mirroring web `noise()`. */
    fun noise(
        start: Double = 0.0,
        dur: Double = 0.25,
        from: Double = 800.0,
        to: Double = 2600.0,
        gain: Double = 0.4,
    ) {
        val t0 = (start * SAMPLE_RATE).toInt()
        val n = (dur * SAMPLE_RATE).toInt().coerceAtLeast(1)
        ensure(t0 + n + 1)
        val q = 0.7
        val flr = 0.0001
        // RBJ constant-0dB band-pass; coefficients recomputed per-sample as the center sweeps.
        var x1 = 0.0; var x2 = 0.0; var y1 = 0.0; var y2 = 0.0
        for (i in 0 until n) {
            val u = i.toDouble() / SAMPLE_RATE
            val f0 = from * (to / from).pow(u / dur)
            val w0 = 2.0 * PI * f0 / SAMPLE_RATE
            val alpha = sin(w0) / (2.0 * q)
            val a0 = 1.0 + alpha
            val b0 = alpha / a0
            val b2 = -alpha / a0
            val a1 = -2.0 * cos(w0) / a0
            val a2 = (1.0 - alpha) / a0
            val x0 = rng.nextDouble() * 2.0 - 1.0
            val y0 = b0 * x0 + b2 * x2 - a1 * y1 - a2 * y2
            x2 = x1; x1 = x0; y2 = y1; y1 = y0
            val g = gain * (flr / gain).pow(u / dur)
            val idx = t0 + i
            buf[idx] = (buf[idx] + MASTER * g * y0).toFloat()
        }
    }

    /** Bright plucked note with an octave shimmer — santur-flavored (web `pluck()`). */
    fun pluck(freq: Double, start: Double = 0.0, gain: Double = 0.42, dur: Double = 0.18) {
        tone(freq, type = Osc.TRIANGLE, start = start, dur = dur, gain = gain, attack = 0.004)
        tone(freq * 2, type = Osc.SINE, start = start, dur = dur * 0.6, gain = gain * 0.28, attack = 0.004)
    }

    /** Tombak/dombak hit: low membrane "tom" + a short noise "bak" slap (web `drumHit()`). */
    fun drumHit(start: Double = 0.0, freq: Double = 180.0, gain: Double = 0.7) {
        tone(freq, to = freq * 0.4, type = Osc.SINE, start = start, dur = 0.18, gain = gain)
        noise(start = start, dur = 0.05, from = 520.0, to = 200.0, gain = gain * 0.3)
    }

    private fun wave(type: Osc, phase: Double): Double = when (type) {
        Osc.SINE -> sin(phase)
        Osc.TRIANGLE -> (2.0 / PI) * asin(sin(phase))
        Osc.SQUARE -> if (sin(phase) >= 0.0) 1.0 else -1.0
        Osc.SAW -> {
            val p = phase / (2.0 * PI)
            2.0 * (p - floor(p + 0.5))
        }
    }

    /** Quantize to 16-bit PCM, peak-normalizing only if the mix would clip. */
    fun build(): ShortArray {
        if (len == 0) return ShortArray(0)
        var peak = 0f
        for (i in 0 until len) {
            val a = abs(buf[i])
            if (a > peak) peak = a
        }
        val scale = if (peak > 0.999f) 0.999f / peak else 1f
        val out = ShortArray(len)
        for (i in 0 until len) {
            var v = buf[i] * scale
            if (v > 1f) v = 1f else if (v < -1f) v = -1f
            out[i] = (v * 32767f).toInt().toShort()
        }
        return out
    }
}
