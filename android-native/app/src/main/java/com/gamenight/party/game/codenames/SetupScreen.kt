package com.gamenight.party.game.codenames

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.ui.components.SetupErrors
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.AppToggle
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.SegmentOption
import com.gamenight.party.ui.components.SegmentedControl
import com.gamenight.party.ui.components.SelectChip
import com.gamenight.party.ui.components.TeamAssigner
import com.gamenight.party.ui.components.TeamColumnSpec
import com.gamenight.party.ui.components.rememberTeamAssignment
import com.gamenight.party.ui.screens.fmtNum
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.TeamA
import com.gamenight.party.ui.theme.TeamB
import com.gamenight.party.ui.theme.accent

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
    manifest: GameManifest,
    onStart: (CodenamesState) -> Unit,
    onClose: () -> Unit,
) {
    CompositionLocalProvider(LocalAccent provides ColorToken.LIME.accent()) {
        val palette = LocalPalette.current

        var selected by remember { mutableStateOf(players.map { it.id }.toSet()) }
        var opts by remember { mutableStateOf(DEFAULT_OPTIONS) }
        var showMore by remember { mutableStateOf(false) }

        val seats = players.filter { it.id in selected }
        val selectedIds = seats.map { it.id }

        // Auto-balanced two-team split the host can tweak per player (shared with the other team games).
        val assignment = rememberTeamAssignment(selectedIds, 2)
        val memberAIds = assignment.memberIdsByTeam[0]
        val memberBIds = assignment.memberIdsByTeam[1]
        val teams = listOf(
            CnConfigTeam("teamA", CnStr.red, memberAIds),
            CnConfigTeam("teamB", CnStr.blue, memberBIds),
        )

        val errors = validateConfig(seats, teams, opts, content)

        AppScreen {
            GameAppBar(manifest = manifest, lang = lang, onClose = onClose, back = true)

            // Scrollable settings; the Start button stays pinned below so it's always reachable.
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                // ── Players ──
                Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "${CnStr.players.resolve(lang)} · ${fmtNum(seats.size, lang)}",
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
                    TeamAssigner(
                        players = seats,
                        columns = listOf(
                            TeamColumnSpec(CnStr.red.resolve(lang), TeamA),
                            TeamColumnSpec(CnStr.blue.resolve(lang), TeamB),
                        ),
                        byPlayer = assignment.byPlayer,
                        onCycle = assignment.cycle,
                        spymasterFirst = true,
                        hint = "🔍 = ${CnStr.spymaster.resolve(lang)} · ${CnStr.teamHint.resolve(lang)}",
                    )
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
                                options = listOf(60, 120, 180, 240).map { SegmentOption(it, "${fmtNum(it / 60, lang)}m") },
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
            }

            // ── Pinned Start: a distinct GOLD accent so it stands out from the lime option controls,
            // full width and always reachable at the bottom regardless of how far the list scrolls.
            Column(
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 4.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SetupErrors(errors = errors, lang = lang)
                CompositionLocalProvider(LocalAccent provides ColorToken.GOLD.accent()) {
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
                    )
                }
            }
        }
    }
}

@Composable
private fun OptionLabel(text: String) {
    Text(text = text, color = LocalPalette.current.text, fontSize = 14.sp)
}

