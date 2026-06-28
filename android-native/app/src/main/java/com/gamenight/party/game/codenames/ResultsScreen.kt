package com.gamenight.party.game.codenames

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.gamenight.party.game.Sfx
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.AppBar
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.WinnerBanner
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.accent

/**
 * Codenames results — a native port of src/games/codenames/screens/ResultsScreen.tsx: the winner
 * banner, the fully-revealed key (every cell coloured by its role) and rematch / home actions.
 */
@Composable
fun CodenamesResultsScreen(
    state: CodenamesState,
    lang: Lang,
    sound: Sfx,
    haptics: Haptics,
    onPlayAgain: () -> Unit,
    onExit: () -> Unit,
) {
    val s = state

    // Victory fanfare on arrival (mirrors the web ResultsScreen): a win sting + sparkle when a team
    // took the round, otherwise a lament.
    LaunchedEffect(Unit) {
        if (s.winner != null) {
            sound.play(SoundId.WIN)
            sound.play(SoundId.SPARKLE)
            haptics.success()
        } else {
            sound.play(SoundId.LOSE)
        }
    }

    CompositionLocalProvider(LocalAccent provides ColorToken.LIME.accent()) {
        val winnerName = s.winner?.let { s.teamMeta.getValue(it).name } ?: ""
        val reason = if (s.winReason == WinReason.OPPONENT_HIT_ASSASSIN) CnStr.winAssassin else CnStr.winCleared

        AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            AppBar(title = CnStr.resultsTitle.resolve(lang), onBack = onExit)

            WinnerBanner(
                title = CnStr.teamWins(winnerName, lang),
                names = listOf(reason.resolve(lang)),
            )

            // The fully-revealed key.
            CnGrid(cells = s.board, spymaster = true, lang = lang)

            AppButton(
                text = CnStr.rematch.resolve(lang),
                onClick = onPlayAgain,
                size = ButtonSize.LG,
                fullWidth = true,
                modifier = Modifier.padding(top = 8.dp),
            )
            AppButton(
                text = CnStr.home.resolve(lang),
                onClick = onExit,
                variant = ButtonVariant.SECONDARY,
                fullWidth = true,
                modifier = Modifier.padding(bottom = 16.dp),
            )
        }
    }
}
