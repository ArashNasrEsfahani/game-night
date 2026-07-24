package com.gamenight.party.game.wouldyourather

import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.ui.screens.faDigits

/**
 * Bilingual UI-chrome strings for "Would You Rather" — a transcription of the `wyr.*` / shared
 * i18n keys from src/i18n/{en,fa}.json. The webapp resolves these via react-i18next; the native
 * app cannot reach res/values from inside a game module, so the chrome strings live here as
 * [LocalizedString] and are resolved with the active [Lang]. (Game CONTENT text still comes only
 * from the shared JSON via [WyrContent].)
 */
object WyrStrings {
    val title = LocalizedString("Would You Rather", "کدوم رو ترجیح می‌دی؟")
    val players = LocalizedString("Players", "بازیکنان")
    val deck = LocalizedString("Deck", "دسته")
    val moreOptions = LocalizedString("More options", "گزینه‌های بیشتر")
    val intensityLabel = LocalizedString("Intensity", "شدت")
    val modeLabel = LocalizedString("Mode", "حالت")
    val modeVote = LocalizedString("Pass & hide", "چرخاندن و پنهان")
    val modeQuick = LocalizedString("Count hands", "شمارش دست")
    val length = LocalizedString("Length", "طول")
    val all = LocalizedString("All", "همه")
    val awardPoints = LocalizedString("Award a point for going with the majority", "برای همراهی با اکثریت امتیاز بده")
    val tieCountsForBoth = LocalizedString("Ties count for everyone", "تساوی برای همه حساب شود")
    val start = LocalizedString("Start", "شروع")

    val wouldYouRather = LocalizedString("Would you rather…", "کدوم رو ترجیح می‌دی…")
    val or = LocalizedString("OR", "یا")
    val startVoting = LocalizedString("Start voting", "شروع رأی‌گیری")
    val countHands = LocalizedString("Count hands", "شمارش دست‌ها")
    val skip = LocalizedString("Skip", "رد کن")
    val passBack = LocalizedString("Pass back to the group", "گوشی را به جمع برگردان")
    val revealSplit = LocalizedString("Reveal split", "نمایش نتیجه")
    val reveal = LocalizedString("Tap to reveal", "برای دیدن بزن")
    val handsForA = LocalizedString("Hands for A", "دست‌ها برای A")
    val handsForB = LocalizedString("Hands for B", "دست‌ها برای B")
    val tie = LocalizedString("It's a tie!", "مساوی شد!")
    val next = LocalizedString("Next", "بعدی")
    val seeResults = LocalizedString("See results", "دیدن نتایج")
    val errorDeck = LocalizedString("No prompts available", "سوالی موجود نیست")
    val playAgain = LocalizedString("Play again", "بازی دوباره")
    val endGame = LocalizedString("End game", "پایان بازی")
    val mostInStep = LocalizedString("Most in step with the crowd", "هماهنگ‌ترین با جمع")

    val resultsTitle = LocalizedString("Results", "نتایج")
    val resultsTie = LocalizedString("It's a tie!", "مساوی شد!")
    val home = LocalizedString("Home", "خانه")

    // ── Interpolated strings ──
    // Each wraps its built string in faDigits so embedded numbers render with Persian digits in FA
    // (a no-op for EN). Functions that interpolate a number therefore take [lang].
    fun progress(lang: Lang, done: Int, total: Int): String = faDigits("$done / $total", lang)

    fun poolSize(lang: Lang, n: Int): String =
        faDigits(if (lang == Lang.FA) "$n سوال موجود است" else "$n prompts available", lang)

    fun votedProgress(lang: Lang, done: Int, total: Int): String =
        faDigits(if (lang == Lang.FA) "$done / $total رأی دادند" else "$done / $total voted", lang)

    fun imReady(lang: Lang, name: String): String =
        if (lang == Lang.FA) "فقط $name باید ببیند" else "Only $name should look"

    fun sideWins(lang: Lang, a: Int, b: Int): String =
        faDigits(if (lang == Lang.FA) "A: $a · B: $b" else "A won $a · B won $b", lang)

    fun recap(lang: Lang, n: Int): String =
        faDigits(if (lang == Lang.FA) "$n سوال انجام شد" else "$n prompts played", lang)

    fun resultsWinner(lang: Lang, name: String): String =
        if (lang == Lang.FA) "$name برنده شد!" else "$name wins!"
}
