package com.gamenight.party.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.ColorToken
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent

/** A single leaderboard line — a 1:1 port of the `ScoreRow` shape in src/sdk/ui/Scoreboard.tsx. */
data class ScoreRow(
    val id: String,
    val label: String,
    val score: Int,
    val rank: Int,
    val color: ColorToken? = null,
    /** Optional pre-formatted value shown instead of the raw number (e.g. a time "1:05"). */
    val display: String? = null,
)

/**
 * A ranked leaderboard — a 1:1 port of src/sdk/ui/Scoreboard.tsx. Each entry is a frosted card; the
 * rank-1 entry gets a gold-tinted fill + rim. Scores pop when they change.
 */
@Composable
fun Leaderboard(rows: List<ScoreRow>, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        rows.forEach { row ->
            key(row.id) { ScoreRowItem(row) }
        }
    }
}

@Composable
private fun ScoreRowItem(row: ScoreRow) {
    val palette = LocalPalette.current
    val first = row.rank == 1

    // Score pop: snap up then spring back whenever the value changes.
    val pop = remember { Animatable(1f) }
    LaunchedEffect(row.score, row.display) {
        pop.snapTo(1.3f)
        pop.animateTo(1f, animationSpec = springSnappy())
    }

    val base = Modifier.fillMaxWidth()
    val shell = if (first) {
        base
            .shadow(14.dp, CardShape, clip = false)
            .clip(CardShape)
            .background(
                Brush.linearGradient(listOf(lerp(palette.surface2, Accents.Gold, 0.22f), palette.surface2)),
                CardShape,
            )
            .border(1.dp, Accents.Gold.copy(alpha = 0.55f), CardShape)
    } else {
        base.glassSurface(palette, CardShape)
    }

    Row(
        modifier = shell.padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = row.rank.toString(),
            modifier = Modifier.width(24.dp),
            color = if (first) Accents.GoldStrong else palette.textMuted,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            textAlign = TextAlign.Center,
        )
        if (row.color != null) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(row.color.accent().base, CircleShape),
            )
        }
        Text(
            text = row.label,
            modifier = Modifier.weight(1f),
            color = palette.text,
            fontWeight = FontWeight.Medium,
            fontSize = 16.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = row.display ?: row.score.toString(),
            modifier = Modifier.graphicsLayer { scaleX = pop.value; scaleY = pop.value },
            color = palette.text,
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
        )
    }
}
