package com.gamenight.party.game.truthordare

import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString

/**
 * Bilingual UI chrome for the Truth or Dare screens — a transcription of the `tod.*` / `results.*` /
 * `common.*` i18n keys (src/i18n/{en,fa}.json) the web screens used. Game CONTENT text still comes
 * from the shared JSON ([ToDContent]); only the surrounding labels live here.
 */
object ToDStr {
    val title = LocalizedString("Truth or Dare", "جرئت یا حقیقت")
    val players = LocalizedString("Players", "بازیکنان")
    val intensity = LocalizedString("Intensity", "شدت")
    val moreOptions = LocalizedString("More options", "گزینه‌های بیشتر")

    val selection = LocalizedString("Pick player by", "انتخاب بازیکن با")
    val selSpinner = LocalizedString("Spinner", "چرخونک")
    val selBottle = LocalizedString("Bottle", "بطری")
    val selSequential = LocalizedString("In order", "به ترتیب")

    val scoring = LocalizedString("Scoring", "امتیازدهی")
    val scoreCasual = LocalizedString("Casual", "بی‌خیال")
    val scorePoints = LocalizedString("Points", "امتیازی")

    val pointsForDare = LocalizedString("Points for a dare", "امتیاز جرئت")
    val pointsForTruth = LocalizedString("Points for a truth", "امتیاز حقیقت")
    val pointsForSkip = LocalizedString("Points for a skip", "امتیاز رد کردن")

    val endLabel = LocalizedString("Game length", "طول بازی")
    val endEndless = LocalizedString("Endless", "بی‌پایان")
    val endRounds = LocalizedString("Rounds", "دور")
    val endTarget = LocalizedString("Target", "هدف")
    val roundsCount = LocalizedString("Rounds", "دورها")
    val targetPoints = LocalizedString("Target points", "امتیاز هدف")

    val privacy = LocalizedString("Private reveal", "نمایش خصوصی")
    val privNever = LocalizedString("Off", "خاموش")
    val privSpicy = LocalizedString("Spicy only", "فقط تند")
    val privAlways = LocalizedString("Always", "همیشه")

    val avoidRepeat = LocalizedString("Avoid picking the same player twice in a row", "یک بازیکن دو بار پشت‌سرهم انتخاب نشود")

    val errorPool = LocalizedString("No prompts available", "سرنخی موجود نیست")
    val contentUnavailable = LocalizedString("Content not available yet", "محتوا هنوز در دسترس نیست")
    val start = LocalizedString("Start", "شروع")
    val playAgain = LocalizedString("Play again", "بازی دوباره")

    val spinHint = LocalizedString("Spin to pick a player", "بچرخون تا یک بازیکن انتخاب بشه")
    val spin = LocalizedString("Spin", "بچرخون")
    val nextUp = LocalizedString("Next up", "نفر بعد")
    val nextPlayer = LocalizedString("Next player", "بازیکن بعدی")
    val truth = LocalizedString("Truth", "حقیقت")
    val dare = LocalizedString("Dare", "جرئت")
    val reveal = LocalizedString("Tap to reveal", "برای دیدن بزن")
    val skipNoReveal = LocalizedString("Skip without revealing", "رد کن بدون دیدن")
    val done = LocalizedString("Done", "انجام شد")
    val skip = LocalizedString("Skip", "رد کن")
    val redraw = LocalizedString("Redraw", "سرنخ دیگه")
    val endGame = LocalizedString("End game", "پایان بازی")

    val bottleHint = LocalizedString("Tap the bottle to spin", "برای چرخاندن روی بطری بزن")
    val bottleSpin = LocalizedString("Spin the bottle", "بطری را بچرخان")
    val spinning = LocalizedString("Spinning…", "در حال چرخیدن…")

    val sessionSummary = LocalizedString("Session over!", "بازی تمام شد!")

    val resultsTitle = LocalizedString("Results", "نتایج")
    val resultsTie = LocalizedString("It's a tie!", "مساوی شد!")
    val resultsHome = LocalizedString("Home", "خانه")

    /** "{name}, your turn!" */
    fun yourTurn(lang: Lang, name: String): String =
        if (lang == Lang.FA) "$name، نوبت توئه!" else "$name, your turn!"

    /** "Pass the phone to {name}" */
    fun passTo(lang: Lang, name: String): String =
        if (lang == Lang.FA) "گوشی را بده به $name" else "Pass the phone to $name"

    /** "{name} wins!" */
    fun winner(lang: Lang, name: String): String =
        if (lang == Lang.FA) "$name برنده شد!" else "$name wins!"

    /** "Turn {n}" */
    fun turnCount(lang: Lang, n: Int): String =
        if (lang == Lang.FA) "نوبت $n" else "Turn $n"

    /** "{turns} turns · {dares} dares · {truths} truths · {skips} skips" */
    fun statLine(lang: Lang, turns: Int, dares: Int, truths: Int, skips: Int): String =
        if (lang == Lang.FA) {
            "$turns نوبت · $dares جرئت · $truths حقیقت · $skips رد"
        } else {
            "$turns turns · $dares dares · $truths truths · $skips skips"
        }
}
