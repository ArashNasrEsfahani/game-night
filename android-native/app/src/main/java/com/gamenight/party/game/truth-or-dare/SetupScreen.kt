package com.gamenight.party.game.truthordare

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.AppToggle
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.SegmentedControl
import com.gamenight.party.ui.components.SegmentOption
import com.gamenight.party.ui.components.SelectChip
import com.gamenight.party.ui.components.Stepper
import com.gamenight.party.ui.screens.fmtNum
import com.gamenight.party.ui.theme.LocalPalette

/**
 * Setup — a Kotlin/Compose port of src/games/truth-or-dare/screens/SetupScreen.tsx. Players + the
 * intensity tiers are always visible; everything else (selection mode, scoring, end condition,
 * privacy, anti-repeat) collapses behind "More options". Builds + validates a [ToDConfig], then on
 * Start creates the seed-threaded initial state and hands it to [onStart].
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TruthOrDareSetupScreen(
    players: List<PlayerSeat>,
    lang: Lang,
    manifest: GameManifest,
    content: ToDContent,
    onStart: (ToDState) -> Unit,
    onClose: () -> Unit,
) {
    val palette = LocalPalette.current
    var opts by remember { mutableStateOf(DEFAULT_OPTIONS) }
    var selected by remember(players) { mutableStateOf(players.map { it.id }.toSet()) }
    var showMore by remember { mutableStateOf(false) }

    val seats = players.filter { it.id in selected }
    val config = ToDConfig(seats, opts, lang)
    val errors = validateConfig(content, config)

    // Non-scrolling scaffold: options scroll in a weighted middle, the Start CTA is pinned at the foot.
    AppScreen {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose)

        Column(
            verticalArrangement = Arrangement.spacedBy(20.dp),
            modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
        ) {
            // ── Players (always visible) ──
            SectionLabel("${ToDStr.players.resolve(lang)} · ${fmtNum(seats.size, lang)}")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                players.forEach { p ->
                    SelectChip(
                        selected = p.id in selected,
                        onClick = {
                            selected = if (p.id in selected) selected - p.id else selected + p.id
                        },
                        text = p.emoji?.let { "$it ${p.name}" } ?: p.name,
                    )
                }
            }

            // ── Intensity tiers (always visible, multi-select) ──
            SectionLabel(ToDStr.intensity.resolve(lang))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                INTENSITIES.forEach { i ->
                    SelectChip(
                        selected = opts.intensities[i] == true,
                        onClick = {
                            opts = opts.copy(intensities = opts.intensities + (i to !(opts.intensities[i] ?: false)))
                        },
                        text = intensityLabel(i).resolve(lang),
                    )
                }
            }

            // ── Collapsible: everything else ──
            AppButton(
                text = if (showMore) "▾ ${ToDStr.moreOptions.resolve(lang)}" else "▸ ${ToDStr.moreOptions.resolve(lang)}",
                onClick = { showMore = !showMore },
                variant = ButtonVariant.GHOST,
                size = ButtonSize.SM,
            )

            if (showMore) {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.fillMaxWidth()) {
                    // Selection mode
                    FieldLabel(ToDStr.selection.resolve(lang))
                    SegmentedControl(
                        options = listOf(
                            SegmentOption(SelectionMode.SPINNER, ToDStr.selSpinner.resolve(lang)),
                            SegmentOption(SelectionMode.BOTTLE, ToDStr.selBottle.resolve(lang)),
                            SegmentOption(SelectionMode.SEQUENTIAL, ToDStr.selSequential.resolve(lang)),
                        ),
                        value = opts.selectionMode,
                        onChange = { opts = opts.copy(selectionMode = it) },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    // Scoring mode
                    FieldLabel(ToDStr.scoring.resolve(lang))
                    SegmentedControl(
                        options = listOf(
                            SegmentOption(ScoringMode.CASUAL, ToDStr.scoreCasual.resolve(lang)),
                            SegmentOption(ScoringMode.POINTS, ToDStr.scorePoints.resolve(lang)),
                        ),
                        value = opts.scoringMode,
                        onChange = { mode ->
                            // Dropping out of points mode must also drop the (now invalid) target end type.
                            opts = if (mode != ScoringMode.POINTS && opts.endType == EndType.TARGET) {
                                opts.copy(scoringMode = mode, endType = EndType.ENDLESS)
                            } else {
                                opts.copy(scoringMode = mode)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    if (opts.scoringMode == ScoringMode.POINTS) {
                        Stepper(
                            value = opts.pointsForDare,
                            onValueChange = { opts = opts.copy(pointsForDare = it) },
                            min = 0, max = 10, label = ToDStr.pointsForDare.resolve(lang),
                        )
                        Stepper(
                            value = opts.pointsForTruth,
                            onValueChange = { opts = opts.copy(pointsForTruth = it) },
                            min = 0, max = 10, label = ToDStr.pointsForTruth.resolve(lang),
                        )
                        Stepper(
                            value = opts.pointsForSkip,
                            onValueChange = { opts = opts.copy(pointsForSkip = it) },
                            min = 0, max = 10, label = ToDStr.pointsForSkip.resolve(lang),
                        )
                    }

                    // End condition
                    FieldLabel(ToDStr.endLabel.resolve(lang))
                    val endOptions = buildList {
                        add(SegmentOption(EndType.ENDLESS, ToDStr.endEndless.resolve(lang)))
                        add(SegmentOption(EndType.ROUNDS, ToDStr.endRounds.resolve(lang)))
                        if (opts.scoringMode == ScoringMode.POINTS) {
                            add(SegmentOption(EndType.TARGET, ToDStr.endTarget.resolve(lang)))
                        }
                    }
                    SegmentedControl(
                        options = endOptions,
                        value = opts.endType,
                        onChange = { opts = opts.copy(endType = it) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (opts.endType != EndType.ENDLESS) {
                        Stepper(
                            value = opts.endValue,
                            onValueChange = { opts = opts.copy(endValue = it) },
                            min = 1, max = 50,
                            label = if (opts.endType == EndType.ROUNDS) ToDStr.roundsCount.resolve(lang) else ToDStr.targetPoints.resolve(lang),
                        )
                    }

                    // Privacy
                    FieldLabel(ToDStr.privacy.resolve(lang))
                    SegmentedControl(
                        options = listOf(
                            SegmentOption(PrivateReveal.NEVER, ToDStr.privNever.resolve(lang)),
                            SegmentOption(PrivateReveal.SPICY_ONLY, ToDStr.privSpicy.resolve(lang)),
                            SegmentOption(PrivateReveal.ALWAYS, ToDStr.privAlways.resolve(lang)),
                        ),
                        value = opts.privateReveal,
                        onChange = { opts = opts.copy(privateReveal = it) },
                        modifier = Modifier.fillMaxWidth(),
                    )

                    AppToggle(
                        checked = opts.avoidImmediateRepeat,
                        onCheckedChange = { opts = opts.copy(avoidImmediateRepeat = it) },
                        label = ToDStr.avoidRepeat.resolve(lang),
                    )
                }
            }
        }

        // ── Errors + Start (pinned to the foot so it's always reachable) ──
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            errors.forEach { e ->
                Text(text = e.resolve(lang), color = palette.text, fontSize = 14.sp)
            }
            // Distinct PRIMARY accent gradient (+ glow) so the CTA stands out from the option controls.
            AppButton(
                text = ToDStr.start.resolve(lang),
                onClick = { onStart(createInitialState(content, config, freshSeed())) },
                variant = ButtonVariant.PRIMARY,
                size = ButtonSize.LG,
                fullWidth = true,
                enabled = errors.isEmpty(),
            )
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    val palette = LocalPalette.current
    Text(text = text, color = palette.textMuted, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
}

@Composable
private fun FieldLabel(text: String) {
    val palette = LocalPalette.current
    Text(text = text, color = palette.text, fontSize = 14.sp)
}
