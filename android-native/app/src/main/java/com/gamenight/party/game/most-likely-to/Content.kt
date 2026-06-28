package com.gamenight.party.game.mostlikelyto

import com.gamenight.party.content.ContentStore
import com.gamenight.party.model.LocalizedString
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Content models + loader for "Most Likely To" — a Kotlin port of
 * src/games/most-likely-to/content/{types.ts,index.ts}. The webapp JSON is the single source of
 * truth: the three decks (classic/spicy/work.json) are mirrored into
 * assets/content/most-likely-to/ by the Gradle sync task and parsed here at runtime via
 * [ContentStore]. NO prompt text is duplicated into Kotlin.
 */

/** Intensity tiers, mildest to spiciest (src `Intensity` union 'family'|'casual'|'spicy'). */
@Serializable
enum class Intensity {
    @SerialName("family") FAMILY,
    @SerialName("casual") CASUAL,
    @SerialName("spicy") SPICY;

    /** Position in the family→casual→spicy ladder (used by the at-or-below ceiling filter). */
    val rank: Int
        get() = when (this) {
            FAMILY -> 0
            CASUAL -> 1
            SPICY -> 2
        }
}

/** Declaration order — mirrors the `order` array in content/index.ts. */
val INTENSITIES: List<Intensity> = listOf(Intensity.FAMILY, Intensity.CASUAL, Intensity.SPICY)

/** Bilingual chip label for a tier — mirrors the `mlt.intensity.*` i18n keys. */
fun intensityLabel(i: Intensity): LocalizedString = when (i) {
    Intensity.FAMILY -> LocalizedString("Family", "خانوادگی")
    Intensity.CASUAL -> LocalizedString("Casual", "معمولی")
    Intensity.SPICY -> LocalizedString("Spicy", "تند")
}

/** One "…is most likely to …" prompt (src `MltPrompt`). */
@Serializable
data class MltPrompt(
    val id: String,
    val text: LocalizedString,
    val intensity: Intensity,
    val emoji: String? = null,
    val tags: List<String> = emptyList(),
)

/** The on-disk shape of one deck file (src `MltDeck`). */
@Serializable
data class MltDeck(
    val id: String,
    val name: LocalizedString,
    val description: LocalizedString,
    val version: Int = 0,
    val prompts: List<MltPrompt> = emptyList(),
)

/**
 * The assembled content database (mirrors the module-level DECKS / DECK_BY_ID / PROMPT_BY_ID built
 * by content/index.ts's `rebuild`). Created once via [load] and passed to the pure logic so
 * [createInitialState] / the screens stay deterministic.
 */
class MltContent(
    /** Decks in canonical order (classic, spicy, work). */
    val decks: List<MltDeck>,
) {
    val deckById: Map<String, MltDeck> = decks.associateBy { it.id }
    val promptById: Map<String, MltPrompt> = decks.flatMap { it.prompts }.associateBy { it.id }

    /**
     * Filter a deck's prompts by intensity ceiling — include prompts at or below [intensity] (NOT
     * shuffled; the reducer shuffles by seed). Mirrors content/index.ts `getPool`.
     */
    fun getPool(deckId: String, intensity: Intensity): List<MltPrompt> {
        val deck = deckById[deckId] ?: decks.firstOrNull() ?: return emptyList()
        val maxRank = intensity.rank
        return deck.prompts.filter { it.intensity.rank <= maxRank }
    }

    companion object {
        const val GAME_ID: String = "most-likely-to"

        /** Canonical deck order (mirrors DEFAULT_DECKS in content/index.ts). */
        private val DECK_ORDER: List<String> = listOf("classic", "spicy", "work")

        /** Parse the shared deck files from assets. Missing/malformed files degrade to empty. */
        fun load(store: ContentStore): MltContent {
            val files = runCatching { store.manifest()[GAME_ID].orEmpty() }
                .getOrDefault(emptyList())
                .ifEmpty { DECK_ORDER.map { "$it.json" } }
            val decks = files
                .mapNotNull { f -> runCatching { store.decode<MltDeck>(GAME_ID, f) }.getOrNull() }
                .sortedBy { d -> DECK_ORDER.indexOf(d.id).let { if (it < 0) Int.MAX_VALUE else it } }
            return MltContent(decks)
        }
    }
}
