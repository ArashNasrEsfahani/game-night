package com.gamenight.party.engine

/**
 * Seeded, deterministic randomness — a Kotlin port of src/engine/rng.ts (mulberry32).
 * Games stay pure by threading seeds through actions, exactly like the web engine: get a fresh
 * seed from the host (see [freshSeed]) at the impure boundary, then everything downstream is
 * reproducible.
 */
class Rng(seed: Int) {
    private var state: Int = seed

    /** Next float in [0, 1). Bit-for-bit equivalent to the web's mulberry32. */
    fun next(): Double {
        state += 0x6D2B79F5
        var t = (state xor (state ushr 15)) * (1 or state)
        t = (t + ((t xor (t ushr 7)) * (61 or t))) xor t
        return (t xor (t ushr 14)).toUInt().toDouble() / 4294967296.0
    }

    /** Inclusive integer in [min, max]. */
    fun int(min: Int, max: Int): Int = min + (next() * (max - min + 1)).toInt()

    /** A uniformly random element (throws on empty, like the web `pick`). */
    fun <T> pick(items: List<T>): T {
        require(items.isNotEmpty()) { "pick() on empty list" }
        return items[(next() * items.size).toInt()]
    }

    /** A new shuffled copy (Fisher–Yates). */
    fun <T> shuffle(items: List<T>): List<T> {
        val out = items.toMutableList()
        for (i in out.indices.reversed()) {
            val j = (next() * (i + 1)).toInt()
            val tmp = out[i]; out[i] = out[j]; out[j] = tmp
        }
        return out
    }
}

/** Derive a stable child seed from a parent seed + salt (mirrors rng.ts deriveSeed). */
fun deriveSeed(seed: Int, salt: Int): Int {
    var h = seed xor (salt * -0x61c88647) // golden-ratio mix
    h = (h xor (h ushr 16)) * -0x7ee3623b
    h = (h xor (h ushr 13)) * -0x3d4d51cb
    return h xor (h ushr 16)
}
