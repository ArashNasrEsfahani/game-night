package com.gamenight.party.game.codenames

import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat

/**
 * Config + options for "Codenames" — a Kotlin port of src/games/codenames/config.ts. Options are
 * strongly typed here (the web reads loose `config.options`); [normalizeOptions] keeps the same
 * invariants the web normalizer enforced.
 */

/** Timed vs untimed (src also has a never-selected 'classic'; kept for parity). */
enum class CodenamesMode { CLASSIC, UNTIMED, TIMED }

/** Which side gives the first clue. */
enum class StartingTeam { TEAM_A, TEAM_B, RANDOM }

/** All tunables (src `CodenamesOptions`). */
data class CodenamesOptions(
    val mode: CodenamesMode = CodenamesMode.UNTIMED,
    val startingTeam: StartingTeam = StartingTeam.RANDOM,
    val packIds: List<String> = listOf(CodenamesContent.DEFAULT_PACK_ID),
    val turnSeconds: Int = 120,
    val allowBonusGuess: Boolean = true,
    /** First team rotates the randomly-generated key (0–3 quarter-turns) before play starts. */
    val chooseOrientation: Boolean = true,
    /** A team may make ONE wrong guess per turn without ending it (a forgiven mistake). */
    val forgiveFirstWrong: Boolean = true,
)

/** src `DEFAULT_OPTIONS`. */
val DEFAULT_OPTIONS: CodenamesOptions = CodenamesOptions()

/** A team as arranged in setup (mirrors a web `TeamSetup.teams` entry; spymaster = first member). */
data class CnConfigTeam(
    val id: String,
    val name: LocalizedString,
    val memberIds: List<String>,
)

/**
 * The per-match config the host builds in Setup (src `GameConfig`). Carries the loaded [content] so
 * `createInitialState` can resolve the word pool purely (the web reads a module-level pool).
 */
data class CodenamesConfig(
    val players: List<PlayerSeat>,
    val teams: List<CnConfigTeam>,
    val content: CodenamesContent,
    val lang: Lang = Lang.EN,
    val options: CodenamesOptions = DEFAULT_OPTIONS,
)

/** Mirrors config.ts `normalizeOptions`: clamp turnSeconds to [30,300] and drop unknown pack ids. */
fun normalizeOptions(o: CodenamesOptions, content: CodenamesContent): CodenamesOptions {
    val packIds = o.packIds.filter { content.byId.containsKey(it) }
    return o.copy(
        packIds = packIds.ifEmpty { listOf(CodenamesContent.DEFAULT_PACK_ID) },
        turnSeconds = o.turnSeconds.coerceIn(30, 300),
    )
}

/** Mirrors config.ts `validateConfig`. Returns the blocking errors (empty when playable). */
fun validateConfig(
    players: List<PlayerSeat>,
    teams: List<CnConfigTeam>,
    options: CodenamesOptions,
    content: CodenamesContent,
): List<LocalizedString> {
    val errors = ArrayList<LocalizedString>()
    if (players.size < 4) errors.add(LocalizedString("Add at least 4 players", "حداقل ۴ بازیکن اضافه کن"))
    if (teams.size != 2) errors.add(LocalizedString("Codenames needs exactly 2 teams", "این بازی دقیقاً به ۲ تیم نیاز دارد"))
    if (teams.any { it.memberIds.size < 2 })
        errors.add(LocalizedString("Each team needs at least 2 players", "هر تیم حداقل به ۲ بازیکن نیاز دارد"))
    if (content.mergedPool(options.packIds).size < 25)
        errors.add(LocalizedString("Need at least 25 words", "حداقل به ۲۵ کلمه نیاز است"))
    return errors
}
