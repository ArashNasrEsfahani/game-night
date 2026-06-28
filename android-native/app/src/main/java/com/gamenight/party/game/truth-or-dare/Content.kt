package com.gamenight.party.game.truthordare

import com.gamenight.party.content.ContentStore
import com.gamenight.party.model.LocalizedString
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Content models + loader for "Truth or Dare" — a Kotlin port of
 * src/games/truth-or-dare/content/index.ts. The webapp JSON is the single source of truth: the two
 * decks (truths.json / dares.json) are mirrored into assets/content/truth-or-dare/ by the Gradle
 * sync task and parsed here at runtime via [ContentStore]. NO prompt text is duplicated into Kotlin.
 */

/** The three difficulty tiers (src `Intensity` union 'mild'|'medium'|'spicy'). */
@Serializable
enum class Intensity {
    @SerialName("mild") MILD,
    @SerialName("medium") MEDIUM,
    @SerialName("spicy") SPICY,
}

/** Truth vs dare (src `PromptKind`). */
@Serializable
enum class PromptKind {
    @SerialName("truth") TRUTH,
    @SerialName("dare") DARE,
}

/** Declaration order — mirrors `INTENSITIES` in content/index.ts. */
val INTENSITIES: List<Intensity> = listOf(Intensity.MILD, Intensity.MEDIUM, Intensity.SPICY)

/** One truth/dare prompt (src `PromptItem`). Optional JSON keys get lenient Kotlin defaults. */
@Serializable
data class PromptItem(
    val id: String,
    val kind: PromptKind,
    val intensity: Intensity,
    val text: LocalizedString,
    val tags: List<String> = emptyList(),
    val minPlayers: Int? = null,
    val requiresProps: Boolean = false,
)

/** The on-disk shape of one deck file (src `DeckFile`). */
@Serializable
data class DeckFile(
    val schemaVersion: Int = 1,
    val deckId: String = "",
    val kind: PromptKind,
    val title: LocalizedString = LocalizedString("", ""),
    val items: List<PromptItem> = emptyList(),
)

/** Bilingual chip label for a tier — mirrors the `tod.intensityName.*` i18n keys. */
fun intensityLabel(i: Intensity): LocalizedString = when (i) {
    Intensity.MILD -> LocalizedString("Mild", "ملایم")
    Intensity.MEDIUM -> LocalizedString("Medium", "متوسط")
    Intensity.SPICY -> LocalizedString("Spicy", "تند")
}

/**
 * The assembled content database (mirrors the module-level TRUTHS / DARES / ALL_PROMPTS /
 * PROMPT_BY_ID built by content/index.ts's `rebuild`). Created once via [load] and passed to the
 * pure logic so [createInitialState] / the reducer / the screens stay deterministic and pure.
 */
class ToDContent(
    val truths: List<PromptItem>,
    val dares: List<PromptItem>,
) {
    val all: List<PromptItem> = truths + dares
    val byId: Map<String, PromptItem> = all.associateBy { it.id }

    /**
     * Filter a kind's pool by enabled intensities + minPlayers gate (NOT shuffled — the deck shuffles
     * by seed). Mirrors content/index.ts `getPool`.
     */
    fun getPool(kind: PromptKind, intensities: Map<Intensity, Boolean>, playerCount: Int): List<PromptItem> {
        val source = if (kind == PromptKind.TRUTH) truths else dares
        return source.filter { (intensities[it.intensity] == true) && (it.minPlayers ?: 2) <= playerCount }
    }

    companion object {
        const val GAME_ID: String = "truth-or-dare"

        /** Parse the two shared deck files from assets. Missing/malformed files degrade to empty. */
        fun load(store: ContentStore): ToDContent {
            val truths = runCatching {
                store.decode<DeckFile>(GAME_ID, "truths.json").items
            }.getOrDefault(emptyList())
            val dares = runCatching {
                store.decode<DeckFile>(GAME_ID, "dares.json").items
            }.getOrDefault(emptyList())
            return ToDContent(truths, dares)
        }
    }
}

/** Standalone parity check mirroring content/index.ts `validateContent` — useful for tests/tools. */
fun validateContent(content: ToDContent): List<String> {
    val problems = ArrayList<String>()
    val seen = HashSet<String>()
    for (p in content.all) {
        if (p.id in seen) problems.add("duplicate id ${p.id}")
        seen.add(p.id)
        if (p.text.en.isBlank() || p.text.fa.isBlank()) problems.add("empty text ${p.id}")
    }
    return problems
}
