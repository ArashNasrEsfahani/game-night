package com.gamenight.party.game.headsup

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.content.ContentStore
import com.gamenight.party.game.Sfx
import com.gamenight.party.engine.Rng
import com.gamenight.party.engine.teamIdAt
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.SetupErrors
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.AppToggle
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.Chip
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.Leaderboard
import com.gamenight.party.ui.components.PillShape
import com.gamenight.party.ui.components.ScoreRow
import com.gamenight.party.ui.components.SegmentOption
import com.gamenight.party.ui.components.SegmentedControl
import com.gamenight.party.ui.components.SelectChip
import com.gamenight.party.ui.components.Stepper
import com.gamenight.party.ui.components.TimerRing
import com.gamenight.party.ui.components.WinnerBanner
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent
import com.gamenight.party.ui.screens.fmtNum
import kotlinx.coroutines.delay
import kotlin.math.ceil

/**
 * Heads Up! screens — native ports of src/games/heads-up/screens/(tsx files), built from the shared Compose
 * UI library. Each wraps its content in [LocalAccent] = the manifest's sky accent so every control
 * recolors to this game (mirrors the web per-game `--game-accent`).
 *
 * Side effects (the 3-2-1 clock, the round timer, the colour-flash auto-clear) live HERE in
 * LaunchedEffect loops and dispatch seed-carrying actions into the pure reducer — never the reducer.
 */

private val HeadsUpAccent = ColorToken.SKY

private val SEAT_COLORS = listOf(
    ColorToken.SKY, ColorToken.ROSE, ColorToken.LIME, ColorToken.GOLD,
    ColorToken.VIOLET, ColorToken.TANGERINE, ColorToken.TEAL, ColorToken.GRAPE,
)

/** Fallback roster so the game is playable before a shared roster store is wired into the shell. */
private fun defaultRoster(lang: Lang): List<PlayerSeat> = (0 until 4).map { i ->
    PlayerSeat(
        id = "p${i + 1}",
        name = if (lang == Lang.FA) "بازیکن ${i + 1}" else "Player ${i + 1}",
        color = SEAT_COLORS[i % SEAT_COLORS.size],
    )
}

/** Round-robin a seed-shuffled roster across [teamCount] teams (mirrors the Setup team auto-split). */
private fun buildTeams(seats: List<PlayerSeat>, teamCount: Int, seed: Int): List<ConfigTeam> {
    val dealt = Rng(seed).shuffle(seats.map { it.id })
    val buckets = List(teamCount) { mutableListOf<String>() }
    dealt.forEachIndexed { i, id -> buckets[i % teamCount].add(id) }
    return (0 until teamCount).map { i ->
        ConfigTeam(
            id = teamIdAt(i),
            name = LocalizedString("Team ${i + 1}", "تیم ${i + 1}"),
            memberIds = buckets[i].toList(),
        )
    }
}

/* ───────────────────────────────  Setup  ─────────────────────────────── */

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HeadsUpSetupScreen(
    players: List<PlayerSeat>,
    content: ContentStore,
    lang: Lang,
    manifest: GameManifest,
    onClose: () -> Unit,
    onStart: (HeadsUpConfig) -> Unit,
) {
    val t: (String, String) -> String = { en, fa -> if (lang == Lang.FA) fa else en }
    CompositionLocalProvider(LocalAccent provides HeadsUpAccent.accent()) {
        val palette = LocalPalette.current
        val huContent = remember(content) { HeadsUpContent.load(content) }
        val roster = remember(players, lang) { players.ifEmpty { defaultRoster(lang) } }

        var selected by remember(roster) { mutableStateOf(roster.map { it.id }.toSet()) }
        var deckIds by remember { mutableStateOf(setOf("animals")) }
        var mode by remember { mutableStateOf(HeadsUpMode.SOLO) }
        var roundSeconds by remember { mutableStateOf(60) }
        var rounds by remember { mutableStateOf(1) }
        var passPenalty by remember { mutableStateOf(false) }
        var recycleDeck by remember { mutableStateOf(true) }
        var motionEnabled by remember { mutableStateOf(false) }
        var teamCount by remember { mutableStateOf(2) }
        var diffEasy by remember { mutableStateOf(true) }
        var diffMedium by remember { mutableStateOf(true) }
        var diffHard by remember { mutableStateOf(true) }
        val teamSeed = remember { freshSeed() }

        val options = HeadsUpOptions(
            deckIds = deckIds.toList(),
            mode = mode,
            roundSeconds = roundSeconds,
            rounds = rounds,
            motionEnabled = motionEnabled,
            passPenalty = if (passPenalty) 1 else 0,
            recycleDeck = recycleDeck,
            teamCount = teamCount,
            difficulties = mapOf(
                Difficulty.EASY to diffEasy,
                Difficulty.MEDIUM to diffMedium,
                Difficulty.HARD to diffHard,
            ),
        )
        val seats = roster.filter { it.id in selected }
        val pool = huContent.mergedPool(options.deckIds, selectedDifficulties(options))
        val teams = if (mode == HeadsUpMode.TEAMS) buildTeams(seats, teamCount, teamSeed) else null
        val config = HeadsUpConfig(players = seats, teams = teams, lang = lang, options = options, cardPool = pool)
        val errors = validateConfig(config)
        val diffCounts = huContent.deckDifficultyCounts(options.deckIds)

        AppScreen(horizontalAlignment = Alignment.Start) {
            GameAppBar(manifest = manifest, lang = lang, onClose = onClose)

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
            SectionLabel("${t("Players", "بازیکن‌ها")} · ${fmtNum(seats.size, lang)}", palette.textMuted)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                roster.forEach { p ->
                    SelectChip(
                        selected = p.id in selected,
                        onClick = {
                            selected = if (p.id in selected) selected - p.id else selected + p.id
                        },
                        text = p.name,
                    )
                }
            }

            SectionLabel(t("Decks", "دسته‌ها"), palette.textMuted)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                huContent.decks.forEach { d ->
                    SelectChip(
                        selected = d.id in deckIds,
                        onClick = { deckIds = if (d.id in deckIds) deckIds - d.id else deckIds + d.id },
                        text = "${d.icon} ${d.name.resolve(lang)}",
                    )
                }
            }

            SectionLabel(t("Mode", "حالت"), palette.textMuted)
            SegmentedControl(
                options = listOf(
                    SegmentOption(HeadsUpMode.SOLO, t("Solo", "انفرادی")),
                    SegmentOption(HeadsUpMode.TEAMS, t("Teams", "تیمی")),
                ),
                value = mode,
                onChange = { mode = it },
            )

            if (mode == HeadsUpMode.TEAMS) {
                SectionLabel(t("Number of teams", "تعداد تیم‌ها"), palette.textMuted)
                SegmentedControl(
                    options = listOf(
                        SegmentOption(2, fmtNum(2, lang)),
                        SegmentOption(3, fmtNum(3, lang)),
                        SegmentOption(4, fmtNum(4, lang)),
                    ),
                    value = teamCount,
                    onChange = { teamCount = it },
                )
            }

            SectionLabel(t("Difficulty", "سختی"), palette.textMuted)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SelectChip(selected = diffEasy, onClick = { diffEasy = !diffEasy }, text = "${t("Easy", "آسان")} · ${fmtNum(diffCounts[Difficulty.EASY] ?: 0, lang)}")
                SelectChip(selected = diffMedium, onClick = { diffMedium = !diffMedium }, text = "${t("Medium", "متوسط")} · ${fmtNum(diffCounts[Difficulty.MEDIUM] ?: 0, lang)}")
                SelectChip(selected = diffHard, onClick = { diffHard = !diffHard }, text = "${t("Hard", "سخت")} · ${fmtNum(diffCounts[Difficulty.HARD] ?: 0, lang)}")
            }

            SectionLabel(t("Round time", "زمان دور"), palette.textMuted)
            SegmentedControl(
                options = ROUND_SECONDS_CHOICES.map { SegmentOption(it, "${fmtNum(it, lang)}s") },
                value = roundSeconds,
                onChange = { roundSeconds = it },
            )

            Stepper(value = rounds, onValueChange = { rounds = it }, min = 1, max = 5, label = t("Rounds each", "دور برای هرکس"))
            AppToggle(checked = passPenalty, onCheckedChange = { passPenalty = it }, label = t("Pass penalty (−1)", "جریمهٔ رد کردن (−۱)"))
            AppToggle(checked = recycleDeck, onCheckedChange = { recycleDeck = it }, label = t("Recycle deck", "چرخش دوبارهٔ کارت‌ها"))
            AppToggle(checked = motionEnabled, onCheckedChange = { motionEnabled = it }, label = t("Tilt controls", "کنترل با تکان دادن"))

            SetupErrors(errors = errors, lang = lang)
            }

            // Primary action pinned to the bottom, always reachable, in a distinct GOLD accent so it
            // stands out from the sky-accented option chips/segments above.
            Spacer(Modifier.height(12.dp))
            CompositionLocalProvider(LocalAccent provides ColorToken.GOLD.accent()) {
                AppButton(
                    text = t("Start", "شروع"),
                    onClick = { if (errors.isEmpty()) onStart(config) },
                    variant = ButtonVariant.PRIMARY,
                    size = ButtonSize.LG,
                    fullWidth = true,
                    enabled = errors.isEmpty(),
                )
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun SectionLabel(text: String, color: Color) {
    Text(text = text, color = color, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
}

/* ────────────────────────────────  Play  ─────────────────────────────── */

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HeadsUpPlayScreen(
    content: ContentStore,
    lang: Lang,
    state: HeadsUpState,
    manifest: GameManifest,
    dispatch: (HeadsUpAction) -> Unit,
    onExit: () -> Unit,
    onClose: () -> Unit,
    sound: Sfx = Sfx.None,
    haptics: Haptics = Haptics.none(),
) {
    val s = state
    val t: (String, String) -> String = { en, fa -> if (lang == Lang.FA) fa else en }
    val huContent = remember(content) { HeadsUpContent.load(content) }

    // 3-2-1 countdown (every 700ms while in the countdown phase).
    LaunchedEffect(s.phase) {
        if (s.phase != HeadsUpPhase.COUNTDOWN) return@LaunchedEffect
        while (true) {
            delay(700)
            dispatch(HeadsUpAction.CountdownTick)
        }
    }
    // Round clock: ceil the remaining whole seconds every 250ms; fire TIME_UP at zero.
    LaunchedEffect(s.phase, s.turnIndex, s.roundSeconds) {
        if (s.phase != HeadsUpPhase.PLAYING) return@LaunchedEffect
        val endAt = System.currentTimeMillis() + s.roundSeconds * 1000L
        while (true) {
            val rem = ceil((endAt - System.currentTimeMillis()) / 1000.0).toInt()
            if (rem <= 0) {
                dispatch(HeadsUpAction.TimeUp)
                break
            }
            dispatch(HeadsUpAction.Tick(rem))
            delay(250)
        }
    }
    // Clear the colour flash shortly after it fires.
    LaunchedEffect(s.flash) {
        if (s.flash != null) {
            delay(400)
            dispatch(HeadsUpAction.ClearFlash)
        }
    }

    // ── Audio/haptic cues (effects only — fired from the UI layer, never the reducer) ──
    // Time's up: the round just closed into its summary.
    LaunchedEffect(s.phase) {
        if (s.phase == HeadsUpPhase.ROUND_END) {
            sound.play(SoundId.TIME_UP)
            haptics.warning()
        }
    }
    // Urgency ticks in the final seconds (secondsLeft is whole seconds, so this fires once per second).
    LaunchedEffect(s.secondsLeft, s.phase) {
        if (s.phase == HeadsUpPhase.PLAYING && s.secondsLeft in 1..3) {
            sound.play(SoundId.TICK)
            haptics.light()
        }
    }

    val accent = HeadsUpAccent.accent()
    val participant = HeadsUpLogic.currentParticipant(s)
    val guesserName = participant?.let { s.playerNames[HeadsUpLogic.guesserId(it)] } ?: ""

    CompositionLocalProvider(LocalAccent provides accent) {
        val palette = LocalPalette.current
        // Bail out of the match early -> jump straight to Results with the standings so far.
        val endGameRight: @Composable () -> Unit = {
            Text(
                text = t("End game", "پایان بازی"),
                color = palette.textMuted,
                fontSize = 14.sp,
                modifier = Modifier.clickable { dispatch(HeadsUpAction.EndGame) },
            )
        }
        AppScreen(horizontalAlignment = Alignment.CenterHorizontally) {
            when (s.phase) {
                HeadsUpPhase.ERROR -> {
                    GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            Text(
                                text = t("No cards available for this setup.", "کارتی برای این تنظیمات نیست."),
                                color = palette.textMuted,
                                textAlign = TextAlign.Center,
                            )
                            AppButton(text = t("Back", "بازگشت"), onClick = onExit, size = ButtonSize.LG)
                        }
                    }
                }

                HeadsUpPhase.HANDOFF -> {
                    GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            if (participant != null && participant.kind == ParticipantKind.TEAM) {
                                Text(participant.name, color = palette.textMuted, fontWeight = FontWeight.SemiBold)
                            }
                            Text("🙈", fontSize = 64.sp)
                            Text(t("Pass the phone to", "گوشی را بده به"), color = palette.textMuted, fontSize = 16.sp)
                            Text(
                                text = guesserName,
                                color = accent.base,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 36.sp,
                                textAlign = TextAlign.Center,
                            )
                            Text(
                                text = t(
                                    "Hold it on your forehead so the group can see the word.",
                                    "گوشی را روی پیشانی نگه دار تا جمع کلمه را ببیند.",
                                ),
                                color = palette.textMuted,
                                fontSize = 13.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.padding(horizontal = 24.dp),
                            )
                            AppButton(
                                text = t("Ready", "آماده"),
                                onClick = { dispatch(HeadsUpAction.ConfirmReady) },
                                size = ButtonSize.LG,
                            )
                        }
                    }
                }

                HeadsUpPhase.COUNTDOWN -> {
                    GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                    // Each new number springs in from small with a tick — the web's per-count pop.
                    val countPop = remember { Animatable(1f) }
                    LaunchedEffect(s.countdownLeft) {
                        sound.play(SoundId.TICK)
                        haptics.light()
                        countPop.snapTo(0.5f)
                        countPop.animateTo(1f, spring(dampingRatio = 0.45f, stiffness = 320f))
                    }
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Text(
                            text = if (s.countdownLeft > 0) fmtNum(s.countdownLeft, lang) else t("GO", "برو"),
                            modifier = Modifier.graphicsLayer { scaleX = countPop.value; scaleY = countPop.value },
                            color = accent.base,
                            fontWeight = FontWeight.Black,
                            fontSize = 96.sp,
                        )
                    }
                }

                HeadsUpPhase.PLAYING -> {
                    GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                    val card = s.currentCardId?.let { huContent.cardByKey[it] }
                    val word = card?.word?.resolve(lang) ?: ""
                    val gotCount = s.currentEntries.count { it.result == EntryResult.GOT }
                    // The running "Got" count pops on each increment (mirrors the web score pop).
                    val gotPop = remember { Animatable(1f) }
                    LaunchedEffect(gotCount) {
                        gotPop.snapTo(1.25f)
                        gotPop.animateTo(1f, spring(dampingRatio = 0.45f, stiffness = 320f))
                    }
                    // Each fresh card springs in (mirrors the web card pop).
                    val cardPop = remember { Animatable(1f) }
                    LaunchedEffect(s.currentCardId) {
                        if (s.currentCardId != null) {
                            cardPop.snapTo(0.7f)
                            cardPop.animateTo(1f, spring(dampingRatio = 0.55f, stiffness = 320f))
                        }
                    }
                    val flashTint = when (s.flash) {
                        EntryResult.GOT -> Accents.LimeStrong.copy(alpha = 0.40f)
                        EntryResult.PASSED -> Accents.GoldStrong.copy(alpha = 0.40f)
                        null -> Color.Transparent
                    }
                    Box(
                        modifier = Modifier.weight(1f).fillMaxWidth().background(flashTint),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(20.dp),
                        ) {
                            if (participant != null && participant.kind == ParticipantKind.TEAM) {
                                Text(participant.name, color = palette.textMuted, fontWeight = FontWeight.SemiBold)
                            }
                            TimerRing(totalSeconds = s.roundSeconds, remainingSeconds = s.secondsLeft.toFloat())
                            if (s.currentCardId != null) {
                                Text(
                                    text = word,
                                    modifier = Modifier.graphicsLayer { scaleX = cardPop.value; scaleY = cardPop.value },
                                    color = palette.text,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 48.sp,
                                    textAlign = TextAlign.Center,
                                )
                            } else {
                                // Fade + slide the "out of words" message in (mirrors the web entrance)
                                // rather than letting it pop in instantly.
                                val outEnter = remember { Animatable(0f) }
                                LaunchedEffect(Unit) { outEnter.animateTo(1f, spring(dampingRatio = 0.9f, stiffness = 220f)) }
                                Text(
                                    text = t("Out of words", "کلمه‌ای نمانده"),
                                    modifier = Modifier.graphicsLayer {
                                        alpha = outEnter.value
                                        translationY = (1f - outEnter.value) * -8.dp.toPx()
                                    },
                                    color = palette.textMuted,
                                    fontSize = 22.sp,
                                )
                            }
                            Text(
                                text = "${t("Got", "درست")}: ${fmtNum(gotCount, lang)}",
                                modifier = Modifier.graphicsLayer { scaleX = gotPop.value; scaleY = gotPop.value },
                                color = palette.textMuted,
                                fontSize = 14.sp,
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                AppButton(
                                    text = "↑ ${t("Pass", "رد")}",
                                    onClick = {
                                        sound.play(SoundId.PASS)
                                        dispatch(HeadsUpAction.MarkPass(freshSeed()))
                                    },
                                    modifier = Modifier.weight(1f),
                                    variant = ButtonVariant.SECONDARY,
                                    size = ButtonSize.LG,
                                    enabled = s.currentCardId != null,
                                )
                                AppButton(
                                    text = "↓ ${t("Got it", "درست")}",
                                    onClick = {
                                        sound.play(SoundId.CORRECT)
                                        haptics.success()
                                        dispatch(HeadsUpAction.MarkGot(freshSeed()))
                                    },
                                    modifier = Modifier.weight(1f),
                                    variant = ButtonVariant.SUCCESS,
                                    size = ButtonSize.LG,
                                    enabled = s.currentCardId != null,
                                )
                            }
                        }
                    }
                }

                HeadsUpPhase.ROUND_END, HeadsUpPhase.FINISHED -> {
                    val last = s.rounds.lastOrNull()
                    val allDone = s.participants.all {
                        (s.roundOfParticipant[it.id] ?: 0) >= s.totalRoundsPerParticipant
                    }
                    // The round tally pops in.
                    val scorePop = remember { Animatable(1f) }
                    LaunchedEffect(last) {
                        scorePop.snapTo(0.6f)
                        scorePop.animateTo(1f, spring(dampingRatio = 0.5f, stiffness = 300f))
                    }
                    GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            Text(guesserName, color = palette.text, fontWeight = FontWeight.Bold, fontSize = 22.sp)
                            Text(
                                text = "${t("Got", "درست")} ${fmtNum(last?.got ?: 0, lang)} · ${t("Passed", "رد")} ${fmtNum(last?.passed ?: 0, lang)}",
                                modifier = Modifier.graphicsLayer { scaleX = scorePop.value; scaleY = scorePop.value },
                                color = accent.base,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 28.sp,
                            )
                            FlowRow(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                (last?.entries ?: emptyList()).forEach { e ->
                                    val w = huContent.cardByKey[e.cardKey]?.word?.resolve(lang) ?: "?"
                                    EntryChip(text = w, got = e.result == EntryResult.GOT)
                                }
                            }
                            AppButton(
                                text = if (allDone) t("See results", "نتایج") else t("Next", "بعدی"),
                                onClick = { dispatch(HeadsUpAction.NextParticipant(freshSeed())) },
                                size = ButtonSize.LG,
                                fullWidth = true,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EntryChip(text: String, got: Boolean) {
    if (got) {
        Box(
            modifier = Modifier
                .clip(PillShape)
                .background(Accents.Lime, PillShape)
                .padding(horizontal = 10.dp, vertical = 4.dp),
        ) {
            Text(text = text, color = Color(0xFF160F30), fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
        }
    } else {
        Chip(text)
    }
}

/* ──────────────────────────────  Results  ────────────────────────────── */

@Composable
fun HeadsUpResultsScreen(
    content: ContentStore,
    lang: Lang,
    state: HeadsUpState,
    manifest: GameManifest,
    onPlayAgain: () -> Unit,
    onExit: () -> Unit,
    onClose: () -> Unit,
    sound: Sfx = Sfx.None,
    haptics: Haptics = Haptics.none(),
) {
    val s = state
    val t: (String, String) -> String = { en, fa -> if (lang == Lang.FA) fa else en }

    // Fanfare once when the results land (mirrors the web `ctx.sound.play('win')`).
    LaunchedEffect(Unit) {
        sound.play(SoundId.WIN)
        haptics.success()
    }

    CompositionLocalProvider(LocalAccent provides HeadsUpAccent.accent()) {
        val winners = HeadsUpLogic.computeWinners(s)
        val winnerNames = winners.map { HeadsUpLogic.participantName(s, it) }
        val title = if (winners.size > 1) {
            t("It's a tie!", "مساوی شد!")
        } else {
            val name = winnerNames.firstOrNull().orEmpty()
            t("$name wins!", "$name برد!")
        }
        val rows = HeadsUpLogic.standings(s).map { r ->
            ScoreRow(
                id = r.participantId,
                label = "${HeadsUpLogic.participantName(s, r.participantId)} · " +
                    t(
                        "got ${fmtNum(r.got, lang)} · pass ${fmtNum(r.passed, lang)}",
                        "درست ${fmtNum(r.got, lang)} · رد ${fmtNum(r.passed, lang)}",
                    ),
                score = r.score,
                rank = r.rank,
                color = s.participants.firstOrNull { it.id == r.participantId }?.color,
            )
        }

        AppScreen(
            horizontalAlignment = Alignment.Start,
            verticalArrangement = Arrangement.spacedBy(12.dp),
            scrollable = true,
        ) {
            GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
            WinnerBanner(title = title, names = winnerNames, tie = winners.size > 1)
            Leaderboard(rows = rows)
            Spacer(Modifier.height(4.dp))
            AppButton(
                text = t("Play again", "دوباره بازی کن"),
                onClick = onPlayAgain,
                size = ButtonSize.LG,
                fullWidth = true,
            )
            AppButton(
                text = t("Home", "خانه"),
                onClick = onExit,
                variant = ButtonVariant.SECONDARY,
                fullWidth = true,
            )
            Spacer(Modifier.height(8.dp))
        }
    }
}
