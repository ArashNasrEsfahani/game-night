package com.gamenight.party.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.ui.theme.Accents

/**
 * The "can't start yet" banner shown above a disabled Start button on every game's setup screen — a
 * rose-tinted, bordered card with a warning glyph, so the blocking reason (too few players, missing
 * config) is impossible to miss instead of a faint line of red text. A 1:1 peer of
 * src/sdk/ui/SetupErrors.tsx. Renders nothing when [errors] is null or empty.
 */
@Composable
fun SetupErrors(errors: List<LocalizedString>?, lang: Lang, modifier: Modifier = Modifier) {
    if (errors.isNullOrEmpty()) return
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Accents.Rose.copy(alpha = 0.14f))
            .border(1.dp, Accents.Rose.copy(alpha = 0.45f), shape)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(text = "⚠️", fontSize = 16.sp)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
            errors.forEach { e ->
                Text(
                    text = e.resolve(lang),
                    color = Accents.RoseStrong,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }
    }
}
