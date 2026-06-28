package com.gamenight.party.game.neverhaveiever

import com.gamenight.party.content.ContentStore
import com.gamenight.party.model.LocalizedString
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Content models + loader for "Never Have I Ever" — a Kotlin port of
 * src/games/never-have-i-ever/content/{types.ts,index.ts}. The webapp JSON is the single source of
 * truth: the two decks (statements.classic/spicy.json) are mirrored into
 * assets/content/never-have-i-ever/ by the Gradle sync task and parsed here at runtime via
 * [ContentStore]. NO statement text is duplicated into Kotlin.
 */

/** The two difficulty tiers (src Intensity union 'classic'|'spicy'). */
@Serializable
enum class NhieIntensity {
    @SerialName("classic") CLASSIC,
    @SerialName("spicy") SPICY;

    /** The file/key segment used in JSON & asset file names, e.g. "classic". */
    val key: String
        get() = when (this) {
            CLASSIC -> "classic"
            SPICY -> "spicy"
        }
}

/** Declaration order — mirrors `INTENSITIES` in content/index.ts. */
val INTENSITIES: List<NhieIntensity> = listOf(NhieIntensity.CLASSIC, NhieIntensity.SPICY)

/** One "Never have I ever …" statement (src `Statement`). */
@Serializable
data class Statement(
    val id: String,
    val text: LocalizedString,
    val intensity: NhieIntensity,
    val tags: List<String> = emptyList(),
)

/** The on-disk shape of one deck file (src `StatementDeckFile`). */
@Serializable
data class StatementDeckFile(
    val intensity: NhieIntensity,
    val version: Int = 0,
    val items: List<Statement> = emptyList(),
)

/** Bilingual chip label for a tier — mirrors the `TITLES` map / `nhie.intensity.*` i18n keys. */
fun intensityLabel(i: NhieIntensity): LocalizedString = when (i) {
    NhieIntensity.CLASSIC -> LocalizedString("Classic", "کلاسیک")
    NhieIntensity.SPICY -> LocalizedString("Spicy", "تند")
}

/**
 * The assembled content database (mirrors the module-level CONTENT / ALL_STATEMENTS /
 * STATEMENT_BY_ID built by content/index.ts's `rebuild`). Created once via [load] and passed to the
 * pure logic so [createInitialState] / the screens stay deterministic.
 */
class NhieContent(
    /** Statements grouped by tier, in [INTENSITIES] order. */
    val byIntensity: Map<NhieIntensity, List<Statement>>,
) {
    val all: List<Statement> = INTENSITIES.flatMap { byIntensity[it].orEmpty() }
    val byId: Map<String, Statement> = all.associateBy { it.id }

    /**
     * Deterministic filter only (no shuffle — the reducer shuffles by seed). Mirrors
     * content/index.ts `getDeck`.
     */
    fun getDeck(intensities: List<NhieIntensity>, tags: List<String> = emptyList()): List<Statement> {
        val chosen = if (intensities.isEmpty()) INTENSITIES else intensities
        var pool = chosen.flatMap { byIntensity[it].orEmpty() }
        if (tags.isNotEmpty()) {
            pool = pool.filter { s -> s.tags.any { it in tags } }
        }
        return pool
    }

    companion object {
        const val GAME_ID: String = "never-have-i-ever"

        /** Parse the two shared deck files from assets. Missing/malformed files degrade to empty. */
        fun load(store: ContentStore): NhieContent {
            val map = LinkedHashMap<NhieIntensity, List<Statement>>()
            for (i in INTENSITIES) {
                val items = runCatching {
                    store.decode<StatementDeckFile>(GAME_ID, "statements.${i.key}.json").items
                }.getOrDefault(emptyList())
                map[i] = items
            }
            return NhieContent(map)
        }
    }
}
