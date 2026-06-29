package com.gamenight.party.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.ui.identity.Emblem
import com.gamenight.party.ui.theme.Accents
import com.gamenight.party.ui.theme.Display
import com.gamenight.party.ui.theme.LocalPalette

/**
 * The shared top bar for every in-game screen — Setup, Play and Results all render this so the game
 * chrome looks identical and is built in one place. Left to right it lays out:
 *
 *  1. a **Close (✕)** button — wire it to the host's `requestExit` so leaving asks for confirmation;
 *  2. the **game name**, centered and painted in a **gold foil** brush (the same gold-foil identity as
 *     the HomeScreen hero title) so it reads as the page's crown and is visually distinct from every
 *     other label on screen;
 *  3. a **How-to-play (?)** button that opens a localized rules sheet ([manifest.howToPlay], falling
 *     back to [manifest.description]); and
 *  4. an optional [trailing] slot for game-specific actions (e.g. an "End game" affordance).
 *
 * The plain titled [AppBar] is kept for non-game chrome (Players / Settings / Leaderboard / Coming
 * soon); this is its richer, game-only sibling.
 *
 * @param manifest the mounted game's manifest — supplies the name + how-to-play copy. From a game,
 *   pass `host.manifest`.
 * @param lang the active language (Persian renders RTL, and the bar mirrors automatically).
 * @param onClose invoked when the Close button is tapped — pass `host::requestExit`.
 * @param trailing optional trailing-edge actions, laid out after the How-to-play button.
 */
@Composable
fun GameAppBar(
    manifest: GameManifest,
    lang: Lang,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    trailing: (@Composable () -> Unit)? = null,
) {
    val palette = LocalPalette.current
    var showHelp by remember { mutableStateOf(false) }

    Row(
        modifier = modifier.fillMaxWidth().height(56.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        IconCircleButton(onClick = onClose, size = 40.dp) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = t(lang, "Close", "بستن"),
                tint = palette.text,
                modifier = Modifier.size(22.dp),
            )
        }

        Text(
            text = manifest.name.resolve(lang),
            modifier = Modifier.weight(1f),
            style = TextStyle(
                brush = goldFoilBrush(palette.isDark),
                fontFamily = Display,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
            ),
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )

        IconCircleButton(
            onClick = { showHelp = true },
            size = 40.dp,
            modifier = Modifier.semantics { contentDescription = t(lang, "How to play", "راهنمای بازی") },
        ) {
            Text(text = "?", color = palette.text, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        }

        trailing?.invoke()
    }

    if (showHelp) {
        HowToPlayDialog(manifest = manifest, lang = lang, onDismiss = { showHelp = false })
    }
}

/**
 * The How-to-play sheet — a frosted card holding the game's emblem, its gold-foil name, and the
 * localized rules text ([GameManifest.howToPlay], falling back to [GameManifest.description]). Long
 * rules scroll. Reachable from the [GameAppBar] on every game screen, Setup included.
 */
@Composable
private fun HowToPlayDialog(manifest: GameManifest, lang: Lang, onDismiss: () -> Unit) {
    val palette = LocalPalette.current
    val body = (manifest.howToPlay ?: manifest.description).resolve(lang)

    Dialog(onDismissRequest = onDismiss) {
        AppCard(modifier = Modifier.fillMaxWidth()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Emblem(gameId = manifest.id, modifier = Modifier.size(40.dp))
                Text(
                    text = manifest.name.resolve(lang),
                    style = TextStyle(
                        brush = goldFoilBrush(palette.isDark),
                        fontFamily = Display,
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                    ),
                )
            }

            Spacer(Modifier.height(10.dp))
            Text(
                text = t(lang, "How to play", "نحوهٔ بازی"),
                color = palette.textMuted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
            )

            Spacer(Modifier.height(8.dp))
            Box(modifier = Modifier.heightIn(max = 360.dp).verticalScroll(rememberScrollState())) {
                Text(text = body, color = palette.text, fontSize = 15.sp, lineHeight = 22.sp)
            }

            Spacer(Modifier.height(18.dp))
            AppButton(
                text = t(lang, "Got it", "متوجه شدم"),
                onClick = onDismiss,
                fullWidth = true,
            )
        }
    }
}

/**
 * The bilingual "are you sure you want to leave?" confirm. Both the [GameAppBar] Close button (via
 * the host's `requestExit`) and the Android system back funnel here so a game is never abandoned by a
 * stray tap; [onConfirm] performs the real exit, [onDismiss] keeps the player in the game.
 */
@Composable
fun GameExitConfirmDialog(
    manifest: GameManifest,
    lang: Lang,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    val palette = LocalPalette.current
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = palette.surface,
        title = {
            Text(
                text = t(lang, "Leave game?", "از بازی خارج می‌شوی؟"),
                color = palette.text,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
            )
        },
        text = {
            Text(
                text = t(
                    lang,
                    "You'll leave ${manifest.name.resolve(lang)} and lose the current round's progress.",
                    "از ${manifest.name.resolve(lang)} خارج می‌شوی و پیشرفت این دور از بین می‌رود.",
                ),
                color = palette.textMuted,
                fontSize = 15.sp,
            )
        },
        confirmButton = {
            AppButton(
                text = t(lang, "Leave", "خروج"),
                onClick = onConfirm,
                variant = ButtonVariant.DANGER,
                size = ButtonSize.SM,
            )
        },
        dismissButton = {
            AppButton(
                text = t(lang, "Stay", "ادامه"),
                onClick = onDismiss,
                variant = ButtonVariant.SECONDARY,
                size = ButtonSize.SM,
            )
        },
    )
}

/** Tiny bilingual helper for this file's chrome strings (kept local to avoid a screens→components dep). */
private fun t(lang: Lang, en: String, fa: String): String = if (lang == Lang.FA) fa else en

/** Gold-foil gradient brush — mirrors the HomeScreen hero `.dp-foil` (brighter at night, deeper by day). */
private fun goldFoilBrush(isDark: Boolean): Brush =
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
