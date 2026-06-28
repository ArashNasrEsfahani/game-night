package com.gamenight.party.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.gamenight.party.engine.Player
import com.gamenight.party.engine.PlayerDraft
import com.gamenight.party.engine.PlayerPatch
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.store.RosterStore
import com.gamenight.party.ui.components.AppBar
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.ButtonVariant
import com.gamenight.party.ui.components.IconCircleButton
import com.gamenight.party.ui.components.PillShape
import com.gamenight.party.ui.components.controlFill
import com.gamenight.party.ui.components.glass2Surface
import com.gamenight.party.ui.components.glassBorder
import com.gamenight.party.ui.theme.Body
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent

/** Avatar emoji choices offered in the player editor. */
private val EMOJI_CHOICES = listOf(
    "😀", "😎", "🤓", "🥳", "😺", "🐶", "🦊", "🐼",
    "🦁", "🐸", "🐵", "🦄", "🐯", "🐰", "🐲", "🦉",
    "🌟", "🔥", "🎉", "👑", "🍕", "🚀", "⚽", "🎸",
)

/**
 * The Players screen — manage the roster (add / rename / remove / reorder, with an emoji + colour per
 * player). A richer take on src/app/pages/PlayersPage.tsx, backed by the persisted [RosterStore]
 * (which delegates all mutations to the pure `engine/roster`).
 */
@Composable
fun PlayersScreen(
    roster: RosterStore,
    lang: Lang,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by roster.state.collectAsState()
    val players = state.players
    var newName by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf<Player?>(null) }

    val add = {
        val n = newName.trim()
        if (n.isNotEmpty()) {
            roster.addPlayer(PlayerDraft(name = n))
            newName = ""
        }
    }

    val move = { from: Int, to: Int ->
        if (to in players.indices && from in players.indices && from != to) {
            val ids = players.map { it.id }.toMutableList()
            val id = ids.removeAt(from)
            ids.add(to, id)
            roster.reorder(ids)
        }
    }

    AppScreen(modifier = modifier) {
        AppBar(title = uiText(lang, "Players", "بازیکنان"), onBack = onBack)

        // Add-player row: name field + Add button.
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PillTextField(
                value = newName,
                onValueChange = { newName = it },
                placeholder = uiText(lang, "Player name", "نام بازیکن"),
                modifier = Modifier.weight(1f),
                onImeAction = add,
            )
            AppButton(text = uiText(lang, "Add", "افزودن"), onClick = add)
        }

        if (players.isEmpty()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                EmptyRoster(lang)
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
            ) {
                items(players, key = { it.id }) { player ->
                    val index = players.indexOfFirst { it.id == player.id }
                    PlayerRow(
                        player = player,
                        isFirst = index == 0,
                        isLast = index == players.lastIndex,
                        lang = lang,
                        onEdit = { editing = player },
                        onRemove = { roster.removePlayer(player.id) },
                        onMoveUp = { move(index, index - 1) },
                        onMoveDown = { move(index, index + 1) },
                    )
                }
            }
        }
    }

    editing?.let { target ->
        PlayerEditorDialog(
            player = target,
            lang = lang,
            onDismiss = { editing = null },
            onSave = { name, emoji, color ->
                roster.updatePlayer(
                    target.id,
                    PlayerPatch(name = name.trim().ifEmpty { target.name }, emoji = emoji, color = color),
                )
                editing = null
            },
            onDelete = {
                roster.removePlayer(target.id)
                editing = null
            },
        )
    }
}

@Composable
private fun PlayerRow(
    player: Player,
    isFirst: Boolean,
    isLast: Boolean,
    lang: Lang,
    onEdit: () -> Unit,
    onRemove: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
) {
    val palette = LocalPalette.current
    AppCard(onClick = onEdit, contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            PlayerAvatar(emoji = player.emoji, color = player.color, name = player.name, size = 40.dp)
            Text(
                text = player.name,
                modifier = Modifier.weight(1f),
                color = palette.text,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            IconCircleButton(onClick = onMoveUp, enabled = !isFirst, size = 32.dp) {
                Icon(Icons.Filled.KeyboardArrowUp, contentDescription = uiText(lang, "Move up", "بالا"), modifier = Modifier.size(20.dp))
            }
            IconCircleButton(onClick = onMoveDown, enabled = !isLast, size = 32.dp) {
                Icon(Icons.Filled.KeyboardArrowDown, contentDescription = uiText(lang, "Move down", "پایین"), modifier = Modifier.size(20.dp))
            }
            IconCircleButton(onClick = onRemove, size = 34.dp) {
                Icon(Icons.Filled.Close, contentDescription = uiText(lang, "Remove", "حذف"), modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun EmptyRoster(lang: Lang) {
    val palette = LocalPalette.current
    androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier.size(80.dp).clip(CircleShape).background(palette.surface2, CircleShape),
            contentAlignment = Alignment.Center,
        ) { Text("👥", fontSize = 36.sp) }
        Spacer(Modifier.height(16.dp))
        Text(
            text = uiText(lang, "Add some players to get started", "برای شروع چند بازیکن اضافه کن"),
            color = palette.textMuted,
            fontSize = 15.sp,
        )
    }
}

// ── Editor dialog ──

@Composable
private fun PlayerEditorDialog(
    player: Player,
    lang: Lang,
    onDismiss: () -> Unit,
    onSave: (name: String, emoji: String?, color: ColorToken?) -> Unit,
    onDelete: () -> Unit,
) {
    val palette = LocalPalette.current
    var name by remember { mutableStateOf(player.name) }
    var emoji by remember { mutableStateOf(player.emoji) }
    var color by remember { mutableStateOf(player.color) }

    Dialog(onDismissRequest = onDismiss) {
        AppCard(modifier = Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                PlayerAvatar(emoji = emoji, color = color, name = name, size = 48.dp)
                Text(
                    text = uiText(lang, "Edit player", "ویرایش بازیکن"),
                    color = palette.text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                )
            }
            Spacer(Modifier.height(14.dp))

            PillTextField(
                value = name,
                onValueChange = { name = it },
                placeholder = uiText(lang, "Player name", "نام بازیکن"),
                modifier = Modifier.fillMaxWidth(),
                onImeAction = null,
            )

            Spacer(Modifier.height(14.dp))
            FieldLabel(uiText(lang, "Emoji", "ایموجی"))
            EmojiPicker(selected = emoji, onSelect = { emoji = it })

            Spacer(Modifier.height(14.dp))
            FieldLabel(uiText(lang, "Colour", "رنگ"))
            ColorPicker(selected = color, onSelect = { color = it })

            Spacer(Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                AppButton(
                    text = uiText(lang, "Delete", "حذف"),
                    onClick = onDelete,
                    variant = ButtonVariant.DANGER,
                    modifier = Modifier.weight(1f),
                )
                AppButton(
                    text = uiText(lang, "Save", "ذخیره"),
                    onClick = { onSave(name, emoji, color) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(text = text, color = LocalPalette.current.textMuted, fontWeight = FontWeight.Medium, fontSize = 13.sp)
    Spacer(Modifier.height(8.dp))
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EmojiPicker(selected: String?, onSelect: (String?) -> Unit) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // "None" choice clears the emoji (engine can't store null via a patch, so we use blank).
        val noneSelected = selected.isNullOrEmpty()
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(if (noneSelected) accent.soft else controlFill(palette), CircleShape)
                .border(if (noneSelected) 2.dp else 1.dp, if (noneSelected) accent.base else glassBorder(palette), CircleShape)
                .clickable { onSelect("") },
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.Close, contentDescription = null, modifier = Modifier.size(18.dp))
        }
        EMOJI_CHOICES.forEach { choice ->
            val isSelected = selected == choice
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(if (isSelected) accent.soft else controlFill(palette), CircleShape)
                    .border(if (isSelected) 2.dp else 1.dp, if (isSelected) accent.base else glassBorder(palette), CircleShape)
                    .clickable { onSelect(choice) },
                contentAlignment = Alignment.Center,
            ) {
                Text(choice, fontSize = 20.sp)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ColorPicker(selected: ColorToken?, onSelect: (ColorToken) -> Unit) {
    val palette = LocalPalette.current
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        ColorToken.entries.forEach { token ->
            val ac = token.accent()
            val isSelected = selected == token
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(ac.base, ac.strong)), CircleShape)
                    .border(if (isSelected) 3.dp else 1.dp, if (isSelected) palette.text else glassBorder(palette), CircleShape)
                    .clickable { onSelect(token) },
            )
        }
    }
}

@Composable
private fun PlayerAvatar(emoji: String?, color: ColorToken?, name: String, size: Dp) {
    val ac = (color ?: ColorToken.TEAL).accent()
    val showEmoji = !emoji.isNullOrBlank()
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(ac.base, ac.strong)), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = if (showEmoji) emoji!! else name.take(1).uppercase().ifEmpty { "?" },
            fontSize = (size.value * 0.45f).sp,
            color = ac.onAccent,
            fontWeight = FontWeight.Bold,
        )
    }
}

/** A frosted pill text field (BasicTextField) matching the Disco Persian identity. */
@Composable
private fun PillTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    onImeAction: (() -> Unit)? = null,
) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    Box(
        modifier = modifier
            .height(48.dp)
            .glass2Surface(palette, PillShape)
            .padding(horizontal = 16.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            textStyle = TextStyle(color = palette.text, fontSize = 16.sp, fontFamily = Body),
            cursorBrush = SolidColor(accent.base),
            keyboardOptions = KeyboardOptions(imeAction = if (onImeAction != null) ImeAction.Done else ImeAction.Default),
            keyboardActions = KeyboardActions(onDone = { onImeAction?.invoke() }),
            decorationBox = { inner ->
                if (value.isEmpty()) {
                    Text(placeholder, color = palette.textDim, fontSize = 16.sp)
                }
                inner()
            },
        )
    }
}
