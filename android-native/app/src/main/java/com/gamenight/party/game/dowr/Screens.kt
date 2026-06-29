@file:OptIn(ExperimentalLayoutApi::class)

package com.gamenight.party.game.dowr

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
import com.gamenight.party.ui.components.EaseOut
import com.gamenight.party.ui.components.EasePop
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.EndGameButton
import com.gamenight.party.ui.components.Leaderboard
import com.gamenight.party.ui.components.PillShape
import com.gamenight.party.ui.components.ScoreRow
import com.gamenight.party.ui.components.SegmentOption
import com.gamenight.party.ui.components.SegmentedControl
import com.gamenight.party.ui.components.SelectChip
import com.gamenight.party.ui.components.Stepper
import com.gamenight.party.ui.components.TimerRing
import com.gamenight.party.ui.components.WinnerBanner
import com.gamenight.party.ui.components.glassBg2
import com.gamenight.party.ui.screens.faDigits
import com.gamenight.party.ui.screens.fmtNum
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.roundToInt

/**
 * Compose screens for "Dowr". Side effects that the web kept in `ctx` (the wall clock, fresh seeds)
 * live here, NOT in the reducer. Each screen re-asserts the game's violet accent locally via
 * [LocalAccent] so it is correct regardless of how the host mounts it.
 */

private val DOWR_ACCENT = ColorToken.VIOLET

@Composable
private fun DowrThemed(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAccent provides DOWR_ACCENT.accent()) { content() }
}

private fun tr(lang: Lang, en: String, fa: String): String = if (lang == Lang.FA) fa else en

/** Tidy mm:ss / Ns total (mirrors the screens' `fmtTotal`), localizing digits for Persian. */
private fun fmtTotal(ms: Long, lang: Lang): String {
    val s = (ms.coerceAtLeast(0L) / 1000.0).roundToInt()
    val m = s / 60
    val r = s % 60
    val raw = if (m > 0) "$m:${r.toString().padStart(2, '0')}" else "${r}s"
    return faDigits(raw, lang)
}

// ──────────────────────────── Setup ────────────────────────────

@Composable
fun DowrSetupScreen(
    players: List<PlayerSeat>,
    content: DowrContent,
    lang: Lang,
    manifest: GameManifest,
    onClose: () -> Unit,
    onStart: (DowrConfig) -> Unit,
) = DowrThemed {
    val palette = LocalPalette.current
    var opts by remember { mutableStateOf(DEFAULT_OPTIONS) }
    var selected by remember { mutableStateOf(players.map { it.id }.toSet()) }

    val seats = players.filter { it.id in selected }
    val teamCount = seats.size / 2
    val config = DowrConfig(players = seats, content = content, lang = lang, options = opts)
    val errors = validateConfig(config)
    val poolSize = content.buildPool(normalizeOptions(opts).categories, opts.difficulty).size

    fun toggleCat(c: DowrCategory) {
        opts = opts.copy(
            categories = if (c in opts.categories) opts.categories - c else opts.categories + c,
        )
    }

    AppScreen(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose, back = true)

        // Options scroll between the fixed top bar and the pinned Start button, so Start is always
        // reachable at the bottom no matter how long the option list grows.
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Players
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                SectionLabel("${tr(lang, "Players", "بازیکنان")} · ${fmtNum(seats.size, lang)}")
                if (teamCount > 0) {
                    Text(
                        text = tr(
                            lang,
                            "${fmtNum(teamCount, lang)} teams of ${fmtNum(2, lang)}",
                            "${fmtNum(teamCount, lang)} تیم دونفره",
                        ),
                        color = LocalAccent.current.base,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                    )
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                players.forEach { p ->
                    SelectChip(
                        selected = p.id in selected,
                        onClick = { selected = if (p.id in selected) selected - p.id else selected + p.id },
                        text = (p.emoji?.let { "$it " } ?: "") + p.name,
                    )
                }
            }
            Text(
                text = tr(lang, "Pairs up automatically — keep it even", "خودکار جفت می‌شوند — تعداد را زوج نگه دار"),
                color = palette.textMuted,
                fontSize = 12.sp,
            )

            // Word packs
            SectionLabel(tr(lang, "Word packs", "بسته‌های کلمه"))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CATEGORIES.forEach { c ->
                    SelectChip(
                        selected = c in opts.categories,
                        onClick = { toggleCat(c) },
                        text = categoryLabel(c).resolve(lang),
                    )
                }
            }

            // More options
            SectionLabel(tr(lang, "More options", "گزینه‌های بیشتر"))

            FieldLabel(tr(lang, "Difficulty", "سختی"))
            val diffSel = when (opts.difficulty) {
                DowrDifficulty.EASY -> "easy"
                DowrDifficulty.MED -> "med"
                DowrDifficulty.HARD -> "hard"
                null -> "random"
            }
            SegmentedControl(
                value = diffSel,
                onChange = { v ->
                    opts = opts.copy(
                        difficulty = when (v) {
                            "easy" -> DowrDifficulty.EASY
                            "med" -> DowrDifficulty.MED
                            "hard" -> DowrDifficulty.HARD
                            else -> null
                        },
                    )
                },
                options = listOf(
                    SegmentOption("random", tr(lang, "Mixed", "ترکیبی")),
                    SegmentOption("easy", tr(lang, "Easy", "آسان")),
                    SegmentOption("med", tr(lang, "Medium", "متوسط")),
                    SegmentOption("hard", tr(lang, "Hard", "سخت")),
                ),
            )

            FieldLabel(tr(lang, "End mode", "پایان بازی"))
            SegmentedControl(
                value = opts.endMode,
                onChange = { opts = opts.copy(endMode = it) },
                options = listOf(
                    SegmentOption(DowrEndMode.TURNS, tr(lang, "Turns each", "نوبت ثابت")),
                    SegmentOption(DowrEndMode.TIME, tr(lang, "Time limit", "محدودیت زمان")),
                ),
            )

            if (opts.endMode == DowrEndMode.TURNS) {
                Stepper(
                    label = tr(lang, "Turns per team", "نوبت هر تیم"),
                    value = opts.rounds,
                    min = 1,
                    max = 8,
                    onValueChange = { opts = opts.copy(rounds = it) },
                )
            } else {
                FieldLabel(tr(lang, "Total time", "زمان کل"))
                SegmentedControl(
                    value = opts.timeLimitSeconds,
                    onChange = { opts = opts.copy(timeLimitSeconds = it) },
                    options = TIME_LIMIT_CHOICES.map { SegmentOption(it, "${fmtNum(it / 60, lang)}m") },
                )
            }

            FieldLabel(tr(lang, "Bomb timer", "زمان بمب"))
            SegmentedControl(
                value = opts.fuseSeconds,
                onChange = { opts = opts.copy(fuseSeconds = it) },
                options = FUSE_CHOICES.map { SegmentOption(it, "${fmtNum(it, lang)}s") },
            )

            if (opts.endMode == DowrEndMode.TURNS) {
                FieldLabel(tr(lang, "Bomb penalty", "جریمهٔ بمب"))
                SegmentedControl(
                    value = opts.bombPenaltySeconds,
                    onChange = { opts = opts.copy(bombPenaltySeconds = it) },
                    options = BOMB_PENALTY_CHOICES.map { SegmentOption(it, "+${fmtNum(it, lang)}s") },
                )

                FieldLabel(tr(lang, "Change-word penalty", "جریمهٔ تعویض کلمه"))
                SegmentedControl(
                    value = opts.changePenaltySeconds,
                    onChange = { opts = opts.copy(changePenaltySeconds = it) },
                    options = CHANGE_PENALTY_CHOICES.map {
                        SegmentOption(it, if (it == 0) tr(lang, "Off", "خاموش") else "+${fmtNum(it, lang)}s")
                    },
                )
            }

            AppToggle(
                label = tr(lang, "Surprise bomb", "بمب غافلگیر"),
                checked = opts.surpriseBomb,
                onCheckedChange = { opts = opts.copy(surpriseBomb = it) },
            )

            Text(
                text = tr(lang, "≈ ${fmtNum(poolSize, lang)} words ready", "حدود ${fmtNum(poolSize, lang)} کلمه آماده است"),
                color = palette.textMuted,
                fontSize = 14.sp,
            )
        }

        // Pinned to the bottom: validation message (if any) + the primary Start CTA. The CTA forces a
        // GOLD accent so it stands apart from the violet option controls above.
        SetupErrors(errors = errors, lang = lang)
        CompositionLocalProvider(LocalAccent provides ColorToken.GOLD.accent()) {
            AppButton(
                text = tr(lang, "Start", "شروع"),
                onClick = { onStart(config) },
                size = ButtonSize.LG,
                fullWidth = true,
                enabled = errors == null,
            )
        }
    }
}

// ──────────────────────────── Play ────────────────────────────

@Composable
fun DowrPlayScreen(
    state: DowrState,
    lang: Lang,
    manifest: GameManifest,
    nextSeed: () -> Int,
    dispatch: (DowrAction) -> Unit,
    onClose: () -> Unit,
    sound: Sfx = Sfx.None,
    haptics: Haptics = Haptics.none(),
    now: () -> Long = { System.currentTimeMillis() },
) = DowrThemed {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    val s = state

    if (s.phase == DowrPhase.ERROR) {
        AppScreen(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(
                    text = tr(lang, "No words match these filters", "هیچ کلمه‌ای با این فیلترها نیست"),
                    color = palette.textMuted,
                    textAlign = TextAlign.Center,
                )
            }
        }
        return@DowrThemed
    }

    val timeMode = s.options.endMode == DowrEndMode.TIME
    val bankedMs = elapsedMs(s)
    val limitMs = timeLimitMs(s)

    // Live timing lives here, not in the reducer: the current word's segment is measured against the
    // wall clock from the moment the word appeared, keeping the match resume-safe.
    var segStart by remember { mutableStateOf(now()) }
    var segMs by remember { mutableStateOf(0L) }
    // Purely cosmetic: bumped on each guessed word so a green check pops over the word swap. Lives in
    // view state (not the reducer) so it stays resume-safe — mirrors the web's `gotBurst`.
    var gotBurst by remember { mutableStateOf(0) }
    // Drives the bomb screen-shake; nudged through a short keyframe run whenever the fuse blows.
    val shake = remember { Animatable(0f) }

    // The always-running clock: pump elapsed, end the match when the shared clock runs out (time
    // mode), and auto-detonate the per-word bomb when its fuse is spent.
    LaunchedEffect(s.phase, s.turnNo, s.fuseMs, timeMode, bankedMs, limitMs) {
        if (s.phase != DowrPhase.PLAYING) return@LaunchedEffect
        while (isActive) {
            delay(120)
            val n = now()
            val e = (n - segStart).coerceAtLeast(0L)
            segMs = e
            if (timeMode && bankedMs + e >= limitMs) {
                segStart = n
                segMs = 0L
                sound.play(SoundId.LOSE)
                haptics.error()
                dispatch(DowrAction.EndTime(e))
                return@LaunchedEffect
            }
            if (e >= s.fuseMs) {
                segStart = n // re-anchor first so the next tick doesn't double-fire
                segMs = 0L
                sound.play(SoundId.EXPLOSION)
                haptics.error()
                dispatch(DowrAction.Advance(TurnEndReason.BOMB, s.fuseMs, nextSeed()))
                return@LaunchedEffect
            }
        }
    }

    // Clear the bomb flash shortly after it fires.
    LaunchedEffect(s.flashBomb) {
        if (s.flashBomb) {
            delay(450)
            dispatch(DowrAction.ClearFlash)
        }
    }

    // Shake the word/bomb column when the fuse blows (mirrors the web's x/y keyframe jolt).
    LaunchedEffect(s.flashBomb) {
        if (s.flashBomb) {
            for (target in listOf(-9f, 8f, -6f, 5f, -3f, 0f)) shake.animateTo(target, tween(55))
        } else {
            shake.snapTo(0f)
        }
    }

    val team = currentTeam(s)
    val card = s.currentCard
    val word = card?.word?.resolve(lang) ?: ""
    val fuseSec = (s.fuseMs / 1000L).toInt()
    val remainSec = (s.fuseMs - segMs).coerceAtLeast(0L).toFloat() / 1000f
    val changeCost = if (timeMode) 0 else s.options.changePenaltySeconds
    val sharedLeftMs = timeRemainingMs(s, segMs)
    val taboo = card?.hints?.taboo?.map { it.resolve(lang) }.orEmpty()

    fun liveTotal(id: String): Long =
        if (id == team.id) (s.totals[id] ?: 0L) + s.changePenaltyMs + segMs else s.totals[id] ?: 0L

    fun teamScore(id: String): String =
        if (timeMode) "${fmtNum(teamWords(s, id), lang)}✓" else fmtTotal(liveTotal(id), lang)

    val gotIt = {
        val n = now()
        val segmentMs = (n - segStart).coerceIn(0L, s.fuseMs)
        segStart = n // anchor the next team's segment to this instant
        segMs = 0L
        gotBurst += 1
        sound.play(SoundId.CORRECT)
        haptics.success()
        dispatch(DowrAction.Advance(TurnEndReason.GUESSED, segmentMs, nextSeed()))
    }
    val changeWord = {
        sound.play(SoundId.PASS)
        haptics.warning()
        dispatch(DowrAction.ChangeWord(nextSeed()))
    }

    AppScreen(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        GameAppBar(
            manifest = manifest,
            lang = lang,
            onClose = onClose,
            trailing = {
                EndGameButton(lang = lang, onEndGame = { dispatch(DowrAction.EndGame) })
            },
        )

        // Standings strip — whose turn + every team's running total / words.
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            s.teams.forEach { tm ->
                TeamPill(name = tm.name, color = tm.color, active = tm.id == team.id, score = teamScore(tm.id))
            }
        }

        // Shared countdown — the headline pressure in time mode.
        if (timeMode) {
            Text(
                text = "⏱ ${fmtTotal(sharedLeftMs, lang)}",
                color = if (sharedLeftMs <= 15000L) ColorToken.ROSE.accent().strong else accent.base,
                fontSize = 30.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center,
            )
        }

        // Whose turn.
        Text(
            text = tr(lang, "${describerName(s)} describes", "${describerName(s)} توضیح می‌دهد"),
            color = accent.base,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
        val turnSub = buildString {
            append(tr(lang, "${guesserName(s)} guesses", "${guesserName(s)} حدس می‌زند"))
            if (!timeMode) {
                append(" · ")
                append(
                    tr(
                        lang,
                        "Round ${fmtNum(currentRound(s), lang)} of ${fmtNum(s.options.rounds, lang)}",
                        "دور ${fmtNum(currentRound(s), lang)} از ${fmtNum(s.options.rounds, lang)}",
                    ),
                )
            }
        }
        Text(text = turnSub, color = palette.textMuted, fontSize = 12.sp, textAlign = TextAlign.Center)

        // Bomb + word (fills the remaining height).
        Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp),
                modifier = Modifier.graphicsLayer { translationX = shake.value.dp.toPx() },
            ) {
                if (s.options.surpriseBomb) {
                    BombPulse()
                } else {
                    TimerRing(totalSeconds = fuseSec, remainingSeconds = remainSec)
                }
                RevealWord(word = word, cardKey = card?.id, color = palette.text)
                if (taboo.isNotEmpty()) {
                    Text(
                        text = "${tr(lang, "Don't say", "نگو")}: ${taboo.joinToString("، ")}",
                        color = palette.textMuted,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }

            // A correct guess pops a lime check + wash — the reward symmetric to the bomb's punish.
            GotItBurst(trigger = gotBurst)

            if (s.flashBomb) {
                val boom = remember { Animatable(0f) }
                LaunchedEffect(Unit) { boom.animateTo(1f, tween(420, easing = EaseOut)) }
                Box(
                    modifier = Modifier.fillMaxSize().background(ColorToken.ROSE.accent().base.copy(alpha = 0.32f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "💥",
                        fontSize = 96.sp,
                        modifier = Modifier.graphicsLayer {
                            val p = boom.value.coerceIn(0f, 1f)
                            val sc = 0.3f + EasePop.transform(p) * 0.85f
                            scaleX = sc
                            scaleY = sc
                            rotationZ = (1f - p) * -14f
                        },
                    )
                }
            }
        }

        // Controls.
        AppButton(
            text = "✓ ${tr(lang, "Got it!", "گرفتم!")}",
            onClick = gotIt,
            variant = ButtonVariant.SUCCESS,
            size = ButtonSize.LG,
            fullWidth = true,
        )
        AppButton(
            text = "↻ " + if (changeCost > 0) {
                tr(lang, "Change (+${fmtNum(changeCost, lang)}s)", "تعویض (+${fmtNum(changeCost, lang)} ثانیه)")
            } else {
                tr(lang, "Change word", "تعویض کلمه")
            },
            onClick = changeWord,
            variant = ButtonVariant.SECONDARY,
            fullWidth = true,
        )
    }
}

// ──────────────────────────── Results ────────────────────────────

@Composable
fun DowrResultsScreen(
    state: DowrState,
    lang: Lang,
    manifest: GameManifest,
    onPlayAgain: () -> Unit,
    onClose: () -> Unit,
    onExit: () -> Unit,
    sound: Sfx = Sfx.None,
    haptics: Haptics = Haptics.none(),
) = DowrThemed {
    val palette = LocalPalette.current
    val s = state
    val timeMode = s.options.endMode == DowrEndMode.TIME

    // Celebrate once when the results land (mirrors the web's `ctx.sound.play('win')` on mount).
    LaunchedEffect(Unit) {
        sound.play(SoundId.WIN)
        haptics.success()
    }

    val winners = selectWinners(s)
    val standings = selectStandings(s)
    val nameOf = { id: String -> s.teams.firstOrNull { it.id == id }?.name ?: id }
    val winnerNames = winners.map(nameOf)
    val firstName = winnerNames.firstOrNull() ?: ""
    val title = if (winnerNames.size > 1) {
        tr(lang, "It's a tie!", "مساوی شد!")
    } else {
        tr(lang, "$firstName wins!", "$firstName برنده شد!")
    }

    val rows = standings.map { st ->
        ScoreRow(
            id = st.subjectId,
            label = st.label,
            score = if (timeMode) st.words else (st.totalMs / 1000L).toInt(),
            display = if (timeMode) tr(lang, "${fmtNum(st.words, lang)} words", "${fmtNum(st.words, lang)} کلمه") else fmtTotal(st.totalMs, lang),
            rank = st.rank,
            color = st.color,
        )
    }

    AppScreen(horizontalAlignment = Alignment.CenterHorizontally, scrollable = true, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
        WinnerBanner(title = title, names = winnerNames, tie = winnerNames.size > 1)
        Text(
            text = if (timeMode) {
                tr(lang, "Most words wins!", "بیشترین کلمه برنده‌ست!")
            } else {
                tr(lang, "Fastest team wins!", "سریع‌ترین تیم برنده شد!")
            },
            color = palette.textMuted,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
        )
        Leaderboard(rows = rows)
        AppButton(
            text = tr(lang, "Play again", "بازی دوباره"),
            onClick = onPlayAgain,
            size = ButtonSize.LG,
            fullWidth = true,
        )
        AppButton(
            text = tr(lang, "Home", "خانه"),
            onClick = onExit,
            variant = ButtonVariant.SECONDARY,
            fullWidth = true,
        )
    }
}

// ──────────────────────────── Small shared pieces ────────────────────────────

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        color = LocalPalette.current.textMuted,
        fontSize = 14.sp,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
private fun FieldLabel(text: String) {
    Text(text = text, color = LocalPalette.current.text, fontSize = 14.sp)
}

/** A team chip in the standings strip — accent fill when it's that team's turn. */
@Composable
private fun TeamPill(name: String, color: ColorToken, active: Boolean, score: String) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    val bg = if (active) accent.strong else glassBg2(palette)
    val fg = if (active) accent.onAccent else palette.textMuted
    Row(
        modifier = Modifier
            .clip(PillShape)
            .background(bg, PillShape)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(color.accent().base, CircleShape))
        Text(text = name, color = fg, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        Text(text = score, color = fg, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

/**
 * The current word, popping in each time the card changes (mirrors the web `reveal` variant): keyed on
 * the card id so a fresh fade + rise + scale plays on every draw / change / advance.
 */
@Composable
private fun RevealWord(word: String, cardKey: String?, color: Color) {
    key(cardKey) {
        val reveal = remember { Animatable(0f) }
        LaunchedEffect(Unit) { reveal.animateTo(1f, tween(340, easing = EasePop)) }
        Text(
            text = word,
            color = color,
            fontSize = 48.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.graphicsLayer {
                val p = reveal.value.coerceIn(0f, 1f)
                alpha = p
                val sc = 0.84f + 0.16f * p
                scaleX = sc
                scaleY = sc
                translationY = (1f - p) * 12.dp.toPx()
            },
        )
    }
}

/**
 * A lime check-coin + wash that blooms once and fades whenever [trigger] increments — the rewarding
 * counterpart to the bomb's kaboom (mirrors the web "Guessed!" burst). Rendered inside the play
 * screen's centre [Box]; no-op until the first correct guess.
 */
@Composable
private fun BoxScope.GotItBurst(trigger: Int) {
    if (trigger <= 0) return
    val lime = ColorToken.LIME.accent()
    val p = remember { Animatable(0f) }
    LaunchedEffect(trigger) {
        p.snapTo(0f)
        p.animateTo(1f, tween(620, easing = EaseOut))
    }
    val v = p.value
    // Lime wash that fades out.
    Box(
        modifier = Modifier
            .matchParentSize()
            .graphicsLayer { alpha = (1f - v).coerceIn(0f, 1f) * 0.45f }
            .background(lime.base),
    )
    // Check coin: pops in, then fades away.
    val coinAlpha = (v / 0.18f).coerceAtMost(1f) * (1f - ((v - 0.45f) / 0.55f).coerceIn(0f, 1f))
    val coinScale = 0.4f + EasePop.transform((v * 1.7f).coerceAtMost(1f)) * 0.8f
    Box(
        modifier = Modifier
            .align(Alignment.Center)
            .size(96.dp)
            .graphicsLayer {
                alpha = coinAlpha
                scaleX = coinScale
                scaleY = coinScale
            }
            .clip(CircleShape)
            .background(lime.strong, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = "✓", color = lime.onAccent, fontSize = 46.sp, fontWeight = FontWeight.Black)
    }
}

/** The breathing bomb emoji shown when surpriseBomb hides the countdown. */
@Composable
private fun BombPulse() {
    val infinite = rememberInfiniteTransition(label = "bomb")
    val scale by infinite.animateFloat(
        initialValue = 1f,
        targetValue = 1.14f,
        animationSpec = infiniteRepeatable(tween(700), RepeatMode.Reverse),
        label = "bombScale",
    )
    Text(
        text = "💣",
        fontSize = 52.sp,
        modifier = Modifier.graphicsLayer { scaleX = scale; scaleY = scale },
    )
}
