package com.gamenight.party.game.pantomime

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.engine.remainingMs
import com.gamenight.party.game.Sfx
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.SetupErrors
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.AppToggle
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.Curtain
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.EndGameButton
import com.gamenight.party.ui.components.Leaderboard
import com.gamenight.party.ui.components.PillShape
import com.gamenight.party.ui.components.ScoreRow
import com.gamenight.party.ui.components.SegmentOption
import com.gamenight.party.ui.components.SegmentedControl
import com.gamenight.party.ui.components.SelectChip
import com.gamenight.party.ui.components.Stepper
import com.gamenight.party.ui.components.TeamAssigner
import com.gamenight.party.ui.components.TeamColumnSpec
import com.gamenight.party.ui.components.TimerRing
import com.gamenight.party.ui.components.rememberTeamAssignment
import com.gamenight.party.ui.components.WinnerBanner
import com.gamenight.party.ui.components.screenEntrance
import com.gamenight.party.ui.screens.faDigits
import com.gamenight.party.ui.screens.fmtNum
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent
import kotlinx.coroutines.delay

/**
 * The three Pantomime screens — a Compose port of screens/{Setup,Play,Results}Screen.tsx built from
 * the shared UI library. Each is wrapped in [PantomimeAccent] so LocalAccent reflects this game's
 * manifest colour (grape), recolouring every control just like the webapp's per-game accent.
 */

private fun gameAccent() = ColorToken.GRAPE

/** Picks the EN or FA face of a small piece of UI chrome (the native i18n stand-in). */
private fun tr(lang: Lang, en: String, fa: String): String = if (lang == Lang.FA) fa else en

private fun teamName(i: Int, lang: Lang): String =
    if (lang == Lang.FA) "تیم ${fmtNum(i + 1, lang)}" else "Team ${i + 1}"

private val TEAM_PALETTE: List<ColorToken> =
    listOf(ColorToken.ROSE, ColorToken.SKY, ColorToken.LIME, ColorToken.GOLD)

/** Provides this game's accent so the shared components recolour to grape. */
@Composable
private fun PantomimeAccent(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAccent provides gameAccent().accent(), content = content)
}

// ──────────────────────────── Setup ────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PantomimeSetupScreen(
    players: List<PlayerSeat>,
    content: PantomimeContent,
    lang: Lang,
    manifest: GameManifest,
    onClose: () -> Unit,
    onStart: (PantomimeConfig) -> Unit,
) = PantomimeAccent {
    val palette = LocalPalette.current
    var opts by remember { mutableStateOf(DEFAULT_OPTIONS) }
    var teamCount by remember { mutableStateOf(2) }
    var selected by remember(players) { mutableStateOf(players.map { it.id }.toSet()) }

    val seats = players.filter { it.id in selected }
    // Auto-balanced split the host can tweak per player (tap a name to move it to the next team).
    val assignment = rememberTeamAssignment(seats.map { it.id }, teamCount)
    val teamColumns = (0 until teamCount).map { i ->
        TeamColumnSpec(teamName(i, lang), TEAM_PALETTE[i % TEAM_PALETTE.size].accent().base)
    }
    val teams = (0 until teamCount).map { i ->
        TeamConfig(id = "t$i", name = teamName(i, lang), memberIds = assignment.memberIdsByTeam[i])
    }

    val config = PantomimeConfig(players = seats, teams = teams, options = opts, lang = lang)
    val errors = validateConfig(config, content)
    val poolSize = buildPool(content, opts).size

    fun toggleCategory(c: PantomimeCategory) {
        opts = opts.copy(
            categories = if (c in opts.categories) opts.categories - c else opts.categories + c,
        )
    }

    fun toggleDifficulty(d: PantomimeDifficulty) {
        opts = opts.copy(
            difficulties = if (d in opts.difficulties) opts.difficulties - d else opts.difficulties + d,
        )
    }

    AppScreen(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose, back = true)

        // Scrolling option stack; the Start button stays pinned below so it's always reachable.
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            // Players: pick who's in, then split them into teams below.
            SectionLabel(tr(lang, "Players", "بازیکنان") + " · " + fmtNum(seats.size, lang))
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                players.forEach { p ->
                    SelectChip(
                        selected = p.id in selected,
                        onClick = {
                            selected = if (p.id in selected) selected - p.id else selected + p.id
                        },
                        text = (p.emoji?.let { "$it " } ?: "") + p.name,
                    )
                }
            }

            // Teams: count + who's in each one (tap a name to move them).
            SectionLabel(tr(lang, "Teams", "تیم‌ها"))
            SegmentedControl(
                value = teamCount,
                onChange = { teamCount = it },
                options = listOf(
                    SegmentOption(2, fmtNum(2, lang)),
                    SegmentOption(3, fmtNum(3, lang)),
                    SegmentOption(4, fmtNum(4, lang)),
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            if (seats.size >= 2) {
                TeamAssigner(
                    players = seats,
                    columns = teamColumns,
                    byPlayer = assignment.byPlayer,
                    onCycle = assignment.cycle,
                    hint = tr(
                        lang,
                        "Tap a player to move them to another team",
                        "برای جابه‌جایی هر بازیکن به تیم دیگر، روی او بزن",
                    ),
                )
            }

            // Categories
            SectionLabel(tr(lang, "Categories", "دسته‌ها"))
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                PANTOMIME_CATEGORIES.forEach { c ->
                    SelectChip(
                        selected = c in opts.categories,
                        onClick = { toggleCategory(c) },
                        text = categoryLabel(c, lang),
                    )
                }
            }

            // Difficulty
            SectionLabel(tr(lang, "Difficulty", "سختی"))
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                PANTOMIME_DIFFICULTIES.forEach { d ->
                    SelectChip(
                        selected = d in opts.difficulties,
                        onClick = { toggleDifficulty(d) },
                        text = difficultyLabel(d, lang),
                    )
                }
            }

            // Round time
            SectionLabel(tr(lang, "Round time", "زمان هر نوبت"))
            SegmentedControl(
                value = opts.roundSeconds,
                onChange = { opts = opts.copy(roundSeconds = it) },
                options = ROUND_SECONDS_CHOICES.map { SegmentOption(it, faDigits("${it}s", lang)) },
                modifier = Modifier.fillMaxWidth(),
            )

            // Game length (end mode)
            SectionLabel(tr(lang, "Game length", "طول بازی"))
            SegmentedControl(
                value = opts.endMode,
                onChange = { opts = opts.copy(endMode = it) },
                options = listOf(
                    SegmentOption(PantomimeEndMode.TARGET_SCORE, tr(lang, "Target score", "امتیاز هدف")),
                    SegmentOption(PantomimeEndMode.ROUNDS, tr(lang, "Fixed rounds", "دور ثابت")),
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            if (opts.endMode == PantomimeEndMode.TARGET_SCORE) {
                Stepper(
                    label = tr(lang, "Target score", "امتیاز هدف"),
                    value = opts.targetScore,
                    min = 1,
                    max = 50,
                    onValueChange = { opts = opts.copy(targetScore = it) },
                    modifier = Modifier.fillMaxWidth(),
                )
            } else {
                Stepper(
                    label = tr(lang, "Rounds", "دورها"),
                    value = opts.totalRounds,
                    min = 1,
                    max = 20,
                    onValueChange = { opts = opts.copy(totalRounds = it) },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            // Skips per turn
            SectionLabel(tr(lang, "Skips per turn", "رد کردن در هر نوبت"))
            SegmentedControl(
                value = opts.maxSkipsPerTurn,
                onChange = { opts = opts.copy(maxSkipsPerTurn = it) },
                options = listOf(
                    SegmentOption(0, fmtNum(0, lang)),
                    SegmentOption(1, fmtNum(1, lang)),
                    SegmentOption(2, fmtNum(2, lang)),
                    SegmentOption(3, fmtNum(3, lang)),
                    SegmentOption(-1, "∞"),
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            AppToggle(
                label = tr(lang, "Skip costs −1 point", "رد کردن یک امتیاز کم می‌کند"),
                checked = opts.skipPenalty,
                onCheckedChange = { opts = opts.copy(skipPenalty = it) },
                modifier = Modifier.fillMaxWidth(),
            )

            Text(
                text = tr(lang, "≈ ${fmtNum(poolSize, lang)} prompts available", "حدود ${fmtNum(poolSize, lang)} سرنخ موجود است"),
                color = palette.textMuted,
                fontSize = 14.sp,
            )
        }

        // Validation sits with the pinned Start button so the reason it's disabled stays visible.
        SetupErrors(errors = errors, lang = lang)

        // Pinned, full-width Start — painted with the gold accent so it stands apart from the grape
        // option controls above, and always reachable below the scrolling options.
        CompositionLocalProvider(LocalAccent provides ColorToken.GOLD.accent()) {
            AppButton(
                text = tr(lang, "Start", "شروع"),
                onClick = { onStart(config) },
                variant = ButtonVariant.PRIMARY,
                size = ButtonSize.LG,
                fullWidth = true,
                enabled = errors == null,
            )
        }
        Spacer(Modifier.padding(bottom = 8.dp))
    }
}

// ──────────────────────────── Play ────────────────────────────

@Composable
fun PantomimePlayScreen(
    state: PantomimeState,
    content: PantomimeContent,
    lang: Lang,
    manifest: GameManifest,
    sound: Sfx,
    haptics: Haptics,
    dispatch: (PantomimeAction) -> Unit,
    onClose: () -> Unit,
    onPlayAgain: () -> Unit,
) = PantomimeAccent {
    val s = state
    val prompt = s.currentPromptId?.let { content.byId[it] }
    val promptText = prompt?.text?.resolve(lang) ?: ""
    val hintText = prompt?.hint?.resolve(lang)
    when (s.phase) {
        PantomimePhase.ERROR -> ErrorView(manifest, lang, onClose, onPlayAgain)
        PantomimePhase.HANDOFF -> HandoffView(s, manifest, lang, dispatch, onClose)
        PantomimePhase.REVEAL -> RevealView(s, manifest, lang, promptText, hintText, sound, haptics, dispatch, onClose)
        PantomimePhase.ACTING -> ActingView(s, manifest, lang, promptText, hintText, sound, haptics, dispatch, onClose)
        PantomimePhase.TURN_END -> TurnEndView(s, manifest, lang, sound, haptics, dispatch, onClose)
        PantomimePhase.RESULTS -> Unit // routed to the Results screen by the host
    }
}

@Composable
private fun ErrorView(manifest: GameManifest, lang: Lang, onClose: () -> Unit, onPlayAgain: () -> Unit) {
    val palette = LocalPalette.current
    AppScreen {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
        Column(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = tr(lang, "No prompts for these categories/difficulties", "هیچ سرنخی با این دسته‌ها/سختی‌ها نیست"),
                color = palette.textMuted,
                textAlign = TextAlign.Center,
            )
            AppButton(text = tr(lang, "Play again", "بازی دوباره"), onClick = onPlayAgain)
        }
    }
}

@Composable
private fun HandoffView(
    s: PantomimeState,
    manifest: GameManifest,
    lang: Lang,
    dispatch: (PantomimeAction) -> Unit,
    onClose: () -> Unit,
) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    val team = activeTeam(s)
    val name = actorName(s)
    val round = fmtNum(currentRound(s), lang)
    // In target-score mode show the win condition ("first to N") rather than an opaque "of ∞".
    val roundLine = if (s.options.endMode == PantomimeEndMode.ROUNDS) {
        tr(lang, "Round $round of ${fmtNum(s.options.totalRounds, lang)}", "دور $round از ${fmtNum(s.options.totalRounds, lang)}")
    } else {
        tr(lang, "Round $round · first to ${fmtNum(s.options.targetScore, lang)}", "دور $round · تا ${fmtNum(s.options.targetScore, lang)} امتیاز")
    }
    AppScreen {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = { EndGameAction(lang, dispatch) })
        Column(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = roundLine,
                color = palette.textMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            )
            if (team != null) TeamBadge(team.name, team.color)
            Text(text = tr(lang, "Pass the phone to", "گوشی را بده به"), color = palette.textMuted, fontSize = 18.sp)
            Text(text = name, color = accent.base, fontWeight = FontWeight.ExtraBold, fontSize = 36.sp, textAlign = TextAlign.Center)
            AppButton(
                text = tr(lang, "I'm $name, ready", "من $name هستم، آماده‌ام"),
                onClick = { dispatch(PantomimeAction.HandoffReady) },
                size = ButtonSize.LG,
            )
        }
    }
}

@Composable
private fun RevealView(
    s: PantomimeState,
    manifest: GameManifest,
    lang: Lang,
    promptText: String,
    hintText: String?,
    sound: Sfx,
    haptics: Haptics,
    dispatch: (PantomimeAction) -> Unit,
    onClose: () -> Unit,
) {
    val palette = LocalPalette.current
    val name = actorName(s)
    var gateOpen by remember(s.turn.index, s.turn.round) { mutableStateOf(false) }
    var showHint by remember(s.turn.index, s.turn.round) { mutableStateOf(false) }
    AppScreen {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = { EndGameAction(lang, dispatch) })
        Curtain(
            open = gateOpen,
            holderName = name,
            hint = tr(lang, "Only $name should look", "فقط $name باید ببیند"),
            revealLabel = tr(lang, "Tap to reveal", "برای دیدن بزن"),
            onReveal = {
                // The curtain isn't an AppButton, so fire the reveal cue ourselves (web: sound 'reveal').
                sound.play(SoundId.REVEAL)
                haptics.medium()
                dispatch(PantomimeAction.Reveal)
                gateOpen = true
            },
            modifier = Modifier.weight(1f).fillMaxWidth(),
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // Re-key on the gate so the prompt pops in (fade + rise + scale) the moment it's revealed.
                key(gateOpen) {
                    Text(
                        text = promptText,
                        modifier = Modifier.fillMaxWidth().screenEntrance(translateY = 10.dp, fromScale = 0.9f),
                        color = palette.text,
                        fontSize = 40.sp,
                        lineHeight = 48.sp,
                        fontWeight = FontWeight.ExtraBold,
                        textAlign = TextAlign.Center,
                    )
                }
                if (hintText != null) {
                    if (showHint) {
                        Text(text = hintText, color = palette.textMuted, textAlign = TextAlign.Center)
                    } else {
                        AppButton(
                            text = tr(lang, "Show hint", "نمایش راهنما"),
                            onClick = { showHint = true },
                            variant = ButtonVariant.GHOST,
                            size = ButtonSize.SM,
                        )
                    }
                }
                AppButton(
                    text = tr(lang, "Start acting", "شروع اجرا"),
                    onClick = { dispatch(PantomimeAction.StartActing(System.currentTimeMillis())) },
                    size = ButtonSize.LG,
                )
            }
        }
    }
}

@Composable
private fun ActingView(
    s: PantomimeState,
    manifest: GameManifest,
    lang: Lang,
    promptText: String,
    hintText: String?,
    sound: Sfx,
    haptics: Haptics,
    dispatch: (PantomimeAction) -> Unit,
    onClose: () -> Unit,
) {
    val palette = LocalPalette.current
    var now by remember { mutableStateOf(System.currentTimeMillis()) }
    var showHint by remember(s.turn.index, s.turn.round) { mutableStateOf(false) }

    // Pump the clock while acting; the reducer auto-finalizes on expiry. Cancels when the phase or
    // running flag changes (the composable also leaves on the next phase). A tasteful countdown tick
    // fires once for each of the final three whole seconds (lastTickSec lives with the coroutine, so
    // it resets cleanly every time acting (re-)starts).
    LaunchedEffect(s.clock.running) {
        if (s.clock.running) {
            var lastTickSec = Int.MAX_VALUE
            while (true) {
                now = System.currentTimeMillis()
                dispatch(PantomimeAction.Tick(now))
                val secsLeft = ((remainingMs(s.clock, now) + 999L) / 1000L).toInt()
                if (secsLeft in 1..3 && secsLeft < lastTickSec) {
                    sound.play(SoundId.TICK)
                    haptics.light()
                    lastTickSec = secsLeft
                }
                delay(250)
            }
        }
    }

    val remainingSec = remainingMs(s.clock, now) / 1000f
    val unlimited = s.options.maxSkipsPerTurn == -1
    val left = skipsLeft(s)

    AppScreen(scrollable = true, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = { EndGameAction(lang, dispatch) })
        StandingsPills(s, lang)
        TimerRing(totalSeconds = s.options.roundSeconds, remainingSeconds = remainingSec)
        // Re-key on the prompt so each newly-drawn card pops in (after a Correct/Skip advances the deck).
        key(promptText) {
            Text(
                text = promptText,
                modifier = Modifier.fillMaxWidth().screenEntrance(translateY = 8.dp, fromScale = 0.92f),
                color = palette.text,
                fontSize = 40.sp,
                lineHeight = 48.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center,
            )
        }
        if (hintText != null) {
            if (showHint) {
                Text(text = hintText, color = palette.textMuted, textAlign = TextAlign.Center)
            } else {
                AppButton(
                    text = tr(lang, "Show hint", "نمایش راهنما"),
                    onClick = { showHint = true },
                    variant = ButtonVariant.GHOST,
                    size = ButtonSize.SM,
                )
            }
        }
        Text(
            text = tr(
                lang,
                "Correct ${fmtNum(s.turnCorrect, lang)} · Skipped ${fmtNum(s.turnSkipped, lang)}",
                "درست ${fmtNum(s.turnCorrect, lang)} · رد ${fmtNum(s.turnSkipped, lang)}",
            ),
            color = palette.textMuted,
            fontSize = 14.sp,
        )
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            AppButton(
                text = "✓ " + tr(lang, "Correct", "درست"),
                onClick = {
                    sound.play(SoundId.CORRECT)
                    haptics.success()
                    dispatch(PantomimeAction.Correct)
                },
                variant = ButtonVariant.SUCCESS,
                size = ButtonSize.LG,
                modifier = Modifier.weight(1f),
            )
            AppButton(
                text = "↷ " + tr(lang, "Skip", "رد کن") + (if (!unlimited) " (${fmtNum(maxOf(0, left), lang)})" else ""),
                onClick = {
                    sound.play(SoundId.PASS)
                    haptics.warning()
                    dispatch(PantomimeAction.Skip)
                },
                variant = ButtonVariant.SECONDARY,
                size = ButtonSize.LG,
                enabled = unlimited || left > 0,
                modifier = Modifier.weight(1f),
            )
        }
        AppButton(
            text = tr(lang, "End turn", "پایان نوبت"),
            onClick = { dispatch(PantomimeAction.EndTurnEarly(System.currentTimeMillis())) },
            variant = ButtonVariant.GHOST,
        )
        Spacer(Modifier.padding(bottom = 8.dp))
    }
}

@Composable
private fun TurnEndView(
    s: PantomimeState,
    manifest: GameManifest,
    lang: Lang,
    sound: Sfx,
    haptics: Haptics,
    dispatch: (PantomimeAction) -> Unit,
    onClose: () -> Unit,
) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    val team = activeTeam(s)
    val name = actorName(s)
    val last = s.history.lastOrNull()
    val reason = when (s.lastTurnEndReason) {
        TurnEndReason.TIME_EXPIRED -> tr(lang, "Time's up", "وقت تمام شد")
        TurnEndReason.DECK_EXHAUSTED -> tr(lang, "Out of prompts!", "سرنخی نمانده!")
        else -> tr(lang, "Ended early", "زودتر تمام شد")
    }
    // The turn ran out of time: punctuate it once as this summary appears (the view mounts per turn end).
    LaunchedEffect(Unit) {
        if (s.lastTurnEndReason == TurnEndReason.TIME_EXPIRED) {
            sound.play(SoundId.TIME_UP)
            haptics.warning()
        }
    }
    AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = { EndGameAction(lang, dispatch) })
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (team != null) TeamBadge(team.name, team.color)
            Text(text = name, color = palette.text, fontWeight = FontWeight.Bold, fontSize = 24.sp)
            Text(text = reason, color = palette.textMuted)
            Text(
                text = "+${fmtNum(last?.correct ?: 0, lang)}",
                modifier = Modifier.screenEntrance(translateY = 0.dp, fromScale = 0.5f),
                color = accent.base,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 30.sp,
            )
            Text(
                text = tr(
                    lang,
                    "Correct ${fmtNum(last?.correct ?: 0, lang)} · Skipped ${fmtNum(last?.skipped ?: 0, lang)}",
                    "درست ${fmtNum(last?.correct ?: 0, lang)} · رد ${fmtNum(last?.skipped ?: 0, lang)}",
                ),
                color = palette.textMuted,
                fontSize = 14.sp,
            )
        }
        Leaderboard(rows = standingsRows(s, lang))
        AppButton(
            text = tr(lang, "Next turn", "نوبت بعدی"),
            onClick = { dispatch(PantomimeAction.NextTurn(pantomimeSeed())) },
            size = ButtonSize.LG,
            fullWidth = true,
        )
        Spacer(Modifier.padding(bottom = 8.dp))
    }
}

// ──────────────────────────── Results ────────────────────────────

@Composable
fun PantomimeResultsScreen(
    state: PantomimeState,
    lang: Lang,
    manifest: GameManifest,
    sound: Sfx,
    haptics: Haptics,
    onClose: () -> Unit,
    onHome: () -> Unit,
    onPlayAgain: () -> Unit,
) = PantomimeAccent {
    val s = state
    // Celebrate the final standings once (web: ResultsScreen plays 'win' on mount).
    LaunchedEffect(Unit) {
        sound.play(SoundId.WIN)
        haptics.success()
    }
    val winners = selectWinners(s)
    val winnerNames = winners.map { teamLabel(s, it) }
    val title =
        if (winners.size > 1) tr(lang, "It's a tie!", "مساوی شد!")
        else tr(lang, "${winnerNames.firstOrNull() ?: ""} wins!", "${winnerNames.firstOrNull() ?: ""} برنده شد!")

    AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
        WinnerBanner(title = title, names = winnerNames, tie = winners.size > 1)
        Leaderboard(rows = standingsRows(s, lang))
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            AppButton(text = tr(lang, "Play again", "بازی دوباره"), onClick = onPlayAgain, size = ButtonSize.LG, fullWidth = true)
            AppButton(text = tr(lang, "Home", "خانه"), onClick = onHome, variant = ButtonVariant.SECONDARY, fullWidth = true)
        }
        Spacer(Modifier.padding(bottom = 8.dp))
    }
}

// ──────────────────────────── Shared bits ────────────────────────────

private fun standingsRows(s: PantomimeState, lang: Lang): List<ScoreRow> = selectStandings(s).map { st ->
    ScoreRow(
        id = st.subjectId,
        label = teamLabel(s, st.subjectId),
        score = st.total,
        rank = st.rank,
        color = teamColor(s, st.subjectId),
        display = fmtNum(st.total, lang),
    )
}

/** Ends the match immediately and shows Results with the standings so far (web: common.endGame). */
@Composable
private fun EndGameAction(lang: Lang, dispatch: (PantomimeAction) -> Unit) {
    EndGameButton(lang = lang, onEndGame = { dispatch(PantomimeAction.EndGame) })
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        color = LocalPalette.current.textMuted,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
    )
}

@Composable
private fun TeamBadge(name: String, color: ColorToken?) {
    val ac = (color ?: ColorToken.GRAPE).accent()
    val palette = LocalPalette.current
    Row(
        modifier = Modifier
            .clip(PillShape)
            .background(ac.soft, PillShape)
            .border(1.dp, ac.base.copy(alpha = 0.5f), PillShape)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(ac.base, CircleShape))
        Text(text = name, color = palette.text, fontWeight = FontWeight.Bold, fontSize = 16.sp)
    }
}

/** Per-team score pills shown while acting; the active team is highlighted in the accent fill. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StandingsPills(s: PantomimeState, lang: Lang) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    val activeId = activeTeam(s)?.teamId
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        selectStandings(s).forEach { st ->
            val team = s.teams.firstOrNull { it.teamId == st.subjectId }
            val isActive = st.subjectId == activeId
            Row(
                modifier = Modifier
                    .clip(PillShape)
                    .background(if (isActive) accent.strong else palette.surface2, PillShape)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background((team?.color ?: ColorToken.GRAPE).accent().base, CircleShape),
                )
                Text(
                    text = team?.name ?: st.subjectId,
                    color = if (isActive) accent.onAccent else palette.textMuted,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                )
                Text(
                    text = fmtNum(st.total, lang),
                    color = if (isActive) accent.onAccent else palette.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                )
            }
        }
    }
}
