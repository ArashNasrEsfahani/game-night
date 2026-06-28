package com.gamenight.party.game.codenames

import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.ui.screens.fmtNum

/**
 * Bilingual UI chrome for the Codenames screens — the native mirror of the `cn.*` / `common.*` /
 * `results.*` i18n keys from src/i18n/{en,fa}.json. Game CONTENT (the words) stays in the shared
 * JSON; only the screen labels live here.
 */
internal object CnStr {
    val title = LocalizedString("Codenames", "کدنیمز")
    val players = LocalizedString("Players", "بازیکنان")
    val start = LocalizedString("Start", "شروع")
    val moreOptions = LocalizedString("More options", "گزینه‌های بیشتر")
    val moreOptionsHint = LocalizedString("Tweak the rules, timing, and extras", "قوانین، زمان‌بندی و موارد اضافه را تنظیم کن")
    val teamHint = LocalizedString("Tap a player to move them to another team", "برای جابه‌جایی هر بازیکن به تیم دیگر، روی او بزن")
    val red = LocalizedString("Red", "قرمز")
    val blue = LocalizedString("Blue", "آبی")
    val spymaster = LocalizedString("Spymaster", "رئیس‌جاسوس")
    val mode = LocalizedString("Mode", "حالت")
    val untimed = LocalizedString("Untimed", "بدون زمان")
    val timed = LocalizedString("Timed", "زمان‌دار")
    val turnTime = LocalizedString("Turn time", "زمان هر نوبت")
    val packs = LocalizedString("Word packs", "بسته‌های کلمه")
    val startingTeam = LocalizedString("Starting team", "تیم شروع‌کننده")
    val random = LocalizedString("Random", "تصادفی")
    val bonusGuess = LocalizedString("Allow the bonus +1 guess", "حدس جایزه +۱ مجاز باشد")
    val forgiveWrong = LocalizedString("Forgive one wrong guess", "یک حدس اشتباه بخشیده شود")
    val forgiven = LocalizedString("Phew! One mistake forgiven", "آخیش! یک اشتباه بخشیده شد")
    val orientationToggle = LocalizedString("First team rotates the key", "تیم اول کلید را می‌چرخاند")
    val startsFirst = LocalizedString("starts first", "اول شروع می‌کند")
    val chooseOrientation = LocalizedString("Choose the key orientation", "جهت کلید را انتخاب کن")
    val orientationHint = LocalizedString("Pick how to turn the secret grid, then start the game.", "انتخاب کن شبکهٔ مخفی چطور بچرخد، بعد بازی را شروع کن.")
    val errorSetup = LocalizedString("Need 2 teams of 2+ and 25 words", "به ۲ تیم حداقل ۲ نفره و ۲۵ کلمه نیاز است")
    val playAgain = LocalizedString("Play again", "بازی دوباره")
    val imSpymaster = LocalizedString("I'm the spymaster", "من رئیس‌جاسوسم")
    val reveal = LocalizedString("Tap to reveal the key", "برای دیدن کلید بزن")
    val clueNumber = LocalizedString("Number", "عدد")
    val clueGiven = LocalizedString("Clue given", "سرنخ داده شد")
    val hideKey = LocalizedString("Hide the key — pass to the guessers", "کلید را پنهان کن — به حدس‌زن‌ها بده")
    val weAreReady = LocalizedString("We're ready", "آماده‌ایم")
    val stopGuessing = LocalizedString("Stop guessing", "توقف حدس")
    val continueLabel = LocalizedString("Continue", "ادامه")
    val winAssassin = LocalizedString("The other team hit the assassin", "تیم دیگر جاسوس مرگبار را زد")
    val winCleared = LocalizedString("All words found", "همهٔ کلمات پیدا شد")
    val rematch = LocalizedString("New board", "صفحهٔ جدید")
    val resultsTitle = LocalizedString("Results", "نتایج")
    val home = LocalizedString("Home", "خانه")
    val tie = LocalizedString("It's a tie!", "مساوی شد!")
    val endGame = LocalizedString("End game", "پایان بازی")

    /** Quarter-turn button labels (src `cn.orient.0..3`). */
    val orient: List<LocalizedString> = listOf(
        LocalizedString("⬆ 0°", "⬆ ۰°"),
        LocalizedString("➡ 90°", "➡ ۹۰°"),
        LocalizedString("⬇ 180°", "⬇ ۱۸۰°"),
        LocalizedString("⬅ 270°", "⬅ ۲۷۰°"),
    )

    fun reason(r: TurnEndReason?): LocalizedString = when (r) {
        TurnEndReason.GUESSED_WRONG -> LocalizedString("Wrong guess!", "حدس اشتباه!")
        TurnEndReason.USED_ALL_GUESSES -> LocalizedString("Out of guesses", "حدس‌ها تمام شد")
        TurnEndReason.TIME_UP -> LocalizedString("Time's up!", "وقت تمام شد!")
        else -> LocalizedString("Turn passed", "نوبت رد شد") // STOPPED or null
    }

    fun reasonEmoji(r: TurnEndReason?): String = when (r) {
        TurnEndReason.GUESSED_WRONG -> "🙈"
        TurnEndReason.USED_ALL_GUESSES -> "✋"
        TurnEndReason.TIME_UP -> "⏰"
        else -> "🤝"
    }

    fun onlySpymaster(name: String, lang: Lang): String =
        if (lang == Lang.FA) "فقط $name باید ببیند" else "Only $name should look"

    fun clueEcho(count: Int, left: Int, lang: Lang): String =
        if (lang == Lang.FA) "سرنخ: ${fmtNum(count, lang)} · ${fmtNum(left, lang)} حدس باقی"
        else "Clue: $count · $left guesses left"

    fun nextTeam(team: String, lang: Lang): String =
        if (lang == Lang.FA) "بعدی: $team" else "Next: $team"

    fun teamWins(team: String, lang: Lang): String =
        if (lang == Lang.FA) "$team برنده شد!" else "$team wins!"
}
