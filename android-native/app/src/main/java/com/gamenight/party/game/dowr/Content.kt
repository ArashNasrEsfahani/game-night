package com.gamenight.party.game.dowr

import com.gamenight.party.content.ContentStore
import com.gamenight.party.model.LocalizedString
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Content models + loader for "Dowr" — a Kotlin port of
 * src/games/dowr/content/{index.ts,types-from-WordCard}. The webapp JSON is the single source of
 * truth: the five word packs (food/objects/jobs/places/animals.json) are mirrored into
 * assets/content/dowr/ by the Gradle `syncSharedContent` task and parsed here at runtime via
 * [ContentStore]. NO word text is duplicated into Kotlin.
 */

/** The five word packs (src `DowrCategory` union). */
@Serializable
enum class DowrCategory {
    @SerialName("food") FOOD,
    @SerialName("objects") OBJECTS,
    @SerialName("jobs") JOBS,
    @SerialName("places") PLACES,
    @SerialName("animals") ANIMALS;

    /** The file/key segment used in JSON & asset file names, e.g. "food" -> food.json. */
    val key: String
        get() = when (this) {
            FOOD -> "food"
            OBJECTS -> "objects"
            JOBS -> "jobs"
            PLACES -> "places"
            ANIMALS -> "animals"
        }
}

/** Declaration order — mirrors `DOWR_CATEGORIES` / `CATEGORIES` in config.ts & content/index.ts. */
val CATEGORIES: List<DowrCategory> = listOf(
    DowrCategory.FOOD,
    DowrCategory.OBJECTS,
    DowrCategory.JOBS,
    DowrCategory.PLACES,
    DowrCategory.ANIMALS,
)

/** The three difficulty tiers (src `DowrDifficulty` union 'easy'|'med'|'hard'). */
@Serializable
enum class DowrDifficulty {
    @SerialName("easy") EASY,
    @SerialName("med") MED,
    @SerialName("hard") HARD,
}

/** Optional "don't say" hints attached to a card (src `WordCard.hints`). */
@Serializable
data class Hints(
    val taboo: List<LocalizedString> = emptyList(),
)

/** One word card (src `WordCard`). */
@Serializable
data class WordCard(
    val id: String,
    val word: LocalizedString,
    val category: DowrCategory,
    val difficulty: DowrDifficulty,
    val hints: Hints? = null,
)

/** Bilingual chip label for a pack — mirrors `CATEGORY_TITLES` / the `dowr.cat.*` i18n keys. */
fun categoryLabel(c: DowrCategory): LocalizedString = when (c) {
    DowrCategory.FOOD -> LocalizedString("Food", "خوراکی")
    DowrCategory.OBJECTS -> LocalizedString("Objects", "اشیا")
    DowrCategory.JOBS -> LocalizedString("Jobs", "مشاغل")
    DowrCategory.PLACES -> LocalizedString("Places", "مکان‌ها")
    DowrCategory.ANIMALS -> LocalizedString("Animals", "حیوانات")
}

/**
 * The assembled content database (mirrors the module-level CONTENT / ALL_CARDS / CARD_BY_ID built by
 * content/index.ts's `rebuild`). Created once via [load] and passed into the pure logic so
 * [createInitialState] / the screens stay deterministic (the web reads a module-level pool).
 */
class DowrContent(
    /** Cards grouped by pack, in [CATEGORIES] order. */
    val byCategory: Map<DowrCategory, List<WordCard>>,
) {
    val all: List<WordCard> = CATEGORIES.flatMap { byCategory[it].orEmpty() }
    val byId: Map<String, WordCard> = all.associateBy { it.id }

    /**
     * Deterministic flatten + filter only (no shuffle — the deck shuffles by seed). Mirrors
     * deck.ts `buildPool`: cats in selection order, then an optional exact-difficulty filter
     * ([difficulty] == null is the "mixed/random" pick).
     */
    fun buildPool(categories: List<DowrCategory>, difficulty: DowrDifficulty?): List<WordCard> {
        val cats = if (categories.isNotEmpty()) categories else CATEGORIES
        var pool = cats.flatMap { byCategory[it].orEmpty() }
        if (difficulty != null) pool = pool.filter { it.difficulty == difficulty }
        return pool
    }

    companion object {
        const val GAME_ID: String = "dowr"

        /** Parse the five shared word-pack files from assets. Missing/malformed files degrade to empty. */
        fun load(store: ContentStore): DowrContent {
            val map = LinkedHashMap<DowrCategory, List<WordCard>>()
            for (c in CATEGORIES) {
                val items = runCatching {
                    store.decode<List<WordCard>>(GAME_ID, "${c.key}.json")
                }.getOrDefault(emptyList())
                map[c] = items
            }
            return DowrContent(map)
        }
    }
}
