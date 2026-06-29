@file:OptIn(ExperimentalLayoutApi::class)

package com.gamenight.party.game.mostlikelyto

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.game.GameHost
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.SetupErrors
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.AppToggle
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.CardShape
import com.gamenight.party.ui.components.Chip
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
import com.gamenight.party.ui.components.pressScale
import com.gamenight.party.ui.components.screenEntrance
import com.gamenight.party.ui.identity.Motif
import com.gamenight.party.ui.screens.fmtNum
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.Display
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent
import kotlin.random.Random

/**
 * The three native screens for "Most Likely To" — a Compose port of
 * src/games/most-likely-to/screens/{Setup,Play,Results}Screen.tsx built on the shared UI library.
 * Each wraps its content so [LocalAccent] reflects this game's manifest colour (tangerine).
 */

/** This game's manifest accent (matches GameCatalog: most-likely-to → tangerine). */
private val ACCENT = ColorToken.TANGERINE

/** Tiny bilingual chrome helper (UI text is not stored as bilingual content). */
private fun tx(lang: Lang, en: String, fa: String): String = if (lang == Lang.FA) fa else en

// ──────────────────────────── Setup ────────────────────────────

@Composable
fun MostLikelyToSetupScreen(
    roster: List<PlayerSeat>,
    content: MltContent,
    host: GameHost,
    onStart: (MltConfig) -> Unit,
) {
    CompositionLocalProvider(LocalAccent provides ACCENT.accent()) {
        val palette = LocalPalette.current
        val lang = host.lang

        var opts by remember { mutableStateOf(DEFAULT_OPTIONS) }
        var selected by remember { mutableStateOf(roster.map { it.id }.toSet()) }

        val selectedSeats = roster.filter { it.id in selected }
        val poolSize = content.getPool(opts.deckId, opts.intensity).size
        val maxRounds = maxOf(1, poolSize)
        val config = MltConfig(players = selectedSeats, content = content, lang = lang, options = opts)
        val errors = validateConfig(config)

        AppScreen {
            GameAppBar(manifest = host.manifest, lang = lang, onClose = host::requestExit, back = true)

            // The options scroll between the fixed top bar and the pinned Start button below, so the
            // primary CTA stays reachable no matter how long the list grows.
            Column(
                modifier = Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                // Players
                FieldLabel("${tx(lang, "Players", "بازیکنان")} · ${fmtNum(selectedSeats.size, lang)}")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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

                // Deck (primary choice)
                FieldLabel(tx(lang, "Deck", "دسته"))
                SegmentedControl(
                    options = content.decks.map { SegmentOption(it.id, it.name.resolve(lang)) },
                    value = opts.deckId,
                    onChange = { opts = opts.copy(deckId = it) },
                )

                // More options
                Text(
                    text = tx(lang, "More options", "گزینه‌های بیشتر"),
                    color = palette.textMuted,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 6.dp),
                )

                FieldLabel(tx(lang, "Intensity", "شدت"))
                SegmentedControl(
                    options = INTENSITIES.map { SegmentOption(it, intensityLabel(it).resolve(lang)) },
                    value = opts.intensity,
                    onChange = { opts = opts.copy(intensity = it) },
                )

                FieldLabel(tx(lang, "Voting style", "نحوه رأی"))
                SegmentedControl(
                    options = listOf(
                        SegmentOption(VotingStyle.PASS_DEVICE, tx(lang, "Pass & hide", "چرخاندن و پنهان")),
                        SegmentOption(VotingStyle.SIMULTANEOUS, tx(lang, "Count out loud", "شمارش بلند")),
                    ),
                    value = opts.votingStyle,
                    onChange = { opts = opts.copy(votingStyle = it) },
                )

                Stepper(
                    label = tx(lang, "Rounds", "دورها"),
                    value = opts.roundCount.coerceIn(1, maxRounds),
                    min = 1,
                    max = maxRounds,
                    onValueChange = { opts = opts.copy(roundCount = it) },
                )

                AppToggle(
                    label = tx(lang, "Allow voting for yourself", "رأی به خود مجاز است"),
                    checked = opts.allowSelfVote,
                    onCheckedChange = { opts = opts.copy(allowSelfVote = it) },
                )
                AppToggle(
                    label = tx(lang, "Show running scores", "نمایش امتیاز لحظه‌ای"),
                    checked = opts.showRunningScores,
                    onCheckedChange = { opts = opts.copy(showRunningScores = it) },
                )

                FieldLabel(tx(lang, "Ties", "تساوی"))
                SegmentedControl(
                    options = listOf(
                        SegmentOption(TieBreak.CO_WINNERS, tx(lang, "Co-winners", "برندگان مشترک")),
                        SegmentOption(TieBreak.RANDOM, tx(lang, "Pick one", "یکی انتخاب شود")),
                    ),
                    value = opts.tieBreak,
                    onChange = { opts = opts.copy(tieBreak = it) },
                )

                Text(
                    text = tx(
                        lang,
                        "≈ ${fmtNum(poolSize, lang)} prompts available",
                        "حدود ${fmtNum(poolSize, lang)} سوال موجود است",
                    ),
                    color = palette.textMuted,
                    fontSize = 13.sp,
                )

                SetupErrors(errors = errors, lang = lang)
            }

            // Pinned primary CTA — a distinct SUCCESS (lime) gradient that stands apart from the
            // tangerine option controls, full width and always reachable at the foot of the screen.
            AppButton(
                text = tx(lang, "Start", "شروع"),
                onClick = { onStart(config) },
                variant = ButtonVariant.SUCCESS,
                size = ButtonSize.LG,
                fullWidth = true,
                enabled = errors == null,
                modifier = Modifier.padding(top = 12.dp, bottom = 8.dp),
            )
        }
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(
        text = text,
        color = LocalPalette.current.text,
        fontSize = 14.sp,
        fontWeight = FontWeight.Medium,
    )
}

// ──────────────────────────── Play ────────────────────────────

@Composable
fun MostLikelyToPlayScreen(
    state: MltState,
    content: MltContent,
    dispatch: (MltAction) -> Unit,
    host: GameHost,
) {
    CompositionLocalProvider(LocalAccent provides ACCENT.accent()) {
        val palette = LocalPalette.current
        val lang = host.lang

        var gateOpen by remember { mutableStateOf(false) }
        val voterId = currentVoterId(state)
        LaunchedEffect(voterId) { gateOpen = false }

        var tally by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
        LaunchedEffect(state.phase, state.currentRound) {
            if (state.phase == MltPhase.VOTING && state.options.votingStyle == VotingStyle.SIMULTANEOUS) {
                tally = state.playerIds.associateWith { 0 }
            }
        }

        val promptId = currentPromptId(state)
        val prompt = promptId?.let { content.promptById[it] }
        val promptText = prompt?.text?.resolve(lang) ?: ""
        val kicker = tx(
            lang,
            "Round ${fmtNum(state.currentRound + 1, lang)} of ${fmtNum(state.orderedPromptIds.size, lang)}",
            "دور ${fmtNum(state.currentRound + 1, lang)} از ${fmtNum(state.orderedPromptIds.size, lang)}",
        )
        val passDevice = state.options.votingStyle == VotingStyle.PASS_DEVICE

        // Shared in-match chrome: lets the host end the match early once at least one round is in,
        // jumping straight to the Results screen with the standings so far.
        val header: @Composable () -> Unit = {
            GameAppBar(
                manifest = host.manifest,
                lang = lang,
                onClose = host::requestExit,
                trailing = if (state.rounds.isNotEmpty()) {
                    {
                        EndGameButton(lang = lang, onEndGame = { dispatch(MltAction.EndGame) })
                    }
                } else {
                    null
                },
            )
        }

        when {
            // Error (unreachable through the guarded Setup, but kept faithful).
            state.phase == MltPhase.ERROR -> AppScreen {
                header()
                Column(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                ) {
                    Text(tx(lang, "No prompts available", "سوالی موجود نیست"), color = palette.textMuted)
                    AppButton(text = tx(lang, "Home", "خانه"), onClick = host::exit)
                }
            }

            // Prompt
            state.phase == MltPhase.PROMPT -> AppScreen {
                header()
                ScoreStrip(state, lang)
                Column(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically),
                ) {
                    key(promptId) {
                        PromptCard(text = promptText, emoji = prompt?.emoji ?: "👉", kicker = kicker, compact = false)
                    }
                    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        AppButton(
                            text = tx(lang, "Start voting", "شروع رأی‌گیری"),
                            onClick = { dispatch(MltAction.BeginVoting) },
                            size = ButtonSize.LG,
                            fullWidth = true,
                        )
                        if (state.poolNextIndex < state.pool.size) {
                            AppButton(
                                text = tx(lang, "Skip", "رد کن"),
                                onClick = { dispatch(MltAction.SkipPrompt) },
                                variant = ButtonVariant.GHOST,
                                fullWidth = true,
                            )
                        }
                    }
                }
            }

            // Pass-device voting — all votes in
            state.phase == MltPhase.VOTING && passDevice && allVoted(state) -> AppScreen {
                header()
                Column(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                ) {
                    Text(
                        text = tx(lang, "All votes are in", "همه رأی دادند"),
                        color = palette.textMuted,
                        fontSize = 18.sp,
                    )
                    AppButton(
                        text = tx(lang, "Reveal", "نمایش"),
                        onClick = { dispatch(MltAction.SubmitVotes(seed = Random.nextInt())) },
                        size = ButtonSize.LG,
                    )
                    AppButton(
                        text = tx(lang, "Undo last vote", "برگرداندن رأی آخر"),
                        onClick = { dispatch(MltAction.UndoLastVote) },
                        variant = ButtonVariant.GHOST,
                    )
                }
            }

            // Pass-device voting — secrecy curtain + pick grid
            state.phase == MltPhase.VOTING && passDevice -> {
                val voterName = voterId?.let { state.playerNames[it] } ?: ""
                AppScreen {
                    header()
                    Text(
                        text = tx(
                            lang,
                            "${fmtNum(state.activeVoterIndex ?: 0, lang)} / ${fmtNum(state.playerIds.size, lang)} voted",
                            "${fmtNum(state.activeVoterIndex ?: 0, lang)} از ${fmtNum(state.playerIds.size, lang)} رأی دادند",
                        ),
                        color = palette.textMuted,
                        fontSize = 12.sp,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        textAlign = TextAlign.Center,
                    )
                    Curtain(
                        open = gateOpen,
                        hint = tx(lang, "Only $voterName should look", "فقط $voterName باید ببیند"),
                        revealLabel = tx(lang, "Reveal", "نمایش"),
                        onReveal = { gateOpen = true },
                        holderName = voterName,
                        modifier = Modifier.fillMaxWidth().weight(1f),
                    ) {
                        Column(
                            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                        ) {
                            PromptCard(text = promptText, emoji = null, kicker = null, compact = true)
                            Text(
                                text = tx(lang, "Tap who you're voting for", "به کی رأی می‌دی؟"),
                                color = palette.textMuted,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.Center,
                            )
                            VoteGrid(
                                playerIds = state.playerIds,
                                names = state.playerNames,
                                disabledId = if (!state.options.allowSelfVote) voterId else null,
                                onPick = { id ->
                                    host.sound.play(SoundId.SELECT)
                                    host.haptics.light()
                                    if (voterId != null) dispatch(MltAction.CastVote(voterId = voterId, targetId = id))
                                },
                            )
                        }
                    }
                }
            }

            // Simultaneous voting — enter the tally
            state.phase == MltPhase.VOTING -> {
                val total = tally.values.sum()
                AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    header()
                    PromptCard(text = promptText, emoji = null, kicker = null, compact = true)
                    Text(
                        text = tx(lang, "Enter how many votes each player got", "تعداد رأی هر بازیکن را وارد کن"),
                        color = palette.textMuted,
                        fontSize = 14.sp,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        state.playerIds.forEach { id ->
                            Stepper(
                                label = state.playerNames[id] ?: id,
                                value = tally[id] ?: 0,
                                min = 0,
                                max = state.playerIds.size,
                                onValueChange = { v -> tally = tally + (id to v) },
                            )
                        }
                    }
                    Text(
                        text = tx(
                            lang,
                            "${fmtNum(total, lang)} votes · ${fmtNum(state.playerIds.size, lang)} players",
                            "${fmtNum(total, lang)} رأی · ${fmtNum(state.playerIds.size, lang)} بازیکن",
                        ),
                        color = palette.textMuted,
                        fontSize = 12.sp,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                    )
                    AppButton(
                        text = tx(lang, "Reveal", "نمایش"),
                        onClick = { dispatch(MltAction.SubmitVotes(tally = tally, seed = Random.nextInt())) },
                        size = ButtonSize.LG,
                        fullWidth = true,
                    )
                    Spacer(Modifier.height(8.dp))
                }
            }

            // Reveal (and the transient FINISHED frame)
            else -> {
                val round = state.rounds.lastOrNull()
                val winnerNames = (round?.winnerIds ?: emptyList()).map { state.playerNames[it] ?: it }
                val isLast = state.currentRound + 1 >= state.orderedPromptIds.size
                // Reveal sting (mirrors the web's ctx.sound.play('reveal')); a winner lands on success.
                LaunchedEffect(state.currentRound) {
                    host.sound.play(SoundId.REVEAL)
                    if (winnerNames.isEmpty()) host.haptics.light() else host.haptics.success()
                }
                AppScreen {
                    header()
                    ScoreStrip(state, lang)
                    Column(
                        modifier = Modifier.fillMaxWidth().weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                    ) {
                        PromptCard(text = promptText, emoji = null, kicker = kicker, compact = true)
                        if (winnerNames.isEmpty()) {
                            Text(
                                text = "🤷 " + tx(lang, "No clear answer — everyone's safe!", "پاسخ روشنی نبود — همه در امان‌اند!"),
                                color = palette.text,
                                fontSize = 18.sp,
                                textAlign = TextAlign.Center,
                            )
                        } else {
                            Column(
                                modifier = Modifier.screenEntrance(translateY = 4.dp, fromScale = 0.6f, durationMillis = 460),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(4.dp),
                            ) {
                                Text(text = "🎉", fontSize = 44.sp)
                                Text(
                                    text = winnerNames.joinToString("، "),
                                    color = LocalAccent.current.base,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 24.sp,
                                    textAlign = TextAlign.Center,
                                )
                                val subtitle = buildString {
                                    append(
                                        if (winnerNames.size > 1) tx(lang, "It's a tie!", "مساوی شد!")
                                        else tx(lang, "is most likely!", "به احتمال زیاد!"),
                                    )
                                    if (round?.wasTie == true && state.options.tieBreak == TieBreak.RANDOM) {
                                        append(" · ")
                                        append(tx(lang, "tie broken", "تساوی شکسته شد"))
                                    }
                                }
                                Text(text = subtitle, color = palette.textMuted, fontSize = 14.sp, textAlign = TextAlign.Center)
                            }
                        }
                        AppButton(
                            text = if (isLast) tx(lang, "See results", "دیدن نتایج") else tx(lang, "Next", "بعدی"),
                            onClick = { dispatch(MltAction.NextRound) },
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
private fun ScoreStrip(state: MltState, lang: Lang) {
    if (!state.options.showRunningScores) return
    val top = state.playerIds.sortedByDescending { state.scores[it] ?: 0 }.take(5)
    FlowRow(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        top.forEach { id ->
            Chip(text = "${state.playerNames[id] ?: id} 🏆${fmtNum(state.scores[id] ?: 0, lang)}")
        }
    }
}

@Composable
private fun PromptCard(text: String, emoji: String?, kicker: String?, compact: Boolean) {
    val accent = LocalAccent.current
    val palette = LocalPalette.current
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .screenEntrance(translateY = 8.dp, fromScale = 0.94f)
            .clip(CardShape)
            .background(
                Brush.verticalGradient(listOf(lerp(palette.surface2, accent.base, 0.26f), palette.surface)),
                CardShape,
            )
            .border(1.5.dp, accent.glow, CardShape)
            .padding(horizontal = if (compact) 20.dp else 28.dp, vertical = if (compact) 22.dp else 36.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(if (compact) 8.dp else 14.dp),
        ) {
            Motif(name = "gereh", accent = Accents.Gold, modifier = Modifier.size(if (compact) 24.dp else 32.dp))
            if (kicker != null) {
                Text(
                    text = kicker,
                    color = palette.textMuted,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                )
            }
            if (emoji != null) {
                Text(text = emoji, fontSize = if (compact) 36.sp else 56.sp)
            }
            Text(
                text = text,
                style = TextStyle(
                    fontFamily = Display,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = if (compact) 22.sp else 28.sp,
                ),
                color = palette.text,
                textAlign = TextAlign.Center,
            )
            Motif(name = "boteh", accent = Accents.Gold, modifier = Modifier.size(if (compact) 14.dp else 18.dp))
        }
    }
}

@Composable
private fun VoteGrid(
    playerIds: List<String>,
    names: Map<String, String>,
    disabledId: String?,
    onPick: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        playerIds.chunked(2).forEach { rowIds ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                rowIds.forEach { id ->
                    VoteButton(
                        modifier = Modifier.weight(1f),
                        name = names[id] ?: id,
                        disabled = id == disabledId,
                        onClick = { onPick(id) },
                    )
                }
                if (rowIds.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun VoteButton(
    modifier: Modifier,
    name: String,
    disabled: Boolean,
    onClick: () -> Unit,
) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    val interaction = remember { MutableInteractionSource() }
    val scale = pressScale(interaction, pressedScale = 0.97f)
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                alpha = if (disabled) 0.3f else 1f
            }
            .clip(shape)
            .background(palette.surface2, shape)
            .border(1.dp, palette.border, shape)
            .clickable(interactionSource = interaction, indication = null, enabled = !disabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
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
            fontSize = 16.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

// ──────────────────────────── Results ────────────────────────────

@Composable
fun MostLikelyToResultsScreen(
    state: MltState,
    host: GameHost,
    onPlayAgain: () -> Unit,
) {
    CompositionLocalProvider(LocalAccent provides ACCENT.accent()) {
        val palette = LocalPalette.current
        val lang = host.lang

        // Victory fanfare when the results land (mirrors the web's ctx.sound.play('win')).
        LaunchedEffect(Unit) {
            host.sound.play(SoundId.WIN)
            host.haptics.success()
        }

        val winners = computeOverallWinners(state)
        val winnerNames = winners.map { state.playerNames[it] ?: it }
        val title = if (winnerNames.size > 1) {
            tx(lang, "It's a tie!", "مساوی شد!")
        } else {
            val n = winnerNames.firstOrNull() ?: ""
            tx(lang, "$n wins!", "$n برنده شد!")
        }

        val rows = rankPlayers(state).map { r ->
            ScoreRow(
                id = r.id,
                label = "${state.playerNames[r.id] ?: r.id} · " +
                    tx(lang, "${fmtNum(r.rawVotes, lang)} votes", "${fmtNum(r.rawVotes, lang)} رأی"),
                score = r.score,
                rank = r.rank,
                color = state.playerColors[r.id],
            )
        }

        AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            GameAppBar(manifest = host.manifest, lang = lang, onClose = host::requestExit)
            WinnerBanner(title = title, names = winnerNames, tie = winnerNames.size > 1)
            Text(
                text = tx(lang, "Round wins", "بردهای دور"),
                color = palette.textMuted,
                fontSize = 13.sp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
            Leaderboard(rows = rows)
            Spacer(Modifier.height(4.dp))
            AppButton(
                text = tx(lang, "Play again", "بازی دوباره"),
                onClick = onPlayAgain,
                size = ButtonSize.LG,
                fullWidth = true,
            )
            AppButton(
                text = tx(lang, "Home", "خانه"),
                onClick = host::exit,
                variant = ButtonVariant.SECONDARY,
                fullWidth = true,
            )
            Spacer(Modifier.height(8.dp))
        }
    }
}
