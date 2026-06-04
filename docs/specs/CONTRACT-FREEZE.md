# CONTRACT FREEZE — resolutions on top of `00-architecture.md`

> **Status: BINDING.** `00-architecture.md` is canonical. Where any other spec (01/02/03 or a
> game spec) disagrees with `00`, `00` wins. This file records the deltas/decisions resolving the
> forks the adversarial review (`99-...`) found. The **real** contract is the compiled
> `src/sdk/types.ts` + the **Dowr** reference game — read those, not the divergent prose.

## Decisions

1. **G11/X1 — Primitives are PURE LIBS, ctx is impure services only.** `src/engine/*` are pure
   functions imported inside `logic.ts`. `GameContext` carries ONLY: `lang, t, localize, setLang,
   clock, random, sound, haptics, prefersDark, muted, reducedMotion, isOnline`. No `ctx.deck`,
   `ctx.roster`, `ctx.sdk`, `ctx.timer` controllers, `ctx.fx`, `ctx.auth`, `ctx.navigate`.
2. **G1 — Start a match:** `GameNav` gains **`startMatch(config: GameConfig): void`**. Setup builds a
   `GameConfig` and calls `nav.startMatch(config)`. The host runs `createInitialState(config, seed)`
   with a fresh seed, persists the session, and routes to Play.
3. **G2/G3 — Seed & content boundary:** `createInitialState(config, seed)` is self-sufficient.
   **Resolved content ids/pool go in `config.options`** (the Setup screen resolves content JSON →
   ids before calling `startMatch`). The reducer uses `rng(seed)`/`shuffle(arr, seed)` for any draws.
   No content in action payloads; no `START` action that carries the pool.
4. **F-series — One `GameManifest`** = `00` §3 exactly: `id, name, tagline, description, icon,
   color: ColorToken, category, minPlayers, maxPlayers, estimatedMinutes:[min,max], tags?:
   LocalizedString[], capabilities: GameCapabilities, stateVersion, experimental?`. Additive only:
   optional **`howToPlay?: LocalizedString`** and optional **`supportsCustomContent?: boolean`**.
   No `title/accent/accentColor/colors/structure/teamsRequired/usesPrimitives/needs*`.
5. **GameCategory** extended to: `party | word | deduction | drawing | trivia | reaction | cards |
   social | voting` (covers most-likely-to / would-you-rather).
6. **SoundId (one set):** `tap | correct | wrong | tick | timeUp | reveal | win | lose | shuffle |
   pass`. Map game-specific names to these (dowr `skip`→`pass`, `expire`→`timeUp`).
7. **Palette (ColorToken, one set):** `grape | tangerine | lime | sky | rose | gold | teal | violet`.
   Each maps to CSS vars `--color-game-<token>` + `-strong`. The host bridges a manifest's
   `color` to `--game-accent` / `--game-accent-strong` for in-game theming. Plus team tokens
   `--color-team-a/-b`, `--color-neutral`, `--color-assassin` (codenames).
8. **Registry:** `src/games/registry.ts`, glob `import.meta.glob('./*/index.ts', { eager: true })`.
   API: `getGame(id)`, `allGames()`, `getCatalog(opts?)`.
9. **Routing:** `HashRouter` + `<Routes>`; game host at `/g/:gameId` (`GameHostPage`).
10. **Persistence:** `sessionStore` **IS persisted** (resume mid-match). roster + settings persisted
    via zustand `persist` + `idb-keyval` storage adapter.
11. **No generic scoreboard chrome (G4):** games own their Results UI.
12. **Reducer signature is `(state, action) => state`** — no `{state, meta}`. Games needing
    transient non-fatal info bake a non-persisted `_meta` field into their state (mafia).
13. **heads-up motion** stays a **view-layer hook inside the game folder** (no shared `sdk/motion`).
14. **Content schema:** each game ships its own typed content JSON under `content/`. The `02` `Deck`
    union + `validateDeck` apply to the **custom-deck editor only**, not to built-in game content.
15. **`Lang`/`lang`** everywhere (not `Locale`/`locale`). Players come from `config.players:
    PlayerSeat[]` (denormalized name/emoji/color) — no `ctx.roster.get`.

## Build order
Follow `99-review-and-build-order.md` §3. Keystone = `src/sdk/types.ts` (get it right once).
