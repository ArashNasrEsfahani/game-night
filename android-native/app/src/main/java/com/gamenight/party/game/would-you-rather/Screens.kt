package com.gamenight.party.game.wouldyourather

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.game.GameHost
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.SetupErrors
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.AppToggle
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.Curtain
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.EndGameButton
import com.gamenight.party.ui.components.Leaderboard
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
import com.gamenight.party.ui.screens.faDigits
import com.gamenight.party.ui.screens.fmtNum
import kotlin.random.Random
import kotlinx.coroutines.delay

/**
 * The three "Would You Rather" screens — built from the shared Disco Persian component library and
 * mirroring src/games/would-you-rather/screens/(tsx files). Each is wrapped in [WyrScope] so [LocalAccent]
 * reflects this game's manifest colour (teal), recolouring every control automatically.
 */

/** This game's manifest accent (mirrors GameCatalog `would-you-rather` → ColorToken.TEAL). */
private val WYR_ACCENT: ColorToken = ColorToken.TEAL

@Composable
private fun WyrScope(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalAccent provides WYR_ACCENT.accent(), content = content)
}

// ──────────────────────────── Setup ────────────────────────────

@Composable
fun WouldYouRatherSetupScreen(
    content: WyrContent,
    players: List<PlayerSeat>,
    host: GameHost,
    onStart: (WyrState) -> Unit,
) = WyrScope {
    val lang = host.lang
    val palette = LocalPalette.current
    var opts by remember { mutableStateOf(DEFAULT_OPTIONS) }
    var selected by remember(players) { mutableStateOf(players.map { it.id }.toSet()) }

    val seats = players.filter { it.id in selected }
    val config = WyrConfig(players = seats, content = content, lang = lang, options = opts)
    val errors = validateConfig(config)
    val poolSize = content.poolFor(opts.deckId, opts.maxIntensity).size

    AppScreen {
        GameAppBar(manifest = host.manifest, lang = lang, onClose = host::requestExit)

        // The options scroll; the Start CTA below stays pinned and always reachable.
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Players
            OptionGroup("${WyrStrings.players.resolve(lang)} · ${fmtNum(seats.size, lang)}") {
                players.chunked(3).forEach { rowPlayers ->
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        rowPlayers.forEach { p ->
                            SelectChip(
                                selected = p.id in selected,
                                onClick = { selected = if (p.id in selected) selected - p.id else selected + p.id },
                                text = displayName(p),
                                modifier = Modifier.weight(1f),
                            )
                        }
                        repeat(3 - rowPlayers.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }

            // Deck (primary choice)
            OptionGroup(WyrStrings.deck.resolve(lang)) {
                SegmentedControl(
                    options = content.decks.map { SegmentOption(it.id, it.name.resolve(lang)) },
                    value = opts.deckId,
                    onChange = { opts = opts.copy(deckId = it) },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            // More options
            Text(
                text = WyrStrings.moreOptions.resolve(lang),
                color = palette.textMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
            )

            OptionGroup(WyrStrings.intensityLabel.resolve(lang)) {
                SegmentedControl(
                    options = INTENSITY_ORDER.map { SegmentOption(it, intensityLabel(it).resolve(lang)) },
                    value = opts.maxIntensity,
                    onChange = { opts = opts.copy(maxIntensity = it) },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            OptionGroup(WyrStrings.modeLabel.resolve(lang)) {
                SegmentedControl(
                    options = listOf(
                        SegmentOption(WyrMode.VOTE, WyrStrings.modeVote.resolve(lang)),
                        SegmentOption(WyrMode.QUICK, WyrStrings.modeQuick.resolve(lang)),
                    ),
                    value = opts.mode,
                    onChange = { opts = opts.copy(mode = it) },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            OptionGroup(WyrStrings.length.resolve(lang)) {
                val lenValue = if (opts.roundLength >= 999) "all" else opts.roundLength.toString()
                SegmentedControl(
                    options = listOf("5", "10", "15", "20").map { SegmentOption(it, faDigits(it, lang)) } +
                        SegmentOption("all", WyrStrings.all.resolve(lang)),
                    value = lenValue,
                    onChange = { v -> opts = opts.copy(roundLength = if (v == "all") 999 else v.toInt()) },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            AppToggle(
                checked = opts.awardMajorityPoints,
                onCheckedChange = { opts = opts.copy(awardMajorityPoints = it) },
                label = WyrStrings.awardPoints.resolve(lang),
            )
            if (opts.awardMajorityPoints && opts.mode == WyrMode.VOTE) {
                AppToggle(
                    checked = opts.tieCountsForBoth,
                    onCheckedChange = { opts = opts.copy(tieCountsForBoth = it) },
                    label = WyrStrings.tieCountsForBoth.resolve(lang),
                )
            }

            Text(
                text = WyrStrings.poolSize(lang, poolSize),
                color = palette.textMuted,
                fontSize = 14.sp,
            )

            SetupErrors(errors = errors, lang = lang)
        }

        // Pinned, full-width primary CTA. A distinct GOLD accent (overriding the teal game accent the
        // option controls use) makes Start stand out from every other control on the page.
        Spacer(Modifier.height(12.dp))
        CompositionLocalProvider(LocalAccent provides ColorToken.GOLD.accent()) {
            AppButton(
                text = WyrStrings.start.resolve(lang),
                onClick = { onStart(createInitialState(config, Random.nextInt())) },
                enabled = errors == null,
                fullWidth = true,
                size = ButtonSize.LG,
            )
        }
    }
}

// ──────────────────────────── Play ────────────────────────────

@Composable
fun WouldYouRatherPlayScreen(
    state: WyrState,
    content: WyrContent,
    host: GameHost,
    dispatch: (WyrAction) -> Unit,
    onPlayAgain: () -> Unit,
) = WyrScope {
    val s = state
    val lang = host.lang
    val palette = LocalPalette.current
    val accent = LocalAccent.current

    // Hooks declared unconditionally (stable call order across recompositions).
    val voterId = currentVoterId(s)
    var gateOpen by remember { mutableStateOf(false) }
    LaunchedEffect(voterId) { gateOpen = false }
    var qa by remember { mutableStateOf(0) }
    var qb by remember { mutableStateOf(0) }
    LaunchedEffect(s.phase, s.index) {
        if (s.phase == WyrPhase.COLLECTING) {
            qa = 0
            qb = 0
        }
    }

    val item = currentItemId(s)?.let { content.itemById[it] }
    val a = item?.optionA?.resolve(lang) ?: ""
    val b = item?.optionB?.resolve(lang) ?: ""

    // Active-play header: the shared game chrome (gold game name, built-in how-to-play, host-confirmed
    // close) plus an "End game" trailing action that ends the match and jumps to Results-so-far.
    val header: @Composable () -> Unit = {
        GameAppBar(
            manifest = host.manifest,
            lang = lang,
            onClose = host::requestExit,
            trailing = if (s.history.isNotEmpty()) {
                {
                    EndGameButton(lang = lang, onEndGame = { dispatch(WyrAction.EndGame) })
                }
            } else {
                null
            },
        )
    }

    when {
        // ── Error ──
        s.phase == WyrPhase.ERROR -> AppScreen(horizontalAlignment = Alignment.CenterHorizontally) {
            header()
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = WyrStrings.errorDeck.resolve(lang),
                    modifier = Modifier.fillMaxWidth(),
                    color = palette.textMuted,
                    textAlign = TextAlign.Center,
                )
                AppButton(text = WyrStrings.playAgain.resolve(lang), onClick = onPlayAgain, size = ButtonSize.LG)
            }
        }

        // ── Prompt ──
        s.phase == WyrPhase.PROMPT -> AppScreen(horizontalAlignment = Alignment.CenterHorizontally) {
            header()
            Text(
                text = WyrStrings.progress(lang, s.index + 1, s.total),
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                color = palette.textMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = WyrStrings.wouldYouRather.resolve(lang),
                    color = palette.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                )
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    OptionCard("A", a)
                    OrBadge(WyrStrings.or.resolve(lang))
                    OptionCard("B", b)
                }
                Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    AppButton(
                        text = if (s.options.mode == WyrMode.VOTE) WyrStrings.startVoting.resolve(lang)
                        else WyrStrings.countHands.resolve(lang),
                        onClick = {
                            host.haptics.medium()
                            dispatch(WyrAction.BeginCollection)
                        },
                        fullWidth = true,
                        size = ButtonSize.LG,
                    )
                    AppButton(
                        text = WyrStrings.skip.resolve(lang),
                        onClick = { dispatch(WyrAction.Skip) },
                        variant = ButtonVariant.GHOST,
                        fullWidth = true,
                    )
                }
            }
        }

        // ── Collecting (pass & hide vote) ──
        s.phase == WyrPhase.COLLECTING && s.options.mode == WyrMode.VOTE -> {
            if (everyoneVoted(s)) {
                AppScreen(horizontalAlignment = Alignment.CenterHorizontally) {
                    header()
                    Column(
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = WyrStrings.passBack.resolve(lang),
                            modifier = Modifier.fillMaxWidth(),
                            color = palette.textMuted,
                            fontSize = 18.sp,
                            textAlign = TextAlign.Center,
                        )
                        AppButton(
                            text = WyrStrings.revealSplit.resolve(lang),
                            onClick = {
                                host.haptics.medium()
                                dispatch(WyrAction.Reveal)
                            },
                            size = ButtonSize.LG,
                        )
                    }
                }
            } else {
                val voterName = voterId?.let { s.playerNames[it] } ?: ""
                AppScreen(horizontalAlignment = Alignment.CenterHorizontally) {
                    header()
                    Text(
                        text = WyrStrings.votedProgress(lang, s.handoffIndex, s.playerIds.size),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        color = palette.textMuted,
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center,
                    )
                    Curtain(
                        open = gateOpen,
                        holderName = voterName,
                        hint = WyrStrings.imReady(lang, voterName),
                        revealLabel = WyrStrings.reveal.resolve(lang),
                        onReveal = {
                            host.sound.play(SoundId.REVEAL)
                            host.haptics.light()
                            gateOpen = true
                        },
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                    ) {
                        Column(
                            modifier = Modifier.weight(1f).fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                text = WyrStrings.wouldYouRather.resolve(lang),
                                modifier = Modifier.fillMaxWidth(),
                                color = palette.text,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                textAlign = TextAlign.Center,
                            )
                            OptionButtons(a = a, b = b) { side ->
                                host.haptics.medium()
                                voterId?.let { dispatch(WyrAction.Choose(it, side)) }
                                dispatch(WyrAction.AdvanceHandoff)
                            }
                        }
                    }
                }
            }
        }

        // ── Collecting (count hands) ──
        s.phase == WyrPhase.COLLECTING && s.options.mode == WyrMode.QUICK -> AppScreen {
            header()
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            ) {
                Text(
                    text = WyrStrings.wouldYouRather.resolve(lang),
                    modifier = Modifier.fillMaxWidth(),
                    color = palette.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    textAlign = TextAlign.Center,
                )
                AppCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = a,
                        modifier = Modifier.fillMaxWidth(),
                        color = palette.text,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp,
                        textAlign = TextAlign.Center,
                    )
                }
                Stepper(
                    label = WyrStrings.handsForA.resolve(lang),
                    value = qa,
                    min = 0,
                    max = s.playerIds.size,
                    onValueChange = { qa = it },
                )
                AppCard(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = b,
                        modifier = Modifier.fillMaxWidth(),
                        color = palette.text,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp,
                        textAlign = TextAlign.Center,
                    )
                }
                Stepper(
                    label = WyrStrings.handsForB.resolve(lang),
                    value = qb,
                    min = 0,
                    max = s.playerIds.size,
                    onValueChange = { qb = it },
                )
                AppButton(
                    text = WyrStrings.revealSplit.resolve(lang),
                    onClick = {
                        host.haptics.medium()
                        dispatch(WyrAction.SetQuickCounts(qa, qb))
                        dispatch(WyrAction.Reveal)
                    },
                    enabled = qa + qb > 0,
                    fullWidth = true,
                    size = ButtonSize.LG,
                )
            }
        }

        // ── Reveal ──
        else -> {
            val cur = s.current ?: RoundCurrent(0, 0, Majority.TIE)
            val totalVotes = (cur.countA + cur.countB).coerceAtLeast(1)
            val fractionA = (cur.countA.toFloat() / totalVotes).coerceAtLeast(0.2f)
            val animFractionA by animateFloatAsState(targetValue = fractionA, animationSpec = tween(600), label = "barA")
            val last = s.index + 1 >= s.total
            val majorityText = when (cur.majority) {
                Majority.TIE -> WyrStrings.tie.resolve(lang)
                Majority.A -> "$a ✓"
                Majority.B -> "$b ✓"
            }
            // Whoosh when the split appears, then spring the verdict in once the bar settles
            // (mirrors the web reveal: bar grows over ~0.6s, then the majority text pops).
            val verdictPop = remember(s.index) { Animatable(0f) }
            LaunchedEffect(s.index) {
                host.sound.play(SoundId.REVEAL)
                delay(450)
                verdictPop.animateTo(1f, spring(dampingRatio = 0.8f, stiffness = 240f))
            }
            AppScreen {
                header()
                Column(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                ) {
                    Text(
                        text = WyrStrings.wouldYouRather.resolve(lang),
                        modifier = Modifier.fillMaxWidth(),
                        color = palette.textMuted,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                    )
                    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth(animFractionA)
                                .background(Brush.linearGradient(listOf(accent.base, accent.strong)))
                                .padding(horizontal = 16.dp, vertical = 16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = a,
                                modifier = Modifier.weight(1f),
                                color = accent.onAccent,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                text = fmtNum(cur.countA, lang),
                                modifier = Modifier.padding(start = 8.dp),
                                color = accent.onAccent,
                                fontWeight = FontWeight.Black,
                            )
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(palette.surface2)
                                .padding(horizontal = 16.dp, vertical = 16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = b,
                                modifier = Modifier.weight(1f),
                                color = palette.text,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                text = fmtNum(cur.countB, lang),
                                modifier = Modifier.padding(start = 8.dp),
                                color = palette.text,
                                fontWeight = FontWeight.Black,
                            )
                        }
                    }
                    Text(
                        text = majorityText,
                        modifier = Modifier
                            .fillMaxWidth()
                            .graphicsLayer {
                                alpha = verdictPop.value
                                val sc = 0.85f + 0.15f * verdictPop.value
                                scaleX = sc
                                scaleY = sc
                            },
                        color = palette.text,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 18.sp,
                        textAlign = TextAlign.Center,
                    )
                    item?.note?.let { note ->
                        Text(
                            text = note.resolve(lang),
                            modifier = Modifier.fillMaxWidth(),
                            color = palette.textMuted,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                        )
                    }
                    AppButton(
                        text = if (last) WyrStrings.seeResults.resolve(lang) else WyrStrings.next.resolve(lang),
                        onClick = {
                            host.haptics.medium()
                            dispatch(WyrAction.Next)
                        },
                        fullWidth = true,
                        size = ButtonSize.LG,
                    )
                }
            }
        }
    }
}

// ──────────────────────────── Results ────────────────────────────

@Composable
fun WouldYouRatherResultsScreen(
    state: WyrState,
    host: GameHost,
    onExit: () -> Unit,
    onPlayAgain: () -> Unit,
) = WyrScope {
    val s = state
    val lang = host.lang
    val palette = LocalPalette.current
    // Celebrate when the results land (mirrors the web ResultsScreen's `sound.play('win')`).
    LaunchedEffect(Unit) {
        host.sound.play(SoundId.WIN)
        host.haptics.success()
    }
    val scored = s.options.awardMajorityPoints && s.options.mode == WyrMode.VOTE
    val winners = computeWinners(s)
    val winnerNames = winners.map { s.playerNames[it] ?: it }
    val sides = sideWins(s)
    val rows = standings(s).map { r ->
        ScoreRow(
            id = r.id,
            label = s.playerNames[r.id] ?: r.id,
            score = r.score,
            rank = r.rank,
            color = s.playerColors[r.id],
            display = fmtNum(r.score, lang),
        )
    }

    AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        GameAppBar(manifest = host.manifest, lang = lang, onClose = host::requestExit)

        if (scored && winners.isNotEmpty()) {
            WinnerBanner(
                title = if (winners.size > 1) WyrStrings.resultsTie.resolve(lang)
                else WyrStrings.resultsWinner(lang, winnerNames.firstOrNull() ?: ""),
                names = winnerNames,
                tie = winners.size > 1,
            )
            Text(
                text = WyrStrings.mostInStep.resolve(lang),
                modifier = Modifier.fillMaxWidth(),
                color = palette.textMuted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
            Leaderboard(rows = rows)
        } else {
            AppCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues(20.dp)) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(text = "🗳️", fontSize = 48.sp)
                    Text(
                        text = WyrStrings.sideWins(lang, sides.first, sides.second),
                        modifier = Modifier.fillMaxWidth(),
                        color = palette.text,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 20.sp,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        text = WyrStrings.recap(lang, s.history.size),
                        modifier = Modifier.fillMaxWidth(),
                        color = palette.textMuted,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }

        Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            AppButton(
                text = WyrStrings.playAgain.resolve(lang),
                onClick = onPlayAgain,
                fullWidth = true,
                size = ButtonSize.LG,
            )
            AppButton(
                text = WyrStrings.home.resolve(lang),
                onClick = onExit,
                variant = ButtonVariant.SECONDARY,
                fullWidth = true,
            )
        }
        Spacer(Modifier.height(8.dp))
    }
}

// ──────────────────────────── Small building blocks ────────────────────────────

private fun displayName(p: PlayerSeat): String =
    if (p.emoji != null) "${p.emoji} ${p.name}" else p.name

@Composable
private fun OptionGroup(label: String, content: @Composable ColumnScope.() -> Unit) {
    val palette = LocalPalette.current
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(text = label, color = palette.textMuted, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
        content()
    }
}

/** A labelled option card — the A/B badge gives each side identity (mirrors the web `OptionCard`). */
@Composable
private fun OptionCard(letter: String, text: String) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    Box(modifier = Modifier.fillMaxWidth()) {
        AppCard(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 24.dp),
        ) {
            Text(
                text = text,
                modifier = Modifier.fillMaxWidth(),
                color = palette.text,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 20.sp,
                textAlign = TextAlign.Center,
            )
        }
        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(8.dp)
                .size(24.dp)
                .clip(CircleShape)
                .background(palette.surface2),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = letter, color = accent.strong, fontWeight = FontWeight.Black, fontSize = 12.sp)
        }
    }
}

/** The overlapping "OR" pip between the two option cards. */
@Composable
private fun OrBadge(label: String) {
    val accent = LocalAccent.current
    Box(
        modifier = Modifier.size(40.dp).clip(CircleShape).background(accent.strong),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = label, color = accent.onAccent, fontWeight = FontWeight.Black, fontSize = 14.sp)
    }
}

/** A/B pick buttons for the secret pass-and-hide vote (mirrors the web `OptionButtons`). */
@Composable
private fun OptionButtons(a: String, b: String, onPick: (Side) -> Unit) {
    val palette = LocalPalette.current
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AppButton(text = a, onClick = { onPick(Side.A) }, fullWidth = true, size = ButtonSize.LG)
        Text(
            text = "—",
            modifier = Modifier.fillMaxWidth(),
            color = palette.textMuted,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
        AppButton(text = b, onClick = { onPick(Side.B) }, variant = ButtonVariant.SECONDARY, fullWidth = true, size = ButtonSize.LG)
    }
}
