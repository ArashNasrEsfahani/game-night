package com.gamenight.party.game.mafia

import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat
import kotlin.math.ceil

/**
 * Match options + validation — a Kotlin port of src/games/mafia/config.ts. The string-union options
 * become enums; numeric fields are clamped in [normalizeOptions] exactly like the web. [MafiaConfig]
 * is the native analogue of the web `GameConfig` (seats + lang + the typed options).
 */

enum class MafiaMode { DEVICE_NARRATOR, SILENT }
enum class DoctorSelfSave { NEVER, ONCE, ALWAYS }
enum class VotingMode { MAJORITY, PLURALITY }
enum class TieRule { NO_ELIMINATION, RANDOM }

data class MafiaOptions(
    val mode: MafiaMode = MafiaMode.DEVICE_NARRATOR,
    val composition: Map<RoleId, Int> = emptyMap(),
    val presetId: String? = null,
    val optionalReveal: Boolean = true,
    val allowDoctorSelfSave: DoctorSelfSave = DoctorSelfSave.ONCE,
    val discussionSeconds: Int = 180,
    val votingMode: VotingMode = VotingMode.MAJORITY,
    val nominationsRequired: Int = 2,
    val tieRule: TieRule = TieRule.NO_ELIMINATION,
    val peacefulFirstNight: Boolean = false,
)

val DEFAULT_OPTIONS: MafiaOptions = MafiaOptions()

/**
 * Clamp the numeric fields into legal ranges (mirrors `normalizeOptions`). The string-union fields
 * are already type-safe enums in Kotlin, so only the numbers need clamping.
 */
fun normalizeOptions(o: MafiaOptions): MafiaOptions = o.copy(
    discussionSeconds = maxOf(0, o.discussionSeconds),
    nominationsRequired = maxOf(1, o.nominationsRequired),
)

/** The native analogue of the web `GameConfig` handed from Setup into a match. */
data class MafiaConfig(
    val players: List<PlayerSeat>,
    val options: MafiaOptions,
    val lang: Lang = Lang.EN,
)

fun readOptions(config: MafiaConfig): MafiaOptions = normalizeOptions(config.options)

fun defaultConfig(players: List<PlayerSeat>, lang: Lang): MafiaConfig = MafiaConfig(
    players = players,
    options = DEFAULT_OPTIONS.copy(composition = autoComposition(players.size)),
    lang = lang,
)

/** Validation errors (bilingual), or null when the config is legal. Mirrors `validateConfig`. */
fun validateConfig(config: MafiaConfig): List<LocalizedString>? {
    val o = readOptions(config)
    val errors = mutableListOf<LocalizedString>()
    val n = config.players.size
    if (n < 5) errors.add(LocalizedString("Add at least 5 players", "حداقل ۵ بازیکن اضافه کن"))
    if (n > 30) errors.add(LocalizedString("At most 30 players", "حداکثر ۳۰ بازیکن"))
    val total = compositionTotal(o.composition)
    if (total != n) {
        errors.add(LocalizedString("Assign exactly $n roles (have $total)", "دقیقاً $n نقش تعیین کن (الان $total)"))
    }
    for (id in o.composition.keys) {
        if (ROLES[id] == null) errors.add(LocalizedString("Unknown role $id", "نقش ناشناخته $id"))
    }
    val mafiaCount = mafiaInComposition(o.composition)
    if (mafiaCount >= ceil(n / 2.0).toInt()) {
        errors.add(LocalizedString("Too many mafia (instant win)", "مافیا خیلی زیاد است (برد فوری)"))
    }
    if (mafiaCount < 1) {
        errors.add(LocalizedString("Need at least 1 mafia", "حداقل به ۱ مافیا نیاز است"))
    }
    return errors.ifEmpty { null }
}
