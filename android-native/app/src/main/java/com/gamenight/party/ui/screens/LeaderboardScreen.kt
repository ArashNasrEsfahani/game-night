package com.gamenight.party.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.Lang
import com.gamenight.party.store.LeaderboardRow
import com.gamenight.party.store.LeaderboardStore
import com.gamenight.party.store.leaderboardRows
import com.gamenight.party.ui.components.AppBar
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.PillShape
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalPalette

private val MEDALS = listOf("🥇", "🥈", "🥉")

/**
 * The Leaderboard screen — cross-game overall standings, a full-screen port of
 * src/app/components/Leaderboard.tsx. Per player it shows total wins as a stacked bar (solo wins in
 * gold + group wins in teal). Reads & writes the persisted [LeaderboardStore]; rankings come from the
 * engine results model (via [leaderboardRows]).
 */
@Composable
fun LeaderboardScreen(
    leaderboard: LeaderboardStore,
    lang: Lang,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val data by leaderboard.state.collectAsState()
    val rows = remember(data) { leaderboardRows(data.tallies) }
    val title = uiText(lang, "Leaderboard", "جدول امتیازها")

    if (data.totalMatches == 0 || rows.isEmpty()) {
        AppScreen(modifier = modifier) {
            AppBar(title = title, onBack = onBack)
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                EmptyLeaderboard(lang)
            }
        }
        return
    }

    val max = maxOf(1, rows.maxOf { it.total })

    AppScreen(modifier = modifier, scrollable = true, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        AppBar(
            title = title,
            onBack = onBack,
            right = {
                AppButton(
                    text = uiText(lang, "Reset", "بازنشانی"),
                    onClick = leaderboard::reset,
                    variant = ButtonVariant.GHOST,
                    size = ButtonSize.SM,
                )
            },
        )

        Text(
            text = "🏆 " + uiText(lang, "${fmtNum(data.totalMatches, lang)} games played", "${fmtNum(data.totalMatches, lang)} بازی انجام‌شده"),
            modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
            color = LocalPalette.current.textMuted,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
        )

        rows.forEach { row -> LeaderboardItem(row = row, max = max, lang = lang) }

        Spacer(Modifier.height(2.dp))
        Legend(lang)
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun LeaderboardItem(row: LeaderboardRow, max: Int, lang: Lang) {
    val palette = LocalPalette.current
    val medal = MEDALS.getOrNull(row.rank - 1) ?: fmtNum(row.rank, lang)

    AppCard(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                text = medal,
                modifier = Modifier.width(28.dp),
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                textAlign = TextAlign.Center,
            )
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = row.name,
                        modifier = Modifier.weight(1f),
                        color = palette.text,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = uiText(
                            lang,
                            "${fmtNum(row.total, lang)} wins (${fmtNum(row.individual, lang)}/${fmtNum(row.team, lang)})",
                            "${fmtNum(row.total, lang)} برد (${fmtNum(row.individual, lang)}/${fmtNum(row.team, lang)})",
                        ),
                        color = palette.textMuted,
                        fontSize = 12.sp,
                    )
                }
                Spacer(Modifier.height(6.dp))
                StackedBar(individual = row.individual, team = row.team, total = row.total, max = max)
            }
        }
    }
}

/** The win-share bar: filled to total/max, split into solo (gold) and group (teal) segments. */
@Composable
private fun StackedBar(individual: Int, team: Int, total: Int, max: Int) {
    val palette = LocalPalette.current
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(10.dp)
            .clip(PillShape)
            .background(palette.surfaceSunk, PillShape),
    ) {
        if (total > 0) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction = (total.toFloat() / max.toFloat()).coerceIn(0f, 1f))
                    .fillMaxHeight()
                    .clip(PillShape),
            ) {
                Row(modifier = Modifier.fillMaxSize()) {
                    if (individual > 0) {
                        Box(modifier = Modifier.weight(individual.toFloat()).fillMaxHeight().background(Accents.GoldStrong))
                    }
                    if (team > 0) {
                        Box(modifier = Modifier.weight(team.toFloat()).fillMaxHeight().background(Accents.Teal))
                    }
                }
            }
        }
    }
}

@Composable
private fun Legend(lang: Lang) {
    val palette = LocalPalette.current
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterHorizontally),
    ) {
        LegendDot(Accents.GoldStrong, uiText(lang, "Solo", "انفرادی"), palette.textMuted)
        LegendDot(Accents.Teal, uiText(lang, "Group", "گروهی"), palette.textMuted)
    }
}

@Composable
private fun LegendDot(color: Color, label: String, textColor: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(color, CircleShape))
        Text(text = label, color = textColor, fontSize = 11.sp)
    }
}

@Composable
private fun EmptyLeaderboard(lang: Lang) {
    val palette = LocalPalette.current
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier.size(80.dp).clip(CircleShape).background(palette.surface2, CircleShape),
            contentAlignment = Alignment.Center,
        ) { Text("🏆", fontSize = 36.sp) }
        Spacer(Modifier.height(16.dp))
        Text(
            text = uiText(lang, "Play a game to start the leaderboard", "یک بازی انجام بده تا جدول شروع شود"),
            color = palette.textMuted,
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
        )
    }
}
