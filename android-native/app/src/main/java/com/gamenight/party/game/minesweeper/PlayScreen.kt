package com.gamenight.party.game.minesweeper

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.game.Sfx
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.EndGameButton
import com.gamenight.party.ui.components.PillShape
import com.gamenight.party.ui.components.glass2Surface
import com.gamenight.party.ui.components.screenEntrance
import com.gamenight.party.ui.screens.faDigits
import com.gamenight.party.ui.screens.fmtNum
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent
import kotlinx.coroutines.delay
import kotlin.random.Random

private fun fmtClock(sec: Int): String = "${sec / 60}:${(sec % 60).toString().padStart(2, '0')}"

/**
 * Mine Hunt play — a native port of screens/PlayScreen.tsx. The active player taps squares to hunt
 * mines; the header shows the remaining count and whose turn it is (or a solo stopwatch). Feedback
 * flashes per tap and auto-clears. Content wears this game's tangerine accent.
 */
@Composable
fun MinesweeperPlayScreen(
    state: MinesweeperState,
    lang: Lang,
    manifest: GameManifest,
    dispatch: (MinesweeperAction) -> Unit,
    onClose: () -> Unit,
    sound: Sfx = Sfx.None,
    haptics: Haptics = Haptics.none(),
) {
    CompositionLocalProvider(LocalAccent provides ColorToken.TANGERINE.accent()) {
        val palette = LocalPalette.current
        val accent = LocalAccent.current
        val s = state
        val solo = isSolo(s)
        val active = activeSeat(s)

        // Solo stopwatch — screen-local, anchored to wall clock, never persisted (resume-safe).
        var elapsed by remember { mutableStateOf(0) }
        LaunchedEffect(solo, s.phase) {
            if (!solo || s.phase != MinePhase.PLAYING) return@LaunchedEffect
            val start = System.currentTimeMillis()
            while (true) {
                elapsed = ((System.currentTimeMillis() - start) / 1000).toInt().coerceAtLeast(0)
                delay(250)
            }
        }

        // Feedback per tap, then clear the flash. A find is celebratory (santur pluck + success buzz);
        // a safe square is a soft pass (filtered blip + light tick). Mirrors the web PlayScreen flash
        // effect — fired here in the UI layer, never inside the reducer.
        LaunchedEffect(s.flash) {
            val f = s.flash ?: return@LaunchedEffect
            when (f.type) {
                FlashType.FOUND -> { sound.play(SoundId.SELECT); haptics.success() }
                FlashType.SAFE -> { sound.play(SoundId.PASS); haptics.light() }
                FlashType.WIN -> Unit // the win flourish plays on the results screen
            }
            if (f.type != FlashType.WIN) {
                delay(900)
                dispatch(MinesweeperAction.ClearFlash)
            }
        }

        val seatColors: Map<String, ColorToken?> = remember(s.seats) { s.seats.associate { it.id to it.color } }

        val toast: String? = when {
            s.flash?.type == FlashType.FOUND -> loc(lang, "Mine found! Tap again 🎉", "مین پیدا شد! دوباره بزن 🎉")
            s.flash?.type == FlashType.SAFE && !solo -> loc(lang, "Safe square, next player's turn", "خانهٔ امن؛ نوبت نفر بعد")
            else -> null
        }

        AppScreen {
            GameAppBar(
                manifest = manifest,
                lang = lang,
                onClose = onClose,
                trailing = {
                    EndGameButton(lang = lang, onEndGame = { dispatch(MinesweeperAction.EndGame) })
                },
            )

            // Goal + turn line. Until the first tap seeds the board the exact mine total isn't known,
            // so show a goal prompt rather than a number that would jump.
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = "💣 " + if (s.minesPlaced) {
                        loc(lang, "${fmtNum(minesLeft(s), lang)} to find", "${fmtNum(minesLeft(s), lang)} مانده")
                    } else {
                        loc(lang, "Find them all!", "همه را پیدا کن!")
                    },
                    color = palette.text,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                )
                if (solo) {
                    Text(text = "⏱ ${faDigits(fmtClock(elapsed), lang)}", color = palette.textMuted, fontSize = 14.sp)
                } else {
                    // Re-key on the active seat so the name pops in on every turn hand-off
                    // (mirrors the web spring-in keyed on active.id).
                    key(active.id) {
                        Text(
                            text = loc(lang, "${active.name}'s turn", "نوبت ${active.name}"),
                            color = accent.base,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            modifier = Modifier.screenEntrance(translateY = 6.dp, fromScale = 0.9f, durationMillis = 280),
                        )
                    }
                }
            }

            // Per-player tallies (versus only).
            if (!solo) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    s.seats.forEach { se ->
                        val isActive = se.id == active.id
                        // The whose-turn pill gently springs up to emphasise the active player.
                        val pillScale by animateFloatAsState(
                            targetValue = if (isActive) 1.05f else 1f,
                            animationSpec = spring(dampingRatio = 0.8f, stiffness = 285f),
                            label = "minePillScale",
                        )
                        Box(
                            modifier = Modifier
                                .graphicsLayer { scaleX = pillScale; scaleY = pillScale }
                                .then(
                                    if (isActive) Modifier.clip(PillShape).background(accent.strong, PillShape)
                                    else Modifier.glass2Surface(palette, PillShape),
                                )
                                .padding(horizontal = 10.dp, vertical = 5.dp),
                        ) {
                            Text(
                                text = "${se.name} · 💣 ${fmtNum(se.score, lang)}",
                                color = if (isActive) accent.onAccent else palette.textMuted,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
            }

            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // Fixed-height slot so the toast never reflows (and jumps) the board.
                Box(modifier = Modifier.fillMaxWidth().height(24.dp), contentAlignment = Alignment.Center) {
                    if (toast != null) {
                        // Re-key per message so each toast pops in fresh (mirrors the web AnimatePresence).
                        key(toast) {
                            Text(
                                text = toast,
                                color = if (s.flash?.type == FlashType.FOUND) Accents.GoldStrong else palette.textMuted,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.screenEntrance(translateY = 8.dp, fromScale = 0.9f, durationMillis = 260),
                            )
                        }
                    }
                }

                MineGrid(
                    cells = s.board,
                    cols = s.cols,
                    seatColors = seatColors,
                    onReveal = { i ->
                        haptics.light() // a light nudge on every reveal tap (mirrors web reveal())
                        dispatch(MinesweeperAction.Reveal(index = i, seed = Random.nextInt()))
                    },
                )

                Text(
                    text = loc(
                        lang,
                        "Tap a square to hunt. Find a mine and you go again; a safe square reveals a clue and passes the turn.",
                        "روی خانه بزن و شکار کن. مین پیدا کنی دوباره می‌زنی؛ خانهٔ امن یک راهنما نشان می‌دهد و نوبت رد می‌شود.",
                    ),
                    color = palette.textMuted,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}
