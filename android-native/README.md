# Game Night — Native Android (Kotlin + Jetpack Compose)

A **from-scratch native** rewrite of the Game Night party-games app, separate from the React webapp
but **sharing its content databases and visual identity**. This exists because the Capacitor WebView
build was slow; native Compose gives real 60fps animations and instant startup.

## What's shared with the webapp (single sources of truth)

| Shared thing | Mechanism |
|---|---|
| **Content databases** (~2,000 bilingual items) | The Gradle task `syncSharedContent` mirrors `../src/games/*/content/*.json` into `assets/content/` at build time + writes `content/manifest.json`. **Edit content once in the web tree; both apps get it.** No second copy is committed. See `app/build.gradle.kts`. |
| **Visual identity** (Disco Persian) | `ui/theme/Color.kt` ports every token from `../src/index.css` (8 game accents + day/night palettes); `ui/theme/Theme.kt` wires day/night + per-game accent via CompositionLocals. |
| **Game contract** | `model/Contract.kt` mirrors `../src/sdk/types.ts`. |
| **Game catalog** | `game/GameCatalog.kt` transcribes all 11 `manifest.ts` files. |
| **Engine primitives** | Ported to `engine/` one-for-one from `../src/engine/*` (so far: `Rng.kt`; deck/timer/scoring/voting/etc. to come). |

> Mafia and Mine Hunt have **no JSON** content (roles / boards are code) — those are reimplemented
> in Kotlin rather than data-shared.

## Build & run

Open the **`android-native/`** folder in Android Studio (it is a standalone Gradle project; do not
confuse it with the Capacitor `../android/` project). Let it sync, then Run.

Toolchain (matched to the existing `../android/` so it's known-good on this machine):
AGP 8.13.0 · Gradle 8.14.3 · compileSdk/targetSdk 36 · minSdk 24 · Kotlin 2.1.0 · Compose BOM 2024.12.01.

The first build runs `syncSharedContent` automatically (wired into `preBuild` + asset merge).
To run it alone: `./gradlew :app:syncSharedContent`.

## Status — incremental port

**Done (foundation):** project skeleton, shared-content pipeline, Compose theme (visual identity),
domain models, seeded RNG, full game catalog, and an app shell (home grid + game detail) that proves
the shared content loads.

**Next (tracked):**
1. Bundle Vazirmatn + Lalezar fonts into `res/font` and point `ui/theme/Type.kt` at them.
2. Port remaining engine primitives (`deck`, `timer`, `scoring`, `voting`, `teams`, `roster`,
   `turnOrder`, `revealGate`, `phaseMachine`, `results`) to `engine/`.
3. Build shared UI components (Button, Card, Chip, AppBar, Screen, Curtain/reveal-gate, Medallion).
4. Render the Persian emblems/motifs (Faravahar, Lion-Sun crest, per-game emblems) as vector drawables.
5. Port games against the template, simplest first:
   Would You Rather → Most Likely To → Never Have I Ever → Truth or Dare → Heads Up! →
   Spyfall → Pantomime → Codenames → Dowr → Mine Hunt → Mafia.
6. Players roster + Settings (day/night, EN/FA + RTL, sound/haptics) and the cross-game leaderboard.
