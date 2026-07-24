package com.gamenight.party.ui.components

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.BlurredEdgeTreatment
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.ui.theme.LocalAccent

// The secrecy alcove is always a dark space (in both themes) so the accent halo reads and the light
// text stays legible — these mirror the hard-coded colours in src/sdk/ui/Curtain.tsx.
private val AlcoveInner = Color(0xFF1A1140)
private val AlcoveOuter = Color(0xFF120C2E)
private val AlcoveInk = Color(0xFFFDF6E6)

/**
 * Pass-the-phone secrecy curtain — a 1:1 port of src/sdk/ui/Curtain.tsx. While closed it shows a
 * dark alcove with a rotating accent halo, the holder's avatar and a reveal button; tapping reveals
 * the [content]. Let the caller give it height via [Modifier.weight] / fillMaxSize.
 */
@Composable
fun Curtain(
    open: Boolean,
    hint: String,
    revealLabel: String,
    onReveal: () -> Unit,
    modifier: Modifier = Modifier,
    holderName: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Crossfade(targetState = open, label = "curtain", modifier = modifier.fillMaxWidth()) { isOpen ->
        if (isOpen) {
            Column(modifier = Modifier.fillMaxSize(), content = content)
        } else {
            CurtainCover(hint = hint, revealLabel = revealLabel, holderName = holderName, onReveal = onReveal)
        }
    }
}

@Composable
private fun CurtainCover(
    hint: String,
    revealLabel: String,
    holderName: String?,
    onReveal: () -> Unit,
) {
    val accent = LocalAccent.current
    val haloTransition = rememberInfiniteTransition(label = "halo")
    val haloAngle by haloTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(14000, easing = LinearEasing), RepeatMode.Restart),
        label = "haloAngle",
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .clip(CardShape)
            .border(1.dp, accent.glow, CardShape)
            .drawBehind {
                drawRect(
                    Brush.radialGradient(
                        colors = listOf(lerp(AlcoveInner, accent.strong, 0.6f), AlcoveOuter),
                        center = Offset(size.width / 2f, 0f),
                        radius = maxOf(size.width, size.height) * 0.95f,
                    ),
                )
            }
            .padding(horizontal = 24.dp, vertical = 40.dp),
        contentAlignment = Alignment.Center,
    ) {
        // Rotating disco halo behind the avatar.
        Box(
            modifier = Modifier
                .size(240.dp)
                .graphicsLayer { rotationZ = haloAngle; alpha = 0.6f }
                .blur(34.dp, BlurredEdgeTreatment.Unbounded)
                .background(
                    Brush.sweepGradient(
                        listOf(Color.Transparent, accent.base.copy(alpha = 0.7f), Color.Transparent),
                    ),
                    CircleShape,
                ),
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            // Holder avatar.
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .shadow(18.dp, CircleShape, clip = false, spotColor = accent.glow, ambientColor = accent.glow)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(accent.base, accent.strong)), CircleShape)
                    .border(4.dp, Color.White.copy(alpha = 0.14f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = holderName?.take(1)?.uppercase() ?: "🤫",
                    color = accent.onAccent,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
            }

            Text(
                text = hint,
                color = AlcoveInk,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            )
            if (holderName != null) {
                Text(
                    text = holderName,
                    color = AlcoveInk,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center,
                )
            }

            AppButton(text = revealLabel, onClick = onReveal, size = ButtonSize.LG)
        }
    }
}
