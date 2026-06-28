package com.gamenight.party.game.codenames

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.Curtain
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.PillShape
import com.gamenight.party.ui.components.Stepper
import com.gamenight.party.ui.components.glass2Surface
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.TeamA
import com.gamenight.party.ui.theme.TeamB
import com.gamenight.party.ui.theme.accent
import com.gamenight.party.ui.screens.fmtNum
import kotlinx.coroutines.delay
import kotlin.math.ceil

/**
 * Codenames play loop — a native port of src/games/codenames/screens/PlayScreen.tsx. Walks the
 * orientation → spymaster handoff → clue (behind a pass-the-phone curtain) → guesser handoff →
 * guessing → turn-end phases. The reducer is pure; the only side effects here are the guessing
 * timer (timed mode) and light haptics.
 */
@Composable
fun CodenamesPlayScreen(
    state: CodenamesState,
    dispatch: (CodenamesAction) -> Unit,
    lang: Lang,
    manifest: GameManifest,
    sound: Sfx,
    haptics: Haptics,
    onClose: () -> Unit,
    onExit: () -> Unit,
) {
    val s = state

    // Pass-the-phone curtain + clue stepper reset whenever the turn/phase changes.
    var gateOpen by remember(s.phase, s.currentTeam) { mutableStateOf(false) }
    var count by remember(s.currentTeam) { mutableStateOf(1) }

    // Guessing timer (timed mode only): a soft tick over the last few seconds, then a time-up blast.
    var secondsLeft by remember { mutableStateOf(s.turnSeconds) }
    LaunchedEffect(s.phase, s.currentTeam, s.mode, s.turnSeconds) {
        if (s.phase == CodenamesPhase.GUESSING && s.mode == CodenamesMode.TIMED) {
            val endAt = System.currentTimeMillis() + s.turnSeconds * 1000L
            secondsLeft = s.turnSeconds
            var prev = s.turnSeconds
            while (true) {
                val rem = ceil((endAt - System.currentTimeMillis()) / 1000.0).toInt()
                val now = rem.coerceAtLeast(0)
                secondsLeft = now
                if (now != prev && now in 1..5) sound.play(SoundId.TICK)
                prev = now
                if (rem <= 0) {
                    sound.play(SoundId.TIME_UP)
                    haptics.warning()
                    dispatch(CodenamesAction.TimerExpired)
                    break
                }
                delay(250)
            }
        }
    }

    val teamColor: Color = if (s.currentTeam == TeamId.TEAM_A) TeamA else TeamB

    CompositionLocalProvider(LocalAccent provides ColorToken.LIME.accent()) {
        val palette = LocalPalette.current

        // Always-available "End game" control: ends the match and jumps to the results with the
        // standings so far (the team closest to clearing wins). Lives in the shared GameAppBar's
        // trailing slot, after the built-in How-to-play button.
        val endGameRight: @Composable () -> Unit = {
            Text(
                text = CnStr.endGame.resolve(lang),
                color = palette.textMuted,
                fontSize = 14.sp,
                modifier = Modifier.clickable { dispatch(CodenamesAction.EndGame) },
            )
        }

        when (s.phase) {
            CodenamesPhase.ERROR -> AppScreen {
                GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(CnStr.errorSetup.resolve(lang), color = palette.textMuted, textAlign = TextAlign.Center)
                        AppButton(text = CnStr.playAgain.resolve(lang), onClick = onExit)
                    }
                }
            }

            CodenamesPhase.ORIENTATION -> AppScreen {
                GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        TeamBadge(currentTeamName(s), CnStr.startsFirst.resolve(lang), teamColor)
                        Text(CnStr.chooseOrientation.resolve(lang), color = palette.text, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, textAlign = TextAlign.Center)
                        Text(CnStr.orientationHint.resolve(lang), color = palette.textMuted, fontSize = 14.sp, textAlign = TextAlign.Center)
                        PlaceholderGrid(palette.surfaceSunk)
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                            listOf(0 to 1, 2 to 3).forEach { (l, r) ->
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                                    AppButton(text = CnStr.orient[l].resolve(lang), onClick = {
                                        sound.play(SoundId.SHUFFLE)
                                        sound.play(SoundId.DRUM)
                                        haptics.medium()
                                        dispatch(CodenamesAction.ChooseOrientation(l))
                                    }, size = ButtonSize.LG, modifier = Modifier.weight(1f))
                                    AppButton(text = CnStr.orient[r].resolve(lang), onClick = {
                                        sound.play(SoundId.SHUFFLE)
                                        sound.play(SoundId.DRUM)
                                        haptics.medium()
                                        dispatch(CodenamesAction.ChooseOrientation(r))
                                    }, size = ButtonSize.LG, modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
            }

            CodenamesPhase.SPYMASTER_HANDOFF -> AppScreen {
                GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                ScoreStrip(s, lang, secondsLeft)
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        TeamBadge(currentTeamName(s), CnStr.spymaster.resolve(lang), teamColor)
                        Text(s.playerNames[currentSpymasterId(s)] ?: "", color = palette.text, fontWeight = FontWeight.ExtraBold, fontSize = 30.sp, textAlign = TextAlign.Center)
                        AppButton(text = CnStr.imSpymaster.resolve(lang), onClick = { dispatch(CodenamesAction.RevealKeyToSpymaster) }, size = ButtonSize.LG)
                    }
                }
            }

            CodenamesPhase.CLUE -> {
                val max = s.remaining[s.currentTeam] ?: 0
                val spyName = s.playerNames[currentSpymasterId(s)] ?: ""
                AppScreen {
                    GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                    Curtain(
                        open = gateOpen,
                        holderName = spyName,
                        hint = CnStr.onlySpymaster(spyName, lang),
                        revealLabel = CnStr.reveal.resolve(lang),
                        onReveal = { sound.play(SoundId.REVEAL); gateOpen = true },
                        modifier = Modifier.weight(1f),
                    ) {
                        ScoreStrip(s, lang, secondsLeft)
                        CnGrid(cells = s.board, spymaster = true, lang = lang)
                        Stepper(value = count.coerceIn(0, maxOf(0, max)), onValueChange = { count = it }, min = 0, max = maxOf(0, max), label = CnStr.clueNumber.resolve(lang), modifier = Modifier.padding(top = 12.dp))
                        AppButton(
                            text = CnStr.clueGiven.resolve(lang),
                            onClick = { dispatch(CodenamesAction.GiveClue(count.coerceIn(0, maxOf(0, max)))) },
                            size = ButtonSize.LG,
                            fullWidth = true,
                            modifier = Modifier.padding(top = 12.dp),
                        )
                    }
                }
            }

            CodenamesPhase.GUESSER_HANDOFF -> AppScreen {
                GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text("🙈", fontSize = 56.sp)
                        Text(CnStr.hideKey.resolve(lang), color = palette.textMuted, fontSize = 16.sp, textAlign = TextAlign.Center)
                        AppButton(text = CnStr.weAreReady.resolve(lang), onClick = { dispatch(CodenamesAction.HandoffToGuessers) }, size = ButtonSize.LG)
                    }
                }
            }

            CodenamesPhase.GUESSING -> {
                val justForgiven = s.lastReveal?.let {
                    (it.outcome == GuessOutcome.NEUTRAL || it.outcome == GuessOutcome.WRONG_TEAM) && s.wrongGuessesThisTurn > 0
                } ?: false
                AppScreen {
                    GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                    ScoreStrip(s, lang, secondsLeft)
                    Text(
                        text = CnStr.clueEcho(s.activeClue?.count ?: 0, guessesLeft(s), lang),
                        color = palette.text,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (justForgiven) {
                        Text(
                            text = "😅 ${CnStr.forgiven.resolve(lang)}",
                            color = Accents.GoldStrong,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        )
                    }
                    CnGrid(
                        cells = s.board,
                        spymaster = false,
                        lang = lang,
                        modifier = Modifier.padding(top = 12.dp),
                        onTap = { i ->
                            // Outcome-aware feedback (mirrors the web reducer's classification): a card
                            // landing for your own colour, a lament for the assassin, a "phew" when the
                            // first wrong is forgiven, otherwise a miss.
                            val cell = s.board[i]
                            val willForgive = cell.role.asTeamOrNull() != s.currentTeam &&
                                cell.role != CardRole.ASSASSIN &&
                                s.forgiveFirstWrong && s.wrongGuessesThisTurn < 1
                            when {
                                cell.role.asTeamOrNull() == s.currentTeam -> {
                                    sound.play(SoundId.SELECT); haptics.success()
                                }
                                cell.role == CardRole.ASSASSIN -> {
                                    sound.play(SoundId.LOSE); haptics.error()
                                }
                                willForgive -> {
                                    sound.play(SoundId.FORGIVE); haptics.warning()
                                }
                                else -> {
                                    sound.play(SoundId.WRONG); haptics.warning()
                                }
                            }
                            dispatch(CodenamesAction.GuessCell(i))
                        },
                    )
                    AppButton(
                        text = CnStr.stopGuessing.resolve(lang),
                        onClick = { dispatch(CodenamesAction.StopGuessing) },
                        variant = ButtonVariant.SECONDARY,
                        fullWidth = true,
                        enabled = (s.activeClue?.guessesMade ?: 0) >= 1,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                }
            }

            CodenamesPhase.TURN_END -> AppScreen {
                GameAppBar(manifest = manifest, lang = lang, onClose = onClose, trailing = endGameRight)
                ScoreStrip(s, lang, secondsLeft)
                val nextName = s.teamMeta.getValue(other(s.currentTeam)).name
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(CnStr.reasonEmoji(s.turnEndReason), fontSize = 56.sp)
                        Text(CnStr.reason(s.turnEndReason).resolve(lang), color = palette.text, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, textAlign = TextAlign.Center)
                        Text(CnStr.nextTeam(nextName, lang), color = palette.textMuted, fontSize = 16.sp, textAlign = TextAlign.Center)
                        AppButton(text = CnStr.continueLabel.resolve(lang), onClick = { dispatch(CodenamesAction.AdvanceTurn) }, size = ButtonSize.LG, fullWidth = true)
                    }
                }
            }

            // GAME_OVER is handled by the host (it swaps to Results once finished); render nothing.
            CodenamesPhase.GAME_OVER -> Box(modifier = Modifier.fillMaxSize().background(palette.bg))
        }
    }
}

@Composable
private fun TeamBadge(title: String, subtitle: String, color: Color) {
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(color)
            .padding(horizontal = 24.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Text(subtitle, color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp)
    }
}

@Composable
private fun PlaceholderGrid(color: Color) {
    Column(modifier = Modifier.graphicsLayer { alpha = 0.6f }, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(5) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                repeat(5) {
                    Box(modifier = Modifier.size(28.dp).clip(RoundedCornerShape(6.dp)).background(color))
                }
            }
        }
    }
}

@Composable
private fun ScoreStrip(s: CodenamesState, lang: Lang, secondsLeft: Int) {
    val palette = LocalPalette.current
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TeamTag(s.teamMeta.getValue(TeamId.TEAM_A).name, s.remaining[TeamId.TEAM_A] ?: 0, TeamA, s.currentTeam == TeamId.TEAM_A, lang)
        if (s.mode == CodenamesMode.TIMED && s.phase == CodenamesPhase.GUESSING) {
            val low = secondsLeft <= 10
            Box(modifier = Modifier.glass2Surface(palette, PillShape).padding(horizontal = 12.dp, vertical = 4.dp)) {
                Text("⏱ ${fmtNum(secondsLeft, lang)}s", color = if (low) TeamA else palette.text, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }
        TeamTag(s.teamMeta.getValue(TeamId.TEAM_B).name, s.remaining[TeamId.TEAM_B] ?: 0, TeamB, s.currentTeam == TeamId.TEAM_B, lang)
    }
}

@Composable
private fun TeamTag(name: String, count: Int, color: Color, active: Boolean, lang: Lang) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.graphicsLayer { alpha = if (active) 1f else 0.45f },
    ) {
        if (active) Text("▶", color = color, fontSize = 12.sp)
        Text("$name ${fmtNum(count, lang)}", color = color, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }
}
