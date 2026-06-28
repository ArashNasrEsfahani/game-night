package com.gamenight.party.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.ui.components.DiscoBackground
import com.gamenight.party.ui.identity.Emblem
import com.gamenight.party.ui.identity.LionSunCrest
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.Display
import com.gamenight.party.ui.theme.GamePalette
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent

/**
 * The home grid — the native face of the webapp's HomePage. A Lion & Sun hero crest over a
 * gold-foil title sits above a scrollable grid of per-game cards, each a lit niche (طاق) holding
 * the game's heraldic [Emblem]. The whole page is transparent so the [DiscoBackground] painted
 * behind it shows through. Tapping a card calls [onOpen] with the game id.
 */
@Composable
fun HomeScreen(
    games: List<GameManifest>,
    lang: Lang,
    onOpen: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = LocalPalette.current
    Box(modifier = modifier.fillMaxSize()) {
        DiscoBackground(modifier = Modifier.matchParentSize())
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) { Hero(lang = lang, palette = palette) }

            item(span = { GridItemSpan(maxLineSpan) }) {
                Text(
                    text = uiText(lang, "CHOOSE A GAME", "یک بازی را انتخاب کنید"),
                    color = if (palette.isDark) Accents.Gold else Accents.GoldStrong,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    letterSpacing = 3.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 4.dp),
                )
            }

            items(games, key = { it.id }) { game ->
                GameCard(game = game, lang = lang, palette = palette, onClick = { onOpen(game.id) })
            }
        }
    }
}

/** The Lion & Sun crest + gold-foil bilingual title + tagline. */
@Composable
private fun Hero(lang: Lang, palette: GamePalette) {
    val foil = foilBrush(palette.isDark)
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        LionSunCrest(size = 132.dp)
        Text(
            text = uiText(lang, "Game Night", "گیم نایت"),
            style = TextStyle(
                brush = foil,
                fontFamily = Display,
                fontWeight = FontWeight.Bold,
                fontSize = 44.sp,
            ),
            textAlign = TextAlign.Center,
        )
        Text(
            text = "شب بازی",
            style = TextStyle(brush = foil, fontFamily = Display, fontSize = 22.sp),
            textAlign = TextAlign.Center,
        )
        Text(
            text = uiText(
                lang,
                "Pass-and-play party games — one phone, many games.",
                "بازی‌های مهمونی پاس‌کاری — یک گوشی، کلی بازی.",
            ),
            color = palette.textMuted,
            fontSize = 14.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

/**
 * One game tile: an opaque glassy card with a lit accent niche holding the game's [Emblem], and a
 * body with the localized title, Persian name and tagline. Opaque so it pops over the disco bg.
 */
@Composable
private fun GameCard(game: GameManifest, lang: Lang, palette: GamePalette, onClick: () -> Unit) {
    val accent = game.color.accent()
    val shape = RoundedCornerShape(24.dp)

    // Theme-aware alcove (طاق): a cream niche by day, a jewel-dark one at night — mirrors the web's
    // `linear-gradient(accent 28% + lapis → lapis-2)` under a bottom-blooming accent glow.
    val lapis = if (palette.isDark) Color(0xFF14163F) else Color(0xFFEFE3C8)
    val lapis2 = if (palette.isDark) Color(0xFF1B2466) else Color(0xFFE7D9B6)
    val nicheTop = lerp(lapis, accent.base, 0.28f)
    val title = game.name.resolve(lang)
    val faName = game.name.fa

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(palette.surface)
            .border(1.dp, palette.border, shape)
            .clickable(onClick = onClick),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(104.dp)
                .background(Brush.verticalGradient(listOf(nicheTop, lapis2)))
                .drawBehind {
                    drawRect(
                        Brush.radialGradient(
                            listOf(accent.base, accent.strong, Color.Transparent),
                            center = Offset(size.width / 2f, size.height * 1.15f),
                            radius = size.height * 1.1f,
                        ),
                    )
                },
            contentAlignment = Alignment.Center,
        ) {
            Emblem(gameId = game.id, modifier = Modifier.size(64.dp))
        }

        Column(modifier = Modifier.padding(start = 14.dp, end = 14.dp, top = 10.dp, bottom = 14.dp)) {
            Text(
                text = title,
                color = palette.text,
                fontFamily = Display,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (faName != title) {
                Text(
                    text = faName,
                    color = if (palette.isDark) accent.base else accent.strong,
                    fontFamily = Display,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Text(
                text = game.tagline.resolve(lang),
                color = palette.textMuted,
                fontSize = 12.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

/** Gold-foil gradient brush — mirrors `.dp-foil` (brighter at night, deeper by day). */
private fun foilBrush(isDark: Boolean): Brush =
    if (isDark) {
        Brush.linearGradient(
            listOf(
                Color(0xFFFFE9A8), Accents.Gold, Color(0xFFFFF3CF), Accents.GoldStrong, Color(0xFFFFCF57),
            ),
        )
    } else {
        Brush.linearGradient(
            listOf(
                Color(0xFFD9971F), Accents.GoldStrong, Color(0xFFB9791A), Accents.GoldStrong, Color(0xFFC98B1F),
            ),
        )
    }
