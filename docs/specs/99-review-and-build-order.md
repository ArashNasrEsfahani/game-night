# 99 — Adversarial Review & Phase-1 Build Order

> **⚠️ HISTORICAL.** This adversarial review drove the **contract freeze** (see
> `CONTRACT-FREEZE.md`) and the Phase-1 build. Both are now **complete**: the contract was frozen,
> Phase-1 (foundation + Dowr) shipped, and **all 10 games are built** on top of it. The mismatches
> catalogued below were the inputs to that reconciliation — they have all been resolved in
> `src/sdk/types.ts`, `CONTRACT-FREEZE.md`, and the implemented games. Keep this file for the
> rationale/build-order; for current truth read `CONTRACT-FREEZE.md` + the Dowr reference game.
>
> **Status:** Critique (resolved). Read this BEFORE writing any code.
> **Verdict:** The architecture spec (`00`) is internally coherent and well-designed. **But almost no other spec actually conforms to it**, despite every one of them claiming "Conforms to 00-architecture.md." Spec `03` (app-shell) and all 10 game specs each invented their own divergent versions of `GameModule`, `GameManifest`, `GameContext`, the registry, and the routing/host contract. If you implement the games as written, none of them will compile against the `00` types. **The single most important pre-build task is to pick ONE contract (00) and rewrite the others to match — or amend 00 and cascade.**

This file enumerates every mismatch, the cross-cutting gaps, a concrete Phase-1 build order, and the top risks.

---

## 0. How bad is it? (one-paragraph summary)

`00-architecture.md` defines: `GameModule` with `{ manifest, logic: {createInitialState, reducer, migrate}, screens: {Setup,Play,Results}, defaultConfig, validateConfig }`; `createInitialState(config, seed)`; manifest field `color: ColorToken`; routing at `/g/:gameId` via `HashRouter` + `getGame`/`getCatalog`; `GameContext` with flat `ctx.clock`/`ctx.random`/`ctx.sound`/`ctx.haptics`/`ctx.localize`. **Every game spec contradicts some subset of this**, and they don't even agree *with each other*: there are at least **four mutually-incompatible `GameModule` shapes** and **four `GameContext` shapes** across the 11 downstream specs. This is a contract-coherence failure, not a set of small bugs.

---

## 1. API CONSISTENCY CHECK — every mismatch

Format: **(spec, what it assumed, what 00 actually says, suggested fix)**.

### 1.1 `GameModule` shape (the worst offender — 4 incompatible variants)

| # | Spec | Assumed | 00 contract | Fix |
|---|---|---|---|---|
| M1 | **03 app-shell** | `logic: { createInitialState(cfg), reducer, selectScoreboard?, isComplete?, schemaVersion }`, `screens.Results?` optional, `logic.createInitialState(cfg)` (no seed) | `logic: { createInitialState(config, seed), reducer, migrate? }`, all 3 screens required, no `selectScoreboard`/`isComplete`/`schemaVersion` on logic | Rewrite 03 to import 00's `GameModule`. Move `schemaVersion`→`manifest.stateVersion`. If `selectScoreboard`/`isComplete` are wanted, add them to 00 as optional. |
| M2 | **dowr, codenames, spyfall, truth-or-dare, most-likely-to, would-you-rather, pantomime, mafia** | **flat** module: `{ manifest, createInitialState, reducer, Setup, Play, Results }` OR `{ manifest, createInitialState, reducer, screens:{...} }` — i.e. `createInitialState`/`reducer` at the **top level**, not under `logic` | `createInitialState`/`reducer` live under `module.logic`; screens under `module.screens` | Wrap all in `logic: { createInitialState, reducer }`. The registry validator in 00 §8 literally checks `m.logic?.reducer` — these modules would all fail `validate()` at startup. |
| M3 | **truth-or-dare** | screens as **top-level keys** `SetupScreen`, `PlayScreen`, `ResultsScreen` (not `screens.Setup`…) | `screens: { Setup, Play, Results }` | Rename to the `screens` object form. |
| M4 | **never-have-i-ever** | `{ manifest, i18n:{en,fa}, logic:{createInitialState, reducer, rankPlayers, computeWinners}, getDeck, screens:{SetupScreen,PlayScreen,ResultsScreen} }` | no `i18n`, no `getDeck`, no extra logic exports, screens are `Setup/Play/Results` | Drop `i18n`/`getDeck` from the module (i18n is global per 02; deck filtering happens in the screen before `createInitialState`). Rename screen keys. |
| M5 | **heads-up** | `GameModule<Cfg,State,Action>` with `createInitialState`/`reducer` top-level, `screens` as `React.LazyExoticComponent`, plus `setupSchema` and `defaultConfig` | screens are plain `ComponentType` (not required lazy); no `setupSchema`; `defaultConfig` is a **function** `(input)=>GameConfig`, not a value | Either add `setupSchema?` + lazy screens to 00, or drop them. Reconcile `defaultConfig` (see C-series below). |
| M6 | **codenames** | `GameModule` (non-generic) with `manifest.teamsRequired: 2` | no `teamsRequired` field exists | Express "needs 2 teams" via `capabilities.usesTeams` + `validateConfig`. Remove `teamsRequired`. |

> **Net:** the type-erased `AnyGameModule` the registry stores (00 §3) cannot hold any of these as written. **Pick 00's shape and rewrite all 11 modules' `index.ts`.**

### 1.2 `createInitialState` signature

| # | Spec | Assumed | 00 contract | Fix |
|---|---|---|---|---|
| S1 | **dowr** | `createInitialState({ config, players, teams, seed }: CreateStateArgs)` — a single object with players/teams broken out | `createInitialState(config: GameConfig, seed: number)` — players/teams live **inside** `config` (`config.players`, `config.teams`) | Read `players`/`teams` from `config`. Drop the `CreateStateArgs` type (not in 00). |
| S2 | **03, codenames, spyfall, mafia, most-likely-to, would-you-rather, pantomime, truth-or-dare, nhie** | `createInitialState(cfg)` — **no seed param** | `createInitialState(config, seed)` — seed is the 2nd arg | Add the `seed` param. Several specs then duplicate seed handling via a `START`/`START_GAME` action (see G2). |
| S3 | **codenames** | seed lives **inside** `CodenamesConfig.seed` | seed is a separate arg; `GameConfig` has no `seed` field | Move seed out of config to the `createInitialState(config, seed)` arg, or have the host put it in `options`. |
| S4 | **truth-or-dare** | `createInitialState(cfg, ctx: GameSeed)` where `GameSeed={seed}` | `createInitialState(config, seed: number)` | Pass `seed` directly, not wrapped in an object. |
| S5 | **would-you-rather, mlt** | `createInitialState` does **not** build the deck/order at all (deferred to a `START` action that carries `order`) | 00's `createInitialState(config, seed)` is expected to produce a ready initial state | Acceptable *pattern* but must still match the signature; the host calls `createInitialState(config, seed)` then the screen may dispatch `START`. Document that the initial `phase` is a pre-game state. |

### 1.3 `GameManifest` fields (every spec invented its own)

00's manifest: `id, name, tagline, description, icon, color: ColorToken, category: GameCategory, minPlayers, maxPlayers, estimatedMinutes:[min,max], tags?: LocalizedString[], capabilities: GameCapabilities, stateVersion, experimental?`.

| # | Spec | Assumed field | 00 field | Fix |
|---|---|---|---|---|
| F1 | **01 design-system** | `accent: AccentName` (`grape\|bubble\|tangerine\|lime\|sky\|sunbeam`) | `color: ColorToken` (`grape\|tangerine\|lime\|sky\|rose\|gold\|teal\|violet`) | **Two clashes at once:** field name (`accent` vs `color`) AND the palette enum. The two token sets barely overlap (01 has `bubble/sunbeam`; 00 has `rose/gold/teal/violet`). Pick one palette + one field name and update both 00 and 01. Games reference `violet` (dowr/spyfall), `grape` (pantomime) — neither valid in 01's `AccentName`/01 vs 00 mismatch. |
| F2 | **03** | `accent: { from: string; to: string }` (gradient pair), `tags: GameTag[]` (string enum), `players: PlayerCountRange`, `estMinutes?: number`, `version`, `hidesScoreboard?`, `hasResults?` | `color: ColorToken`, `tags?: LocalizedString[]`, `minPlayers`/`maxPlayers`, `estimatedMinutes:[n,n]`, `stateVersion` | Whole manifest is different. Reconcile to 00. `accent.from/to` gradient → derive from one `ColorToken` (the design system already builds the gradient from `--game-accent`/`-strong`). |
| F3 | **dowr** | `title` (not `name`), `tags: LocalizedString[]` (ok), `accentColorId`, `supportsTeams`/`supportsSolo`, `estMinutes`, `usesPrimitives: SdkPrimitiveId[]`, `defaultConfig: unknown` on the manifest | `name`, `color`, `capabilities`, `estimatedMinutes`, no `usesPrimitives`, no `defaultConfig` on manifest | Rename `title→name`; `accentColorId→color`; fold `supportsTeams/Solo` into `capabilities`/`validateConfig`; drop `usesPrimitives` (or add to 00 as docs-only); move `defaultConfig` to the module, not manifest. |
| F4 | **codenames** | `title`, `tagline`, `accent: 'var(--color-team-a)'` (a CSS string!), `icon:'grid'`, `teamsRequired`, `estimatedMinutes: number` (scalar) | `name`, `color: ColorToken` (enum, not CSS), `estimatedMinutes: [n,n]` (tuple) | `name`, enum `color`, tuple minutes, drop `teamsRequired`. `accent` as a raw CSS var breaks the `ColorToken` contract. |
| F5 | **spyfall** | `name` (ok), `accent:'violet'`, `usesTeams`, `usesTimer`, `estMinutes:number`, `categories: string[]` | `color`, `capabilities{...}`, `estimatedMinutes:[n,n]`, single `category` | `accent→color`; `usesTeams/usesTimer`→`capabilities`; `estMinutes`→tuple; `categories`→`category`. |
| F6 | **mafia** | `name` (ok), `color:'mafia'` (not a ColorToken), `tags: string[]` (`["deduction","party","teams"]`), `estMinutes:{min,max}` (object) | `color: ColorToken`, `tags?: LocalizedString[]`, `estimatedMinutes:[n,n]` (tuple) | `'mafia'` is not a valid `ColorToken`. `tags` are bare strings (00 wants `LocalizedString[]`; 03 wants a `GameTag` enum — **three different tag models across specs**). `estMinutes` object vs tuple. |
| F7 | **pantomime** | `accentColor:'grape'`, `structure:'teams'`, `tags:string[]`, `estimatedMinutes:number` | `color`, no `structure`, `tags?:LocalizedString[]`, tuple minutes | Reconcile each. `structure` → `capabilities.usesTeams`. |
| F8 | **truth-or-dare** | `title`, `estMinutes:[n,n]`, `tags:string[]`, `accent:'accent-tod'` (a token name), `teamMode:'none'`, `supportsCustomContent` | `name`, `estimatedMinutes`, `tags?:LocalizedString[]`, `color:ColorToken`, no `teamMode`/`supportsCustomContent` | Rename; `teamMode`→`capabilities.usesTeams:false`; if custom content is a real feature, add `supportsCustomContent?` to 00. |
| F9 | **most-likely-to** | `name` (ok), `accentColor:'var(--color-game-mlt)'`, `tags:string[]`, `estimatedMinutes:number`, `category:'social'`, `supportsTeams` | `color:ColorToken`, tuple minutes, `category:GameCategory` (no `'social'`!) | `'social'` is not in 00's `GameCategory` union. Add it or remap to `'party'`. `accentColor` CSS var vs `ColorToken`. |
| F10 | **would-you-rather** | `title`, `blurb` (not `tagline`/`description`), `accent:'fuchsia'`, `estMinutes:[n,n]`, `capabilities:{teams,timer,deck,voting,scoring:'optional'}`, `contentPacks`, `defaultLocaleContent` | `name`, `tagline`, `description`, `color`, `capabilities: GameCapabilities` (a fixed shape, no `scoring:'optional'`) | `blurb`→`tagline`/`description`; `'fuchsia'` not a ColorToken; 00's `GameCapabilities` shape differs (it has `usesTeams/usesTimer/usesDeck/usesVoting/usesRevealGate/passAndPlay`). |
| F11 | **heads-up** | `title`, `description`, `howToPlay` (extra), `color:'var(--color-game-headsup)'`, `tags:LocalizedString[]` (ok), `capabilities:{motion,haptics,sound}` | `name`, no `howToPlay`, `color:ColorToken`, `capabilities` shape is the 00 one (no `motion`) | Add `howToPlay?` + `motion?` capability to 00 if desired; `title→name`; CSS-var color → token. |
| F12 | **nhie** | `title`, `accent`, `colors:{from,to}`, `category`, `estimatedMinutes:[n,n]`, `supportsTeams`, `needsTimer`, `needsDeck`, `usesSecrecy`, `contentLocales`, `intensities` | none of these flag names exist in 00 | Largest manifest drift. Fold `needs*`/`usesSecrecy` into `capabilities`; `colors`/`accent`→`color`; drop `contentLocales`/`intensities` from manifest (intensity is content/config). |

> **Pattern:** every game uses a slightly different name for: the title (`name` vs `title`), the color (`color`/`accent`/`accentColor`/`accentColorId`/`colors`), the time estimate (tuple vs scalar vs object), the tags (`LocalizedString[]` vs `string[]` vs `GameTag[]`), and capability flags (`capabilities{}` vs loose `supports*`/`uses*`/`needs*`). **None will satisfy the single `GameManifest` interface.** This must be normalized before the home grid (which reads manifests) can render anything.

### 1.4 `GameContext` shape (4 incompatible variants)

00's `GameContext`: flat — `lang, t, localize, setLang, clock, random, sound, haptics, prefersDark, muted, reducedMotion, isOnline`. The engine primitives are **NOT** on `ctx`; games import pure primitives in `logic.ts` and read derived state in screens.

| # | Spec | Assumed `ctx` | 00 contract | Fix |
|---|---|---|---|---|
| X1 | **03** | `ctx` carries the engine primitives as live APIs: `roster, teams, turnOrder, timer, deck, scoring, voting, revealGate, phase, results` + `sfx`, `haptics`, `startPlay`, `endPlay`, `makeSeed`, `localize` | 00 keeps primitives OUT of ctx (they're pure libs); ctx has `clock`/`random`, not `makeSeed`; `sound` not `sfx` | This is a **fundamental architectural disagreement**: 03 wants "primitives-as-services on ctx"; 00 wants "primitives-as-pure-libs, ctx = impure services only." Decide which model wins. (00's is cleaner for pure testing; 03's is what every game spec actually assumes — see below.) |
| X2 | **dowr** | `ctx: { roster, teams, turnOrder, timer, rng, sound, haptics, i18n, nav }` with `ctx.rng.nextSeed()`, `ctx.timer.start({onTick,onExpire})`, `ctx.i18n.t/localize/dir/lang`, `ctx.nav.goHome/replay/share` | flat ctx; seed via `ctx.random.seed()`; clock via `ctx.clock`; localize via `ctx.localize`; navigation via the `nav` prop (separate from ctx) | Reconcile: `rng.nextSeed()`→`random.seed()`; the stateful `timer.start` controller doesn't exist in 00 (00's timer is pure data + `ctx.clock.onFrame`). `i18n.*`→flat `t`/`localize`/`lang`. `nav` is a screen prop in 00, not on ctx. |
| X3 | **codenames, spyfall, mafia, pantomime, truth-or-dare, mlt, would-you-rather** | varied: `ctx.start(config)` / `ctx.startGame(config)` / `ctx.newGame` / `ctx.navigate` / `ctx.fx.play` / `ctx.auth.signedIn` / `ctx.router` / `ctx.primitives.*` | none of these exist on 00's ctx | Define ONE "start a match" entry. 00's `GameScreenProps` has `nav` (`toPlay/playAgain/...`) but **no `startGame`** — a real gap (G1). `ctx.fx` (spyfall) vs `ctx.sound`+`ctx.haptics` (00). `ctx.auth` is not in 00. |
| X4 | **heads-up** | `GameContext = { config, state, dispatch, sdk: SdkBundle, setConfig, finish }` — screens receive the WHOLE context as their props type, and primitives live under `ctx.sdk.*` | 00 separates `GameScreenProps { state, config, dispatch, ctx, nav }` from `GameContext` (services only); no `sdk` bundle, no `setConfig`, no `finish` | heads-up conflates `GameScreenProps` and `GameContext`. Map `sdk.*`→pure imports + flat ctx; `finish()`→`nav.toResults()`; `setConfig`→Setup-local state. |

### 1.5 Registry & auto-discovery glob path

| # | Spec | Assumed glob | 00 contract | Fix |
|---|---|---|---|---|
| R1 | **00 itself** | `import.meta.glob('./*/index.ts')` inside `src/games/registry.ts` | — | 00's own example uses `'./*/index.ts'` (registry sits in `src/games/`). |
| R2 | **03** | `import.meta.glob('../games/*/index.ts')` inside `src/sdk/registry.ts` | 00 puts registry at `src/games/registry.ts` with `'./*/index.ts'` | Two different registry locations (`src/games/` vs `src/sdk/`) AND two glob paths. The task brief locks `import.meta.glob('./games/*/index.ts')` (registry at `src/`). **Three different answers.** Pick one location; the glob path is relative to that file. |
| R3 | **all game specs** | comment "discovered by `import.meta.glob('./games/*/index.ts')`" | implies registry lives at `src/` | The brief's path (`./games/*/index.ts`) only works if the registry file is at `src/registry.ts`, contradicting both 00 (`src/games/registry.ts`) and 03 (`src/sdk/registry.ts`). **Decide the registry's home and fix the glob to match.** |
| R4 | **03** | `GAMES: GameModule[]` array + `getGame`, sorted by `manifest.name.en` | 00: `getGame`, `allGames`, `getCatalog` (manifests only), sorted by `category` then `id` | Reconcile the registry API (03's `GAMES` array vs 00's `getCatalog()`); pick the sort key. |

### 1.6 Routing & host

| # | Spec | Assumed | 00 contract | Fix |
|---|---|---|---|---|
| RT1 | **03** | route `/play/:gameId`, `createHashRouter`, `RootLayout` with `useMatches`, `handle:{immersive}` | route `/g/:gameId`, `HashRouter`+`<Routes>` (not `createHashRouter`), `GameHostPage` | Pick `/g/:gameId` vs `/play/:gameId` (game specs say `ctx.navigate('results')` etc., agnostic; but the host page name differs: `GameHostPage` (00) vs `GameHostScreen` (03)). Pick `createHashRouter` vs `HashRouter`+`Routes`. |
| RT2 | **03** | session store **not persisted** (refresh resets a run) | 00 §10: `sessionStore` **is** persisted via idb (resume mid-match is a headline feature) | **Direct contradiction.** Every game spec relies on "zustand persist + idb-keyval rehydrates mid-game" (resume). 03 says runs are ephemeral. **00 + the games win; fix 03.** |
| RT3 | **00 vs 03** | host screen logic differs: 00 routes by `session.screen`/`state.finished`; 03 routes by `sessionStore.phase` | — | Align the host's screen-selection logic and the `HostScreen`/`GamePhase` enum (00: `'setup'\|'play'\|'results'`; 03 `GamePhase` same values but stored differently). |

### 1.7 Shared `Player` / `Team` / id types

| # | Spec | Assumed | 00 contract | Fix |
|---|---|---|---|---|
| P1 | **dowr** | `Player { id, name, colorId, avatarSeed? }`, `Team { id, colorId, name?, playerIds }` | 00 has **`PlayerSeat` { id: PlayerId, name, emoji?, color? }`** (config-time) and engine `Player { id, name, emoji?, color?, createdAt }` (roster). No `colorId`/`avatarSeed`/`playerIds` | Use `PlayerSeat` from `config.players`; `color` not `colorId`. dowr's `Team.playerIds` vs 00 `TeamSetup.teams[].memberIds`. |
| P2 | **03** | `Player { id, name, color, emoji, createdAt }` (color/emoji **required**) | engine `Player` has `emoji?`/`color?` **optional** | Make required-ness consistent (03 forces color+emoji; 00 optional). |
| P3 | **codenames, spyfall, mlt, etc.** | `playerIds: string[]` and look up names via `ctx.roster.get(id)` | `config.players: PlayerSeat[]` already carries denormalized `name`/`emoji`/`color`; there is no `ctx.roster.get` in 00 | Read names from `config.players` seats; drop `ctx.roster.get`. |
| P4 | **02 vs 03** | 02 `Lang = 'en'\|'fa'`; 03 `Locale = 'en'\|'fa'` (renamed) | 00 uses `Lang` | 03 calls it `Locale` and `config.locale`; 00 uses `Lang` and `config.lang`. Pick one name everywhere (`Lang`/`lang`). |

### 1.8 Capabilities / declared-primitive vocabulary

| # | Spec | Assumed | 00 contract | Fix |
|---|---|---|---|---|
| C1 | **dowr** | `usesPrimitives: SdkPrimitiveId[]` on manifest; `SdkPrimitiveId` union of 10 primitive names | 00 has `capabilities: GameCapabilities` (boolean flags), no per-primitive list | Either add `usesPrimitives?` to 00 (nice for docs/validation) or drop it. |
| C2 | **03** | `selectScoreboard?`, `isComplete?`, `hidesScoreboard?`, `hasResults?` (generic scoreboard chrome) | 00 has none of these | Decide if the host renders a generic scoreboard. If yes, add to 00; if no, games own their scoreboards (they all do anyway). |
| C3 | **heads-up** | `setupSchema` declarative form + `SetupSchema` type "owned by 00" | 00 defines no `SetupSchema` | 00 does **not** define `SetupSchema`/`SdkBundle`/`motion` despite heads-up asserting it does. Either add them or rewrite heads-up's Setup as a normal screen. |

### 1.9 `defaultConfig` shape

| # | Spec | Assumed | 00 contract | Fix |
|---|---|---|---|---|
| D1 | **00** | `defaultConfig: (input: DefaultConfigInput) => GameConfig` (a **function**) | — | This is 00's contract. |
| D2 | **heads-up, mlt, would-you-rather** | `defaultConfig` is a **value object** (`DEFAULT_CONFIG`), sometimes on the module, sometimes a partial | function vs value mismatch | Wrap value defaults in the `(input)=>GameConfig` function form, or change 00 to accept a value. |
| D3 | **dowr** | `defaultConfig` on the **manifest** (`defaultConfig: unknown`) | `defaultConfig` is a **module** field | Move to module. |

### 1.10 Timer model (pure-data vs stateful-controller)

| # | Spec | Assumed | 00 contract | Fix |
|---|---|---|---|---|
| T1 | **dowr** | `ctx.timer.start({ seconds, onTick, onExpire })` — a stateful imperative controller with callbacks | 00 §6.4: timer is **pure data** (`TimerState`); the screen subscribes via `ctx.clock.onFrame`/`ctx.clock.interval` and dispatches `{type:'TICK', now}`; the reducer folds it | Rewrite dowr's timer usage to the 00 model: `ctx.clock.interval(1000, now => dispatch({type:'TICK', now}))`, derive expiry from `timer.isExpired(state.clock, now)`. The `onTick/onExpire` controller doesn't exist. |
| T2 | **heads-up** | `sdk.timer.countdown()`, `sdk.timer.interval()` emitting `TICK`/`TIME_UP` | same as T1 | Same fix; use `ctx.clock`. |
| T3 | **pantomime, spyfall** | timer state mixed: spyfall says "timer is SDK-owned, not in the pure reducer, reconciles from `endsAt`"; pantomime stores `startedAt`/`elapsedBeforeMs` **in reducer state** (matches 00) and dispatches `TICK` | 00: timer data lives in game state; clock value comes via action `now` | pantomime is closest to correct. spyfall's "SDK owns timer outside reducer" conflicts with 00 (timer is part of serializable state). Reconcile to "timer data in state, clock injected." |

### 1.11 Sound / haptics naming

| # | Spec | Assumed | 00 contract | 01 contract | Fix |
|---|---|---|---|---|---|
| SH1 | **00** | `SoundId = 'tap'\|'correct'\|'wrong'\|'tick'\|'timeUp'\|'reveal'\|'win'\|'lose'\|'shuffle'\|'pass'` (10) | — | — | — |
| SH2 | **01** | `SoundId = 'tap'\|'tick'\|'correct'\|'wrong'\|'reveal'\|'transition'\|'win'` (**7**, "exactly these seven") | 10 ids | — | **00 and 01 define different SoundId unions** (00 has `timeUp/lose/shuffle/pass`; 01 has `transition` instead). Pick one set. dowr uses `'skip'`/`'expire'` (in neither!). |
| SH3 | **03** | `SfxName = 'tap'\|'success'\|'fail'\|'reveal'\|'turn'\|'win'\|'tick'` (yet another set) | 10 ids | 7 ids | A **third** sound vocabulary. dowr (`tick/correct/skip/expire/win`), spyfall (`card_flip/tick`), mafia (VO mp3s) all differ again. Normalize to one `SoundId` union in 00. |
| SH4 | **00 vs 03** | 00 `HapticsService { light, medium, heavy, success, warning, error }`; 01 adds `reveal`/`select`; 03 `Pattern = light\|medium\|heavy\|success\|warning` (no error/reveal/select) | — | — | Reconcile the haptic-pattern union across 00/01/03. |

### 1.12 Other concrete mismatches

| # | Spec | Issue | Fix |
|---|---|---|---|
| O1 | **mafia** | Roles are a **sub-plugin registry** via `import.meta.glob('./roles/*.ts')` inside the game. Fine, but mafia also assumes a `_meta` channel on returned state for non-fatal errors, and openly admits "the architecture's reducer may return `{state, meta}` — implementer must follow whichever 00 mandates." | 00's reducer is strictly `(state, action) => state`. **No `meta` channel.** Bake `_meta` into the state shape (non-persisted field) or drop it. Resolve before building mafia. |
| O2 | **mafia** | `createInitialState` **throws `MafiaConfigError`** on bad config. | 00 expects `validateConfig` to gate Start; `createInitialState` shouldn't be the validation point (host may call it post-validation). Acceptable to throw defensively, but the primary guard is `module.validateConfig`. |
| O3 | **heads-up** | Introduces a **new shared primitive** `sdk/motion` and asserts 00 "defines `SetupSchema`, `SdkBundle`, `motion`." | 00 defines none of these. Either (a) amend 00 to add a `motion` service to `GameContext` and a `SetupSchema` type, or (b) keep motion entirely inside the heads-up folder as a view-layer hook (preferred — it's screen-only and pure-boundary-safe). The brief says "adding a game never edits a shared file"; a new shared primitive violates that, so prefer (b). |
| O4 | **02 i18n** | i18next version `@26`, react-i18next `@17`. | Brief/00 say i18next + react-i18next **v17**. 02's `i18next@26` may be a typo or a real version pin mismatch. Confirm the i18next major. |
| O5 | **02** | per-game UI strings: 02 puts all UI catalogs in **`src/i18n/locales/<lng>/<ns>.json`** with a fixed namespace list (`common,settings,home,roster,errors,games`). But dowr/spyfall/nhie/etc. expect **per-game** catalogs (`i18n/<lng>/dowr.json`, `strings/en.json`, game `i18n.ts`). | 02's namespace list is closed and doesn't include per-game namespaces; 03 lists yet more keys (`nav.*`, `host.*`, `a11y.*`) not in 02's namespaces. **Decide: are per-game UI strings a new namespace per game, or one big `games` namespace?** This blocks every game's screen text. |
| O6 | **02 vs 00** | 02 says content lives at `src/games/<id>/content/*.json` matching `deckTypes.ts` (`WordDeck`/`PromptDeck`/`LocationsDeck`/`MafiaRolesDeck` discriminated union with `DeckMeta` envelope). But **every game spec defines its own bespoke content schema** (dowr `WordCard`, codenames `WordPack`, spyfall `SpyfallPack`, nhie `Statement`, etc.) that do **not** match 02's `Deck` union. | Either 02's deck model is the canonical content schema (then games must conform) or it's only for the custom-deck editor and games may ship arbitrary JSON. **Clarify.** As written, the "content schema test" in 02 (`glob all content/*.json, run validateDeck`) would **fail on every game's content** because none match `DeckMeta`. |
| O7 | **codenames** | references `--color-team-a`, `--color-team-b`, `--color-neutral`, `--color-assassin` tokens and `sdk/engine/rng.ts`. | 01 defines no team/neutral/assassin tokens; 00 puts rng at `src/engine/rng.ts` (not `sdk/engine/rng.ts`). Add the tokens to 01; fix the rng path. |
| O8 | **dowr** | imports `from '../../sdk/types'` (relative, 2 levels). | 00 says games may use `@/…` or relative; `../../sdk/types` from `src/games/dowr/` resolves to `src/sdk/types` — correct. (No fix; noted to confirm the alias is wired.) |
| O9 | **most-likely-to** | `category: 'social'`. | Not in 00's `GameCategory` union (`party\|word\|deduction\|drawing\|trivia\|reaction\|cards`). Add `'social'\|'voting'` or remap. spyfall/mafia use `'deduction'` (valid); codenames tags include `'spymaster'` (tags are free-ish, fine). |
| O10 | **03** | `avatarPalette.ts` uses `Math.random()` directly in `pickRandomAvatar`. | Allowed (it's UI, not reducer/engine). Just confirm the lint ban on `Math.random` is scoped to `src/engine/**` + `src/games/**/logic.ts` only (00 §App.B says exactly that). No fix; noted. |

---

## 2. GAPS / missing decisions (across all specs)

1. **G1 — No "start a match" entry point in `GameModule`/`ctx`.** Setup screens in **every** game call `ctx.start(config)` / `ctx.startGame(config)` / `host.start(...)` / `ctx.newGame(...)`, but 00's `GameScreenProps.nav` has `toSetup/toPlay/toResults/exit/playAgain` and **no `startMatch(config)`**. 00 §9.1 shows `startMatch` as a local function inside `GameHostPage`, never exposed to the Setup screen. **Define how Setup hands a built `GameConfig` to the host to begin a run.** (Add `nav.startMatch(config)` or `ctx.startMatch(config)`.)

2. **G2 — Seed timing is ambiguous.** 00 passes `seed` to `createInitialState(config, seed)`. But ~7 game specs *also* carry a seed in a `START`/`START_GAME` action and do the deck build there (because they need roster/content the pure reducer can't import). Decide: does the host call `createInitialState(config, seed)` (and the screen passes content via `config.options`/a pre-resolved pool), or does `createInitialState` produce a skeleton and a `START` action finishes setup? Pick one **and document where the content pool enters** (config.options vs action payload — they currently disagree).

3. **G3 — Where does resolved content (deck/words/pool) cross the purity boundary?** Specs split three ways: (a) put resolved ids in `config.options.promptIds` (pantomime, nhie), (b) pass them in the `START` action (`promptPool`, `order`) (mlt, wyr), (c) pass a `wordPool` field on the typed config (codenames). 00 only gives you `GameConfig.options: Record<string,unknown>`. **Standardize: resolved content ids go in `config.options`** (keeps `createInitialState(config, seed)` self-sufficient and pure).

4. **G4 — Generic scoreboard chrome: yes or no?** 03 wants `selectScoreboard`/`ScoreboardModel`/`ScoreboardSheet` in the host; 00 has none and every game ships its own results/scoreboard UI. Decide once.

5. **G5 — The `02` deck model vs per-game content schemas (O6).** Biggest content gap: 02 mandates a `Deck` discriminated union + `validateDeck` CI test, but no game's content matches it. Resolve whether shipped game content must conform to `DeckMeta` or whether 02's model is custom-deck-only.

6. **G6 — Per-game i18n namespacing (O5).** No decision on whether each game adds a namespace, reuses one `games` namespace, or ships its own `i18n.ts`. The typed-keys augmentation in 02 (`react-i18next.d.ts`) lists a fixed closed namespace set, which forbids per-game additions as written.

7. **G7 — Color/accent token system is unspecified end-to-end.** 00 `ColorToken` (8 names) ≠ 01 `AccentName` (6 names) ≠ games' CSS-var strings. No mapping from a manifest token to the `--game-accent` CSS vars is agreed (01 has `accentVars(accent,isDark)` keyed by `AccentName`; 00 manifests carry `color: ColorToken`). **Need one canonical palette + the manifest-token→CSS-var bridge.**

8. **G8 — `Player` color assignment.** 01's `<Avatar>` says player color comes "from a fixed playful palette set in roster"; 03 has `PLAYER_COLORS` hex array; 00's `PlayerSeat.color` is a `ColorToken`. Hex vs token mismatch for player chips. Decide.

9. **G9 — Reduced-motion / mute single-source.** 00 puts `reducedMotion`/`muted` on `ctx`; 01 reads `useReducedMotionSafe()` (framer hook) + settings; 03 has `followSystemMotion` + `MotionConfig`. Three plumbing paths. Pick one source of truth.

10. **G10 — Migration story is thin.** 00 has `migrate?` + `stateVersion`; sessionStore stores `stateVersion`. But no game defines a `migrate`. Acceptable for v1 (stale sessions are discarded), but **state-shape churn during Phase 1 will invalidate saved sessions** — decide whether to bump versions or wipe idb in dev.

11. **G11 — `GameContext` primitives-as-services vs pure-libs (X1).** The deepest unresolved design fork. 00: primitives are pure libs imported in `logic.ts`; ctx is impure services only. 03 + all games: primitives are live APIs on `ctx`/`ctx.sdk`. **This must be decided first — it shapes the entire SDK surface.** Recommendation: keep 00's model (pure libs + thin ctx) because it makes `logic.test.ts` trivially testable and matches the "reducers are pure" mandate; rewrite the game specs' screen sections to import pure helpers + read derived state. (The games' *reducers* already assume pure libs — only their *screens* wrongly reach for `ctx.deck` etc.)

12. **G12 — PWA spec missing.** Brief lists `vite-plugin-pwa`; there is **no spec** for the manifest, icons, offline caching strategy, or update flow. Task #11 has nothing to build against.

13. **G13 — Supabase schema vs stores.** 02 §12 defines `saved_groups.players` as `[{id,name,emoji?,color?}]` and `game_stats`; 03's `authStore`/`sync.ts` reference `roster`+`groups` push/pull but the local `SavedGroup` (memberIds) ≠ remote `saved_groups` (embedded players). Mapping undefined.

14. **G14 — No spec owns `src/engine/*` implementation details beyond signatures.** 00 §6 gives signatures; the brief assigns "01-engine" ownership but **there is no `01-engine` file** (01 is the design system). The engine primitives have a contract but no implementation spec/owner. (The task list's "Build SDK engine primitives" has only 00 §6 to work from — sufficient but thin on edge semantics like deck reshuffle determinism.)

15. **G15 — `estimatedMinutes` semantics.** tuple `[min,max]` (00) vs scalar (several) vs `{min,max}` (mafia). Home sort by duration (03) needs one shape.

16. **G16 — Voting primitive vs games.** 00's `voting` is vote-for-option|vote-for-player with `ballots: Record<voterId,choiceId>`. mlt/wyr/spyfall/mafia each re-model voting in their own state (mlt `pendingVotes`, wyr `choices`, mafia `votes`+`nominations`). They don't actually consume the `voting` primitive's state shape — they reimplement it. Decide if `voting` is a real shared primitive or just UI helpers.

---

## 3. PHASE-1 BUILD ORDER (foundation + Dowr)

**Pre-req (do this FIRST, before any code): freeze the contract.** Reconcile §1 by editing `00` to be the single source of truth and patching `01`/`02`/`03`/`dowr` to match it. At minimum resolve: G11 (primitives model), G1 (start-match entry), G3 (content via `config.options`), F-series (one `GameManifest`), X-series (one `GameContext`), R-series (one registry path), SH-series (one `SoundId`), G7 (one color palette + bridge). Without this, code written for one spec won't link against another.

Then build in dependency order (each file's prerequisites precede it):

### 3.1 Tooling & tokens
1. `vite.config.ts` — React plugin, `@tailwindcss/vite`, `@`→`src` alias. *(01 §2.1)*
2. `tsconfig.app.json` — strict, `@/*` paths, `verbatimModuleSyntax`. *(00 §3)*
3. `src/styles/theme.css` — `@import "tailwindcss"`; `@theme` tokens (colors, type, spacing, radius, shadow, z); `@custom-variant dark`; semantic `:root/.dark` vars; `@utility` bridges. *(01 §2–5)* — **must include the agreed canonical palette (G7) + game-accent vars + any team/assassin tokens codenames needs.**
4. `src/styles/fonts.css` + `public/fonts/*` — Vazirmatn/Baloo2/Inter. *(01 §4)*
5. `src/styles/tokens.ts` — durations/springs/Z/SoundId mirror. *(01 §13)*
6. `index.html` — FOUC theme script + `<meta theme-color>` + `#root`/`#overlay-root`. *(01 §6.2)*

### 3.2 SDK contract (the frozen types) — **the keystone**
7. `src/sdk/types.ts` — the reconciled `LocalizedString, Lang, PlayerId/TeamId, GameCategory, ColorToken, GameManifest, GameCapabilities, GameConfig, PlayerSeat, TeamSetup, GameStateBase, GameActionBase, GameLogic, GameScreenProps, GameNav (incl. startMatch — G1), GameScreens, GameModule, AnyGameModule, DefaultConfigInput, GameContext + service interfaces`. *(00 §3, §7)* — **everything downstream imports this; get it right once.**
8. `src/sdk/context.ts` — `GameContextObject`, `GameContextProvider`, `useGameContext`. *(00 §7)*
9. `src/lib/cn.ts`, `src/lib/localize.ts` (`localize`, `useLocalize`). *(00 §2; 02 §6.1)*

### 3.3 i18n
10. `src/i18n/config.ts`, `detect.ts`, `dir.ts`, `format.ts`, `resources.ts`, `index.ts`, `react-i18next.d.ts`. *(02 §3–5)* — **fix namespace decision (G6) and i18next version (O4) first.**
11. `src/i18n/locales/{en,fa}/{common,settings,home,roster,errors,games,host,a11y,...}.json` — include the keys 03 §13 and dowr §13 consume. *(02 §4; 03 §13)*

### 3.4 Engine primitives (pure libs — testable in isolation)
12. `src/engine/rng.ts` (`rng`, `shuffle`, `pick`, `int`, `deriveSeed`) + `rng.test.ts`. *(00 §6.11)* — first because most others lean on seeded shuffle.
13. `src/engine/ids.ts` (`makeId`, `asPlayerId`). *(00 App.B)*
14. `src/engine/roster.ts`, `teams.ts`, `turnOrder.ts`, `timer.ts`, `deck.ts`, `scoring.ts`, `voting.ts`, `revealGate.ts`, `phaseMachine.ts`, `results.ts` — each pure, each with a `*.test.ts`. *(00 §6)* — **dowr needs roster, teams, turnOrder(circular), timer, deck, scoring, revealGate, phaseMachine, results** — build those before dowr; `voting` can come later (dowr doesn't use it).
15. `src/engine/index.ts` barrel. *(00 §6)*

### 3.5 Services (impure, behind ctx)
16. `src/services/clock.ts` (`now`, `onFrame`, `interval`). *(00 §7)* — **dowr's timer needs this (T1).**
17. `src/services/random.ts` (`seed()` crypto-backed). *(00 §7)*
18. `src/services/sound.ts` (howler, mute-aware, agreed `SoundId`) + `public/sfx/*`. *(01 §9; SH-fix)*
19. `src/services/haptics.ts` (`navigator.vibrate`, agreed pattern union). *(01 §10)*
20. `src/services/supabase.ts` — lazy factory returning `null` when no env. *(00 §10.5; 03 §12)* — stub OK for Phase 1.

### 3.6 Stores (persistence)
21. `src/store/persist/idbStorage.ts`, `persist/keys.ts`. *(00 §10.1)*
22. `src/store/settingsStore.ts` (theme, language, muted, haptics, reducedMotion) — drives theme/dir/sound. *(00 §10.4; 03 §7.1)*
23. `src/store/rosterStore.ts` (delegates to `engine/roster`). *(00 §10.2)*
24. `src/store/sessionStore.ts` (**persisted** per RT2/G10 decision; `start/update/setScreen/clear/get`). *(00 §10.3)*
25. `src/store/authStore.ts` — guest-first stub. *(03 §7.4)*

### 3.7 App shell + providers + theme
26. `src/app/theme/ThemeProvider.tsx` (+ `accentVars` bridge G7), `DirProvider.tsx`. *(01 §6; 02 §5.1)*
27. `src/app/AppProviders.tsx` — i18n + theme + dir + sound + haptics + hydration gate + error boundary + `MotionConfig`. *(03 §6)*
28. `src/app/routes.ts` (agreed path), `AppRouter.tsx` (`HashRouter`). *(00 §9 / RT1 decision)*
29. `src/main.tsx`, `src/App.tsx`. *(00 §2)*

### 3.8 SDK UI kit (only what Setup→Play→Results + Home need for dowr)
30. Primitives: `Button`, `Card`, `Screen`, `Chip`, `Avatar`/`PlayerChip`, `Spinner`, `Backdrop`, `Sheet`, `Modal`. *(01 §8)*
31. Game-shell pieces dowr uses: `AppBar/AppHeader`, `SegmentedControl`, `Stepper`, `Toggle`, `RevealGate`/`Curtain`, `TimerRing`, `ScoreBoard`/`ScoreboardList`, `TeamBadge`, `PlayerRoster`/`PlayerPicker`, `WinnerBanner`, `Confetti`, `PhaseTransition`, `Toast`, `EmptyState`. *(01 §8; dowr §3.3)*
32. `src/sdk/ui/index.ts` barrel + `src/sdk/index.ts` barrel. *(00 App.A)*

### 3.9 Registry + Host + global screens
33. `src/games/registry.ts` (agreed glob path R-fix; `getGame`, `allGames`, `getCatalog`). *(00 §8)*
34. `src/app/pages/GameHostPage.tsx` — resolve module, load/create session, screen selection, build `dispatch` (persist), build `nav` (incl. `startMatch` G1), build+provide `GameContext`, Resume/Start-over prompt. *(00 §9.1)*
35. `src/app/pages/HomePage.tsx` + `GameCard` (reads catalog manifests). *(00 §8; 01 §8.2)*
36. `src/app/pages/PlayersPage.tsx`, `SettingsPage.tsx`, `NotFoundPage.tsx`. *(00 §2; 03 §10–11)*

### 3.10 Dowr (the reference game) — proves the whole stack
37. `src/games/dowr/manifest.ts` (conformed to final `GameManifest`). *(dowr §16 + F3 fixes)*
38. `src/games/dowr/content/*.json` (5 categories) + `content/index.ts` + `deck.ts` (`buildPool`, `shuffle`, `validateContent`). *(dowr §4, §7)*
39. `src/games/dowr/config.ts` (`DowrConfig`, `DEFAULT_CONFIG`, `normalizeConfig`, the module `defaultConfig`/`validateConfig`). *(dowr §5 + D3/S1 fixes)*
40. `src/games/dowr/logic.ts` — `createInitialState(config, seed)` (read players/teams from config — S1), `reducer`, selectors. *(dowr §8–11 + S1)*
41. `src/games/dowr/logic.test.ts` — the 33 cases. *(dowr §18)*
42. `src/games/dowr/screens/{SetupScreen,PlayScreen,ResultsScreen}.tsx` — composed from SDK UI; timer via `ctx.clock` (T1 fix); seed via `ctx.random.seed()`; start via `nav.startMatch` (G1). *(dowr §12 + X2/T1 fixes)*
43. `src/games/dowr/index.ts` — `GameModule` in 00's shape (`logic:{...}, screens:{...}`). *(dowr §17 + M2 fix)*

### 3.11 PWA + verify
44. Write a minimal **PWA spec** (G12), then `vite-plugin-pwa` config + manifest + icons. *(brief; no existing spec)*
45. End-to-end verify: Home shows Dowr card → Setup → Play (reveal, timer, correct/skip, summary) → Results → replay; reload mid-match resumes; en/fa RTL; mute; offline. *(00 §11; dowr §19)*

> **Dependency rationale:** types (7) gate everything; engine primitives (12–15) gate dowr's logic; services+stores (16–25) gate the host; UI (30–32) gates the screens; registry+host (33–36) gate running any game; dowr (37–43) is last and exercises every layer, satisfying the brief's "reference game must use every primitive."

---

## 4. TOP RISKS

1. **R1 — Contract divergence (critical).** The 11 downstream specs don't conform to 00 or to each other (§1). If you start coding games before freezing one contract, you'll rewrite every `index.ts`/manifest/screen. **Mitigation:** do the §3 pre-req (freeze 00, patch 01/02/03/dowr) before writing any `src/games/*` code.

2. **R2 — `GameContext` model fork (G11/X1).** "Primitives as pure libs" (00) vs "primitives as services on ctx" (03 + all games' screens). Choosing wrong forces a second rewrite of every screen. **Mitigation:** decide now; recommend 00's pure-lib model + thin ctx; update game screen sections to import pure helpers and read derived state.

3. **R3 — Manifest non-conformance blocks the Home grid (F-series).** The catalog reads manifests; with 12 different manifest shapes, `getCatalog()` can't render. **Mitigation:** normalize `GameManifest` first; add a runtime manifest validator in the registry (00 §8 already validates `id`/logic/screens — extend it to color/category/minPlayers).

4. **R4 — Content schema gap (O6/G5).** 02's `validateDeck` CI test will fail on every game's bespoke content. **Mitigation:** decide 02-deck-model scope (custom-only vs canonical); if canonical, reshape game content; if not, scope the content test to custom decks.

5. **R5 — Timer model mismatch (T-series).** dowr/heads-up assume a stateful `ctx.timer` controller that 00 doesn't provide; 00's timer is pure data + `ctx.clock`. **Mitigation:** implement `ctx.clock` (interval/onFrame) and write dowr's PlayScreen to the 00 model from the start.

6. **R6 — Seed/content boundary (G2/G3).** Inconsistent across specs (config.options vs START action). If the host and game disagree on where the seed/pool enters, the reducer can't build initial state purely. **Mitigation:** standardize "resolved content ids + seed enter via `createInitialState(config, seed)` with content in `config.options`"; make dowr the worked example.

7. **R7 — Registry path/location ambiguity (R-series).** Three different glob paths/locations. A wrong relative glob silently discovers **zero** games (empty Home) with no error. **Mitigation:** pin the registry file location and matching relative glob; add a dev assertion that the catalog is non-empty.

8. **R8 — Sound/haptic vocab drift (SH-series).** Games trigger `SoundId`s that don't exist (`skip`, `expire`, `card_flip`). At runtime these silently no-op or throw depending on the manager. **Mitigation:** one `SoundId` union in 00; map every game's triggers to it; type-check `sound.play(id)`.

9. **R9 — Persisted-session contradiction (RT2).** 03 says runs are ephemeral; 00 + every game rely on resume. Build the wrong one and "resume mid-game" (a headline feature) breaks. **Mitigation:** sessionStore IS persisted (follow 00); fix 03.

10. **R10 — Missing PWA & engine-impl specs (G12/G14).** Tasks #11 (PWA) and #5 (engine) have thin/absent specs; edge semantics (deck reshuffle determinism, timer pause/resume math, tie-aware ranking) are under-specified and will be reinvented per game. **Mitigation:** write a short PWA spec and an engine-semantics addendum (or treat 00 §6 as binding and add edge-case tests) before tasks #5/#11.

11. **R11 — mafia `_meta` reducer-return shape (O1).** mafia's "reducer may return `{state, meta}`" contradicts 00's `(state,action)=>state`. If unresolved, mafia's screens can't read validation errors. **Mitigation:** bake a non-persisted `_meta` field into mafia's state; never change the reducer signature.

12. **R12 — heads-up new shared primitive (O3).** Adding `sdk/motion` violates "adding a game edits no shared file." **Mitigation:** keep motion as a view-layer hook inside the heads-up folder (pure-boundary-safe); only promote to shared `sdk/` if a second game needs it.

---

### Bottom line
`00-architecture.md` is a solid, buildable contract. The failure mode is that **every other spec drifted from it independently**, producing 4 incompatible `GameModule` shapes, 4 `GameContext` shapes, 12 manifest variants, 3 sound vocabularies, and 3 registry paths. Spend the first work session reconciling specs to `00` (or amending `00` and cascading), then follow the §3 build order. Do **not** implement games before the contract is frozen — that's the one mistake that costs the most rework.
