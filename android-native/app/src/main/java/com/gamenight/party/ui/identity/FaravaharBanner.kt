package com.gamenight.party.ui.identity

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.ui.theme.Brand
import com.gamenight.party.ui.theme.LocalPalette

/**
 * Wide winged-disc (Faravahar) crest — a banner divider drenched in gold light. Native port of
 * src/sdk/ui/FaravaharBanner.tsx. The wings are rendered in gold (the web passed
 * color="--color-game-gold").
 */
@Composable
fun FaravaharBanner(
    subtitle: String? = null,
    modifier: Modifier = Modifier,
) {
    val palette = LocalPalette.current
    // radial-gradient(80% 140% at 50% 0%, gold→lapis, surface) — approximated as a vertical glow.
    val glow = lerp(palette.surface, Brand, 0.16f)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.verticalGradient(listOf(glow, palette.surface)))
            .border(1.dp, palette.border, RoundedCornerShape(24.dp))
            .padding(horizontal = 16.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Motif(
            name = "faravahar",
            accent = Brand,
            modifier = Modifier
                .fillMaxWidth(0.78f)
                .aspectRatio(160f / 104f),
        )
        if (subtitle != null) {
            Text(
                text = subtitle,
                color = palette.textMuted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
            )
        }
    }
}
