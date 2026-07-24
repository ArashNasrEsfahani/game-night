package com.gamenight.party.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.ui.theme.LocalPalette

/**
 * Mobile-first page scaffold — a 1:1 port of src/sdk/ui/Screen.tsx: a centered column constrained
 * to a max width, with safe-area insets honoured on every edge so content clears the status bar,
 * gesture nav and display cutouts.
 *
 * @param scrollable when true the column scrolls vertically; leave false (default) when children use
 *   [ColumnScope.weight] to divide the height (e.g. a [Curtain] that fills the screen).
 */
@Composable
fun AppScreen(
    modifier: Modifier = Modifier,
    horizontalAlignment: Alignment.Horizontal = Alignment.Start,
    verticalArrangement: Arrangement.Vertical = Arrangement.Top,
    scrollable: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(modifier = modifier.fillMaxSize()) {
        // The animated Disco Persian backdrop sits at the bottom; content/cards above stay opaque.
        DiscoBackground(modifier = Modifier.matchParentSize())
        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .fillMaxHeight()
                .widthIn(max = 420.dp)
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(horizontal = 16.dp)
                // Every screen eases in (fade + slight rise/scale), mirroring the web dp-rise.
                .screenEntrance()
                .then(if (scrollable) Modifier.verticalScroll(rememberScrollState()) else Modifier),
            horizontalAlignment = horizontalAlignment,
            verticalArrangement = verticalArrangement,
            content = content,
        )
    }
}

/**
 * Top bar — a 1:1 port of src/sdk/ui/AppBar.tsx: an optional auto-mirroring back chevron, a bold
 * truncating title that takes the remaining width, and an optional trailing slot.
 */
@Composable
fun AppBar(
    title: String? = null,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
    right: (@Composable () -> Unit)? = null,
) {
    val palette = LocalPalette.current
    Row(
        modifier = modifier.fillMaxWidth().height(56.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (onBack != null) {
            IconCircleButton(onClick = onBack, size = 40.dp) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = palette.text,
                    modifier = Modifier.size(24.dp),
                )
            }
        }
        Text(
            text = title.orEmpty(),
            modifier = Modifier.weight(1f),
            color = palette.text,
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        right?.invoke()
    }
}
