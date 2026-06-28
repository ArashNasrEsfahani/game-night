package com.gamenight.party.content

import android.content.res.AssetManager
import kotlinx.serialization.json.Json

/**
 * Reads the SHARED content databases that the Gradle `syncSharedContent` task mirrors from the
 * webapp (src/games/<id>/content/<file>.json) into assets/content/. The webapp remains the single source
 * of truth — this just parses the same JSON at runtime.
 *
 * Layout in assets:
 *   content/manifest.json         -> { "<gameId>": ["file.json", ...], ... }
 *   content/<gameId>/<file>.json  -> that game's raw content
 */
class ContentStore(private val assets: AssetManager) {
    val json: Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private fun read(path: String): String =
        assets.open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }

    /** Map of gameId -> content file names available for it. */
    fun manifest(): Map<String, List<String>> =
        json.decodeFromString(read("content/manifest.json"))

    /** Raw JSON text of one content file. */
    fun raw(gameId: String, file: String): String = read("content/$gameId/$file")

    /** Decode one content file into [T] (a @Serializable type). */
    inline fun <reified T> decode(gameId: String, file: String): T =
        json.decodeFromString(raw(gameId, file))
}
