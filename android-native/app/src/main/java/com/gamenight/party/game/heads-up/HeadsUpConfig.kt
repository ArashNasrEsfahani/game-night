package com.gamenight.party.game.headsup

import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat

/**
 * Per-match options + config for Heads Up! — the native port of src/games/heads-up/config.ts.
 *
 * Purity note: the web `createInitialState(config, seed)` reads its card pool from a module-global
 * deck registry. To keep the native reducer genuinely pure (no content/IO dependency), Setup resolves
 * the pool with [HeadsUpContent] and stuffs the result into [HeadsUpConfig.cardPool] — exactly the
 * "resolved content ids/pools live in the config" contract the webapp's GameConfig documents.
 */

enum class HeadsUpMode { SOLO, TEAMS }

val ROUND_SECONDS_CHOICES: List<Int> = listOf(30, 45, 60, 90)

data class HeadsUpOptions(
    val deckIds: List<String> = listOf("animals"),
    val mode: HeadsUpMode = HeadsUpMode.SOLO,
    val roundSeconds: Int = 60,
    val rounds: Int = 1,
    val motionEnabled: Boolean = false,
    /** 0 or 1 — points docked per pass. */
    val passPenalty: Int = 0,
    val recycleDeck: Boolean = true,
    /** Number of teams to auto-build in Setup (teams mode). */
    val teamCount: Int = 2,
    /** Which difficulty tiers to include from the chosen decks. */
    val difficulties: Map<Difficulty, Boolean> = mapOf(
        Difficulty.EASY to true,
        Difficulty.MEDIUM to true,
        Difficulty.HARD to true,
    ),
)

/** A team chosen in Setup (mirrors the web TeamSetup.teams entry: id + name + members). */
data class ConfigTeam(
    val id: String,
    val name: LocalizedString,
    val memberIds: List<String>,
)

/** The narrowed native equivalent of the web GameConfig for this game. */
data class HeadsUpConfig(
    val players: List<PlayerSeat>,
    val teams: List<ConfigTeam>?,
    val lang: Lang,
    val options: HeadsUpOptions,
    /** Resolved (merged + tier-filtered, NOT shuffled) pool of `<deckId>:<cardId>` keys. */
    val cardPool: List<String>,
)

/** The list of enabled tiers (always non-empty; falls back to all). Mirrors `selectedDifficulties`. */
fun selectedDifficulties(o: HeadsUpOptions): List<Difficulty> {
    val on = DIFFICULTIES.filter { o.difficulties[it] == true }
    return if (on.isNotEmpty()) on else DIFFICULTIES.toList()
}

/**
 * Returns the blocking config errors (empty == valid), mirroring `validateConfig` in config.ts.
 * [HeadsUpConfig.cardPool] is the already-resolved pool, so the "no cards at this difficulty" check
 * stays pure.
 */
fun validateConfig(config: HeadsUpConfig): List<LocalizedString> {
    val errors = mutableListOf<LocalizedString>()
    val n = config.players.size
    if (n < 2) errors.add(LocalizedString("Add at least 2 players", "حداقل ۲ بازیکن اضافه کن"))
    if (n > 16) errors.add(LocalizedString("At most 16 players", "حداکثر ۱۶ بازیکن"))
    if (config.options.deckIds.isEmpty()) {
        errors.add(LocalizedString("Pick at least one deck", "حداقل یک دسته انتخاب کن"))
    }
    if (config.cardPool.isEmpty()) {
        errors.add(LocalizedString("No cards at this difficulty", "کارتی در این سطح سختی نیست"))
    }
    if (config.options.mode == HeadsUpMode.TEAMS) {
        val teams = config.teams ?: emptyList()
        if (n < 4) {
            errors.add(LocalizedString("Teams mode needs at least 4 players", "حالت تیمی حداقل به ۴ بازیکن نیاز دارد"))
        }
        if (teams.size < 2) {
            errors.add(LocalizedString("Need at least 2 teams", "حداقل ۲ تیم لازم است"))
        }
        if (teams.any { it.memberIds.size < 2 }) {
            errors.add(LocalizedString("Each team needs at least 2 players", "هر تیم حداقل به ۲ بازیکن نیاز دارد"))
        }
    }
    return errors
}
