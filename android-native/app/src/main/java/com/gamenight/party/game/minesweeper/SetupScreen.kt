package com.gamenight.party.game.minesweeper

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.material3.Text
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.ui.components.AppBar
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.SegmentOption
import com.gamenight.party.ui.components.SegmentedControl
import com.gamenight.party.ui.components.SelectChip
import com.gamenight.party.ui.components.Stepper
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent

/**
 * Mine Hunt setup — a native port of screens/SetupScreen.tsx. Pick the players taking turns (1–4),
 * a difficulty preset (or a custom board), then start. Content is wrapped so [com.gamenight.party.ui.theme.LocalAccent]
 * is this game's tangerine accent.
 */
@Composable
fun MinesweeperSetupScreen(
    roster: List<PlayerSeat>,
    lang: Lang,
    onExit: () -> Unit,
    onStart: (MinesweeperConfig) -> Unit,
) {
    CompositionLocalProvider(com.gamenight.party.ui.theme.LocalAccent provides ColorToken.TANGERINE.accent()) {
        val palette = LocalPalette.current

        var opts by remember { mutableStateOf(DEFAULT_MINE_OPTIONS) }
        var selected by remember { mutableStateOf(roster.take(4).map { it.id }) }

        fun setDifficulty(d: MineDifficulty) {
            opts = if (d == MineDifficulty.CUSTOM) {
                opts.copy(difficulty = MineDifficulty.CUSTOM)
            } else {
                val p = MINE_PRESETS.getValue(d)
                opts.copy(difficulty = d, cols = p.cols, rows = p.rows, mines = p.mines)
            }
        }

        fun setCols(cols: Int) {
            opts = opts.copy(cols = cols, mines = minOf(opts.mines, cols * opts.rows - 9))
        }

        fun setRows(rows: Int) {
            opts = opts.copy(rows = rows, mines = minOf(opts.mines, opts.cols * rows - 9))
        }

        val seats: List<PlayerSeat> = roster.filter { selected.contains(it.id) }
        val errors = validateMineConfig(seats, opts)

        AppScreen(scrollable = true) {
            AppBar(title = loc(lang, "Mine Hunt", "مین‌یاب"), onBack = onExit)

            Column(
                modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                // ── Players ──
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "${loc(lang, "Players", "بازیکنان")} · ${seats.size}",
                        color = palette.textMuted,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                    )
                    Text(
                        text = loc(lang, "Solo, or 2 to 4 players taking turns", "تنها، یا ۲ تا ۴ نفر نوبتی"),
                        color = palette.textDim,
                        fontSize = 12.sp,
                    )
                    if (roster.isEmpty()) {
                        Text(
                            text = loc(lang, "No players yet — add some first.", "هنوز بازیکنی نیست — اول چند نفر اضافه کن."),
                            color = palette.textDim,
                            fontSize = 13.sp,
                        )
                    } else {
                        FlowChips(
                            roster = roster,
                            selected = selected,
                            onToggle = { id ->
                                selected = if (selected.contains(id)) selected - id else selected + id
                            },
                        )
                    }
                }

                // ── Difficulty ──
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(text = loc(lang, "Difficulty", "سختی"), color = palette.text, fontSize = 14.sp)
                    SegmentedControl(
                        value = opts.difficulty,
                        onChange = { setDifficulty(it) },
                        options = listOf(
                            SegmentOption(MineDifficulty.EASY, loc(lang, "Easy", "آسان")),
                            SegmentOption(MineDifficulty.MEDIUM, loc(lang, "Medium", "متوسط")),
                            SegmentOption(MineDifficulty.HARD, loc(lang, "Hard", "سخت")),
                            SegmentOption(MineDifficulty.CUSTOM, loc(lang, "Custom", "دلخواه")),
                        ),
                    )
                }

                // ── Custom board + hint ──
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (opts.difficulty == MineDifficulty.CUSTOM) {
                        Stepper(
                            label = loc(lang, "Columns", "ستون‌ها"),
                            value = opts.cols, min = 6, max = 14,
                            onValueChange = { setCols(it) },
                        )
                        Stepper(
                            label = loc(lang, "Rows", "ردیف‌ها"),
                            value = opts.rows, min = 6, max = 18,
                            onValueChange = { setRows(it) },
                        )
                        Stepper(
                            label = loc(lang, "Mines", "مین‌ها"),
                            value = opts.mines, min = 1, max = opts.cols * opts.rows - 9,
                            onValueChange = { opts = opts.copy(mines = it) },
                        )
                    }
                    Text(
                        text = loc(
                            lang,
                            "≈ ${opts.mines} mines to find on a ${opts.cols}×${opts.rows} board",
                            "حدود ${opts.mines} مین برای پیدا کردن روی صفحهٔ ${opts.cols}×${opts.rows}",
                        ),
                        color = palette.textMuted,
                        fontSize = 12.sp,
                    )
                }

                // ── Errors ──
                if (errors != null) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        errors.forEach { e ->
                            Text(text = e.resolve(lang), color = Accents.RoseStrong, fontSize = 14.sp)
                        }
                    }
                }

                AppButton(
                    text = loc(lang, "Start", "شروع"),
                    onClick = {
                        onStart(MinesweeperConfig(players = seats, options = normalizeMineOptions(opts), lang = lang))
                    },
                    size = ButtonSize.LG,
                    fullWidth = true,
                    enabled = errors == null,
                )
            }
        }
    }
}

/** A simple wrapping-ish chip list (rows of up to three) for selecting roster members. */
@Composable
private fun FlowChips(
    roster: List<PlayerSeat>,
    selected: List<String>,
    onToggle: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        roster.chunked(3).forEach { rowItems ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                rowItems.forEach { p ->
                    SelectChip(
                        selected = selected.contains(p.id),
                        onClick = { onToggle(p.id) },
                        text = p.emoji?.let { "$it ${p.name}" } ?: p.name,
                    )
                }
            }
        }
    }
}
