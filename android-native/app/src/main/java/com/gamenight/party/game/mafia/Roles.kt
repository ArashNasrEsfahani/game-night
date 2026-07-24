package com.gamenight.party.game.mafia

import com.gamenight.party.model.LocalizedString

/**
 * The role registry — a faithful Kotlin port of src/games/mafia/roles.ts. Mafia has NO JSON content
 * database; its content (role names / reveal cards / guides) plus the structural night-action specs
 * live here in code, exactly as the web game keeps them in roles.ts. Resolution stays table-driven
 * in [MafiaLogic].
 */

typealias RoleId = String

enum class Faction { TOWN, MAFIA, NEUTRAL }

enum class NightEffect {
    KILL,
    PROTECT,
    GUARD,
    INVESTIGATE,
    INVESTIGATE_EXACT,
    VIG_KILL,
    BLOCK,
    FRAME,
    NONE,
}

data class NightActionSpec(
    val key: String,
    val order: Int,
    val effect: NightEffect,
    val canTargetSelf: Boolean,
    val skippable: Boolean,
    /** At most this many uses across the whole game (per actor). */
    val perGame: Int? = null,
)

data class MafiaRole(
    val id: RoleId,
    val faction: Faction,
    val name: LocalizedString,
    /** Shown privately on the deal screen when this player reveals their card. */
    val reveal: LocalizedString,
    /** One-line "how it works" used by the in-game role guide. */
    val guide: LocalizedString,
    val icon: String,
    /** What the detective sees; defaults to [faction]. */
    val appearsAs: Faction? = null,
    val countsAsMafia: Boolean? = null,
    val countsAsTown: Boolean? = null,
    /** Neutral win: if voted out by day, this player wins and the game ends. */
    val winsIfLynched: Boolean = false,
    /** At most this many of this role in one game (Setup caps the stepper). */
    val maxInGame: Int? = null,
    val night: NightActionSpec? = null,
)

val ROLES: Map<RoleId, MafiaRole> = linkedMapOf(
    "mafia" to MafiaRole(
        id = "mafia",
        faction = Faction.MAFIA,
        name = LocalizedString("Mafia", "مافیا"),
        reveal = LocalizedString(
            "You are Mafia. Each night, agree with the other mafia on one person to eliminate.",
            "تو مافیایی. هر شب با بقیهٔ مافیا روی یک نفر برای حذف توافق کن.",
        ),
        guide = LocalizedString(
            "Wakes with the other mafia each night and picks one player to eliminate. Wins when the mafia equal or outnumber the town.",
            "هر شب با بقیهٔ مافیا بیدار می‌شود و یک نفر را برای حذف انتخاب می‌کند. وقتی تعداد مافیا با شهر برابر شود برنده است.",
        ),
        icon = "🔫",
        night = NightActionSpec("mafia.kill", 10, NightEffect.KILL, canTargetSelf = false, skippable = false),
    ),
    "godfather" to MafiaRole(
        id = "godfather",
        faction = Faction.MAFIA,
        name = LocalizedString("Godfather", "پدرخوانده"),
        reveal = LocalizedString(
            "You are the Godfather, leader of the Mafia. To the Detective you appear innocent.",
            "تو پدرخوانده‌ای، رهبر مافیا. در نگاه کارآگاه بی‌گناه به نظر می‌رسی.",
        ),
        guide = LocalizedString(
            "Leads the mafia kill and reads as Town if the Detective investigates them.",
            "رهبر کشتن مافیاست و اگر کارآگاه بررسی‌اش کند، شهروند به نظر می‌رسد.",
        ),
        icon = "🤵",
        appearsAs = Faction.TOWN,
        countsAsMafia = true,
        maxInGame = 1,
        night = NightActionSpec("mafia.kill", 10, NightEffect.KILL, canTargetSelf = false, skippable = false),
    ),
    "framer" to MafiaRole(
        id = "framer",
        faction = Faction.MAFIA,
        name = LocalizedString("Framer", "پاپوش‌دوز"),
        reveal = LocalizedString(
            "You are the Framer (Mafia). Each night you may frame one player so the Detective sees them as Mafia.",
            "تو پاپوش‌دوزی (مافیا). هر شب می‌توانی برای یک نفر پاپوش بدوزی تا کارآگاه او را مافیا ببیند.",
        ),
        guide = LocalizedString(
            "Mafia helper. Frames one player a night — if the Detective checks that player tonight, they read as Mafia.",
            "کمک‌مافیا. هر شب برای یکی پاپوش می‌دوزد؛ اگر کارآگاه همان شب او را بررسی کند، مافیا دیده می‌شود.",
        ),
        icon = "🖼️",
        countsAsMafia = true,
        maxInGame = 1,
        night = NightActionSpec("framer.frame", 15, NightEffect.FRAME, canTargetSelf = false, skippable = true),
    ),
    "consigliere" to MafiaRole(
        id = "consigliere",
        faction = Faction.MAFIA,
        name = LocalizedString("Consigliere", "مشاور مافیا"),
        reveal = LocalizedString(
            "You are the Consigliere (Mafia). Each night you may learn one player’s exact role.",
            "تو مشاور مافیایی. هر شب می‌توانی نقش دقیق یک بازیکن را بفهمی.",
        ),
        guide = LocalizedString(
            "Mafia investigator. Each night learns the exact role of one player (not just their side).",
            "کارآگاه مافیا. هر شب نقش دقیق یک بازیکن را می‌فهمد، نه فقط جناحش را.",
        ),
        icon = "🕵️",
        countsAsMafia = true,
        maxInGame = 1,
        night = NightActionSpec("consigliere.check", 22, NightEffect.INVESTIGATE_EXACT, canTargetSelf = false, skippable = true),
    ),
    "citizen" to MafiaRole(
        id = "citizen",
        faction = Faction.TOWN,
        name = LocalizedString("Citizen", "شهروند"),
        reveal = LocalizedString(
            "You are a Citizen. You have no special power — use your wits to find the Mafia.",
            "تو شهروندی. قدرت ویژه‌ای نداری — با هوشت مافیا را پیدا کن.",
        ),
        guide = LocalizedString(
            "No night power. Talks, reads the room, and votes by day to find the mafia.",
            "قدرت شبانه ندارد. روزها صحبت می‌کند، فضا را می‌سنجد و رأی می‌دهد تا مافیا را پیدا کند.",
        ),
        icon = "🧑",
    ),
    "detective" to MafiaRole(
        id = "detective",
        faction = Faction.TOWN,
        name = LocalizedString("Detective", "کارآگاه"),
        reveal = LocalizedString(
            "You are the Detective. Each night you may investigate one player to learn if they are Mafia.",
            "تو کارآگاه هستی. هر شب می‌توانی یک بازیکن را بررسی کنی تا بفهمی مافیاست یا نه.",
        ),
        guide = LocalizedString(
            "Each night checks one player and learns their side: Town or Mafia. The Godfather fools them; a Framer can too.",
            "هر شب یک نفر را بررسی می‌کند و جناحش را می‌فهمد: شهر یا مافیا. پدرخوانده و پاپوش‌دوز می‌توانند گولش بزنند.",
        ),
        icon = "🔍",
        maxInGame = 1,
        night = NightActionSpec("detective.check", 20, NightEffect.INVESTIGATE, canTargetSelf = false, skippable = true),
    ),
    "doctor" to MafiaRole(
        id = "doctor",
        faction = Faction.TOWN,
        name = LocalizedString("Doctor", "دکتر"),
        reveal = LocalizedString(
            "You are the Doctor. Each night you may protect one player from being killed.",
            "تو دکتری. هر شب می‌توانی یک نفر را از کشته‌شدن نجات دهی.",
        ),
        guide = LocalizedString(
            "Each night picks one player to shield. If that player is attacked tonight, they survive.",
            "هر شب یک نفر را برای محافظت انتخاب می‌کند. اگر همان شب به او حمله شود، زنده می‌ماند.",
        ),
        icon = "🩺",
        maxInGame = 1,
        night = NightActionSpec("doctor.save", 30, NightEffect.PROTECT, canTargetSelf = true, skippable = true),
    ),
    "bodyguard" to MafiaRole(
        id = "bodyguard",
        faction = Faction.TOWN,
        name = LocalizedString("Bodyguard", "محافظ"),
        reveal = LocalizedString(
            "You are the Bodyguard. Each night you guard one player — if they are attacked, you die in their place.",
            "تو محافظی. هر شب از یک نفر نگهبانی می‌دهی — اگر به او حمله شود، تو به‌جایش کشته می‌شوی.",
        ),
        guide = LocalizedString(
            "Guards one player a night. If that player is attacked, the Bodyguard takes the hit and dies instead.",
            "هر شب از یک نفر نگهبانی می‌دهد. اگر به آن نفر حمله شود، محافظ ضربه را می‌خورد و به‌جایش می‌میرد.",
        ),
        icon = "🛡️",
        maxInGame = 1,
        night = NightActionSpec("bodyguard.guard", 28, NightEffect.GUARD, canTargetSelf = false, skippable = true),
    ),
    "escort" to MafiaRole(
        id = "escort",
        faction = Faction.TOWN,
        name = LocalizedString("Escort", "اغواگر"),
        reveal = LocalizedString(
            "You are the Escort. Each night you may block one player — they cannot use their power tonight.",
            "تو اغواگری. هر شب می‌توانی یک نفر را مسدود کنی — آن شب نمی‌تواند از قدرتش استفاده کند.",
        ),
        guide = LocalizedString(
            "Blocks one player a night, cancelling their night ability. Can stop a lone mafia’s kill, the Doctor’s save, an investigation, and more.",
            "هر شب یک نفر را مسدود می‌کند و قدرت شبانه‌اش را خنثی می‌کند. می‌تواند کشتن یک مافیای تنها، نجات دکتر، یک بررسی و… را متوقف کند.",
        ),
        icon = "💋",
        maxInGame = 1,
        night = NightActionSpec("escort.block", 5, NightEffect.BLOCK, canTargetSelf = false, skippable = true),
    ),
    "sniper" to MafiaRole(
        id = "sniper",
        faction = Faction.TOWN,
        name = LocalizedString("Sniper", "تک‌تیرانداز"),
        reveal = LocalizedString(
            "You are the Sniper. Once per game, at night, you may shoot one player.",
            "تو تک‌تیراندازی. یک‌بار در بازی، شب می‌توانی به یک نفر شلیک کنی.",
        ),
        guide = LocalizedString(
            "Town vigilante. Once per game may shoot a player at night. Be careful — shooting a townsperson hurts the town.",
            "تیرخلاص شهر. یک‌بار در بازی می‌تواند شب به کسی شلیک کند. مراقب باش — شلیک به شهروند به ضرر شهر است.",
        ),
        icon = "🎯",
        maxInGame = 1,
        night = NightActionSpec("sniper.shoot", 25, NightEffect.VIG_KILL, canTargetSelf = false, skippable = true, perGame = 1),
    ),
    "jester" to MafiaRole(
        id = "jester",
        faction = Faction.NEUTRAL,
        name = LocalizedString("Jester", "دلقک"),
        reveal = LocalizedString(
            "You are the Jester. You have one goal: get the town to vote YOU out. If you are lynched, you win!",
            "تو دلقکی. یک هدف داری: کاری کن شهر به حذف خودت رأی بدهد. اگر اعدام شوی، برنده‌ای!",
        ),
        guide = LocalizedString(
            "Neutral. Wins immediately if the town votes them out by day. Dying at night does nothing — act suspicious!",
            "بی‌طرف. اگر شهر روز به حذفش رأی دهد، فوراً برنده می‌شود. مردن در شب فایده‌ای ندارد — مشکوک رفتار کن!",
        ),
        icon = "🃏",
        winsIfLynched = true,
        maxInGame = 1,
    ),
)

val ROLE_LIST: List<MafiaRole> = ROLES.values.toList()

fun countsAsMafia(role: MafiaRole): Boolean = role.countsAsMafia ?: (role.faction == Faction.MAFIA)
fun countsAsTown(role: MafiaRole): Boolean = role.countsAsTown ?: (role.faction == Faction.TOWN)
