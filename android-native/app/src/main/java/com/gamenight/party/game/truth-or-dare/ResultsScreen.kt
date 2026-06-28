package com.gamenight.party.game.truthordare

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.game.Sfx
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.Leaderboard
import com.gamenight.party.ui.components.ScoreRow
import com.gamenight.party.ui.components.WinnerBanner
import com.gamenight.party.ui.theme.LocalPalette

/**
 * Results — a Kotlin/Compose port of src/games/truth-or-dare/screens/ResultsScreen.tsx. In points
 * mode it crowns the winner(s) with a [WinnerBanner] + [Leaderboard]; otherwise it shows a casual
 * session summary (turns / dares / truths / skips).
 */
@Composable
fun TruthOrDareResultsScreen(
    state: ToDState,
    lang: Lang,
    manifest: GameManifest,
    onPlayAgain: () -> Unit,
    onExit: () -> Unit,
    onClose: () -> Unit,
    sound: Sfx = Sfx.None,
    haptics: Haptics = Haptics.none(),
) {
    val s = state
    val palette = LocalPalette.current

    // Crown the session once, on entry: a victory fanfare + a success buzz (web plays 'win' on mount).
    LaunchedEffect(Unit) {
        sound.play(SoundId.WIN)
        haptics.success()
    }

    val points = s.options.scoringMode == ScoringMode.POINTS
    val winners = computeWinners(s)
    val winnerNames = winners.map { s.playerNames[it] ?: it }
    val dares = s.history.count { it.kind == PromptKind.DARE && it.outcome == Outcome.DONE }
    val truths = s.history.count { it.kind == PromptKind.TRUTH && it.outcome == Outcome.DONE }
    val skips = s.history.count { it.outcome == Outcome.SKIP }
    val rows = standings(s).map {
        ScoreRow(
            id = it.id,
            label = s.playerNames[it.id] ?: it.id,
            score = it.score,
            rank = it.rank,
            color = s.playerColors[it.id],
        )
    }

    AppScreen(scrollable = true) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose)
        Column(verticalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.fillMaxWidth()) {
            if (points && winners.isNotEmpty()) {
                WinnerBanner(
                    title = if (winners.size > 1) {
                        ToDStr.resultsTie.resolve(lang)
                    } else {
                        ToDStr.winner(lang, winnerNames.firstOrNull() ?: "")
                    },
                    names = winnerNames,
                )
                Leaderboard(rows = rows)
            } else {
                AppCard(contentPadding = PaddingValues(horizontal = 20.dp, vertical = 32.dp)) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(text = "🎯", fontSize = 48.sp)
                        Text(
                            text = ToDStr.sessionSummary.resolve(lang),
                            color = palette.text,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 18.sp,
                        )
                        Text(
                            text = ToDStr.statLine(lang, s.history.size, dares, truths, skips),
                            color = palette.textMuted,
                            fontSize = 14.sp,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }

            AppButton(
                text = ToDStr.playAgain.resolve(lang),
                onClick = onPlayAgain,
                size = ButtonSize.LG,
                fullWidth = true,
            )
            AppButton(
                text = ToDStr.resultsHome.resolve(lang),
                onClick = onExit,
                variant = ButtonVariant.SECONDARY,
                fullWidth = true,
            )
            Spacer(Modifier.height(8.dp))
        }
    }
}
