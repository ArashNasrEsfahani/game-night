package com.gamenight.party.game.headsup

import com.gamenight.party.content.ContentStore
import com.gamenight.party.model.LocalizedString
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Heads Up! content models + loader — the native port of src/games/heads-up/content/index.ts.
 *
 * The webapp JSON (src/games/heads-up/content/(json files)) is the SINGLE source of truth; the Gradle
 * `syncSharedContent` task mirrors it into assets/content/heads-up/, and this parses the very same
 * files at runtime via [ContentStore]. NO content text is duplicated into Kotlin.
 */

/** easy = common single word, medium = trickier, hard = compound / obscure. Missing == medium. */
@Serializable
enum class Difficulty {
    @SerialName("easy") EASY,
    @SerialName("medium") MEDIUM,
    @SerialName("hard") HARD,
}

/** Stable tier order, mirroring `DIFFICULTIES` in content/index.ts. */
val DIFFICULTIES: List<Difficulty> = listOf(Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD)

@Serializable
data class HeadsUpCard(
    val id: String,
    val word: LocalizedString,
    val hint: LocalizedString? = null,
    val difficulty: Difficulty? = null,
)

@Serializable
data class HeadsUpDeck(
    val id: String,
    val name: LocalizedString,
    val category: String = "",
    val icon: String = "",
    val cards: List<HeadsUpCard> = emptyList(),
)

/** A card's effective tier (untagged content counts as 'medium'), mirroring `cardDifficulty`. */
fun cardDifficulty(c: HeadsUpCard): Difficulty = c.difficulty ?: Difficulty.MEDIUM

/**
 * The assembled deck registry for a match. Built once from [ContentStore] (see [load]); holds the
 * ordered decks plus the by-id and namespaced-card-key (`<deckId>:<cardId>`) lookups, and exposes
 * the same pool/filter helpers as content/index.ts. The reducer never touches this — it operates on
 * the already-resolved `cardPool` of keys; card TEXT is resolved here at render time.
 */
class HeadsUpContent private constructor(val decks: List<HeadsUpDeck>) {

    val deckById: Map<String, HeadsUpDeck> = decks.associateBy { it.id }

    /** Namespaced lookup `<deckId>:<cardId>` -> card, mirroring `CARD_BY_KEY`. */
    val cardByKey: Map<String, HeadsUpCard> =
        decks.flatMap { d -> d.cards.map { c -> "${d.id}:${c.id}" to c } }.toMap()

    /**
     * Namespaced card-id pool for the chosen decks (NOT shuffled), optionally filtered by tier.
     * Omitting [difficulties] (or passing all three) includes every card. Mirrors `mergedPool`.
     */
    fun mergedPool(deckIds: List<String>, difficulties: List<Difficulty>? = null): List<String> {
        val ids = if (deckIds.isNotEmpty()) deckIds else listOfNotNull(decks.firstOrNull()?.id)
        val allow = difficulties?.takeIf { it.isNotEmpty() }?.toSet()
        return ids.flatMap { id ->
            (deckById[id]?.cards ?: emptyList())
                .filter { allow == null || cardDifficulty(it) in allow }
                .map { "$id:${it.id}" }
        }
    }

    /** How many cards each chosen deck has per tier (drives the Setup difficulty hints). */
    fun deckDifficultyCounts(deckIds: List<String>): Map<Difficulty, Int> {
        val counts = linkedMapOf(Difficulty.EASY to 0, Difficulty.MEDIUM to 0, Difficulty.HARD to 0)
        val ids = if (deckIds.isNotEmpty()) deckIds else listOfNotNull(decks.firstOrNull()?.id)
        for (id in ids) for (c in deckById[id]?.cards ?: emptyList()) {
            val d = cardDifficulty(c)
            counts[d] = (counts[d] ?: 0) + 1
        }
        return counts
    }

    companion object {
        const val GAME = "heads-up"

        /**
         * Deck files in the exact order of `DEFAULT_DECKS` in content/index.ts, so deck #0 (the
         * fallback / default) is `animals`, matching the web. (The Gradle manifest lists files
         * alphabetically; we deliberately load by this canonical order instead.)
         */
        val DECK_FILES: List<String> = listOf(
            "animals.json", "movies.json", "tv.json", "actions.json",
            "food.json", "sports.json", "music.json", "brands.json",
        )

        /** Parse every shared deck JSON via [ContentStore]; silently skips any file not present. */
        fun load(content: ContentStore): HeadsUpContent {
            val decks = DECK_FILES.mapNotNull { file ->
                runCatching { content.decode<HeadsUpDeck>(GAME, file) }.getOrNull()
            }
            return HeadsUpContent(decks)
        }
    }
}
