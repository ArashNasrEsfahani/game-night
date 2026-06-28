package com.gamenight.party.game.spyfall

import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat

/**
 * Options + config + validation for Spyfall — a 1:1 port of src/games/spyfall/config.ts.
 */

/** The four selectable round lengths, in seconds (5 / 6 / 8 / 10 minutes). */
val ROUND_SECONDS_CHOICES: List<Int> = listOf(300, 360, 480, 600)

/** At most one spy per three players, hard-capped at 3 (mirrors config.ts#maxSpies). */
fun maxSpies(n: Int): Int = maxOf(1, minOf(3, n / 3))

data class SpyfallOptions(
    val spyCount: Int = 1,
    val roundSeconds: Int = 480,
    val enabledPackIds: List<String> = listOf("core"),
    val totalRounds: Int = 1,
    val allowSpyGuess: Boolean = true,
    val useTimer: Boolean = true,
)

/** The native analogue of the web `GameConfig` slice Spyfall needs. */
data class SpyfallConfig(
    val players: List<PlayerSeat>,
    val lang: Lang = Lang.EN,
    val options: SpyfallOptions = SpyfallOptions(),
)

/**
 * Clamp raw options into a valid range for the given player count (mirrors config.ts#normalizeOptions):
 * spies in [1, cap]; a known round length (else 480); enabled packs filtered to ones that exist
 * (falling back to `core`); rounds in [1, 10]. Booleans pass through.
 */
fun normalizeOptions(o: SpyfallOptions, playerCount: Int): SpyfallOptions {
    val enabled = o.enabledPackIds.filter { SpyfallContent.packById(it) != null }
    val cap = maxSpies(maxOf(3, playerCount))
    return o.copy(
        spyCount = o.spyCount.coerceIn(1, cap),
        roundSeconds = if (o.roundSeconds in ROUND_SECONDS_CHOICES) o.roundSeconds else 480,
        enabledPackIds = enabled.ifEmpty { listOf("core") },
        totalRounds = o.totalRounds.coerceIn(1, 10),
    )
}

fun readOptions(config: SpyfallConfig): SpyfallOptions =
    normalizeOptions(config.options, config.players.size)

/** Returns the list of blocking problems, or null if the config is playable (mirrors validateConfig). */
fun validateConfig(config: SpyfallConfig): List<LocalizedString>? {
    val o = readOptions(config)
    val errors = mutableListOf<LocalizedString>()
    val n = config.players.size
    if (n < 3) errors.add(LocalizedString("Add at least 3 players", "حداقل ۳ بازیکن اضافه کن"))
    if (n > 12) errors.add(LocalizedString("At most 12 players", "حداکثر ۱۲ بازیکن"))
    if (n - o.spyCount < 2) {
        errors.add(LocalizedString("Need at least 2 non-spies", "حداقل ۲ غیرجاسوس لازم است"))
    }
    if (SpyfallContent.buildCatalog(o.enabledPackIds).isEmpty()) {
        errors.add(LocalizedString("Pick at least one location pack", "حداقل یک دستهٔ مکان انتخاب کن"))
    }
    return errors.ifEmpty { null }
}
