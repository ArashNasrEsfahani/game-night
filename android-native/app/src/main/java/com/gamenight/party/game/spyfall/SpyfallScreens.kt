package com.gamenight.party.game.spyfall

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.ui.components.SetupErrors
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.AppToggle
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.Chip
import com.gamenight.party.ui.components.Curtain
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.Leaderboard
import com.gamenight.party.ui.components.ScoreRow
import com.gamenight.party.ui.components.SegmentOption
import com.gamenight.party.ui.components.SegmentedControl
import com.gamenight.party.ui.components.SelectChip
import com.gamenight.party.ui.components.Stepper
import com.gamenight.party.ui.components.WinnerBanner
import com.gamenight.party.ui.components.glass2Surface
import com.gamenight.party.ui.screens.faDigits
import com.gamenight.party.ui.screens.fmtNum
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import com.gamenight.party.game.Sfx
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.EasePop
import kotlinx.coroutines.delay

/**
 * Spyfall screens — native ports of src/games/spyfall/screens/{Setup,Play,Results}Screen.tsx, built
 * from the shared Disco Persian component library. All three are mounted inside the violet accent
 * (the game's manifest color) by [SpyfallGame.Mount].
 *
 * UI chrome strings are inlined bilingually (matching src/i18n/{en,fa}.json `spy.*`) and resolved
 * via [host language]; CONTENT (locations, roles) stays in the shared JSON via [SpyfallContent].
 */

private fun txt(lang: Lang, en: String, fa: String): String = if (lang == Lang.FA) fa else en

private fun fmt(sec: Int): String {
    val m = sec / 60
    val s = maxOf(0, sec % 60)
    return "$m:${s.toString().padStart(2, '0')}"
}

/** A column that fills the remaining height and centers its content (justify-center / items-center). */
@Composable
private fun ColumnScope.CenterColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.weight(1f).fillMaxWidth(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
        content = content,
    )
}

/**
 * A one-shot "pop" entrance (mirrors the web `--ease-pop` reveal): the node fades in while scaling up
 * from slightly small the first time it enters the composition. Used to make a freshly-revealed
 * secret card / round-outcome headline land with a little bounce on top of the screen's own fade-in.
 */
private fun Modifier.popIn(durationMillis: Int = 320, fromScale: Float = 0.9f): Modifier = composed {
    var shown by remember { mutableStateOf(false) }
    val progress by animateFloatAsState(
        targetValue = if (shown) 1f else 0f,
        animationSpec = tween(durationMillis, easing = EasePop),
        label = "popIn",
    )
    LaunchedEffect(Unit) { shown = true }
    graphicsLayer {
        alpha = progress.coerceIn(0f, 1f)
        val sc = fromScale + (1f - fromScale) * progress
        scaleX = sc
        scaleY = sc
    }
}

/* ─────────────────────────────────  Setup  ───────────────────────────────── */

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SpyfallSetupScreen(
    players: List<PlayerSeat>,
    lang: Lang,
    manifest: GameManifest,
    onClose: () -> Unit,
    onStart: (SpyfallConfig) -> Unit,
) {
    val palette = LocalPalette.current
    var opts by remember { mutableStateOf(SpyfallOptions()) }
    var selected by remember { mutableStateOf(players.map { it.id }.toSet()) }
    val packs = remember { SpyfallContent.packs() }

    val seats = players.filter { it.id in selected }
    val cap = maxSpies(maxOf(3, seats.size))
    val effectiveSpyCount = minOf(opts.spyCount, cap)
    val config = SpyfallConfig(players = seats, lang = lang, options = opts.copy(spyCount = effectiveSpyCount))
    val errors = validateConfig(config)

    AppScreen {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose)

        // Options scroll in the middle; the Start button stays pinned to the bottom (below), so it is
        // always reachable no matter how many players / packs push the list past the fold.
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
        ) {
            Text(
                text = "${txt(lang, "Players", "بازیکنان")} · ${fmtNum(seats.size, lang)}",
                color = palette.textMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                modifier = Modifier.padding(top = 4.dp, bottom = 8.dp),
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                players.forEach { p ->
                    SelectChip(
                        selected = p.id in selected,
                        onClick = { selected = if (p.id in selected) selected - p.id else selected + p.id },
                        text = (p.emoji?.let { "$it " } ?: "") + p.name,
                    )
                }
            }

            Spacer(Modifier.height(20.dp))
            Stepper(
                value = effectiveSpyCount,
                onValueChange = { opts = opts.copy(spyCount = it) },
                min = 1,
                max = cap,
                label = txt(lang, "Spies", "جاسوس‌ها"),
            )
            Spacer(Modifier.height(8.dp))
            Stepper(
                value = opts.totalRounds,
                onValueChange = { opts = opts.copy(totalRounds = it) },
                min = 1,
                max = 10,
                label = txt(lang, "Rounds", "دورها"),
            )

            Spacer(Modifier.height(14.dp))
            Text(
                text = txt(lang, "Round time", "زمان دور"),
                color = palette.text,
                fontSize = 14.sp,
                modifier = Modifier.padding(bottom = 6.dp),
            )
            SegmentedControl(
                options = ROUND_SECONDS_CHOICES.map { SegmentOption(it, "${fmtNum(it / 60, lang)}m") },
                value = opts.roundSeconds,
                onChange = { opts = opts.copy(roundSeconds = it) },
                modifier = Modifier.fillMaxWidth(),
            )

            if (packs.size > 1) {
                Spacer(Modifier.height(14.dp))
                Text(
                    text = txt(lang, "Location packs", "بسته‌های مکان"),
                    color = palette.text,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(bottom = 6.dp),
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    packs.forEach { pack ->
                        SelectChip(
                            selected = pack.id in opts.enabledPackIds,
                            onClick = {
                                opts = opts.copy(
                                    enabledPackIds = if (pack.id in opts.enabledPackIds) {
                                        opts.enabledPackIds - pack.id
                                    } else {
                                        opts.enabledPackIds + pack.id
                                    },
                                )
                            },
                            text = pack.name.resolve(lang),
                        )
                    }
                }
            }

            Spacer(Modifier.height(14.dp))
            AppToggle(
                checked = opts.useTimer,
                onCheckedChange = { opts = opts.copy(useTimer = it) },
                label = txt(lang, "Use a timer", "استفاده از تایمر"),
            )
            Spacer(Modifier.height(8.dp))
            AppToggle(
                checked = opts.allowSpyGuess,
                onCheckedChange = { opts = opts.copy(allowSpyGuess = it) },
                label = txt(lang, "Let the spy guess the location", "جاسوس بتواند مکان را حدس بزند"),
            )
            Spacer(Modifier.height(8.dp))
        }

        // Pinned bottom action. Painted in GOLD (overriding the game's violet accent) so the primary
        // Start button stands out from every violet option control above it.
        SetupErrors(errors = errors, lang = lang, modifier = Modifier.padding(bottom = 10.dp))
        CompositionLocalProvider(LocalAccent provides ColorToken.GOLD.accent()) {
            AppButton(
                text = txt(lang, "Start", "شروع"),
                onClick = { onStart(config) },
                size = ButtonSize.LG,
                fullWidth = true,
                enabled = errors == null,
            )
        }
        Spacer(Modifier.height(8.dp))
    }
}

/* ─────────────────────────────────  Play  ───────────────────────────────── */

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SpyfallPlayScreen(
    state: SpyfallState,
    lang: Lang,
    manifest: GameManifest,
    onClose: () -> Unit,
    onExit: () -> Unit,
    dispatch: (SpyfallAction) -> Unit,
    sound: Sfx = Sfx.None,
    haptics: Haptics = Haptics.none(),
) {
    val s = state
    val palette = LocalPalette.current
    val accent = LocalAccent.current

    var gateOpen by remember { mutableStateOf(false) }
    var voteCursor by remember { mutableStateOf(0) }
    var secondsLeft by remember { mutableStateOf(s.options.roundSeconds) }

    // Re-close the secrecy gate whenever the holder changes (mirrors the web reset effect).
    LaunchedEffect(s.phase, s.revealCursor, voteCursor) { gateOpen = false }
    LaunchedEffect(s.phase) { if (s.phase == SpyfallPhase.VOTING) voteCursor = 0 }

    // QA countdown — the only clock in the game; lives here, never in the pure reducer.
    LaunchedEffect(s.phase, s.options.useTimer, s.options.roundSeconds) {
        if (s.phase != SpyfallPhase.QA || !s.options.useTimer) return@LaunchedEffect
        val endAt = System.currentTimeMillis() + s.options.roundSeconds * 1000L
        secondsLeft = s.options.roundSeconds
        var lastTick = -1
        while (true) {
            val rem = Math.ceil((endAt - System.currentTimeMillis()) / 1000.0).toInt()
            secondsLeft = maxOf(0, rem)
            if (rem <= 0) {
                sound.play(SoundId.TIME_UP)
                haptics.warning()
                dispatch(SpyfallAction.TimerExpired)
                break
            }
            // Tense final countdown — a tiny tick on each of the last five seconds.
            if (rem in 1..5 && rem != lastTick) {
                lastTick = rem
                sound.play(SoundId.TICK)
            }
            delay(250)
        }
    }

    val name: (String) -> String = { id -> s.playerNames[id] ?: id }

    // Shared "End game" affordance (mirrors Truth or Dare): ends the match immediately and the shell
    // swaps to Results with the running standings. Shown during active play in each in-match AppBar.
    val endGameRight: @Composable () -> Unit = {
        Text(
            text = txt(lang, "End game", "پایان بازی"),
            color = palette.textMuted,
            fontSize = 14.sp,
            modifier = Modifier.clickable { dispatch(SpyfallAction.EndGame) },
        )
    }

    when (s.phase) {
        SpyfallPhase.ERROR -> AppScreen {
            GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
            CenterColumn {
                Text(
                    text = txt(lang, "Not enough players or locations", "بازیکن یا مکان کافی نیست"),
                    color = palette.textMuted,
                    fontSize = 16.sp,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(12.dp))
                AppButton(text = txt(lang, "Play again", "بازی دوباره"), onClick = onExit)
            }
        }

        SpyfallPhase.REVEAL -> {
            val pid = currentRevealPlayerId(s)
            val card = pid?.let { s.round.cards[it] }
            val loc = card?.let { SpyfallContent.locationById(it.locationId) }
            val role = if (card != null && !card.isSpy && card.roleId != null) {
                SpyfallContent.roleName(card.locationId, card.roleId)
            } else {
                null
            }
            val holder = pid?.let(name) ?: ""
            AppScreen {
                GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                Text(
                    text = faDigits("${s.revealCursor + 1} / ${s.playerIds.size}", lang),
                    color = palette.textMuted,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                )
                Curtain(
                    open = gateOpen,
                    holderName = holder,
                    hint = txt(lang, "Only $holder should look", "فقط $holder باید ببیند"),
                    revealLabel = txt(lang, "Tap to reveal", "برای دیدن بزن"),
                    onReveal = {
                        sound.play(SoundId.REVEAL)
                        haptics.light()
                        gateOpen = true
                    },
                    modifier = Modifier.weight(1f),
                ) {
                    AppCard(modifier = Modifier.weight(1f).fillMaxWidth().popIn()) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            if (card?.isSpy == true) {
                                Text("🕵️", fontSize = 64.sp)
                                Text(
                                    text = txt(lang, "You are the Spy", "تو جاسوسی"),
                                    color = accent.base,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 28.sp,
                                    textAlign = TextAlign.Center,
                                )
                                Text(
                                    text = txt(lang, "Blend in — figure out the location!", "خودت رو جا بزن — مکان رو حدس بزن!"),
                                    color = palette.textMuted,
                                    fontSize = 14.sp,
                                    textAlign = TextAlign.Center,
                                )
                            } else {
                                Text(loc?.icon ?: "📍", fontSize = 56.sp)
                                Text(
                                    text = loc?.name?.resolve(lang) ?: "",
                                    color = palette.text,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 28.sp,
                                    textAlign = TextAlign.Center,
                                )
                                if (role != null) Chip(text = role.resolve(lang))
                            }
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    AppButton(
                        text = txt(lang, "Hide & pass", "پنهان کن و بده"),
                        onClick = { dispatch(SpyfallAction.RevealNext) },
                        size = ButtonSize.LG,
                        fullWidth = true,
                    )
                }
            }
        }

        SpyfallPhase.QA -> AppScreen {
            GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
            CenterColumn {
                if (s.options.useTimer) {
                    Text(
                        text = faDigits(fmt(secondsLeft), lang),
                        color = if (secondsLeft <= 60) Accents.RoseStrong else accent.base,
                        fontWeight = FontWeight.Black,
                        fontSize = 64.sp,
                    )
                    Spacer(Modifier.height(12.dp))
                }
                Text(
                    text = txt(
                        lang,
                        "${name(s.round.firstAskerId)} asks first",
                        "${name(s.round.firstAskerId)} اول سؤال می‌پرسد",
                    ),
                    color = palette.textMuted,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = txt(
                        lang,
                        "No location list — work it out from the questions.",
                        "فهرست مکان‌ها نیست — از روی سؤال‌ها حدس بزن.",
                    ),
                    color = palette.textMuted,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(0.85f),
                )
            }
            AppButton(
                text = txt(lang, "Call a vote", "رأی‌گیری کن"),
                onClick = { dispatch(SpyfallAction.CallVote("", "")) },
                size = ButtonSize.LG,
                fullWidth = true,
                modifier = Modifier.padding(bottom = 16.dp),
            )
        }

        SpyfallPhase.ACCUSATION -> AppScreen {
            GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
            CenterColumn {
                Text(
                    text = txt(lang, "Time to vote!", "وقت رأی‌گیری!"),
                    color = palette.text,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 24.sp,
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(16.dp))
                AppButton(
                    text = txt(lang, "Start vote", "شروع رأی"),
                    onClick = { dispatch(SpyfallAction.OpenVoting) },
                    size = ButtonSize.LG,
                )
                Spacer(Modifier.height(8.dp))
                AppButton(
                    text = txt(lang, "Keep talking", "ادامه گفتگو"),
                    onClick = { dispatch(SpyfallAction.CancelVote) },
                    variant = ButtonVariant.GHOST,
                )
            }
        }

        SpyfallPhase.VOTING -> {
            if (voteCursor >= s.playerIds.size) {
                AppScreen {
                    GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                    CenterColumn {
                        Text(
                            text = txt(lang, "Everyone has voted", "همه رأی دادند"),
                            color = palette.textMuted,
                            fontSize = 18.sp,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(16.dp))
                        AppButton(
                            text = txt(lang, "Reveal result", "نمایش نتیجه"),
                            onClick = {
                                sound.play(SoundId.REVEAL)
                                haptics.medium()
                                dispatch(SpyfallAction.LockVotes)
                            },
                            size = ButtonSize.LG,
                        )
                    }
                }
            } else {
                val voter = s.playerIds[voteCursor]
                AppScreen {
                    GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                    Curtain(
                        open = gateOpen,
                        holderName = name(voter),
                        hint = txt(lang, "Only ${name(voter)} should look", "فقط ${name(voter)} باید ببیند"),
                        revealLabel = txt(lang, "Tap to reveal", "برای دیدن بزن"),
                        onReveal = { gateOpen = true },
                        modifier = Modifier.weight(1f),
                    ) {
                        Column(
                            modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
                            verticalArrangement = Arrangement.Center,
                        ) {
                            Text(
                                text = txt(lang, "Who is the spy?", "جاسوس کیه؟"),
                                color = palette.text,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(16.dp))
                            s.playerIds.filter { it != voter }.chunked(2).forEach { rowItems ->
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    rowItems.forEach { id ->
                                        VoteCandidate(
                                            name = name(id),
                                            modifier = Modifier.weight(1f),
                                            onClick = {
                                                sound.play(SoundId.SELECT)
                                                haptics.light()
                                                dispatch(SpyfallAction.CastVote(voter, id))
                                                voteCursor += 1
                                            },
                                        )
                                    }
                                    if (rowItems.size == 1) Spacer(Modifier.weight(1f))
                                }
                            }
                            Spacer(Modifier.height(6.dp))
                            AppButton(
                                text = txt(lang, "Abstain", "رأی نمی‌دهم"),
                                onClick = {
                                    dispatch(SpyfallAction.CastVote(voter, null))
                                    voteCursor += 1
                                },
                                variant = ButtonVariant.GHOST,
                                fullWidth = true,
                            )
                        }
                    }
                }
            }
        }

        SpyfallPhase.SPY_GUESS -> {
            val spy = s.round.spyIds.firstOrNull() ?: ""
            AppScreen {
                GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                Curtain(
                    open = gateOpen,
                    holderName = name(spy),
                    hint = txt(lang, "Spy ${name(spy)} — guess the location", "جاسوس ${name(spy)} — مکان را حدس بزن"),
                    revealLabel = txt(lang, "Tap to reveal", "برای دیدن بزن"),
                    onReveal = { gateOpen = true },
                    modifier = Modifier.weight(1f),
                ) {
                    Text(
                        text = txt(lang, "Guess the location to steal the win", "مکان را حدس بزن تا برد را برباییی"),
                        color = palette.text,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    )
                    Column(
                        modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
                    ) {
                        SpyfallContent.allLocations().chunked(2).forEach { rowItems ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                rowItems.forEach { locItem ->
                                    LocationGuess(
                                        label = "${locItem.icon ?: "📍"} ${locItem.name.resolve(lang)}",
                                        modifier = Modifier.weight(1f),
                                        onClick = {
                                            sound.play(SoundId.REVEAL)
                                            haptics.medium()
                                            dispatch(SpyfallAction.SpyGuess(spy, locItem.id))
                                        },
                                    )
                                }
                                if (rowItems.size == 1) Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    AppButton(
                        text = txt(lang, "Don't guess", "حدس نمی‌زنم"),
                        onClick = { dispatch(SpyfallAction.SkipSpyGuess) },
                        variant = ButtonVariant.GHOST,
                        fullWidth = true,
                    )
                }
            }
        }

        // ROUND_END (and the transient MATCH_END, before the shell swaps to Results).
        else -> {
            if (s.phase == SpyfallPhase.MATCH_END) {
                AppScreen { GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight) }
            } else {
                val r = s.round
                val loc = SpyfallContent.locationById(r.locationId)
                val last = r.index + 1 >= s.options.totalRounds
                val outcomeText = when (r.outcome) {
                    RoundOutcome.SPY_CAUGHT -> txt(lang, "The spy was caught! 🎉", "جاسوس گیر افتاد! 🎉")
                    RoundOutcome.SPY_SURVIVED -> txt(lang, "The spy survived! 🕵️", "جاسوس قسر در رفت! 🕵️")
                    RoundOutcome.SPY_GUESSED_RIGHT -> txt(lang, "The spy guessed the location! 🕵️", "جاسوس مکان را درست حدس زد! 🕵️")
                    RoundOutcome.SPY_GUESSED_WRONG -> txt(lang, "The spy guessed wrong!", "جاسوس اشتباه حدس زد!")
                    null -> ""
                }
                // Outcome sting, once as the round resolves: a bright cue when the table wins, a sly
                // reveal whoosh when the spy gets away (sound/haptics live here, not in the reducer).
                LaunchedEffect(Unit) {
                    when (r.outcome) {
                        RoundOutcome.SPY_CAUGHT, RoundOutcome.SPY_GUESSED_WRONG -> {
                            sound.play(SoundId.CORRECT)
                            haptics.success()
                        }
                        RoundOutcome.SPY_SURVIVED, RoundOutcome.SPY_GUESSED_RIGHT -> {
                            sound.play(SoundId.REVEAL)
                            haptics.warning()
                        }
                        null -> {}
                    }
                }
                AppScreen {
                    GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                    CenterColumn {
                        Text(
                            text = outcomeText,
                            modifier = Modifier.popIn(),
                            color = accent.base,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 24.sp,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(16.dp))
                        AppCard(modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = txt(lang, "The location was", "مکان این بود"),
                                color = palette.textMuted,
                                fontSize = 14.sp,
                            )
                            Text(
                                text = "${loc?.icon ?: ""} ${loc?.name?.resolve(lang) ?: ""}",
                                color = palette.text,
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp,
                            )
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = txt(lang, "The spy was", "جاسوس این بود"),
                                color = palette.textMuted,
                                fontSize = 14.sp,
                            )
                            Text(
                                text = r.spyIds.joinToString("، ") { name(it) },
                                color = palette.text,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                            )
                        }
                        Spacer(Modifier.height(16.dp))
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            s.playerIds.forEach { id ->
                                val sc = r.roundScores[id] ?: 0
                                Chip(text = "${name(id)} ${if (sc > 0) "+${fmtNum(sc, lang)}" else "·"}")
                            }
                        }
                        Spacer(Modifier.height(20.dp))
                        AppButton(
                            text = if (last) txt(lang, "See results", "دیدن نتایج") else txt(lang, "Next round", "دور بعد"),
                            onClick = { dispatch(SpyfallAction.NextRound(kotlin.random.Random.nextInt())) },
                            size = ButtonSize.LG,
                            fullWidth = true,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun VoteCandidate(name: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val accent = LocalAccent.current
    val palette = LocalPalette.current
    AppCard(
        modifier = modifier,
        onClick = onClick,
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 14.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                modifier = Modifier.size(28.dp).clip(CircleShape).background(accent.strong, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = name.take(1).uppercase(),
                    color = accent.onAccent,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                )
            }
            Text(
                text = name,
                color = palette.text,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun LocationGuess(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    Box(
        modifier = modifier
            .glass2Surface(palette, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = palette.text,
            fontWeight = FontWeight.Medium,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
    }
}

/* ────────────────────────────────  Results  ─────────────────────────────── */

@Composable
fun SpyfallResultsScreen(
    state: SpyfallState,
    lang: Lang,
    manifest: GameManifest,
    onPlayAgain: () -> Unit,
    onClose: () -> Unit,
    onExit: () -> Unit,
    sound: Sfx = Sfx.None,
    haptics: Haptics = Haptics.none(),
) {
    val s = state

    // Victory fanfare once when results land — the WinnerBanner already springs/confetti on its own.
    LaunchedEffect(Unit) {
        sound.play(SoundId.WIN)
        haptics.success()
    }

    val winners = computeWinners(s)
    val winnerNames = winners.map { s.playerNames[it] ?: it }
    val title = if (winners.size > 1) {
        txt(lang, "It's a tie!", "مساوی شد!")
    } else {
        val w = winnerNames.firstOrNull() ?: ""
        txt(lang, "$w wins!", "$w برنده شد!")
    }
    val rows = standings(s).map { r ->
        ScoreRow(
            id = r.id,
            label = s.playerNames[r.id] ?: r.id,
            score = r.score,
            rank = r.rank,
            color = s.playerColors[r.id],
        )
    }

    AppScreen(scrollable = true) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
        WinnerBanner(title = title, names = winnerNames, tie = winners.size > 1)
        Spacer(Modifier.height(8.dp))
        Leaderboard(rows = rows)
        Spacer(Modifier.height(16.dp))
        AppButton(
            text = txt(lang, "Play again", "بازی دوباره"),
            onClick = onPlayAgain,
            size = ButtonSize.LG,
            fullWidth = true,
        )
        Spacer(Modifier.height(8.dp))
        AppButton(
            text = txt(lang, "Home", "خانه"),
            onClick = onExit,
            variant = ButtonVariant.SECONDARY,
            fullWidth = true,
        )
        Spacer(Modifier.height(24.dp))
    }
}
