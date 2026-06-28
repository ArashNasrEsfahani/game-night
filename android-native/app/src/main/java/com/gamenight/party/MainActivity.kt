package com.gamenight.party

import android.os.Bundle
import androidx.activity.ComponentActivity
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gamenight.party.content.ContentStore
import com.gamenight.party.game.GameCatalog
import com.gamenight.party.game.GameHost
import com.gamenight.party.game.GameRegistry
import com.gamenight.party.game.Sfx
import com.gamenight.party.model.ColorToken
import com.gamenight.party.model.Lang
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.LocalHaptics
import com.gamenight.party.sound.LocalSoundEngine
import com.gamenight.party.sound.SoundEngine
import com.gamenight.party.sound.SoundId
import com.gamenight.party.store.AppStores
import com.gamenight.party.store.LocalAppStores
import com.gamenight.party.ui.components.AppBar
import com.gamenight.party.ui.components.AppScreen
import com.gamenight.party.ui.components.IconCircleButton
import com.gamenight.party.ui.components.routeTransform
import com.gamenight.party.ui.screens.HomeScreen
import com.gamenight.party.ui.screens.LeaderboardScreen
import com.gamenight.party.ui.screens.PlayersScreen
import com.gamenight.party.ui.screens.ProvideAppDirection
import com.gamenight.party.ui.screens.SettingsScreen
import com.gamenight.party.ui.screens.uiText
import com.gamenight.party.ui.theme.GameNightTheme
import com.gamenight.party.ui.theme.LocalPalette

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
 * itself drives the entire Setup -> Play -> Results flow and calls [GameHost.exit] to return home.
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

    // The shared, settings-gated engine/vibrator — handed to the game so its cues honour mute/haptics.
    val sfxEngine = LocalSoundEngine.current
    val gameHaptics = LocalHaptics.current

    // Fresh host each recomposition so it always reflects the current language / exit callback; the
    // game's internal `remember`ed match state is unaffected (Mount keys its state on nothing, or on
    // host.content, which is stable for the app's lifetime).
    val host = object : GameHost {
        override val lang: Lang = lang
        override val content: ContentStore = content
        override fun exit() = onExit()
        override val sound: Sfx = Sfx { sfxEngine.play(it) }
        override val haptics: Haptics = gameHaptics
    }
    entry.Mount(seats, host)
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
