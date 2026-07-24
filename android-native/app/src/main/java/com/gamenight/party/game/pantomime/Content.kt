package com.gamenight.party.game.pantomime

import com.gamenight.party.content.ContentStore
import com.gamenight.party.model.LocalizedString
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Content models + loader for Pantomime — a faithful Kotlin port of
 * src/games/pantomime/content/{types.ts,index.ts}. The shared web JSON (one file per real category)
 * is the single source of truth; the Gradle `syncSharedContent` task mirrors it into
 * assets/content/pantomime/<category>.json, and [PantomimeContentLoader] parses it at runtime via
 * [ContentStore]. NEVER duplicate prompt text into Kotlin.
 */

/** easy / medium / hard, matching the lowercase JSON values. */
@Serializable
enum class PantomimeDifficulty {
    @SerialName("easy") EASY,
    @SerialName("medium") MEDIUM,
    @SerialName("hard") HARD,
}

/**
 * The selectable decks. The eight real decks map 1:1 to a content file (via [slug]); [MIXED] is a
 * virtual deck that expands to the union of all real decks at resolve time.
 */
enum class PantomimeCategory(val slug: String) {
    MOVIES("movies"),
    TV("tv"),
    ANIMALS("animals"),
    ACTIONS("actions"),
    FAMOUS("famous"),
    PROVERBS("proverbs"),
    SPORTS("sports"),
    JOBS("jobs"),
    MIXED("mixed");

    companion object {
        /** All real (non-virtual) categories, in deck order — mirrors REAL_CATEGORIES in index.ts. */
        val REAL: List<PantomimeCategory> = listOf(MOVIES, TV, ANIMALS, ACTIONS, FAMOUS, PROVERBS, SPORTS, JOBS)

        /** Every selectable category (the eight real decks plus the virtual "mixed"). */
        val ALL: List<PantomimeCategory> = REAL + MIXED
    }
}

/** A single promptable item to mime. Mirrors the `PantomimePrompt` interface in types.ts. */
@Serializable
data class PantomimePrompt(
    val id: String,
    val text: LocalizedString,
    /** The real deck this belongs to ("movies", "animals", …); parsed as a plain string. */
    val category: String = "",
    val difficulty: PantomimeDifficulty = PantomimeDifficulty.EASY,
    /** Optional acting hint shown ONLY to the actor inside the reveal gate. */
    val hint: LocalizedString? = null,
    val tags: List<String> = emptyList(),
)

/** One JSON file per real category. Mirrors `PantomimeDeckFile` in types.ts. */
@Serializable
data class PantomimeDeckFile(
    val category: String = "",
    val version: Int = 1,
    val prompts: List<PantomimePrompt> = emptyList(),
)

/**
 * The loaded, in-memory content for Pantomime. Holds prompts indexed by real category plus a flat
 * id->prompt lookup, and reproduces the pool selection/filter logic from index.ts. Passing this in
 * keeps [createInitialState] pure (the web reads a module-level pool; native threads it explicitly).
 */
class PantomimeContent(
    val contentByCategory: Map<PantomimeCategory, List<PantomimePrompt>>,
) {
    /** All prompts across the real categories, in deck order. */
    val all: List<PantomimePrompt> = PantomimeCategory.REAL.flatMap { contentByCategory[it].orEmpty() }

    /** id -> prompt, used by the screens to resolve the current prompt's text/hint. */
    val byId: Map<String, PantomimePrompt> = all.associateBy { it.id }

    /** Prompts for the requested categories + difficulties (mirrors `selectPrompts` in index.ts). */
    fun selectPrompts(
        categories: List<PantomimeCategory>,
        difficulties: List<PantomimeDifficulty>,
    ): List<PantomimePrompt> {
        val cats = resolveCategories(categories)
        val diffs = difficulties.ifEmpty {
            listOf(PantomimeDifficulty.EASY, PantomimeDifficulty.MEDIUM, PantomimeDifficulty.HARD)
        }
        return cats.flatMap { contentByCategory[it].orEmpty() }.filter { it.difficulty in diffs }
    }
}

/** Expand "mixed" to all real categories; de-duplicate to real categories only (mirrors index.ts). */
fun resolveCategories(categories: List<PantomimeCategory>): List<PantomimeCategory> {
    if (categories.isEmpty() || PantomimeCategory.MIXED in categories) return PantomimeCategory.REAL
    val reals = categories.filter { it != PantomimeCategory.MIXED }
    return reals.ifEmpty { PantomimeCategory.REAL }
}

/** Reads + decodes every real-category JSON file from the shared content assets. */
object PantomimeContentLoader {
    fun load(store: ContentStore): PantomimeContent {
        val byCategory = PantomimeCategory.REAL.associateWith { cat ->
            runCatching { store.decode<PantomimeDeckFile>("pantomime", "${cat.slug}.json").prompts }
                .getOrDefault(emptyList())
        }
        return PantomimeContent(byCategory)
    }
}

/** Build the UNSHUFFLED prompt pool for the chosen categories/difficulties (mirrors deck.ts). */
fun buildPool(content: PantomimeContent, options: PantomimeOptions): List<PantomimePrompt> =
    content.selectPrompts(options.categories, options.difficulties)
