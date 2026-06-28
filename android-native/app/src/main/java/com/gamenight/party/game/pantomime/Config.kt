package com.gamenight.party.game.pantomime

import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat

/**
 * Config + options for Pantomime — a faithful Kotlin port of src/games/pantomime/config.ts. Pure:
 * no clock / RNG / IO. The options are typed (no untyped option bag), but [normalizeOptions] still
 * clamps/falls back so a malformed config can never reach the reducer.
 */

enum class PantomimeEndMode { TARGET_SCORE, ROUNDS }

data class PantomimeOptions(
    /** Selected decks; "mixed" expands to all real decks at resolve time. */
    val categories: List<PantomimeCategory>,
    /** Difficulty filter; non-empty after normalization. */
    val difficulties: List<PantomimeDifficulty>,
    /** Seconds per turn (the actor's miming window). */
    val roundSeconds: Int,
    /** End condition (exactly one mode). */
    val endMode: PantomimeEndMode,
    /** Used when [endMode] == [PantomimeEndMode.TARGET_SCORE]. */
    val targetScore: Int,
    /** Used when [endMode] == [PantomimeEndMode.ROUNDS]. */
    val totalRounds: Int,
    /** Skips allowed per turn. -1 = unlimited. */
    val maxSkipsPerTurn: Int,
    /** If true, a skip costs the team −1 (floored at 0). */
    val skipPenalty: Boolean,
)

val PANTOMIME_CATEGORIES: List<PantomimeCategory> = PantomimeCategory.ALL
val PANTOMIME_DIFFICULTIES: List<PantomimeDifficulty> =
    listOf(PantomimeDifficulty.EASY, PantomimeDifficulty.MEDIUM, PantomimeDifficulty.HARD)
val ROUND_SECONDS_CHOICES: List<Int> = listOf(30, 45, 60, 90, 120)

/** -1 means unlimited skips. */
val SKIP_CHOICES: List<Int> = listOf(0, 1, 2, 3, -1)

val DEFAULT_OPTIONS: PantomimeOptions = PantomimeOptions(
    categories = listOf(PantomimeCategory.MIXED),
    difficulties = PANTOMIME_DIFFICULTIES,
    roundSeconds = 60,
    endMode = PantomimeEndMode.TARGET_SCORE,
    targetScore = 10,
    totalRounds = 5,
    maxSkipsPerTurn = 2,
    skipPenalty = false,
)

private fun <T> oneOf(value: T, choices: List<T>, fallback: T): T = if (value in choices) value else fallback

private fun clampInt(value: Int, min: Int, max: Int): Int = minOf(max, maxOf(min, value))

/** Mirrors config.ts `normalizeOptions`: drops unknown enum members, clamps, applies fallbacks. */
fun normalizeOptions(o: PantomimeOptions): PantomimeOptions {
    val categories = o.categories.filter { it in PANTOMIME_CATEGORIES }
    val difficulties = o.difficulties.filter { it in PANTOMIME_DIFFICULTIES }
    return o.copy(
        categories = categories.ifEmpty { DEFAULT_OPTIONS.categories },
        difficulties = difficulties.ifEmpty { PANTOMIME_DIFFICULTIES },
        roundSeconds = oneOf(o.roundSeconds, ROUND_SECONDS_CHOICES, 60),
        endMode = o.endMode,
        targetScore = clampInt(o.targetScore, 1, 50),
        totalRounds = clampInt(o.totalRounds, 1, 20),
        maxSkipsPerTurn = oneOf(o.maxSkipsPerTurn, SKIP_CHOICES, 2),
        skipPenalty = o.skipPenalty,
    )
}

/**
 * A configured team for a match: stable id, display name (already resolved to a plain string) and
 * the ordered member player-ids. Local to Pantomime (the shared GameEntry has no team type).
 */
data class TeamConfig(
    val id: String,
    val name: String,
    val memberIds: List<String>,
)

/**
 * The match configuration. Mirrors the slice of the webapp's `GameConfig` this game reads, plus the
 * loaded [content] so [createInitialState] / [validateConfig] can resolve the deck purely.
 */
data class PantomimeConfig(
    val players: List<PlayerSeat>,
    val teams: List<TeamConfig>,
    val options: PantomimeOptions,
    val lang: Lang = Lang.EN,
)

/** Mirrors config.ts `validateConfig`. Returns null when the config is playable. */
fun validateConfig(config: PantomimeConfig, content: PantomimeContent): List<LocalizedString>? {
    val o = normalizeOptions(config.options)
    val errors = mutableListOf<LocalizedString>()
    val n = config.players.size
    val teams = config.teams
    if (n < 4) errors += LocalizedString("Add at least 4 players", "حداقل ۴ بازیکن اضافه کن")
    if (n > 16) errors += LocalizedString("At most 16 players", "حداکثر ۱۶ بازیکن")
    if (teams.size < 2) errors += LocalizedString("Need at least 2 teams", "حداقل ۲ تیم لازم است")
    if (teams.size > 4) errors += LocalizedString("At most 4 teams", "حداکثر ۴ تیم")
    if (teams.any { it.memberIds.size < 2 })
        errors += LocalizedString("Each team needs at least 2 players", "هر تیم حداقل به ۲ بازیکن نیاز دارد")
    if (o.difficulties.isEmpty())
        errors += LocalizedString("Pick at least one difficulty", "حداقل یک سختی انتخاب کن")
    if (buildPool(content, o).isEmpty())
        errors += LocalizedString(
            "No prompts for these categories/difficulties",
            "هیچ سرنخی با این دسته‌ها/سختی‌ها نیست",
        )
    return errors.ifEmpty { null }
}

// ──────────────────────────── Bilingual UI labels (i18n stand-ins) ────────────────────────────

/** Mirrors the `pantomime.cat.*` i18n keys. */
fun categoryLabel(c: PantomimeCategory, lang: Lang): String = when (c) {
    PantomimeCategory.MOVIES -> if (lang == Lang.FA) "فیلم‌ها" else "Movies"
    PantomimeCategory.TV -> if (lang == Lang.FA) "سریال‌ها" else "TV Shows"
    PantomimeCategory.ANIMALS -> if (lang == Lang.FA) "حیوانات" else "Animals"
    PantomimeCategory.ACTIONS -> if (lang == Lang.FA) "کارها" else "Actions"
    PantomimeCategory.FAMOUS -> if (lang == Lang.FA) "آدم‌های مشهور" else "Famous people"
    PantomimeCategory.PROVERBS -> if (lang == Lang.FA) "ضرب‌المثل‌ها" else "Persian Proverbs"
    PantomimeCategory.SPORTS -> if (lang == Lang.FA) "ورزش" else "Sports"
    PantomimeCategory.JOBS -> if (lang == Lang.FA) "مشاغل" else "Jobs"
    PantomimeCategory.MIXED -> if (lang == Lang.FA) "ترکیبی" else "Mixed"
}

/** Mirrors the `pantomime.diff.*` i18n keys. */
fun difficultyLabel(d: PantomimeDifficulty, lang: Lang): String = when (d) {
    PantomimeDifficulty.EASY -> if (lang == Lang.FA) "آسان" else "Easy"
    PantomimeDifficulty.MEDIUM -> if (lang == Lang.FA) "متوسط" else "Medium"
    PantomimeDifficulty.HARD -> if (lang == Lang.FA) "سخت" else "Hard"
}
