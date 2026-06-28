package com.gamenight.party.game.truthordare

import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat

/**
 * Config + options for "Truth or Dare" — a Kotlin port of src/games/truth-or-dare/config.ts.
 * Options are strongly typed here (the web reads loose `config.options`); [normalizeOptions] keeps
 * the same invariants the web normalizer enforced.
 */

/** How the active player is chosen each turn. */
enum class SelectionMode { SPINNER, SEQUENTIAL, BOTTLE }

/** Casual play (no points) vs a points race. */
enum class ScoringMode { CASUAL, POINTS }

/** When the match ends. */
enum class EndType { ENDLESS, ROUNDS, TARGET }

/** Whether a prompt is shown behind a pass-the-phone curtain first. */
enum class PrivateReveal { NEVER, SPICY_ONLY, ALWAYS }

/** All tunables (src `ToDOptions`). */
data class ToDOptions(
    val intensities: Map<Intensity, Boolean>,
    val selectionMode: SelectionMode,
    val scoringMode: ScoringMode,
    val pointsForDare: Int,
    val pointsForTruth: Int,
    val pointsForSkip: Int,
    val endType: EndType,
    /** rounds count (endType ROUNDS) or target points (endType TARGET). */
    val endValue: Int,
    val privateReveal: PrivateReveal,
    val avoidImmediateRepeat: Boolean,
)

/** src `DEFAULT_OPTIONS`. */
val DEFAULT_OPTIONS: ToDOptions = ToDOptions(
    intensities = mapOf(
        Intensity.MILD to true,
        Intensity.MEDIUM to true,
        Intensity.SPICY to false,
    ),
    selectionMode = SelectionMode.SPINNER,
    scoringMode = ScoringMode.CASUAL,
    pointsForDare = 2,
    pointsForTruth = 1,
    pointsForSkip = 0,
    endType = EndType.ENDLESS,
    endValue = 5,
    privateReveal = PrivateReveal.NEVER,
    avoidImmediateRepeat = true,
)

/** The per-match config the host builds in Setup (src `GameConfig`). */
data class ToDConfig(
    val players: List<PlayerSeat>,
    val options: ToDOptions,
    val lang: Lang,
)

/**
 * Clamp/repair options the way src `normalizeOptions` did: force at least one tier on (mild as the
 * fallback) and keep `endValue >= 1`. The strongly-typed enums already constrain the rest.
 */
fun normalizeOptions(o: ToDOptions): ToDOptions {
    var intensities = o.intensities
    if (intensities.values.none { it }) intensities = intensities + (Intensity.MILD to true)
    return o.copy(
        intensities = intensities,
        endValue = maxOf(1, o.endValue),
    )
}

/** src `readOptions`. */
fun readOptions(config: ToDConfig): ToDOptions = normalizeOptions(config.options)

/** src `validateConfig` — returns the list of blocking errors (empty when the config is playable). */
fun validateConfig(content: ToDContent, config: ToDConfig): List<LocalizedString> {
    val o = readOptions(config)
    val errors = ArrayList<LocalizedString>()
    val n = config.players.size
    if (n < 2) errors.add(LocalizedString("Add at least 2 players", "حداقل ۲ بازیکن اضافه کن"))
    if (n > 16) errors.add(LocalizedString("At most 16 players", "حداکثر ۱۶ بازیکن"))
    val pc = maxOf(2, n)
    val truths = content.getPool(PromptKind.TRUTH, o.intensities, pc)
    val dares = content.getPool(PromptKind.DARE, o.intensities, pc)
    if (truths.isEmpty()) errors.add(LocalizedString("No truths at this intensity", "هیچ حقیقتی در این شدت نیست"))
    if (dares.isEmpty()) errors.add(LocalizedString("No dares at this intensity", "هیچ جرئتی در این شدت نیست"))
    return errors
}
