package com.gamenight.party.game.truthordare

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.game.Sfx
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.Chip
import com.gamenight.party.ui.components.Curtain
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import kotlinx.coroutines.delay

/**
 * Play — a Kotlin/Compose port of src/games/truth-or-dare/screens/PlayScreen.tsx (+ BottleStage.tsx).
 * The reducer owns every decision (who's up, which prompt, scoring, end); these views only animate
 * the reveal. Phase routing mirrors the web: error / idle (spinner|sequential or bottle) / choosing
 * (roulette or bottle) / revealing (curtain) / resolving (prompt card).
 */
@Composable
fun TruthOrDarePlayScreen(
    state: ToDState,
    lang: Lang,
    manifest: GameManifest,
    content: ToDContent,
    dispatch: (ToDAction) -> Unit,
    onExit: () -> Unit,
    onClose: () -> Unit,
    sound: Sfx = Sfx.None,
    haptics: Haptics = Haptics.none(),
) {
    val s = state
    val palette = LocalPalette.current
    val activeName = s.activePlayerId?.let { s.playerNames[it] } ?: ""
    val prompt = s.currentPromptId?.let { content.byId[it] }
    val promptText = prompt?.text?.resolve(lang) ?: ""

    // Shared chrome: game name in gold + built-in How-to-play; the End-game action rides the trailing slot.
    val header: @Composable () -> Unit = {
        GameAppBar(
            manifest = manifest,
            lang = lang,
            onClose = onClose,
            trailing = if (s.history.isNotEmpty()) {
                {
                    Text(
                        text = ToDStr.endGame.resolve(lang),
                        color = palette.textMuted,
                        fontSize = 14.sp,
                        modifier = Modifier.clickable { dispatch(ToDAction.EndGame) },
                    )
                }
            } else {
                null
            },
        )
    }

    when (s.phase) {
        ToDPhase.ERROR -> ErrorScreen(lang, header, onExit)

        ToDPhase.IDLE, ToDPhase.CHOOSING -> {
            when {
                s.options.selectionMode == SelectionMode.BOTTLE -> BottleStage(s, lang, dispatch, header, sound, haptics)
                s.phase == ToDPhase.IDLE -> IdleScreen(s, lang, dispatch, header, sound)
                else -> ChoosingScreen(s, lang, dispatch, header, activeName, sound, haptics)
            }
        }

        ToDPhase.REVEALING -> RevealingScreen(s, lang, dispatch, header, activeName, sound)

        ToDPhase.RESOLVING -> ResolvingScreen(s, lang, dispatch, header, activeName, prompt, promptText, sound, haptics)

        // The host swaps to Results once finished; this is only a momentary placeholder.
        ToDPhase.GAME_OVER -> AppScreen { header() }
    }
}

/* ─────────────────────────  Phase views  ───────────────────────── */

@Composable
private fun ColumnScope.CenterStage(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.weight(1f).fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
        content = content,
    )
}

@Composable
private fun ErrorScreen(lang: Lang, header: @Composable () -> Unit, onExit: () -> Unit) {
    val palette = LocalPalette.current
    AppScreen {
        header()
        CenterStage {
            Text(text = ToDStr.errorPool.resolve(lang), color = palette.textMuted, fontSize = 16.sp)
            AppButton(text = ToDStr.playAgain.resolve(lang), onClick = onExit, size = ButtonSize.LG)
        }
    }
}

@Composable
private fun IdleScreen(
    s: ToDState,
    lang: Lang,
    dispatch: (ToDAction) -> Unit,
    header: @Composable () -> Unit,
    sound: Sfx,
) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    AppScreen {
        header()
        CenterStage {
            if (s.options.scoringMode == ScoringMode.POINTS) {
                Chip(text = ToDStr.turnCount(lang, s.turnIndex))
            }
            if (s.options.selectionMode == SelectionMode.SPINNER) {
                // Gentle breathing pulse on the bullseye while it waits to be spun (web: scale 1→1.08).
                val pulse = rememberInfiniteTransition(label = "todIdlePulse")
                val pulseScale by pulse.animateFloat(
                    initialValue = 1f,
                    targetValue = 1.08f,
                    animationSpec = infiniteRepeatable(tween(1300, easing = FastOutSlowInEasing), RepeatMode.Reverse),
                    label = "todIdlePulseScale",
                )
                Text(
                    text = "🎯",
                    fontSize = 80.sp,
                    modifier = Modifier.graphicsLayer { scaleX = pulseScale; scaleY = pulseScale },
                )
                Text(text = ToDStr.spinHint.resolve(lang), color = palette.textMuted, fontSize = 18.sp)
                AppButton(
                    // Web fires a 'shuffle' sweep as the spin kicks off (AppButton already plays the tap).
                    text = ToDStr.spin.resolve(lang),
                    onClick = { sound.play(SoundId.SHUFFLE); dispatch(ToDAction.Spin(freshSeed())) },
                    size = ButtonSize.LG,
                )
            } else {
                Text(text = ToDStr.nextUp.resolve(lang), color = palette.textMuted, fontSize = 18.sp)
                Text(
                    text = s.playerNames[nextSequentialId(s)] ?: "",
                    color = accent.base,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 34.sp,
                )
                AppButton(
                    text = ToDStr.nextPlayer.resolve(lang),
                    onClick = { dispatch(ToDAction.NextPlayer) },
                    size = ButtonSize.LG,
                )
            }
        }
    }
}

@Composable
private fun ChoosingScreen(
    s: ToDState,
    lang: Lang,
    dispatch: (ToDAction) -> Unit,
    header: @Composable () -> Unit,
    activeName: String,
    sound: Sfx,
    haptics: Haptics,
) {
    val accent = LocalAccent.current
    val spin = s.options.selectionMode == SelectionMode.SPINNER
    var settled by remember(s.spinSerial) { mutableStateOf(!spin) }
    var display by remember(s.spinSerial) { mutableStateOf(activeName) }
    val names = remember(s.playerNames) { s.playerNames.values.toList() }

    // Roulette the displayed name, decelerating onto the chosen one (spinner only). The reducer
    // already made the pick — this only animates the reveal.
    LaunchedEffect(s.spinSerial) {
        if (!spin) {
            display = activeName
            settled = true
            return@LaunchedEffect
        }
        settled = false
        var i = 0
        var d = 55.0
        while (d < 300.0) {
            display = if (names.isEmpty()) activeName else names[i % names.size]
            i += 1
            delay(d.toLong())
            d *= 1.22
        }
        display = activeName
        settled = true
        // The pick lands: a rising reveal flourish + a success buzz (mirrors the web roulette settle).
        sound.play(SoundId.REVEAL)
        haptics.success()
    }

    // The bullseye pops when the name settles (web: spring to scale 1.06).
    val targetScale by animateFloatAsState(
        targetValue = if (settled) 1.06f else 1f,
        animationSpec = spring(dampingRatio = 0.45f, stiffness = 220f),
        label = "todChosenPop",
    )

    AppScreen {
        header()
        CenterStage {
            Text(
                text = "🎯",
                fontSize = 64.sp,
                modifier = Modifier.graphicsLayer { scaleX = targetScale; scaleY = targetScale },
            )
            Text(
                text = if (settled) ToDStr.yourTurn(lang, activeName) else display,
                color = accent.base,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 30.sp,
                textAlign = TextAlign.Center,
            )
            // Truth / Dare slide + fade in once the chosen player is revealed.
            AnimatedVisibility(
                visible = settled,
                enter = fadeIn(tween(250)) + slideInVertically(tween(250)) { it / 4 },
            ) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    AppButton(
                        text = ToDStr.truth.resolve(lang),
                        onClick = { dispatch(ToDAction.Choose(PromptKind.TRUTH, freshSeed())) },
                        size = ButtonSize.LG,
                        modifier = Modifier.weight(1f),
                    )
                    AppButton(
                        text = ToDStr.dare.resolve(lang),
                        onClick = { dispatch(ToDAction.Choose(PromptKind.DARE, freshSeed())) },
                        variant = ButtonVariant.DANGER,
                        size = ButtonSize.LG,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun RevealingScreen(
    s: ToDState,
    lang: Lang,
    dispatch: (ToDAction) -> Unit,
    header: @Composable () -> Unit,
    activeName: String,
    sound: Sfx,
) {
    var gateOpen by remember(s.spinSerial, s.currentPromptId) { mutableStateOf(false) }
    AppScreen {
        header()
        Curtain(
            open = gateOpen,
            holderName = activeName,
            hint = ToDStr.passTo(lang, activeName),
            revealLabel = ToDStr.reveal.resolve(lang),
            onReveal = {
                // Pulling back the secrecy curtain — a rising whoosh (web plays 'reveal').
                sound.play(SoundId.REVEAL)
                gateOpen = true
                dispatch(ToDAction.Reveal)
            },
            modifier = Modifier.weight(1f).fillMaxWidth(),
        ) { /* The prompt itself shows in the RESOLVING phase the reveal transitions into. */ }
        Box(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
            AppButton(
                text = ToDStr.skipNoReveal.resolve(lang),
                onClick = { dispatch(ToDAction.Resolve(Outcome.SKIP)) },
                variant = ButtonVariant.GHOST,
            )
        }
    }
}

@Composable
private fun ResolvingScreen(
    s: ToDState,
    lang: Lang,
    dispatch: (ToDAction) -> Unit,
    header: @Composable () -> Unit,
    activeName: String,
    prompt: PromptItem?,
    promptText: String,
    sound: Sfx,
    haptics: Haptics,
) {
    val palette = LocalPalette.current

    // Each freshly drawn prompt card springs in (scale + fade), re-firing on every redraw.
    val cardPop = remember(s.currentPromptId) { Animatable(0f) }
    LaunchedEffect(s.currentPromptId) {
        cardPop.snapTo(0f)
        cardPop.animateTo(1f, spring(dampingRatio = 0.6f, stiffness = 240f))
    }

    AppScreen {
        header()
        CenterStage {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Chip(text = intensityLabel(prompt?.intensity ?: Intensity.MILD).resolve(lang))
                Chip(text = if (s.currentKind == PromptKind.DARE) ToDStr.dare.resolve(lang) else ToDStr.truth.resolve(lang))
                if (prompt?.requiresProps == true) Text(text = "🎒", fontSize = 18.sp)
            }
            Text(text = activeName, color = palette.textMuted, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Box(
                modifier = Modifier.fillMaxWidth().graphicsLayer {
                    val p = cardPop.value
                    alpha = p.coerceIn(0f, 1f)
                    val sc = 0.92f + 0.08f * p
                    scaleX = sc
                    scaleY = sc
                },
            ) {
                AppCard(contentPadding = PaddingValues(horizontal = 24.dp, vertical = 40.dp)) {
                    Text(
                        text = promptText,
                        modifier = Modifier.fillMaxWidth(),
                        color = palette.text,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 22.sp,
                        lineHeight = 30.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                AppButton(
                    // Completed the prompt: a satisfying 'correct' chime + success buzz.
                    text = "✓ ${ToDStr.done.resolve(lang)}",
                    onClick = {
                        sound.play(SoundId.CORRECT)
                        haptics.success()
                        dispatch(ToDAction.Resolve(Outcome.DONE))
                    },
                    size = ButtonSize.LG,
                    modifier = Modifier.weight(1f),
                )
                AppButton(
                    // Bailed on the prompt: a soft 'pass' blip (handing it off).
                    text = ToDStr.skip.resolve(lang),
                    onClick = {
                        sound.play(SoundId.PASS)
                        dispatch(ToDAction.Resolve(Outcome.SKIP))
                    },
                    variant = ButtonVariant.SECONDARY,
                    size = ButtonSize.LG,
                    modifier = Modifier.weight(1f),
                )
            }
            AppButton(
                // Drawing a different prompt: a 'shuffle' sweep.
                text = "↻ ${ToDStr.redraw.resolve(lang)}",
                onClick = {
                    sound.play(SoundId.SHUFFLE)
                    dispatch(ToDAction.Redraw(freshSeed()))
                },
                variant = ButtonVariant.GHOST,
            )
        }
    }
}
