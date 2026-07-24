package com.gamenight.party.game.codenames

import com.gamenight.party.content.ContentStore
import com.gamenight.party.model.LocalizedString
import kotlinx.serialization.Serializable

/**
 * Content models + loader for "Codenames" — a Kotlin port of
 * src/games/codenames/content/{types.ts,index.ts}. The webapp JSON is the single source of truth:
 * the word packs (core.json, nature.json) are mirrored into assets/content/codenames/ by the Gradle
 * sync task and parsed here at runtime via [ContentStore]. NO word text is duplicated into Kotlin.
 */

/** One board word (src `WordEntry`). */
@Serializable
data class CnWordEntry(
    val id: String,
    val text: LocalizedString,
    val difficulty: Int? = null,
    val tags: List<String> = emptyList(),
)

/** The on-disk shape of one word pack file (src `WordPack`). */
@Serializable
data class CnWordPack(
    val id: String,
    val name: LocalizedString,
    val version: Int = 1,
    val words: List<CnWordEntry> = emptyList(),
)

/**
 * The assembled content database (mirrors the module-level WORD_PACKS / PACK_BY_ID built by
 * content/index.ts's `rebuild`). Created once via [load] and passed to the pure logic so
 * `createInitialState` / the screens stay deterministic.
 */
class CodenamesContent private constructor(
    /** Word packs in declaration order (mirrors DATASETS: core, then nature). */
    val packs: List<CnWordPack>,
) {
    val byId: Map<String, CnWordPack> = packs.associateBy { it.id }

    /** Flatten + de-duplicate (first wins) the selected packs into a candidate pool (src `mergedPool`). */
    fun mergedPool(packIds: List<String>): List<CnWordEntry> {
        val ids = packIds.ifEmpty { listOf(DEFAULT_PACK_ID) }
        val seen = HashSet<String>()
        val out = ArrayList<CnWordEntry>()
        for (pid in ids) {
            for (w in byId[pid]?.words ?: emptyList()) {
                if (seen.add(w.id)) out.add(w)
            }
        }
        return out
    }

    companion object {
        const val GAME_ID: String = "codenames"
        const val DEFAULT_PACK_ID: String = "core"

        /** Files in the same order as content/index.ts's DATASETS (matters for de-dup precedence). */
        private val PACK_FILES = listOf("core.json", "nature.json")

        /** Parse the shared word-pack files from assets. Missing/malformed files are skipped. */
        fun load(store: ContentStore): CodenamesContent {
            val packs = PACK_FILES.mapNotNull { file ->
                runCatching { store.decode<CnWordPack>(GAME_ID, file) }.getOrNull()
            }
            return CodenamesContent(packs)
        }
    }
}
