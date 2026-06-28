package com.gamenight.party.game

import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.GameCapabilities
import com.gamenight.party.model.GameCategory
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.LocalizedString

/**
 * The native catalog — transcribed 1:1 from each src/games/<id>/manifest.ts so the home grid
 * matches the webapp (same titles, taglines, icons, accent colors, player ranges).
 *
 * NOTE: this is static catalog metadata only. Each game's logic + screens get ported incrementally
 * (see GameRegistry, added per game). A manifest here without a registered implementation simply
 * shows on the grid as "coming soon" until its port lands.
 */
private fun ls(en: String, fa: String) = LocalizedString(en, fa)

object GameCatalog {
    val all: List<GameManifest> = listOf(
        GameManifest(
            id = "codenames",
            name = ls("Codenames", "کدنیمز"),
            tagline = ls("Two spymasters, one secret key", "دو رئیس‌جاسوس، یک کلید مخفی"),
            description = ls(
                "Two teams race to find their secret words on a 5×5 grid. Each spymaster secretly sees the key and gives a one-word clue. Find all your words to win, but steer clear of the assassin or you lose on the spot.",
                "دو تیم برای پیدا کردن کلمات مخفی‌شان روی شبکهٔ ۵×۵ رقابت می‌کنند. هر رئیس‌جاسوس پنهانی کلید را می‌بیند و یک سرنخ تک‌کلمه‌ای می‌دهد.",
            ),
            icon = "🔲", color = ColorToken.LIME, category = GameCategory.WORD,
            minPlayers = 4, maxPlayers = 16, estimatedMinutes = 10..20,
            capabilities = GameCapabilities(usesTeams = true, usesTimer = true, usesDeck = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "dowr",
            name = ls("Dowr", "دور"),
            tagline = ls("Describe fast, beat the bomb!", "سریع توضیح بده، بمب رو ببر!"),
            description = ls(
                "A quick relay in teams of two. Describe the word so your partner guesses it before the bomb goes off. The phone races around the room, and the fastest team takes it.",
                "یک مسابقهٔ زمانی تیمی (تیم‌های دونفره): کلمه را طوری توضیح بده که هم‌تیمی‌ات قبل از انفجار بمب حدس بزند.",
            ),
            icon = "🗣️", color = ColorToken.VIOLET, category = GameCategory.WORD,
            minPlayers = 4, maxPlayers = 10, estimatedMinutes = 5..20,
            capabilities = GameCapabilities(usesTeams = true, usesTimer = true, usesDeck = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "heads-up",
            name = ls("Heads Up!", "حدس بزن!"),
            tagline = ls("Phone on your forehead, guess the word!", "گوشی روی پیشانی، کلمه را حدس بزن!"),
            description = ls(
                "Hold the phone on your forehead so the group can see the word. They give clues; you guess against the clock. Got it or pass, then race to the next word.",
                "گوشی را روی پیشانی بگیر تا جمع کلمه را ببینند. آن‌ها سرنخ می‌دهند و تو با زمان مسابقه می‌دهی.",
            ),
            icon = "🙈", color = ColorToken.SKY, category = GameCategory.PARTY,
            minPlayers = 2, maxPlayers = 16, estimatedMinutes = 5..15,
            capabilities = GameCapabilities(usesTeams = true, usesTimer = true, usesDeck = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "mafia",
            name = ls("Mafia", "مافیا"),
            tagline = ls("Hidden roles, night & day", "نقش‌های پنهان، شب و روز"),
            description = ls(
                "Town versus Mafia social deduction. The phone deals secret roles, then narrates the night/day loop: mafia eliminate, the doctor saves, the detective investigates, and the town votes to hang a suspect.",
                "نبرد مردم‌شهر و مافیا. گوشی نقش‌ها را پنهانی پخش می‌کند و چرخهٔ شب و روز را روایت می‌کند.",
            ),
            icon = "🎭", color = ColorToken.ROSE, category = GameCategory.DEDUCTION,
            minPlayers = 5, maxPlayers = 20, estimatedMinutes = 15..45,
            capabilities = GameCapabilities(usesTimer = true, usesDeck = true, usesVoting = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "minesweeper",
            name = ls("Mine Hunt", "مین‌یاب"),
            tagline = ls("Hunt down the hidden mines!", "مین‌های پنهان را پیدا کن!"),
            description = ls(
                "Reverse Minesweeper: the mines are the treasure. Tap squares to hunt them. Find a mine and you score it and tap again; tap a safe square and it reveals a number clue and your turn passes. Nothing explodes.",
                "مین‌یاب وارونه: این بار مین‌ها گنج‌اند. روی خانه‌ها بزن تا پیدایشان کنی. هیچ‌چیز منفجر نمی‌شود.",
            ),
            icon = "💣", color = ColorToken.TANGERINE, category = GameCategory.DEDUCTION,
            minPlayers = 1, maxPlayers = 4, estimatedMinutes = 5..20,
            capabilities = GameCapabilities(),
        ),
        GameManifest(
            id = "most-likely-to",
            name = ls("Most Likely To", "به احتمال زیاد"),
            tagline = ls("Point at the friend most likely to…", "به دوستی اشاره کن که به احتمال زیاد…"),
            description = ls(
                "A \"Most likely to…\" prompt appears, everyone votes for a player, and the most-voted is revealed. Most wins across the deck takes the crown.",
                "یک سوال «به احتمال زیاد…» می‌آید، همه به یک بازیکن رأی می‌دهند و پررأی‌ترین معرفی می‌شود.",
            ),
            icon = "👉", color = ColorToken.TANGERINE, category = GameCategory.VOTING,
            minPlayers = 3, maxPlayers = 20, estimatedMinutes = 8..15,
            capabilities = GameCapabilities(usesDeck = true, usesVoting = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "never-have-i-ever",
            name = ls("Never Have I Ever", "من هیچ‌وقت"),
            tagline = ls("Confess or lose a life", "اعتراف کن یا یک جان از دست بده"),
            description = ls(
                "A statement pops up. Everyone who HAS done it loses a life. The last clean player standing wins, or whoever ends up with the fewest confessions.",
                "یک جمله ظاهر می‌شود. هر کس آن را انجام داده باشد یک جان از دست می‌دهد.",
            ),
            icon = "🙈", color = ColorToken.ROSE, category = GameCategory.PARTY,
            minPlayers = 3, maxPlayers = 16, estimatedMinutes = 10..25,
            capabilities = GameCapabilities(usesDeck = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "pantomime",
            name = ls("Pantomime", "پانتومیم"),
            tagline = ls("Act it out silently", "بی‌کلام اجرا کن"),
            description = ls(
                "One actor mimes a prompt without speaking while their team races the clock to guess. Most points wins.",
                "یک بازیگر بی‌کلام سرنخ را اجرا می‌کند تا تیمش پیش از پایان زمان حدس بزند.",
            ),
            icon = "🎭", color = ColorToken.GRAPE, category = GameCategory.PARTY,
            minPlayers = 4, maxPlayers = 16, estimatedMinutes = 10..20,
            capabilities = GameCapabilities(usesTeams = true, usesTimer = true, usesDeck = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "spyfall",
            name = ls("Spyfall", "جاسوس"),
            tagline = ls("Find the spy, hide the location", "جاسوس را پیدا کن، مکان را پنهان کن"),
            description = ls(
                "Everyone secretly gets the same location and a role. Everyone except the spy, who knows neither one. Ask clever questions to sniff out the spy without giving away the place.",
                "همه پنهانی یک مکان و یک نقش مشترک می‌گیرند؛ به‌جز جاسوس که هیچ‌کدام را نمی‌داند.",
            ),
            icon = "🕵️", color = ColorToken.VIOLET, category = GameCategory.DEDUCTION,
            minPlayers = 3, maxPlayers = 12, estimatedMinutes = 8..15,
            capabilities = GameCapabilities(usesTimer = true, usesDeck = true, usesVoting = true, usesRevealGate = true),
        ),
        GameManifest(
            id = "truth-or-dare",
            name = ls("Truth or Dare", "جرئت یا حقیقت"),
            tagline = ls("Spin, pick, reveal, pass the phone!", "بچرخون، انتخاب کن، نشون بده، گوشی رو بچرخون!"),
            description = ls(
                "Spin to pick a player, choose Truth or Dare, and reveal a prompt. Play casually forever or race to a points target.",
                "بچرخون تا یک بازیکن انتخاب بشه، جرئت یا حقیقت را انتخاب کن و سرنخ را ببین.",
            ),
            icon = "🌶️", color = ColorToken.GOLD, category = GameCategory.PARTY,
            minPlayers = 2, maxPlayers = 16, estimatedMinutes = 10..40,
            capabilities = GameCapabilities(usesDeck = true, usesRevealGate = true),
            supportsCustomContent = true,
        ),
        GameManifest(
            id = "would-you-rather",
            name = ls("Would You Rather", "کدوم رو ترجیح می‌دی؟"),
            tagline = ls("Two options. Pick a side. Defend it.", "دو گزینه. یک طرف رو انتخاب کن. ازش دفاع کن."),
            description = ls(
                "Two impossible options appear. Everyone picks A or B, the split is revealed, and the debate begins. Optionally score points for going with the crowd.",
                "دو گزینهٔ ناممکن می‌آید. همه A یا B را انتخاب می‌کنند، نتیجه نمایش داده می‌شود و بحث شروع می‌شود.",
            ),
            icon = "🤔", color = ColorToken.TEAL, category = GameCategory.VOTING,
            minPlayers = 2, maxPlayers = 20, estimatedMinutes = 5..20,
            capabilities = GameCapabilities(usesDeck = true, usesVoting = true, usesRevealGate = true),
        ),
    )

    fun byId(id: String): GameManifest? = all.firstOrNull { it.id == id }
}
