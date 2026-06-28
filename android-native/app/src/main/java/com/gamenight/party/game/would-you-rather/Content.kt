package com.gamenight.party.game.wouldyourather

import com.gamenight.party.content.ContentStore
import com.gamenight.party.model.LocalizedString
import kotlinx.serialization.Serializable

/**
 * Content models + loader for "Would You Rather" — a Kotlin port of
 * src/games/would-you-rather/content/{types.ts,index.ts}. The webapp JSON is the single source of
 * truth: the three decks (classic/spicy/travel .en-fa.json) are mirrored into
 * assets/content/would-you-rather/ by the Gradle sync task and parsed here at runtime via
 * [ContentStore]. NO dilemma text is duplicated into Kotlin.
 */

/** The three intensity tiers (src `Intensity` = 'mild'|'medium'|'spicy'). */
enum class Intensity(val key: String) {
    MILD("mild"),
    MEDIUM("medium"),
    SPICY("spicy"),
}

/** Declaration order — mirrors `ORDER` in content/index.ts (the intensity ceiling axis). */
val INTENSITY_ORDER: List<Intensity> = listOf(Intensity.MILD, Intensity.MEDIUM, Intensity.SPICY)

private val INTENSITY_KEYS: List<String> = INTENSITY_ORDER.map { it.key }

/** Bilingual chip label for a tier — mirrors the `wyr.intensity.*` i18n keys. */
fun intensityLabel(i: Intensity): LocalizedString = when (i) {
    Intensity.MILD -> LocalizedString("Mild", "ملایم")
    Intensity.MEDIUM -> LocalizedString("Medium", "متوسط")
    Intensity.SPICY -> LocalizedString("Spicy", "تند")
}

/** One "would you rather" dilemma (src `WyrItem`). [intensity] is kept as the raw key string so an
 *  unrecognised tier degrades gracefully (matches the web `ORDER.indexOf` filter semantics). */
@Serializable
data class WyrItem(
    val id: String,
    val optionA: LocalizedString,
    val optionB: LocalizedString,
    val intensity: String = "mild",
    val tags: List<String> = emptyList(),
    val note: LocalizedString? = null,
)

/** The on-disk shape of one deck file (src `WyrDeck`). */
@Serializable
data class WyrDeck(
    val id: String,
    val name: LocalizedString,
    val description: LocalizedString? = null,
    val intensityDefault: String = "mild",
    val items: List<WyrItem> = emptyList(),
)

/**
 * The assembled content database (mirrors the module-level DECKS / DECK_BY_ID / ITEM_BY_ID built by
 * content/index.ts's `rebuild`). Created once via [load] and passed to the pure logic so
 * [createInitialState] and the screens stay deterministic / content-free.
 */
class WyrContent(val decks: List<WyrDeck>) {
    val byId: Map<String, WyrDeck> = decks.associateBy { it.id }
    val itemById: Map<String, WyrItem> = decks.flatMap { it.items }.associateBy { it.id }

    /**
     * Items at or below the chosen [maxIntensity] ceiling (NOT shuffled — the reducer shuffles by
     * seed). Mirrors content/index.ts `poolFor`: an unknown intensity (indexOf == -1) is always
     * included since -1 <= ceil.
     */
    fun poolFor(deckId: String, maxIntensity: Intensity): List<WyrItem> {
        val ceil = INTENSITY_ORDER.indexOf(maxIntensity)
        return (byId[deckId]?.items ?: emptyList()).filter { INTENSITY_KEYS.indexOf(it.intensity) <= ceil }
    }

    companion object {
        const val GAME_ID: String = "would-you-rather"

        /** Deck files, in the order content/index.ts declares them (classic, spicy, travel). */
        private val FILES: List<String> = listOf(
            "classic.en-fa.json",
            "spicy.en-fa.json",
            "travel.en-fa.json",
        )

        /** Parse the shared deck files from assets. Missing/malformed files degrade to skipped. */
        fun load(store: ContentStore): WyrContent =
            WyrContent(FILES.mapNotNull { f -> runCatching { store.decode<WyrDeck>(GAME_ID, f) }.getOrNull() })
    }
}
