package com.gamenight.party.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.theme.LocalPalette

/**
 * Team pickers shared by every game played in groups — the native port of
 * src.app.components.TeamAssigner.tsx.
 *
 * Two shapes, because the games need two different guarantees:
 *  - [TeamAssigner] + [rememberTeamAssignment] — free columns, any size. Tap a player to move them to
 *    the next team (Pantomime, Heads Up, Codenames).
 *  - [PairAssigner] + [rememberPairAssignment] — teams of EXACTLY two. Tap two players to swap them,
 *    so a pair can never end up with one or three members (Dowr's relay).
 *
 * Both always render who is in each team, so the host can read the split before starting.
 */

/** Balance players across [teamCount] teams, preserving valid prior choices — web `balance`. */
fun balanceTeams(ids: List<String>, teamCount: Int, prev: Map<String, Int>): Map<String, Int> {
    val n = maxOf(1, teamCount)
    val next = LinkedHashMap<String, Int>()
    val counts = IntArray(n)
    for (id in ids) {
        val t = prev[id]
        if (t != null && t in 0 until n) {
            next[id] = t
            counts[t]++
        }
    }
    for (id in ids) {
        if (next[id] == null) {
            var min = 0
            for (k in 1 until n) if (counts[k] < counts[min]) min = k
            next[id] = min
            counts[min]++
        }
    }
    return next
}

/** What a game feeds into its team config, plus the handle the picker needs. */
@Immutable
class TeamAssignment(
    val byPlayer: Map<String, Int>,
    val memberIdsByTeam: List<List<String>>,
    val cycle: (String) -> Unit,
)

/**
 * Auto-seeded, manually tweakable team assignment. Seeds an even round-robin split; changing the team
 * COUNT re-balances fresh, while adding or removing players keeps the moves the host already made.
 */
@Composable
fun rememberTeamAssignment(ids: List<String>, teamCount: Int): TeamAssignment {
    val idsKey = ids.joinToString(",")
    // Keyed on teamCount: a structural change drops the manual moves so the split re-balances evenly.
    var manual by remember(teamCount) { mutableStateOf(emptyMap<String, Int>()) }
    val byPlayer = remember(idsKey, teamCount, manual) { balanceTeams(ids, teamCount, manual) }
    val memberIdsByTeam = remember(idsKey, teamCount, byPlayer) {
        (0 until maxOf(1, teamCount)).map { ti -> ids.filter { (byPlayer[it] ?: 0) == ti } }
    }
    return TeamAssignment(
        byPlayer = byPlayer,
        memberIdsByTeam = memberIdsByTeam,
        cycle = { id -> manual = manual + (id to (((byPlayer[id] ?: 0) + 1) % maxOf(1, teamCount))) },
    )
}

/** One team column: its label and the colour that tints it. */
@Immutable
data class TeamColumnSpec(val name: String, val color: Color)

/**
 * Grouped columns — one per team, with its members listed underneath. Tapping a member moves them to
 * the next team. Set [spymasterFirst] (Codenames) to flag the first member of each column with 🔍.
 */
@Composable
fun TeamAssigner(
    players: List<PlayerSeat>,
    columns: List<TeamColumnSpec>,
    byPlayer: Map<String, Int>,
    onCycle: (String) -> Unit,
    modifier: Modifier = Modifier,
    hint: String? = null,
    spymasterFirst: Boolean = false,
) {
    val palette = LocalPalette.current
    val n = maxOf(1, columns.size)
    // Four teams would squeeze four name columns onto a phone, so wrap those into a 2×2 grid.
    val perRow = if (n == 4) 2 else n

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        columns.chunked(perRow).forEachIndexed { rowIndex, chunk ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                chunk.forEachIndexed { i, col ->
                    val teamIndex = rowIndex * perRow + i
                    TeamColumnBox(
                        spec = col,
                        members = players.filter { (byPlayer[it.id] ?: 0).coerceAtMost(n - 1) == teamIndex },
                        onCycle = onCycle,
                        spymasterFirst = spymasterFirst,
                    )
                }
                // Keep column widths equal when the last row is short (e.g. 3 teams never happens
                // here, but a future odd count would otherwise stretch).
                repeat(perRow - chunk.size) { Spacer(Modifier.weight(1f)) }
            }
        }
        if (hint != null) {
            Text(
                text = hint,
                modifier = Modifier.fillMaxWidth(),
                color = palette.textMuted,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun RowScope.TeamColumnBox(
    spec: TeamColumnSpec,
    members: List<PlayerSeat>,
    onCycle: (String) -> Unit,
    spymasterFirst: Boolean,
) {
    val palette = LocalPalette.current
    Column(
        modifier = Modifier
            .weight(1f)
            .defaultMinSize(minHeight = 80.dp)
            .glass2Surface(palette, CardShape)
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(spec.color, CircleShape))
            Text(
                text = spec.name,
                color = palette.text,
                fontWeight = FontWeight.Bold,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (members.isEmpty()) {
            Text(
                text = "—",
                modifier = Modifier.fillMaxWidth(),
                color = palette.textMuted,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
            )
        } else {
            members.forEachIndexed { mi, p ->
                PlayerSlot(
                    label = (if (spymasterFirst && mi == 0) "🔍 " else "") +
                        (p.emoji?.let { "$it " } ?: "") + p.name,
                    selected = false,
                    accent = spec.color,
                    onClick = { onCycle(p.id) },
                )
            }
        }
    }
}

/** Seat order for exactly-two teams, plus the tap handler that swaps two players. */
@Immutable
class PairAssignment(
    val order: List<String>,
    val picked: String?,
    val tap: (String) -> Unit,
)

/**
 * Pair assignment for games that need teams of exactly two: pairs are consecutive slots in [order],
 * and the host re-pairs by tapping two players to swap their slots. Default order is roster order —
 * the same consecutive pairing these games used to build on their own.
 */
@Composable
fun rememberPairAssignment(ids: List<String>): PairAssignment {
    val idsKey = ids.joinToString(",")
    var moved by remember { mutableStateOf(emptyList<String>()) }
    var pickedRaw by remember { mutableStateOf<String?>(null) }

    // Derived, never stale: the host's arrangement filtered to who's still selected, newcomers last.
    val order = remember(idsKey, moved) {
        val kept = moved.filter { it in ids }
        kept + ids.filter { it !in kept }
    }
    val picked = pickedRaw?.takeIf { it in order }

    return PairAssignment(
        order = order,
        picked = picked,
        tap = { id ->
            if (picked == null || picked == id) {
                pickedRaw = if (picked == id) null else id
            } else {
                val a = order.indexOf(picked)
                val b = order.indexOf(id)
                pickedRaw = null
                if (a >= 0 && b >= 0) {
                    moved = order.toMutableList().also { it[a] = order[b]; it[b] = order[a] }
                }
            }
        },
    )
}

/**
 * One row per team of two, showing exactly who is with whom. Tap a player to pick them up, tap a
 * second to swap the two. A trailing odd player gets an empty slot, so an uneven roster is obvious
 * (the game's own validation is what blocks Start).
 */
@Composable
fun PairAssigner(
    players: List<PlayerSeat>,
    order: List<String>,
    picked: String?,
    onTap: (String) -> Unit,
    teamName: (Int) -> String,
    colors: List<Color>,
    modifier: Modifier = Modifier,
    hint: String? = null,
) {
    val palette = LocalPalette.current
    val byId = players.associateBy { it.id }
    val pairs = order.chunked(2)

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        pairs.forEachIndexed { pi, pair ->
            val accent = colors[pi % colors.size]
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .glass2Surface(palette, CardShape)
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(accent, CircleShape))
                Text(
                    text = teamName(pi + 1),
                    modifier = Modifier.defaultMinSize(minWidth = 56.dp),
                    color = palette.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                // Both seats of the pair; the second is empty when the roster count is odd.
                Row(
                    modifier = Modifier.weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    for (slot in 0..1) {
                        val seat = pair.getOrNull(slot)?.let { byId[it] }
                        if (seat == null) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(12.dp))
                                    .border(1.dp, glassBorder(palette), RoundedCornerShape(12.dp))
                                    .padding(vertical = 8.dp),
                            ) {
                                Text(
                                    text = "—",
                                    modifier = Modifier.fillMaxWidth(),
                                    color = palette.textMuted,
                                    fontSize = 12.sp,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        } else {
                            PlayerSlot(
                                label = (seat.emoji?.let { "$it " } ?: "") + seat.name,
                                selected = picked == seat.id,
                                accent = accent,
                                onClick = { onTap(seat.id) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }
        if (hint != null) {
            Text(
                text = hint,
                modifier = Modifier.fillMaxWidth(),
                color = palette.textMuted,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** A tappable player tile — plain surface, or filled with the team colour while picked up. */
@Composable
private fun PlayerSlot(
    label: String,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = LocalPalette.current
    val interaction = remember { MutableInteractionSource() }
    val scale = pressScale(interaction)
    val select = tactile(SoundId.SELECT)
    val shape = RoundedCornerShape(12.dp)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .clip(shape)
            .background(if (selected) accent else palette.surface, shape)
            .clickable(interactionSource = interaction, indication = null) {
                select()
                onClick()
            }
            .padding(horizontal = 8.dp, vertical = 8.dp),
    ) {
        Text(
            text = label,
            color = if (selected) palette.onAccentInk else palette.text,
            fontWeight = FontWeight.Medium,
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
