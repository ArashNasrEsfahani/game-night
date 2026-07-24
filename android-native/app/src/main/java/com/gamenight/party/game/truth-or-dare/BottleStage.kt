package com.gamenight.party.game.truthordare

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.game.Sfx
import com.gamenight.party.model.Lang
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.ButtonSize
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent
import kotlin.math.cos
import kotlin.math.sin

/**
 * Spin-the-bottle picker — a Kotlin/Compose port of src/games/truth-or-dare/screens/BottleStage.tsx.
 *
 * The TARGET is decided purely by the reducer (SPIN -> activePlayerId, bumping spinSerial); this view
 * ONLY animates the reveal: it winds the bottle a variable 4–7 whole turns, glides to a friction stop
 * so the neck lands on the chosen seat, then rocks back and forth (overshoot ~9°, rebound ~3°, settle)
 * like a real spun bottle. When it lands it highlights the seat and offers Truth / Dare. A reduced-
 * motion path (system "remove animations") settles in one quick step instead.
 *
 * Geometry mirrors the web: the bottle is drawn pointing UP (neck at top) at rotation 0; seat i sits
 * at angle (-90 + i/n*360)°, so rotating by (targetIndex/n*360) points the neck at the target.
 */
@Composable
internal fun BottleStage(
    s: ToDState,
    lang: Lang,
    dispatch: (ToDAction) -> Unit,
    header: @Composable () -> Unit,
    sound: Sfx = Sfx.None,
    haptics: Haptics = Haptics.none(),
) {
    val accent = LocalAccent.current
    val palette = LocalPalette.current

    // Kicking off a spin: a shuffle sweep + a springy boing + a light tick (mirrors the web spin()).
    val spin: () -> Unit = {
        sound.play(SoundId.SHUFFLE)
        sound.play(SoundId.BOING)
        haptics.light()
        dispatch(ToDAction.Spin(freshSeed()))
    }

    // Honour the OS "remove animations" / reduce-motion toggle (animator duration scale of 0).
    val context = LocalContext.current
    val reduce = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }

    val seats = remember(s.playerIds, s.playerNames) { s.playerIds.map { it to (s.playerNames[it] ?: "") } }
    val n = maxOf(seats.size, 1)
    val targetIndex = s.activePlayerId?.let { s.playerIds.indexOf(it) } ?: -1
    val activeName = s.activePlayerId?.let { s.playerNames[it] } ?: ""
    val activeColor = s.activePlayerId?.let { s.playerColors[it] }
    val auraColor = (activeColor?.accent() ?: accent).base

    // Accumulated rotation in degrees; only ever climbs across spins (the wobble dips locally).
    val rotation = remember { Animatable(0f) }
    var landed by remember(s.spinSerial) { mutableStateOf(false) }

    // On each fresh spin, wind several whole turns to the chosen seat, then settle with a damped wobble.
    LaunchedEffect(s.spinSerial, targetIndex) {
        if (s.phase != ToDPhase.CHOOSING || targetIndex < 0) return@LaunchedEffect
        landed = false
        val base = rotation.value
        val currentMod = ((base % 360f) + 360f) % 360f
        val want = (targetIndex.toFloat() / n) * 360f
        val delta = (((want - currentMod) % 360f) + 360f) % 360f
        if (reduce) {
            // Reduced motion: no spinning theatre, just glide straight onto the seat.
            rotation.animateTo(base + delta, tween(durationMillis = 250, easing = LinearOutSlowInEasing))
        } else {
            // Vary the spin every time (4–7 whole turns) so it never feels canned.
            val turns = 4 + (s.spinSerial % 4)
            val final = base + turns * 360f + delta
            val totalMs = ((2f + turns * 0.28f) * 1000f).toInt()
            // Long friction glide that overshoots the seat...
            rotation.animateTo(
                targetValue = final + 9f,
                animationSpec = tween((totalMs * 0.82f).toInt(), easing = CubicBezierEasing(0.1f, 0.72f, 0.2f, 1f)),
            )
            // ...rebounds back past it...
            rotation.animateTo(
                targetValue = final - 3f,
                animationSpec = tween((totalMs * 0.11f).toInt(), easing = CubicBezierEasing(0.4f, 0f, 0.6f, 1f)),
            )
            // ...then settles onto the seat.
            rotation.animateTo(
                targetValue = final,
                animationSpec = tween((totalMs * 0.07f).toInt(), easing = CubicBezierEasing(0.33f, 0f, 0.3f, 1f)),
            )
        }
        landed = true
        // The neck settles on the chosen seat: a reveal flourish + a firmer buzz (web onAnimationComplete).
        sound.play(SoundId.REVEAL)
        haptics.medium()
    }

    AppScreen {
        header()
        Column(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(300.dp)
                    .then(
                        // A soft turn-aura behind the ring in the active player's colour (mirrors TurnAura).
                        if (s.phase == ToDPhase.CHOOSING) {
                            Modifier.background(
                                Brush.radialGradient(listOf(auraColor.copy(alpha = 0.18f), Color.Transparent)),
                            )
                        } else {
                            Modifier
                        },
                    ),
                contentAlignment = Alignment.Center,
            ) {
                seats.forEachIndexed { i, seat ->
                    val theta = Math.toRadians(-90.0 + (i.toDouble() / n) * 360.0)
                    val r = 118f
                    val x = (cos(theta) * r).toFloat()
                    val y = (sin(theta) * r).toFloat()
                    val chosen = landed && i == targetIndex
                    val chipScale by animateFloatAsState(if (chosen) 1.1f else 1f, label = "chip$i")
                    Box(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .offset(x = x.dp, y = y.dp)
                            .graphicsLayer { scaleX = chipScale; scaleY = chipScale }
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (chosen) accent.base else palette.surface2)
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                            .width(72.dp),
                    ) {
                        Text(
                            text = seat.second,
                            color = if (chosen) accent.onAccent else palette.text,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }

                // The bottle itself: a Canvas shape, neck (pointer) on top, rotating about the ring centre.
                // Tappable while idle so the bottle itself triggers the spin (like the web button).
                val canTap = s.phase == ToDPhase.IDLE
                Canvas(
                    modifier = Modifier
                        .size(width = 50.dp, height = 150.dp)
                        .graphicsLayer { rotationZ = rotation.value }
                        .then(
                            if (canTap) {
                                Modifier.clickable(
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication = null,
                                ) { spin() }
                            } else {
                                Modifier
                            },
                        ),
                ) {
                    val sx = size.width / 46f
                    val sy = size.height / 138f
                    fun px(x: Float) = x * sx
                    fun py(y: Float) = y * sy

                    // Body silhouette (a faithful trace of the web's <path>): neck shoulders down to a round base.
                    val body = Path().apply {
                        moveTo(px(15f), py(34f))
                        quadraticTo(px(23f), py(28f), px(31f), py(34f))
                        lineTo(px(35f), py(60f))
                        quadraticTo(px(36f), py(70f), px(36f), py(84f))
                        lineTo(px(36f), py(120f))
                        quadraticTo(px(36f), py(134f), px(23f), py(134f))
                        quadraticTo(px(10f), py(134f), px(10f), py(120f))
                        lineTo(px(10f), py(84f))
                        quadraticTo(px(10f), py(70f), px(11f), py(60f))
                        close()
                    }
                    // Coloured drop-shadow glow under the body (mirrors the web drop-shadow).
                    translate(left = 0f, top = py(5f)) { drawPath(body, color = accent.glow) }
                    // Body fill + outline.
                    drawPath(
                        path = body,
                        brush = Brush.verticalGradient(listOf(accent.base, accent.strong), startY = py(34f), endY = py(134f)),
                    )
                    drawPath(body, color = accent.strong, style = Stroke(width = 2.5f * sx))
                    // Neck.
                    drawRect(color = accent.base, topLeft = Offset(px(19.5f), py(12f)), size = Size(px(7f), py(22f)))
                    // Cap.
                    drawRoundRect(
                        color = accent.strong,
                        topLeft = Offset(px(18f), py(2f)),
                        size = Size(px(10f), py(11f)),
                        cornerRadius = CornerRadius(2.5f * sx, 2.5f * sx),
                    )
                    // Label highlight + cap glint.
                    drawRoundRect(
                        color = accent.onAccent.copy(alpha = 0.18f),
                        topLeft = Offset(px(13f), py(92f)),
                        size = Size(px(20f), py(16f)),
                        cornerRadius = CornerRadius(3f * sx, 3f * sx),
                    )
                    drawCircle(color = accent.onAccent.copy(alpha = 0.5f), radius = 2f * sx, center = Offset(px(23f), py(6.5f)))
                }
            }

            when {
                s.phase == ToDPhase.IDLE -> {
                    Text(text = ToDStr.bottleHint.resolve(lang), color = palette.textMuted, fontSize = 14.sp)
                    AppButton(
                        text = "🍾 ${ToDStr.bottleSpin.resolve(lang)}",
                        onClick = spin,
                        size = ButtonSize.LG,
                    )
                }

                !landed -> Text(
                    text = ToDStr.spinning.resolve(lang),
                    color = accent.base,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 18.sp,
                )

                else -> {
                    Text(
                        text = ToDStr.yourTurn(lang, activeName),
                        color = accent.base,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 22.sp,
                        textAlign = TextAlign.Center,
                    )
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
}
