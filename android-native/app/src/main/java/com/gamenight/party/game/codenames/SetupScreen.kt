package com.gamenight.party.game.codenames

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.ui.components.AppBar
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.AppToggle
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.CardShape
import com.gamenight.party.ui.components.SegmentOption
import com.gamenight.party.ui.components.SegmentedControl
import com.gamenight.party.ui.components.SelectChip
import com.gamenight.party.ui.components.glass2Surface
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.TeamA
import com.gamenight.party.ui.theme.TeamB
import com.gamenight.party.ui.theme.accent

/** Round-robin balance preserving prior picks — the 2-team case of TeamAssigner.tsx `balance`. */
private fun balanceTeams(ids: List<String>, prev: Map<String, Int>): Map<String, Int> {
    val next = LinkedHashMap<String, Int>()
    val counts = intArrayOf(0, 0)
    for (id in ids) {
        val t = prev[id]
        if (t != null && t in 0..1) { next[id] = t; counts[t]++ }
    }
    for (id in ids) {
        if (next[id] == null) {
            val min = if (counts[0] <= counts[1]) 0 else 1
            next[id] = min; counts[min]++
        }
    }
    return next
}

/**
 * Codenames setup — a native port of src/games/codenames/screens/SetupScreen.tsx: pick who plays,
 * tap-to-move two-team assignment (spymaster = first member, 🔍), and the "more options" sheet. On
 * Start it builds the config, resolves the shared word pool and emits the initial state via [onStart].
 */
@Composable
fun CodenamesSetupScreen(
    content: CodenamesContent,
    players: List<PlayerSeat>,
    lang: Lang,
    onStart: (CodenamesState) -> Unit,
    onExit: () -> Unit,
) {
    CompositionLocalProvider(LocalAccent provides ColorToken.LIME.accent()) {
        val palette = LocalPalette.current

        var selected by remember { mutableStateOf(players.map { it.id }.toSet()) }
        var opts by remember { mutableStateOf(DEFAULT_OPTIONS) }
        var showMore by remember { mutableStateOf(false) }

        val seats = players.filter { it.id in selected }
        val selectedIds = seats.map { it.id }
        val selectedKey = selectedIds.joinToString(",")

        var byPlayer by remember { mutableStateOf(balanceTeams(selectedIds, emptyMap())) }
        LaunchedEffect(selectedKey) { byPlayer = balanceTeams(selectedIds, byPlayer) }
        val cycle: (String) -> Unit = { id -> byPlayer = byPlayer + (id to (((byPlayer[id] ?: 0) + 1) % 2)) }

        val seatById = seats.associateBy { it.id }
        val memberAIds = selectedIds.filter { minOf(byPlayer[it] ?: 0, 1) == 0 }
        val memberBIds = selectedIds.filter { minOf(byPlayer[it] ?: 0, 1) == 1 }
        val teams = listOf(
            CnConfigTeam("teamA", CnStr.red, memberAIds),
            CnConfigTeam("teamB", CnStr.blue, memberBIds),
        )

        val errors = validateConfig(seats, teams, opts, content)

        AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(20.dp)) {
            AppBar(title = CnStr.title.resolve(lang), onBack = onExit)

            // ── Players ──
            Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "${CnStr.players.resolve(lang)} · ${seats.size}",
                    color = palette.textMuted,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                )
                players.chunked(3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { p ->
                            SelectChip(
                                selected = p.id in selected,
                                onClick = {
                                    selected = if (p.id in selected) selected - p.id else selected + p.id
                                },
                                text = (p.emoji?.let { "$it " } ?: "") + p.name,
                            )
                        }
                    }
                }
            }

            // ── Two-team assignment (spymaster = first, 🔍) ──
            if (seats.size >= 2) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TeamColumn(CnStr.red.resolve(lang), TeamA, memberAIds.mapNotNull { seatById[it] }, cycle, lang)
                        TeamColumn(CnStr.blue.resolve(lang), TeamB, memberBIds.mapNotNull { seatById[it] }, cycle, lang)
                    }
                    Text(
                        text = "🔍 = ${CnStr.spymaster.resolve(lang)} · ${CnStr.teamHint.resolve(lang)}",
                        color = palette.textMuted,
                        fontSize = 12.sp,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            // ── More options disclosure ──
            AppCard(onClick = { showMore = !showMore }) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(CnStr.moreOptions.resolve(lang), color = palette.text, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                        Text(CnStr.moreOptionsHint.resolve(lang), color = palette.textMuted, fontSize = 12.sp)
                    }
                    Text(if (showMore) "▾" else "▸", color = palette.textMuted, fontSize = 18.sp)
                }
            }

            AnimatedVisibility(visible = showMore) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.fillMaxWidth()) {
                    // Mode
                    OptionLabel(CnStr.mode.resolve(lang))
                    SegmentedControl(
                        options = listOf(
                            SegmentOption(CodenamesMode.UNTIMED, CnStr.untimed.resolve(lang)),
                            SegmentOption(CodenamesMode.TIMED, CnStr.timed.resolve(lang)),
                        ),
                        value = opts.mode,
                        onChange = { opts = opts.copy(mode = it) },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    // Turn time (only when timed)
                    if (opts.mode == CodenamesMode.TIMED) {
                        OptionLabel(CnStr.turnTime.resolve(lang))
                        SegmentedControl(
                            options = listOf(60, 120, 180, 240).map { SegmentOption(it, "${it / 60}m") },
                            value = opts.turnSeconds,
                            onChange = { opts = opts.copy(turnSeconds = it) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    // Word packs (only when more than one)
                    if (content.packs.size > 1) {
                        OptionLabel(CnStr.packs.resolve(lang))
                        content.packs.chunked(2).forEach { row ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                row.forEach { p ->
                                    SelectChip(
                                        selected = p.id in opts.packIds,
                                        onClick = {
                                            opts = opts.copy(
                                                packIds = if (p.id in opts.packIds) opts.packIds - p.id else opts.packIds + p.id,
                                            )
                                        },
                                        text = p.name.resolve(lang),
                                    )
                                }
                            }
                        }
                    }

                    // Starting team
                    OptionLabel(CnStr.startingTeam.resolve(lang))
                    SegmentedControl(
                        options = listOf(
                            SegmentOption(StartingTeam.RANDOM, CnStr.random.resolve(lang)),
                            SegmentOption(StartingTeam.TEAM_A, CnStr.red.resolve(lang)),
                            SegmentOption(StartingTeam.TEAM_B, CnStr.blue.resolve(lang)),
                        ),
                        value = opts.startingTeam,
                        onChange = { opts = opts.copy(startingTeam = it) },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    // Toggles
                    AppToggle(checked = opts.allowBonusGuess, onCheckedChange = { opts = opts.copy(allowBonusGuess = it) }, label = CnStr.bonusGuess.resolve(lang))
                    AppToggle(checked = opts.forgiveFirstWrong, onCheckedChange = { opts = opts.copy(forgiveFirstWrong = it) }, label = CnStr.forgiveWrong.resolve(lang))
                    AppToggle(checked = opts.chooseOrientation, onCheckedChange = { opts = opts.copy(chooseOrientation = it) }, label = CnStr.orientationToggle.resolve(lang))
                }
            }

            if (errors.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.fillMaxWidth()) {
                    errors.forEach { Text(it.resolve(lang), color = Accents.RoseStrong, fontSize = 14.sp) }
                }
            }

            AppButton(
                text = CnStr.start.resolve(lang),
                onClick = {
                    val o = normalizeOptions(opts, content)
                    val config = CodenamesConfig(players = seats, teams = teams, content = content, lang = lang, options = o)
                    val seed = (System.nanoTime() and 0x7fffffffL).toInt()
                    onStart(createInitialState(config, seed))
                },
                size = ButtonSize.LG,
                fullWidth = true,
                enabled = errors.isEmpty(),
                modifier = Modifier.padding(bottom = 16.dp),
            )
        }
    }
}

@Composable
private fun OptionLabel(text: String) {
    Text(text = text, color = LocalPalette.current.text, fontSize = 14.sp)
}

@Composable
private fun RowScope.TeamColumn(
    name: String,
    color: androidx.compose.ui.graphics.Color,
    members: List<PlayerSeat>,
    onCycle: (String) -> Unit,
    lang: Lang,
) {
    val palette = LocalPalette.current
    Column(
        modifier = Modifier.weight(1f).glass2Surface(palette, CardShape).padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(color))
            Text(name, color = palette.text, fontWeight = FontWeight.Bold, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (members.isEmpty()) {
            Text("—", color = palette.textMuted, fontSize = 12.sp)
        } else {
            members.forEachIndexed { mi, p ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(palette.surface)
                        .clickable { onCycle(p.id) }
                        .padding(horizontal = 8.dp, vertical = 8.dp),
                ) {
                    Text(
                        text = (if (mi == 0) "🔍 " else "") + (p.emoji?.let { "$it " } ?: "") + p.name,
                        color = palette.text,
                        fontWeight = FontWeight.Medium,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}
