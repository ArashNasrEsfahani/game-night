package com.gamenight.party

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.content.ContentStore
import com.gamenight.party.engine.Player
import com.gamenight.party.engine.PlayerDraft
import com.gamenight.party.game.GameCatalog
import com.gamenight.party.game.GameHost
import com.gamenight.party.game.GameRegistry
import com.gamenight.party.game.Sfx
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.LocalHaptics
import com.gamenight.party.sound.LocalSoundEngine
import com.gamenight.party.sound.SoundEngine
import com.gamenight.party.sound.SoundId
import com.gamenight.party.store.AppStores
import com.gamenight.party.store.LocalAppStores
import com.gamenight.party.store.RosterStore
import com.gamenight.party.ui.components.AppBar
import com.gamenight.party.ui.components.AppButton
import com.gamenight.party.ui.components.AppCard
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.GameAppBar
import com.gamenight.party.ui.components.GameExitConfirmDialog
import com.gamenight.party.ui.components.IconCircleButton
import com.gamenight.party.ui.components.PillShape
import com.gamenight.party.ui.components.glass2Surface
import com.gamenight.party.ui.components.routeTransform
import com.gamenight.party.ui.screens.HomeScreen
import com.gamenight.party.ui.screens.LeaderboardScreen
import com.gamenight.party.ui.screens.PlayersScreen
import com.gamenight.party.ui.screens.ProvideAppDirection
import com.gamenight.party.ui.screens.SettingsScreen
import com.gamenight.party.ui.screens.uiText
import com.gamenight.party.ui.theme.Body
import com.gamenight.party.ui.theme.GameNightTheme
import com.gamenight.party.ui.theme.LocalAccent
import com.gamenight.party.ui.theme.LocalPalette
import com.gamenight.party.ui.theme.accent

class MainActivity : ComponentActivity() {
    // The single, process-lifetime SFX engine + vibrator wrapper, shared app-wide via composition
    // locals so both games and chrome can fire cues. Their `enabled` flags are kept in sync with the
    // user's sound/haptics settings inside [AppRoot].
    private val sound = SoundEngine(enabled = true)
    private lateinit var haptics: Haptics

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        haptics = Haptics(applicationContext, enabled = true)
        val content = ContentStore(assets)
        // Process-lifetime stores (settings / roster / leaderboard), persisted via DataStore.
        val stores = AppStores.create(applicationContext)
        setContent {
            CompositionLocalProvider(
                LocalAppStores provides stores,
                LocalSoundEngine provides sound,
                LocalHaptics provides haptics,
            ) {
                AppRoot(content)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // Free native AudioTracks + the worker thread.
        sound.release()
    }
}

// ── Routing ──
// A flat, saveable route token. Top-level destinations are constants; an active game is encoded as
// "game:<id>". This survives config changes (rotation) without a nav library while keeping in-memory
// match state inside each game's Mount.
private const val ROUTE_HOME = "home"
private const val ROUTE_PLAYERS = "players"
private const val ROUTE_SETTINGS = "settings"
private const val ROUTE_LEADERBOARD = "leaderboard"
private const val GAME_PREFIX = "game:"

@Composable
private fun AppRoot(content: ContentStore) {
    val stores = LocalAppStores.current
    val settings by stores.settings.state.collectAsState()
    val hydrated by stores.settings.hydrated.collectAsState()
    val lang = settings.language
    val dark = settings.darkTheme(isSystemInDarkTheme())

    var route by rememberSaveable { mutableStateOf(ROUTE_HOME) }
    val activeGameId = route.takeIf { it.startsWith(GAME_PREFIX) }?.removePrefix(GAME_PREFIX)

    // While inside a game, recolor the whole theme to that game's manifest accent (mirrors the web
    // --game-accent override); otherwise fall back to the day/night default.
    val activeManifest = activeGameId?.let { GameRegistry.byId(it)?.manifest ?: GameCatalog.byId(it) }
    val accent = activeManifest?.color ?: if (dark) ColorToken.GOLD else ColorToken.TEAL

    // Keep the shared engine/vibrator gated by the user's settings (sound = !muted, haptics on/off),
    // and warm the SFX cache once sound is allowed (renders off the main thread).
    val sound = LocalSoundEngine.current
    val haptics = LocalHaptics.current
    SideEffect {
        sound.enabled = !settings.muted
        haptics.enabled = settings.haptics
    }
    LaunchedEffect(settings.muted) { if (!settings.muted) sound.preload() }

    GameNightTheme(darkTheme = dark, accent = accent) {
        ProvideAppDirection(lang) {
            if (!hydrated) {
                // Avoid a theme/language flash before the persisted settings load.
                Box(modifier = Modifier.fillMaxSize().background(LocalPalette.current.bg))
                return@ProvideAppDirection
            }
            val goHome = { route = ROUTE_HOME }

            // Navigation cue: opening a game/sub-page reveals (select), returning home passes back.
            // Skip the very first emission so launch (and rotation, which doesn't reset `route`) is silent.
            var firstRoute by remember { mutableStateOf(true) }
            LaunchedEffect(route) {
                if (firstRoute) {
                    firstRoute = false
                    return@LaunchedEffect
                }
                when {
                    route == ROUTE_HOME -> sound.play(SoundId.PASS)
                    route.startsWith(GAME_PREFIX) -> sound.play(SoundId.SELECT)
                    else -> sound.play(SoundId.TAP)
                }
                haptics.light()
            }

            // Route transition: opening (target != home) slides up + scales + fades in; returning
            // home plays the reverse. Mirrors the web AppRouter `routeShell`.
            AnimatedContent(
                targetState = route,
                modifier = Modifier.fillMaxSize(),
                transitionSpec = { routeTransform(forward = targetState != ROUTE_HOME) },
                label = "route",
            ) { current ->
                val curGameId = current.takeIf { it.startsWith(GAME_PREFIX) }?.removePrefix(GAME_PREFIX)
                when {
                    current == ROUTE_PLAYERS ->
                        PlayersScreen(roster = stores.roster, lang = lang, onBack = goHome)

                    current == ROUTE_SETTINGS ->
                        SettingsScreen(settings = stores.settings, onBack = goHome)

                    current == ROUTE_LEADERBOARD ->
                        LeaderboardScreen(leaderboard = stores.leaderboard, lang = lang, onBack = goHome)

                    curGameId != null ->
                        GameRoute(gameId = curGameId, content = content, lang = lang, onExit = goHome)

                    else ->
                        HomeRoute(
                            lang = lang,
                            onOpen = { id -> route = GAME_PREFIX + id },
                            onPlayers = { route = ROUTE_PLAYERS },
                            onLeaderboard = { route = ROUTE_LEADERBOARD },
                            onSettings = { route = ROUTE_SETTINGS },
                        )
                }
            }
        }
    }
}

/** The home grid plus a slim action bar for Players / Leaderboard / Settings. */
@Composable
private fun HomeRoute(
    lang: Lang,
    onOpen: (String) -> Unit,
    onPlayers: () -> Unit,
    onLeaderboard: () -> Unit,
    onSettings: () -> Unit,
) {
    val palette = LocalPalette.current
    Column(modifier = Modifier.fillMaxSize().background(palette.bg)) {
        AppBar(
            modifier = Modifier.statusBarsPadding().padding(horizontal = 8.dp),
            right = {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconCircleButton(onClick = onPlayers) { Text("👥", fontSize = 18.sp) }
                    IconCircleButton(onClick = onLeaderboard) { Text("🏆", fontSize = 18.sp) }
                    IconCircleButton(onClick = onSettings) { Text("⚙️", fontSize = 18.sp) }
                }
            },
        )
        HomeScreen(
            games = GameCatalog.all,
            lang = lang,
            onOpen = onOpen,
            modifier = Modifier.weight(1f),
        )
    }
}

/**
 * Mounts a single game: resolves the [GameEntry][com.gamenight.party.game.GameEntry] from the
 * [GameRegistry], maps the persisted roster into seat order, and hands the game a [GameHost]. The game
 * itself drives the entire Setup -> Play -> Results flow.
 *
 * The shell owns three cross-cutting behaviours here so no game has to repeat them:
 *  • a **not-enough-players gate** — if the roster has fewer than `manifest.minPlayers`, an inline
 *    add-players screen is shown first and the game only mounts once enough players exist;
 *  • a **leave confirm** — both the chrome Close button ([GameHost.requestExit]) and the Android
 *    system back show a bilingual "are you sure?" dialog and exit only on confirm; and
 *  • the **host wiring** — language, content, manifest, settings-gated sound/haptics, and the two
 *    exit paths ([GameHost.exit] / [GameHost.requestExit]).
 */
@Composable
private fun GameRoute(gameId: String, content: ContentStore, lang: Lang, onExit: () -> Unit) {
    val stores = LocalAppStores.current
    val roster by stores.roster.state.collectAsState()
    val seats = remember(roster.players) {
        roster.players.map { PlayerSeat(id = it.id, name = it.name, emoji = it.emoji, color = it.color) }
    }

    val entry = remember(gameId) { GameRegistry.byId(gameId) }
    if (entry == null) {
        ComingSoonScreen(gameId = gameId, lang = lang, onBack = onExit)
        return
    }
    val manifest = entry.manifest

    // GATE: not enough players yet → inline add-players screen. Nothing has started, so back / Close
    // just return home directly (no progress to lose). The game mounts as soon as the roster reaches
    // manifest.minPlayers (the persisted roster flow re-emits and flips this branch).
    if (seats.size < manifest.minPlayers) {
        BackHandler(onBack = onExit)
        AddPlayersGate(manifest = manifest, roster = stores.roster, lang = lang, onClose = onExit)
        return
    }

    // IN GAME: Close (host.requestExit) and Android system-back both route through one confirm.
    var confirmingExit by rememberSaveable { mutableStateOf(false) }
    BackHandler { confirmingExit = true }

    // The shared, settings-gated engine/vibrator — handed to the game so its cues honour mute/haptics.
    val sfxEngine = LocalSoundEngine.current
    val gameHaptics = LocalHaptics.current

    // Fresh host each recomposition so it always reflects the current language / exit callbacks; the
    // game's internal `remember`ed match state is unaffected (Mount keys its state on nothing, or on
    // host.content, which is stable for the app's lifetime).
    val host = object : GameHost {
        override val lang: Lang = lang
        override val content: ContentStore = content
        override val manifest: GameManifest = manifest
        override fun exit() = onExit()
        override fun requestExit() { confirmingExit = true }
        override val sound: Sfx = Sfx { sfxEngine.play(it) }
        override val haptics: Haptics = gameHaptics
    }
    entry.Mount(seats, host)

    if (confirmingExit) {
        GameExitConfirmDialog(
            manifest = manifest,
            lang = lang,
            onConfirm = { confirmingExit = false; onExit() },
            onDismiss = { confirmingExit = false },
        )
    }
}

/**
 * The not-enough-players gate shown before a game mounts: the game's gold-name [GameAppBar] (so
 * How-to-play is reachable even here), a "have / need" count, a name field + Add button that append to
 * the persisted roster, and the current player list. As soon as the roster reaches the game's
 * `minPlayers`, [GameRoute] swaps this for the live game.
 */
@Composable
private fun AddPlayersGate(
    manifest: GameManifest,
    roster: RosterStore,
    lang: Lang,
    onClose: () -> Unit,
) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    val state by roster.state.collectAsState()
    val players = state.players
    val need = manifest.minPlayers
    val have = players.size
    val remaining = (need - have).coerceAtLeast(0)
    var newName by remember { mutableStateOf("") }

    val add = {
        val n = newName.trim()
        if (n.isNotEmpty()) {
            roster.addPlayer(PlayerDraft(name = n))
            newName = ""
        }
    }

    AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        GameAppBar(manifest = manifest, lang = lang, onClose = onClose, back = true)

        Spacer(Modifier.height(4.dp))
        Text(
            text = "$have / $need",
            color = accent.base,
            fontWeight = FontWeight.Bold,
            fontSize = 40.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            text = uiText(
                lang,
                "Add $remaining more player${if (remaining == 1) "" else "s"} to start",
                "برای شروع $remaining بازیکن دیگر اضافه کن",
            ),
            color = palette.textMuted,
            fontSize = 15.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )

        // Add-player row: name field + Add button (disabled until a name is typed).
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            GateField(
                value = newName,
                onValueChange = { newName = it },
                placeholder = uiText(lang, "Player name", "نام بازیکن"),
                onSubmit = add,
                modifier = Modifier.weight(1f),
            )
            AppButton(text = uiText(lang, "Add", "افزودن"), onClick = add, enabled = newName.isNotBlank())
        }

        if (players.isNotEmpty()) {
            AppCard(modifier = Modifier.fillMaxWidth()) {
                players.forEachIndexed { index, player ->
                    if (index > 0) Spacer(Modifier.height(10.dp))
                    GatePlayerRow(player)
                }
            }
        }
    }
}

/** A frosted pill name field for the [AddPlayersGate] (mirrors the Players-screen field identity). */
@Composable
private fun GateField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = LocalPalette.current
    val accent = LocalAccent.current
    Box(
        modifier = modifier.height(48.dp).glass2Surface(palette, PillShape).padding(horizontal = 16.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            textStyle = TextStyle(color = palette.text, fontSize = 16.sp, fontFamily = Body),
            cursorBrush = SolidColor(accent.base),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onSubmit() }),
            decorationBox = { inner ->
                if (value.isEmpty()) Text(placeholder, color = palette.textDim, fontSize = 16.sp)
                inner()
            },
        )
    }
}

/** One roster entry in the gate's list: a small accent avatar (emoji or initial) + the player name. */
@Composable
private fun GatePlayerRow(player: Player) {
    val palette = LocalPalette.current
    val ac = (player.color ?: ColorToken.TEAL).accent()
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(ac.base, ac.strong)), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (!player.emoji.isNullOrBlank()) player.emoji!! else player.name.take(1).uppercase().ifEmpty { "?" },
                color = ac.onAccent,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
            )
        }
        Text(text = player.name, color = palette.text, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
    }
}

/** Tasteful detail for a catalog game whose native port hasn't landed yet. */
@Composable
private fun ComingSoonScreen(gameId: String, lang: Lang, onBack: () -> Unit) {
    val manifest = GameCatalog.byId(gameId)
    val palette = LocalPalette.current
    AppScreen(scrollable = true, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        AppBar(title = manifest?.name?.resolve(lang) ?: gameId, onBack = onBack)
        if (manifest != null) {
            Text(text = manifest.icon, fontSize = 56.sp)
            Text(
                text = manifest.tagline.resolve(lang),
                color = palette.textMuted,
                fontSize = 16.sp,
            )
            Text(
                text = manifest.description.resolve(lang),
                color = palette.text,
                fontSize = 15.sp,
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = uiText(lang, "Coming soon", "به‌زودی"),
            color = palette.textMuted,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
        )
        Text(
            text = uiText(
                lang,
                "This game isn't available in the native app yet.",
                "این بازی هنوز در نسخهٔ نیتیو در دسترس نیست.",
            ),
            color = palette.textDim,
            fontSize = 14.sp,
        )
    }
}
