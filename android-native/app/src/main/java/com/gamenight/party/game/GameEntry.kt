package com.gamenight.party.game

import androidx.compose.runtime.Composable
import com.gamenight.party.content.ContentStore
import com.gamenight.party.model.GameManifest
import com.gamenight.party.model.Lang
import com.gamenight.party.model.PlayerSeat
import com.gamenight.party.sound.Haptics
import com.gamenight.party.sound.SoundId

/**
 * The tiny sound facade a game fires UI cues through, e.g. `host.sound.play(SoundId.CORRECT)`.
 * Backed by the process [com.gamenight.party.sound.SoundEngine]; honours the user's mute setting
 * (a muted engine makes [play] a cheap no-op). It is a SAM/`fun interface`, so the host can wire it
 * with a lambda (`Sfx { engine.play(it) }`).
 *
 * Sound is an *effect*: call [play] only from the Compose/UI layer (event handlers / LaunchedEffect),
 * never from inside a pure reducer.
 */
fun interface Sfx {
    fun play(id: SoundId)

    companion object {
        /** A no-op sink — the safe default before the host wires a real engine. */
        val None: Sfx = Sfx { }
    }
}

/**
 * The context the app hands a game when it mounts: the active language, the shared [ContentStore]
 * (so the game can parse its JSON content databases at runtime), a way to leave back to the home
 * grid, and the shell's [sound] / [haptics] so the game can fire feedback cues. Mirrors the slice of
 * the webapp's `GameScreenProps.ctx`/`nav` a native pass-and-play game actually needs.
 *
 * [sound] and [haptics] have safe no-op defaults, so a game that ignores them — and any host that
 * doesn't wire them — still compiles and runs. Both honour the user's settings (sound/haptics
 * toggles) because the shell gates the shared engine/vibrator instances behind those toggles.
 */
interface GameHost {
    val lang: Lang
    val content: ContentStore
    fun exit()

    /** Fire a sound cue, e.g. `sound.play(SoundId.WIN)`. No-op when the user has muted sound. */
    val sound: Sfx get() = Sfx.None

    /** Fire a haptic cue, e.g. `haptics.success()`. No-op when haptics are off or unavailable. */
    val haptics: Haptics get() = Haptics.none()
}

/**
 * A fully self-contained, mountable native game. A registry keeps a `List<GameEntry>`; the shell
 * looks one up by [id] (matching its [com.gamenight.party.model.GameManifest] in [GameCatalog]) and
 * calls [Mount], which drives the whole Setup -> Play -> Results flow with its own internal,
 * seed-threaded state.
 */
interface GameEntry {
    /** Must equal the matching GameManifest.id in [GameCatalog]. */
    val id: String

    /**
     * The catalog metadata for this game. Defaults to the [GameCatalog] entry for [id]; a game may
     * override it to supply its own (e.g. a code-driven manifest).
     */
    val manifest: GameManifest
        get() = GameCatalog.byId(id) ?: error("No manifest registered for game id '$id'")

    /** Renders the entire game, starting at its setup screen. [players] is the available roster. */
    @Composable
    fun Mount(players: List<PlayerSeat>, host: GameHost)
}
