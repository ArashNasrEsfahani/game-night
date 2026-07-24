package com.gamenight.party.game.minesweeper

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.Leaderboard
import com.gamenight.party.ui.components.ScoreRow
import com.gamenight.party.ui.components.WinnerBanner
import com.gamenight.party.ui.screens.fmtNum
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.accent

/**
 * Mine Hunt results — a native port of screens/ResultsScreen.tsx. A winner banner (or solo
 * congratulation), the score leaderboard (versus only), the fully revealed board, and replay / home
 * actions. Content wears this game's tangerine accent.
 */
@Composable
fun MinesweeperResultsScreen(
    state: MinesweeperState,
    lang: Lang,
    manifest: GameManifest,
    onClose: () -> Unit,
    onExit: () -> Unit,
    onPlayAgain: () -> Unit,
    sound: Sfx = Sfx.None,
    haptics: Haptics = Haptics.none(),
) {
    CompositionLocalProvider(LocalAccent provides ColorToken.TANGERINE.accent()) {
        val s = state
        val solo = isSolo(s)

        // Celebrate the reveal: a victory run + a shimmering sparkle (mirrors the web ResultsScreen
        // mount, which plays 'win' then 'sparkle'), plus a single success buzz for the win moment.
        LaunchedEffect(Unit) {
            sound.play(SoundId.WIN)
            sound.play(SoundId.SPARKLE)
            haptics.success()
        }

        val winnerNames = s.winnerIds.map { seatName(s, it) }
        val title = when {
            s.winReason == WinReason.SOLO_WIN -> loc(lang, "You found every mine!", "همهٔ مین‌ها را پیدا کردی!")
            winnerNames.size > 1 -> loc(lang, "It's a tie!", "مساوی شد!")
            else -> loc(lang, "${winnerNames.firstOrNull() ?: ""} wins!", "${winnerNames.firstOrNull() ?: ""} برنده شد!")
        }

        val seatColors: Map<String, ColorToken?> = remember(s.seats) { s.seats.associate { it.id to it.color } }

        val rows: List<ScoreRow> = standings(s).map { r ->
            ScoreRow(
                id = r.id,
                label = r.name,
                score = r.score,
                rank = r.rank,
                color = r.color,
                display = loc(lang, "${fmtNum(r.score, lang)} mines", "${fmtNum(r.score, lang)} مین"),
            )
        }

        AppScreen(scrollable = true) {
            GameAppBar(manifest = manifest, lang = lang, onClose = onClose)

            Column(
                modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                WinnerBanner(title = title, names = if (solo) emptyList() else winnerNames, tie = !solo && winnerNames.size > 1)

                if (!solo) Leaderboard(rows = rows)

                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    MineGrid(
                        cells = s.board,
                        cols = s.cols,
                        seatColors = seatColors,
                        modifier = Modifier.widthIn(max = 300.dp),
                        disabled = true,
                    )
                }

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    AppButton(
                        text = loc(lang, "New board", "صفحهٔ جدید"),
                        onClick = onPlayAgain,
                        size = ButtonSize.LG,
                        fullWidth = true,
                    )
                    AppButton(
                        text = loc(lang, "Home", "خانه"),
                        onClick = onExit,
                        variant = ButtonVariant.SECONDARY,
                        fullWidth = true,
                    )
                }
            }
        }
    }
}
