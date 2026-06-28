package com.gamenight.party.game.neverhaveiever

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.game.Sfx
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.Chip
import com.gamenight.party.ui.components.Curtain
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.Leaderboard
import com.gamenight.party.ui.components.PillShape
import com.gamenight.party.ui.components.ScoreRow
import com.gamenight.party.ui.components.SegmentOption
import com.gamenight.party.ui.components.SegmentedControl
import com.gamenight.party.ui.components.SelectChip
import com.gamenight.party.ui.components.Stepper
import com.gamenight.party.ui.components.WinnerBanner
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent
import com.gamenight.party.ui.screens.fmtNum

/**
 * The three "Never Have I Ever" screens — a Compose port of screens/{Setup,Play,Results}Screen.tsx
 * built from the shared UI library. Each is wrapped in [NhieAccent] so LocalAccent reflects this
 * game's manifest colour (rose), recolouring every control just like the webapp's per-game accent.
 */

private fun gameAccent() = ColorToken.ROSE

/** Picks the EN or FA face of a small piece of UI chrome (the native i18n stand-in). */
private fun tr(lang: Lang, en: String, fa: String): String = if (lang == Lang.FA) fa else en

/** Provides this game's accent so the shared components recolour to rose. */
@Composable
private fun NhieAccent(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAccent provides gameAccent().accent(), content = content)
}

/** AppBar trailing control that ends the match now and jumps to Results (mirrors ToD's "End game"). */
@Composable
private fun EndGameAction(lang: Lang, dispatch: (NhieAction) -> Unit) {
    val palette = LocalPalette.current
    Text(
        text = tr(lang, "End game", "پایان بازی"),
        color = palette.textMuted,
        fontSize = 14.sp,
        modifier = Modifier.clickable { dispatch(NhieAction.EndGame) },
    )
}

/** An emoji that springs in (the heart-break / skull punch from the web's reveal animations). */
@Composable
private fun PopEmoji(emoji: String, fontSize: TextUnit, modifier: Modifier = Modifier) {
    val scale = remember { Animatable(0.3f) }
    LaunchedEffect(Unit) { scale.animateTo(1f, spring(dampingRatio = 0.45f, stiffness = 320f)) }
    Text(
        text = emoji,
        fontSize = fontSize,
        modifier = modifier.graphicsLayer { scaleX = scale.value; scaleY = scale.value },
    )
}

// ──────────────────────────── Setup ────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NeverHaveIEverSetupScreen(
    players: List<PlayerSeat>,
    content: NhieContent,
    lang: Lang,
    manifest: GameManifest,
    onClose: () -> Unit,
    onStart: (NhieConfig) -> Unit,
) = NhieAccent {
    val palette = LocalPalette.current
    var opts by remember { mutableStateOf(DEFAULT_OPTIONS) }
    var selected by remember { mutableStateOf(players.map { it.id }.toSet()) }
    var showMore by remember { mutableStateOf(false) }

    val seats = players.filter { it.id in selected }
    val config = NhieConfig(players = seats, content = content, lang = lang, options = opts)
    val errors = validateConfig(config)
    val poolSize = content.getDeck(opts.intensities).size
    val poolText = fmtNum(poolSize, lang)

    // Fixed top bar + a scrolling options area + a pinned Start button, so Start is always reachable.
    AppScreen(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose)

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            // Players
            Text(
                text = tr(lang, "Players", "بازیکنان") + " · " + fmtNum(seats.size, lang),
                color = palette.textMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            )
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
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

            // Mode (the primary gameplay choice)
            Text(text = tr(lang, "Mode", "حالت"), color = palette.text, fontSize = 14.sp)
            SegmentedControl(
                value = opts.mode,
                onChange = { opts = opts.copy(mode = it) },
                options = listOf(
                    SegmentOption(NhieMode.CLASSIC, tr(lang, "Classic (lives)", "کلاسیک (جان)")),
                    SegmentOption(NhieMode.POINTS, tr(lang, "Points", "امتیازی")),
                ),
                modifier = Modifier.fillMaxWidth(),
            )

            // More options
            Text(
                text = (if (showMore) "▾ " else "▸ ") + tr(lang, "More options", "گزینه‌های بیشتر"),
                color = palette.textMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(PillShape)
                    .clickable { showMore = !showMore }
                    .padding(vertical = 4.dp),
            )

            if (showMore) {
                // Answer style
                Text(text = tr(lang, "Answer style", "نحوه پاسخ"), color = palette.text, fontSize = 14.sp)
                SegmentedControl(
                    value = opts.revealMode,
                    onChange = { opts = opts.copy(revealMode = it) },
                    options = listOf(
                        SegmentOption(RevealMode.SEQUENTIAL, tr(lang, "Pass & hide", "چرخاندن و پنهان")),
                        SegmentOption(RevealMode.HONOR, tr(lang, "Honor count", "شمارش افتخاری")),
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )

                // Intensity chips
                Text(text = tr(lang, "Intensity", "شدت"), color = palette.text, fontSize = 14.sp)
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    INTENSITIES.forEach { i ->
                        SelectChip(
                            selected = i in opts.intensities,
                            onClick = {
                                opts = opts.copy(
                                    intensities = if (i in opts.intensities) opts.intensities - i else opts.intensities + i,
                                )
                            },
                            text = intensityLabel(i).resolve(lang),
                        )
                    }
                }

                // Lives (classic only)
                if (opts.mode == NhieMode.CLASSIC) {
                    Stepper(
                        label = tr(lang, "Starting lives", "جان اولیه"),
                        value = opts.startingLives,
                        min = 1,
                        max = 20,
                        onValueChange = { opts = opts.copy(startingLives = it) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                // Statements
                Stepper(
                    label = tr(lang, "Statements", "جمله‌ها"),
                    value = opts.deckSize.coerceAtMost(maxOf(1, poolSize)),
                    min = 1,
                    max = maxOf(1, poolSize),
                    onValueChange = { opts = opts.copy(deckSize = it) },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Text(
                text = tr(lang, "$poolText statements available", "$poolText جمله موجود است"),
                color = palette.textMuted,
                fontSize = 14.sp,
            )

            if (errors != null) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    errors.forEach { e ->
                        Text(text = e.resolve(lang), color = Accents.RoseStrong, fontSize = 14.sp)
                    }
                }
            }
        }

        // Pinned Start button — a distinct GOLD accent (the crown colour) so it stands apart from the
        // rose option controls, full width, always reachable at the bottom.
        CompositionLocalProvider(LocalAccent provides ColorToken.GOLD.accent()) {
            AppButton(
                text = tr(lang, "Start", "شروع"),
                onClick = { onStart(config) },
                size = ButtonSize.LG,
                fullWidth = true,
                enabled = errors == null,
            )
        }
        Spacer(Modifier.height(4.dp))
    }
}

// ──────────────────────────── Play ────────────────────────────

@Composable
fun NeverHaveIEverPlayScreen(
    state: NhieState,
    content: NhieContent,
    lang: Lang,
    sound: Sfx,
    haptics: Haptics,
    manifest: GameManifest,
    dispatch: (NhieAction) -> Unit,
    onClose: () -> Unit,
    onRematch: () -> Unit,
) = NhieAccent {
    when (state.phase) {
        NhiePhase.ERROR -> ErrorView(lang, manifest, onClose, onRematch)
        NhiePhase.STATEMENT -> StatementView(state, content, lang, manifest, dispatch, onClose)
        NhiePhase.ANSWERING ->
            if (state.options.revealMode == RevealMode.SEQUENTIAL)
                SequentialView(state, content, lang, sound, haptics, manifest, dispatch, onClose)
            else HonorView(state, content, lang, manifest, dispatch, onClose)
        NhiePhase.REVEAL -> RevealView(state, content, lang, sound, haptics, manifest, dispatch, onClose)
        NhiePhase.RESULTS -> Unit // routed to the Results screen by the host
    }
}

@Composable
private fun ErrorView(lang: Lang, manifest: GameManifest, onClose: () -> Unit, onRematch: () -> Unit) {
    val palette = LocalPalette.current
    AppScreen {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
        Column(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(text = tr(lang, "No statements available", "جمله‌ای موجود نیست"), color = palette.textMuted)
            AppButton(text = tr(lang, "Rematch", "بازی دوباره"), onClick = onRematch)
        }
    }
}

@Composable
private fun StatementView(
    s: NhieState,
    content: NhieContent,
    lang: Lang,
    manifest: GameManifest,
    dispatch: (NhieAction) -> Unit,
    onClose: () -> Unit,
) {
    val palette = LocalPalette.current
    val stmt = s.currentStatementId?.let { content.byId[it] }
    val stmtText = stmt?.text?.resolve(lang) ?: ""
    val roundText = fmtNum(s.roundIndex + 1, lang)
    AppScreen(horizontalAlignment = Alignment.CenterHorizontally) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = { EndGameAction(lang, dispatch) })
        ScoreStrip(s, lang)
        Column(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Chip(text = intensityLabel(stmt?.intensity ?: NhieIntensity.CLASSIC).resolve(lang))
            Text(
                text = tr(lang, "Round $roundText", "دور $roundText"),
                color = palette.textMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
            )
            AppCard(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 40.dp),
            ) {
                Text(
                    text = stmtText,
                    modifier = Modifier.fillMaxWidth(),
                    color = palette.text,
                    fontSize = 28.sp,
                    lineHeight = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center,
                )
            }
            Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AppButton(
                    text = tr(lang, "Start answering", "شروع پاسخ"),
                    onClick = { dispatch(NhieAction.StartAnswering) },
                    size = ButtonSize.LG,
                    fullWidth = true,
                )
                AppButton(
                    text = tr(lang, "Skip", "رد کن"),
                    onClick = { dispatch(NhieAction.SkipStatement) },
                    variant = ButtonVariant.GHOST,
                    fullWidth = true,
                )
            }
        }
    }
}

@Composable
private fun SequentialView(
    s: NhieState,
    content: NhieContent,
    lang: Lang,
    sound: Sfx,
    haptics: Haptics,
    manifest: GameManifest,
    dispatch: (NhieAction) -> Unit,
    onClose: () -> Unit,
) {
    val palette = LocalPalette.current
    val done = allAnswered(s)
    val stmtText = s.currentStatementId?.let { content.byId[it]?.text?.resolve(lang) } ?: ""
    AppScreen {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = { EndGameAction(lang, dispatch) })
        if (done) {
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = tr(lang, "Everyone has answered", "همه پاسخ دادند"),
                    color = palette.textMuted,
                    fontSize = 18.sp,
                )
                AppButton(
                    text = tr(lang, "Reveal results", "نمایش نتیجه"),
                    onClick = { dispatch(NhieAction.ResolveRound) },
                    size = ButtonSize.LG,
                )
            }
        } else {
            val holder = currentHolder(s)
            val holderName = holder?.let { s.playerNames[it] } ?: ""
            var gateOpen by remember(holder) { mutableStateOf(false) }
            Curtain(
                open = gateOpen,
                holderName = holderName,
                hint = tr(lang, "Only $holderName should look", "فقط $holderName باید ببیند"),
                revealLabel = tr(lang, "Tap to reveal", "برای دیدن بزن"),
                // Pass-the-phone secrecy curtain lifts — mirror the web's reveal cue (sound + a firmer
                // haptic than a normal tap) so the holder feels the hand-off.
                onReveal = {
                    sound.play(SoundId.REVEAL)
                    haptics.medium()
                    gateOpen = true
                },
                modifier = Modifier.weight(1f).fillMaxWidth(),
            ) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterVertically),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = stmtText,
                        modifier = Modifier.fillMaxWidth(),
                        color = palette.text,
                        fontSize = 24.sp,
                        lineHeight = 32.sp,
                        fontWeight = FontWeight.ExtraBold,
                        textAlign = TextAlign.Center,
                    )
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        AppButton(
                            text = tr(lang, "I have ✓", "انجام داده‌ام ✓"),
                            onClick = {
                                if (holder != null) dispatch(NhieAction.Answer(holder, true))
                                dispatch(NhieAction.PassToNext)
                            },
                            size = ButtonSize.LG,
                            modifier = Modifier.weight(1f),
                        )
                        AppButton(
                            text = tr(lang, "I have not ✗", "انجام نداده‌ام ✗"),
                            onClick = {
                                if (holder != null) dispatch(NhieAction.Answer(holder, false))
                                dispatch(NhieAction.PassToNext)
                            },
                            variant = ButtonVariant.SECONDARY,
                            size = ButtonSize.LG,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun HonorView(
    s: NhieState,
    content: NhieContent,
    lang: Lang,
    manifest: GameManifest,
    dispatch: (NhieAction) -> Unit,
    onClose: () -> Unit,
) {
    val palette = LocalPalette.current
    val alive = s.players.filter { !it.eliminated }
    var honorSel by remember(s.roundIndex) { mutableStateOf(emptySet<String>()) }
    val stmtText = s.currentStatementId?.let { content.byId[it]?.text?.resolve(lang) } ?: ""
    AppScreen {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = { EndGameAction(lang, dispatch) })
        Column(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = stmtText,
                modifier = Modifier.fillMaxWidth(),
                color = palette.text,
                fontSize = 20.sp,
                lineHeight = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center,
            )
            Text(
                text = tr(lang, "Tap everyone who has", "روی هر کسی که انجام داده بزن") + " · " +
                    tr(lang, "${fmtNum(honorSel.size, lang)} confessed", "${fmtNum(honorSel.size, lang)} اعتراف"),
                modifier = Modifier.fillMaxWidth(),
                color = palette.textMuted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                alive.forEach { p ->
                    SelectChip(
                        selected = p.id in honorSel,
                        onClick = { honorSel = if (p.id in honorSel) honorSel - p.id else honorSel + p.id },
                        text = s.playerNames[p.id] ?: p.id,
                    )
                }
            }
            Spacer(Modifier.weight(1f))
            Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AppButton(
                    text = tr(lang, "Reveal results", "نمایش نتیجه"),
                    onClick = {
                        dispatch(NhieAction.SetHonorHaves(honorSel.toList()))
                        dispatch(NhieAction.ResolveRound)
                    },
                    size = ButtonSize.LG,
                    fullWidth = true,
                )
                AppButton(
                    text = tr(lang, "Nobody", "هیچ‌کس"),
                    onClick = {
                        dispatch(NhieAction.SetHonorHaves(emptyList()))
                        dispatch(NhieAction.ResolveRound)
                    },
                    variant = ButtonVariant.GHOST,
                    fullWidth = true,
                )
            }
        }
    }
}

@Composable
private fun RevealView(
    s: NhieState,
    content: NhieContent,
    lang: Lang,
    sound: Sfx,
    haptics: Haptics,
    manifest: GameManifest,
    dispatch: (NhieAction) -> Unit,
    onClose: () -> Unit,
) {
    val palette = LocalPalette.current
    val lr = s.lastResult
    val haveNames = (lr?.haveIds ?: emptyList()).map { s.playerNames[it] ?: it }
    val justEliminated = (lr?.newlyEliminated ?: emptyList()).toSet()
    val justLost =
        if (s.options.mode == NhieMode.CLASSIC) (lr?.haveIds ?: emptyList()).filter { it !in justEliminated }.toSet()
        else emptySet()
    val stmtText = s.currentStatementId?.let { content.byId[it]?.text?.resolve(lang) } ?: ""

    // The round's stakes landing: one cue per reveal (keyed to the round so it fires once), plus a
    // spring "pop" on the result. Someone knocked out -> a defeat sting + error buzz; a confession ->
    // a wrong/penalty cue + warning; everyone innocent (😇) -> a positive chime + success.
    val pop = remember(s.roundIndex) { Animatable(0.7f) }
    LaunchedEffect(s.roundIndex) {
        when {
            justEliminated.isNotEmpty() -> { sound.play(SoundId.LOSE); haptics.error() }
            haveNames.isNotEmpty() -> { sound.play(SoundId.WRONG); haptics.warning() }
            else -> { sound.play(SoundId.CORRECT); haptics.success() }
        }
        pop.animateTo(1f, spring(dampingRatio = 0.5f, stiffness = 320f))
    }
    AppScreen(horizontalAlignment = Alignment.CenterHorizontally) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = { EndGameAction(lang, dispatch) })
        ScoreStrip(s, lang, justLost = justLost, justEliminated = justEliminated)
        Column(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = stmtText,
                modifier = Modifier.fillMaxWidth(),
                color = palette.text,
                fontSize = 22.sp,
                lineHeight = 30.sp,
                fontWeight = FontWeight.ExtraBold,
                textAlign = TextAlign.Center,
            )
            Column(
                modifier = Modifier.graphicsLayer { scaleX = pop.value; scaleY = pop.value },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (haveNames.isEmpty()) {
                    Text(text = "😇 " + tr(lang, "Everyone's innocent!", "همه پاک‌اند!"), fontSize = 20.sp, color = palette.text)
                } else {
                    Text(text = tr(lang, "Confessed", "اعتراف کردند"), color = palette.textMuted, fontSize = 14.sp)
                    Text(
                        text = haveNames.joinToString("، "),
                        color = palette.text,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        textAlign = TextAlign.Center,
                    )
                    if (lr != null && lr.newlyEliminated.isNotEmpty()) {
                        Text(
                            text = "💀 " + tr(lang, "Out", "حذف") + ": " +
                                lr.newlyEliminated.joinToString("، ") { s.playerNames[it] ?: it },
                            color = Accents.RoseStrong,
                            fontSize = 15.sp,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
            AppButton(
                text = if (s.finished) tr(lang, "See results", "دیدن نتایج") else tr(lang, "Next statement", "جمله بعدی"),
                onClick = { dispatch(NhieAction.NextStatement) },
                size = ButtonSize.LG,
                fullWidth = true,
            )
        }
    }
}

/** Per-player lives/skull/confession pips — a port of the web `ScoreStrip`. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ScoreStrip(
    s: NhieState,
    lang: Lang,
    justLost: Set<String> = emptySet(),
    justEliminated: Set<String> = emptySet(),
) {
    val palette = LocalPalette.current
    val classic = s.options.mode == NhieMode.CLASSIC
    FlowRow(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        s.players.forEach { p ->
            val name = s.playerNames[p.id] ?: p.id
            Row(
                modifier = Modifier
                    .graphicsLayer { alpha = if (p.eliminated) 0.4f else 1f }
                    .clip(PillShape)
                    .background(palette.surface2, PillShape)
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(text = name, color = palette.text, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                when {
                    p.eliminated ->
                        if (p.id in justEliminated) PopEmoji("💀", 14.sp) else Text("💀", fontSize = 14.sp)
                    classic -> {
                        Text(
                            text = if (p.lives <= 5) "❤️".repeat(p.lives.coerceAtLeast(0)) else "❤️ " + fmtNum(p.lives, lang),
                            fontSize = 12.sp,
                        )
                        if (p.id in justLost) PopEmoji("💔", 14.sp)
                    }
                    else -> Text(text = "· " + fmtNum(p.haveCount, lang), color = palette.textMuted, fontSize = 12.sp)
                }
            }
        }
    }
}

// ──────────────────────────── Results ────────────────────────────

@Composable
fun NeverHaveIEverResultsScreen(
    state: NhieState,
    lang: Lang,
    sound: Sfx,
    haptics: Haptics,
    manifest: GameManifest,
    onClose: () -> Unit,
    onExit: () -> Unit,
    onRematch: () -> Unit,
) = NhieAccent {
    val palette = LocalPalette.current
    val s = state
    val classic = s.options.mode == NhieMode.CLASSIC

    // Victory flourish once the results land — pairs with the WinnerBanner's spring-in / confetti.
    LaunchedEffect(Unit) {
        sound.play(SoundId.WIN)
        haptics.success()
    }
    val winnerNames = s.winnerIds.map { s.playerNames[it] ?: it }
    val title =
        if (s.winnerIds.size > 1) tr(lang, "It's a tie!", "مساوی شد!")
        else tr(lang, "${winnerNames.firstOrNull() ?: ""} wins!", "${winnerNames.firstOrNull() ?: ""} برنده شد!")

    val ranked = rankPlayers(s)
    val rows = ranked.mapIndexed { i, p ->
        val score = if (classic) p.lives else p.haveCount
        ScoreRow(
            id = p.id,
            label = s.playerNames[p.id] ?: p.id,
            score = score,
            rank = i + 1,
            display = fmtNum(score, lang),
        )
    }

    AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
        WinnerBanner(title = title, names = winnerNames)
        Text(
            text = if (classic) tr(lang, "Lives remaining", "جان باقی‌مانده")
            else tr(lang, "Confessions (fewer is better)", "اعتراف‌ها (کمتر بهتر است)"),
            modifier = Modifier.fillMaxWidth(),
            color = palette.textMuted,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
        )
        Leaderboard(rows = rows)
        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            AppButton(text = tr(lang, "Rematch", "بازی دوباره"), onClick = onRematch, size = ButtonSize.LG, fullWidth = true)
            AppButton(text = tr(lang, "Home", "خانه"), onClick = onExit, variant = ButtonVariant.SECONDARY, fullWidth = true)
        }
        Spacer(Modifier.padding(bottom = 8.dp))
    }
}
