package com.gamenight.party.game.spyfall

import com.gamenight.party.content.ContentStore
import com.gamenight.party.model.LocalizedString
import kotlinx.serialization.Serializable

/**
 * Content models + loader for Spyfall — a 1:1 port of src/games/spyfall/content/{types.ts,index.ts}.
 *
 * The webapp JSON (src/games/spyfall/content/(json files)) is the single source of truth; the Gradle
 * `syncSharedContent` task mirrors it into assets/content/spyfall/ and we parse it here at runtime
 * via [ContentStore]. NOTHING is duplicated into Kotlin.
 *
 * A "pack" is one JSON file (core.json, modern.json …); each holds a list of locations, each with a
 * list of roles. Catalogs are assembled exactly as content/index.ts#buildCatalog does (first wins on
 * id collision; default to the `core` pack when nothing is enabled).
 */

@Serializable
data class SpyfallRole(
    val id: String,
    val name: LocalizedString,
)

@Serializable
data class SpyfallLocation(
    val id: String,
    val name: LocalizedString,
    val icon: String? = null,
    val roles: List<SpyfallRole> = emptyList(),
)

@Serializable
data class SpyfallPack(
    val id: String,
    val name: LocalizedString,
    val version: Int = 1,
    val locations: List<SpyfallLocation> = emptyList(),
)

/**
 * Process-wide, immutable-after-load content registry — the native analogue of the module-level
 * constants the web's content/index.ts builds at import time. Loaded once (idempotently) from the
 * shared assets; the pure reducer reads from it just like the web reducer reads the imported JSON.
 */
object SpyfallContent {
    private var loadedPacks: List<SpyfallPack> = emptyList()
    private var packIndex: Map<String, SpyfallPack> = emptyMap()
    private var allLocs: List<SpyfallLocation> = emptyList()
    private var locIndex: Map<String, SpyfallLocation> = emptyMap()

    /** Parse every Spyfall content file listed in the shared manifest. Safe to call repeatedly. */
    fun load(store: ContentStore) {
        if (loadedPacks.isNotEmpty()) return
        val files = runCatching { store.manifest()["spyfall"] }.getOrNull() ?: emptyList()
        val parsed = files.mapNotNull { file ->
            runCatching { store.decode<SpyfallPack>("spyfall", file) }.getOrNull()
        }
        if (parsed.isEmpty()) return
        loadedPacks = parsed
        packIndex = parsed.associateBy { it.id }
        // ALL_LOCATIONS in the web is built across every pack (used by the spy-guess grid).
        val catalog = buildCatalog(parsed.map { it.id })
        allLocs = catalog
        locIndex = catalog.associateBy { it.id }
    }

    fun isLoaded(): Boolean = loadedPacks.isNotEmpty()

    /** Every pack, in manifest order (core, modern, …) — drives the Setup pack chips. */
    fun packs(): List<SpyfallPack> = loadedPacks

    fun packById(id: String): SpyfallPack? = packIndex[id]

    /** Flat list of every location across every pack (mirrors web ALL_LOCATIONS). */
    fun allLocations(): List<SpyfallLocation> = allLocs

    fun locationById(id: String): SpyfallLocation? = locIndex[id]

    /**
     * Flat catalog of all locations across the enabled packs (first wins on id collision) — a 1:1
     * port of content/index.ts#buildCatalog. Empty enabled list falls back to `core`.
     */
    fun buildCatalog(enabledPackIds: List<String>): List<SpyfallLocation> {
        val ids = if (enabledPackIds.isEmpty()) listOf("core") else enabledPackIds
        val seen = HashSet<String>()
        val out = ArrayList<SpyfallLocation>()
        for (pid in ids) {
            for (loc in (packIndex[pid]?.locations ?: emptyList())) {
                if (seen.add(loc.id)) out.add(loc)
            }
        }
        return out
    }

    /** Look up a role's bilingual name by location + role id (mirrors content/index.ts#roleName). */
    fun roleName(locationId: String, roleId: String): LocalizedString? =
        locIndex[locationId]?.roles?.firstOrNull { it.id == roleId }?.name
}
