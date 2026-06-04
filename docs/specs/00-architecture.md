# 00 — Architecture: Game SDK & Plugin Contract

> **Status:** Normative / LOCKED contract.
> **Audience:** Every other spec (01-engine, 02-ui, 03-i18n, 04-pwa, individual game specs) and every implementer.
> **Rule of thumb:** If a game folder needs to edit a file *outside* `src/games/<id>/`, the design is wrong. Read this document first.

This file is the **contract** the rest of the codebase depends on. It defines the shared TypeScript types, the engine "primitives" exposed through `GameContext`, the auto-discovery registry, the on-disk folder layout, how games are routed and hosted through the generic Setup → Play → Results shell, and how in-progress sessions + the player roster are persisted.

The product is a **mobile-first, bilingual (English + Persian, full RTL), playful PWA** for **pass-and-play** party games on **one shared phone**. Everything works **100% offline and signed-out**; sign-in is optional and additive only.

---

## Table of Contents

1. [Design principles](#1-design-principles)
2. [Folder layout under `src/`](#2-folder-layout-under-src)
3. [`src/sdk/types.ts` — the shared type vocabulary](#3-srcsdktypests--the-shared-type-vocabulary)
4. [The plugin contract: `GameManifest`, `GameModule`, `GameLogic`](#4-the-plugin-contract-gamemanifest-gamemodule-gamelogic)
5. [`GameConfig`, `GameState`, `GameAction` conventions](#5-gameconfig-gamestate-gameaction-conventions)
6. [Engine primitives (signatures + state)](#6-engine-primitives-signatures--state)
   - [6.1 roster](#61-roster)
   - [6.2 teams](#62-teams)
   - [6.3 turnOrder](#63-turnorder)
   - [6.4 timer](#64-timer)
   - [6.5 deck](#65-deck)
   - [6.6 scoring](#66-scoring)
   - [6.7 voting](#67-voting)
   - [6.8 revealGate](#68-revealgate)
   - [6.9 phaseMachine](#69-phasemachine)
   - [6.10 results / win-conditions](#610-results--win-conditions)
   - [6.11 rng (seeded randomness)](#611-rng-seeded-randomness)
7. [`GameContext` — how services are injected into a game](#7-gamecontext--how-services-are-injected-into-a-game)
8. [Auto-discovery registry & the home catalog](#8-auto-discovery-registry--the-home-catalog)
9. [Routing & generic Setup → Play → Results hosting](#9-routing--generic-setup--play--results-hosting)
10. [Persistence: roster + in-progress sessions](#10-persistence-roster--in-progress-sessions)
11. [How to add a game (checklist)](#11-how-to-add-a-game-checklist)
12. [Appendix A — reference `src/sdk/index.ts` barrel](#appendix-a--reference-srcsdkindexts-barrel)
13. [Appendix B — error & invariant conventions](#appendix-b--error--invariant-conventions)

---

## 1. Design principles

These are binding constraints. Every primitive, type, and screen below obeys them.

1. **Pure logic, impure shell.** A game's `logic.ts` exports only **pure functions**: `createInitialState(config, seed)` and `reducer(state, action) => state`. No `Date.now()`, no `Math.random()`, no I/O, no DOM. Any randomness or clock value is supplied **inside the action payload** (a `seed: number` or `now: number`). This makes `logic.test.ts` deterministic.
2. **Engine primitives are libraries, not magic.** Each primitive in `src/engine/*` is a set of **pure helper functions over a slice of state** (e.g. `deck.draw(state, n) => { state, drawn }`). Games compose them inside their reducer. The *impure* side (real clock, real RNG, persistence, sound) lives in the **host shell** and is exposed through `GameContext` as **services** the screens call — never the reducer.
3. **Auto-discovery, zero shared edits.** Games are discovered with `import.meta.glob('./games/*/index.ts', { eager: true })`. Adding a game = adding a folder. No central array to update, no switch statement to extend.
4. **Bilingual by construction.** Every user-visible string is either a localized UI key (i18next catalog) or a `LocalizedString = { en; fa }` in game **content** JSON. The engine never hard-codes display text.
5. **Single device, pass-and-play.** There is exactly one active player "holding the phone" at any moment. The engine models **whose turn / whose reveal** it is and provides **revealGate** so the phone can be handed over safely (the holder sees a "tap when ready" curtain).
6. **Offline-first.** All state is serializable JSON and survives reload via `zustand persist` (synchronous draft mirror in `localStorage`) **plus** `idb-keyval` (authoritative async snapshots). Supabase is an optional sync layer, never a dependency.
7. **Serializable everything.** `GameState`, `GameConfig`, roster, and session are plain JSON (no class instances, no `Map`/`Set`, no functions). Use arrays + record objects so persistence and Supabase sync are trivial.

---

## 2. Folder layout under `src/`

```
src/
├─ main.tsx                      # createRoot; mounts <AppProviders><Router/></AppProviders>
├─ App.tsx                       # top-level providers + <AppRouter/>
├─ index.css                    # Tailwind v4 entry: @import "tailwindcss"; @theme {…} tokens
│
├─ app/                          # the host application shell (NOT game-specific)
│  ├─ AppProviders.tsx           # i18n, ThemeProvider, DirProvider, ToastHost, SoundProvider
│  ├─ AppRouter.tsx              # HashRouter + <Routes> (see §9)
│  ├─ routes.ts                  # route path constants + builders (buildPlayPath(gameId), …)
│  ├─ theme/
│  │  ├─ ThemeProvider.tsx       # light/dark: system + manual toggle; sets data-theme
│  │  └─ DirProvider.tsx         # sets <html dir> + lang from i18n language (rtl for fa)
│  └─ pages/
│     ├─ HomePage.tsx            # grid of colorful game cards from the catalog (§8)
│     ├─ PlayersPage.tsx         # roster setup + saved groups (engine roster primitive)
│     ├─ SettingsPage.tsx        # theme, language, global mute, haptics, sign-in entry
│     ├─ GameHostPage.tsx        # generic host for one game (Setup→Play→Results) (§9)
│     └─ NotFoundPage.tsx
│
├─ sdk/                          # THE CONTRACT (this document). Imported by games + host.
│  ├─ types.ts                   # LocalizedString, GameManifest, GameModule, GameContext, …
│  ├─ context.ts                 # React context object + useGameContext() hook
│  ├─ ui/                        # the SDK component library games compose from (spec 02)
│  │  ├─ index.ts                # barrel: Button, Card, Curtain, TimerRing, Stepper, …
│  │  ├─ Button.tsx  Card.tsx  Screen.tsx  Curtain.tsx  TimerRing.tsx
│  │  ├─ PlayerChip.tsx  TeamBadge.tsx  VoteList.tsx  ScoreBoard.tsx  PhaseHeader.tsx
│  │  └─ … (full list owned by spec 02-ui)
│  └─ index.ts                   # public barrel: re-exports types + ui + helpers (App. A)
│
├─ engine/                       # PURE primitive libraries (no React, no I/O)
│  ├─ index.ts                   # barrel re-export of every primitive namespace
│  ├─ ids.ts                     # branded id types + makeId(seed) helpers
│  ├─ rng.ts                     # seeded PRNG (mulberry32) + shuffle(seed, arr)
│  ├─ roster.ts                  # Player, Roster ops
│  ├─ teams.ts                   # TeamSet ops + auto-balance
│  ├─ turnOrder.ts               # sequential | circular | random cursor
│  ├─ timer.ts                   # countdown/stopwatch as data (clock injected)
│  ├─ deck.ts                    # draw/discard/reshuffle over content items
│  ├─ scoring.ts                 # per-player / per-team score ledger
│  ├─ voting.ts                  # vote-for-option | vote-for-player tally
│  ├─ revealGate.ts              # pass-the-phone curtain state machine
│  ├─ phaseMachine.ts            # declarative phase graph + transitions
│  └─ results.ts                 # win-condition evaluation -> standings
│
├─ store/                        # zustand stores (the impure runtime state)
│  ├─ rosterStore.ts             # players + saved groups (persisted)
│  ├─ sessionStore.ts            # in-progress game sessions per gameId (persisted)
│  ├─ settingsStore.ts           # theme, language, muted, haptics (persisted)
│  ├─ authStore.ts               # optional Supabase session (NOT persisted via us)
│  └─ persist/
│     ├─ idbStorage.ts           # zustand StateStorage adapter backed by idb-keyval
│     └─ keys.ts                 # IndexedDB / localStorage key constants
│
├─ services/                     # impure runtime services injected via GameContext
│  ├─ clock.ts                   # now(): number, raf loop, createInterval
│  ├─ random.ts                  # nextSeed(): number (crypto-backed) for action payloads
│  ├─ sound.ts                   # howler wrapper, respects global mute
│  ├─ haptics.ts                 # navigator.vibrate wrapper, respects global mute
│  └─ supabase.ts                # optional client factory (lazy, may be null)
│
├─ i18n/                         # i18next setup + UI catalogs (spec 03)
│  ├─ index.ts                   # init i18next (en default, fa), language detector
│  ├─ en.json   fa.json          # UI strings only (NOT game content)
│
├─ games/                        # ALL plugins live here. Auto-discovered. (§8)
│  └─ <gameId>/                  # one self-contained game (see §11 + §4)
│     ├─ index.ts                # default-exports GameModule
│     ├─ manifest.ts             # GameManifest (metadata for catalog)
│     ├─ logic.ts                # PURE createInitialState + reducer
│     ├─ logic.test.ts           # vitest unit tests of logic.ts
│     ├─ config.ts               # default GameConfig + config schema/validation
│     ├─ content/*.json          # bilingual decks/words/locations/roles
│     └─ screens/
│        ├─ SetupScreen.tsx
│        ├─ PlayScreen.tsx
│        └─ ResultsScreen.tsx
│
├─ lib/                          # tiny cross-cutting helpers (clsx wrapper, localize())
│  ├─ cn.ts                      # className join
│  └─ localize.ts                # localize(ls, lang) and useLocalize()
│
└─ types/                        # ambient + global declarations
   └─ glob.d.ts                  # import.meta.glob typing helpers if needed
```

**Ownership map**

| Path | Owned/specified by |
|---|---|
| `src/sdk/types.ts`, `src/sdk/context.ts` | **This file (00)** — frozen contract |
| `src/sdk/ui/*` | spec **02-ui** (must satisfy the props this file references) |
| `src/engine/*` | spec **01-engine** (must satisfy signatures in §6) |
| `src/store/*`, `src/services/*` | spec **01-engine** + this file (§7, §10) |
| `src/i18n/*` | spec **03-i18n** |
| `src/app/*`, routing | this file (§9) + spec 02-ui for visuals |
| `src/games/*` | per-game specs |

---

## 3. `src/sdk/types.ts` — the shared type vocabulary

This file has **no runtime code** (pure `type`/`interface`), so games and the host can import it freely. Because `verbatimModuleSyntax` is on, always import these with `import type`.

> **Import paths.** The project defines a `@/*` → `src/*` alias (`vite.config.ts` + `tsconfig.app.json`). Host/app/store code SHOULD use it (`import type { GameModule } from '@/sdk/types'`). Game `logic.ts`/screens may use either `@/…` or relative paths; the relative sketches below are equivalent to their `@/`-prefixed forms. The registry glob (§8) stays **relative** (`./*/index.ts`) because `import.meta.glob` patterns are resolved relative to the file, not via aliases.

```ts
// src/sdk/types.ts
import type { ComponentType } from 'react';

/* ─────────────────────────  Localization  ───────────────────────── */

export type Lang = 'en' | 'fa';

/** Every piece of game CONTENT text is bilingual. UI chrome uses i18next keys instead. */
export interface LocalizedString {
  en: string;
  fa: string;
}

/* ─────────────────────────  Branded IDs  ───────────────────────── */
/** Branded primitives prevent accidentally mixing id kinds. Values are plain strings. */
export type PlayerId = string & { readonly __brand: 'PlayerId' };
export type TeamId   = string & { readonly __brand: 'TeamId' };
export type GameId   = string;                 // matches the folder name in src/games/<GameId>

/* ─────────────────────────  Catalog metadata  ───────────────────────── */

export type GameCategory =
  | 'party' | 'word' | 'deduction' | 'drawing' | 'trivia' | 'reaction' | 'cards';

/** Tailwind v4 token name used to color the card (maps to --color-game-* in @theme). */
export type ColorToken =
  | 'grape' | 'tangerine' | 'lime' | 'sky' | 'rose' | 'gold' | 'teal' | 'violet';

/**
 * Static, content-free description of a game. Read at startup to build the home grid.
 * MUST be cheap to evaluate (no heavy imports) — keep manifest.ts dependency-light.
 */
export interface GameManifest {
  id: GameId;                         // unique; equals folder name; stable forever
  name: LocalizedString;              // card title
  tagline: LocalizedString;          // one-line hook under the title
  description: LocalizedString;       // longer text shown on the game detail / setup
  icon: string;                       // emoji or icon-name token rendered on the card
  color: ColorToken;                  // card accent color
  category: GameCategory;
  minPlayers: number;                 // inclusive
  maxPlayers: number;                 // inclusive
  estimatedMinutes: [min: number, max: number];
  tags?: LocalizedString[];           // optional chips (e.g. "loud", "no-writing")
  /** Feature flags the host uses to decide what setup affordances to show. */
  capabilities: GameCapabilities;
  /** Schema version of this game's persisted state; bump on breaking logic changes. */
  stateVersion: number;
  /** If true, hidden from the grid unless an unlock/experimental flag is set. */
  experimental?: boolean;
}

export interface GameCapabilities {
  usesTeams: boolean;                 // host shows team setup in Setup
  usesTimer: boolean;
  usesDeck: boolean;
  usesVoting: boolean;
  usesRevealGate: boolean;            // pass-the-phone curtain
  /** Minimum reveal granularity: does the active "holder" change every turn? */
  passAndPlay: boolean;               // virtually always true for this product
}

/* ─────────────────────────  Config / State / Action  ───────────────────────── */
// Generic params let the host treat all games uniformly while each game keeps strong types.

/** Per-match options chosen in Setup (round count, timer length, deck selection, …). */
export interface GameConfig {
  /** Players participating this match, in seat order (subset of the roster). */
  players: PlayerSeat[];
  /** Optional team assignment when capabilities.usesTeams. */
  teams?: TeamSetup;
  /** Game-specific options bag; each game narrows this via its own type (§5). */
  options: Record<string, unknown>;
  /** Locale captured at match start (content is localized at render with current lang). */
  lang: Lang;
}

export interface PlayerSeat {
  id: PlayerId;
  name: string;                       // denormalized snapshot (roster may change later)
  emoji?: string;
  color?: ColorToken;
}

export interface TeamSetup {
  mode: 'manual' | 'auto';
  teams: { id: TeamId; name: LocalizedString | string; memberIds: PlayerId[] }[];
}

/** Marker base every concrete GameState extends. Must be JSON-serializable. */
export interface GameStateBase {
  /** Mirrors manifest.stateVersion at creation; used for migration on load. */
  v: number;
  /** Current phase id from the game's phaseMachine. */
  phase: string;
  /** True once a win-condition fired and Results should be shown. */
  finished: boolean;
}

/** Marker base every concrete GameAction extends (a discriminated union per game). */
export interface GameActionBase {
  type: string;
}

/* ─────────────────────────  The plugin entry types  ───────────────────────── */

/**
 * Pure logic of a game. NO side effects: no Date.now, no Math.random, no I/O.
 * Randomness/clock arrive via the action payload (seed / now fields).
 */
export interface GameLogic<S extends GameStateBase, A extends GameActionBase> {
  /** Build the starting state from config; `seed` is supplied by the host (impure source). */
  createInitialState: (config: GameConfig, seed: number) => S;
  /** Pure transition. Must return a NEW state object (no mutation). */
  reducer: (state: S, action: A) => S;
  /** Optional migrator invoked when a persisted state's `v` < manifest.stateVersion. */
  migrate?: (oldState: unknown, fromVersion: number) => S;
}

/** Props the host passes to every game screen. Generic over the game's state/action. */
export interface GameScreenProps<S extends GameStateBase, A extends GameActionBase> {
  state: S;
  config: GameConfig;
  /** Dispatch a pure action through the game's reducer (host handles persistence). */
  dispatch: (action: A) => void;
  /** The injected services + engine helpers (see §7). */
  ctx: GameContext;
  /** Navigate the host shell. */
  nav: GameNav;
}

export interface GameNav {
  toSetup: () => void;
  toPlay: () => void;
  toResults: () => void;
  exit: () => void;                   // back to Home, after confirm
  /** Start a brand-new match of the same game (clears session, returns to Setup). */
  playAgain: () => void;
}

/** The three screens a game must provide; composed from sdk/ui. */
export interface GameScreens<S extends GameStateBase, A extends GameActionBase> {
  Setup: ComponentType<GameScreenProps<S, A>>;
  Play: ComponentType<GameScreenProps<S, A>>;
  Results: ComponentType<GameScreenProps<S, A>>;
}

/**
 * The default export of src/games/<id>/index.ts.
 * `unknown` generics at the boundary let the registry hold a heterogeneous list;
 * each game keeps its own strong S/A internally.
 */
export interface GameModule<
  S extends GameStateBase = GameStateBase,
  A extends GameActionBase = GameActionBase,
> {
  manifest: GameManifest;
  logic: GameLogic<S, A>;
  screens: GameScreens<S, A>;
  /** Produce the default config given the chosen players/lang (pre-fills Setup). */
  defaultConfig: (input: DefaultConfigInput) => GameConfig;
  /** Validate a config before starting; return localized errors or null. */
  validateConfig?: (config: GameConfig) => LocalizedString[] | null;
}

export interface DefaultConfigInput {
  players: PlayerSeat[];
  lang: Lang;
}

/** Type-erased module the registry stores (see §8). */
export type AnyGameModule = GameModule<GameStateBase, GameActionBase>;
```

`GameContext` itself is large and lives at the bottom of `types.ts`; it is detailed in **§7**.

---

## 4. The plugin contract: `GameManifest`, `GameModule`, `GameLogic`

A game is the `default` export of `src/games/<id>/index.ts`, of type `GameModule`. Reference sketch:

```ts
// src/games/example/index.ts
import type { GameModule } from '../../sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer, migrate } from './logic';
import { defaultConfig, validateConfig } from './config';
import { Setup } from './screens/SetupScreen';
import { Play } from './screens/PlayScreen';
import { Results } from './screens/ResultsScreen';
import type { ExampleState, ExampleAction } from './logic';

const mod: GameModule<ExampleState, ExampleAction> = {
  manifest,
  logic: { createInitialState, reducer, migrate },
  screens: { Setup, Play, Results },
  defaultConfig,
  validateConfig,
};

export default mod;
```

```ts
// src/games/example/manifest.ts
import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'example',
  name: { en: 'Example', fa: 'نمونه' },
  tagline: { en: 'A tiny demo', fa: 'یک نمونه کوچک' },
  description: { en: '…', fa: '…' },
  icon: '🎲',
  color: 'grape',
  category: 'party',
  minPlayers: 2,
  maxPlayers: 12,
  estimatedMinutes: [5, 15],
  capabilities: {
    usesTeams: false, usesTimer: true, usesDeck: true,
    usesVoting: false, usesRevealGate: true, passAndPlay: true,
  },
  stateVersion: 1,
};
```

**Contract rules**

- `manifest.id` MUST equal the folder name and is **permanent** (it keys persisted sessions).
- `logic.ts` exports **named** `createInitialState`, `reducer`, optionally `migrate`, plus the game's `State`/`Action` types. It imports **only** from `src/engine/*`, `src/sdk/types`, `src/lib/*`, and its own `content/*.json`. It MUST NOT import React, stores, services, or the DOM.
- Screens import from `src/sdk/ui` and `src/sdk/types` only (plus their own `logic` types). They never import engine primitives directly — they read derived data the reducer already placed in state, and they dispatch actions.
- `content/*.json` files contain `LocalizedString` values for any displayable text.

---

## 5. `GameConfig`, `GameState`, `GameAction` conventions

### 5.1 Narrowing the generic config

`GameConfig.options` is `Record<string, unknown>` at the boundary. Each game defines a typed options interface and a parser:

```ts
// src/games/example/config.ts
import type { GameConfig, DefaultConfigInput, LocalizedString } from '../../sdk/types';

export interface ExampleOptions {
  rounds: number;
  timerSeconds: number;
  deckIds: string[];
}

export function readOptions(config: GameConfig): ExampleOptions {
  const o = config.options as Partial<ExampleOptions>;
  return {
    rounds: o.rounds ?? 3,
    timerSeconds: o.timerSeconds ?? 60,
    deckIds: o.deckIds ?? ['core'],
  };
}

export function defaultConfig({ players, lang }: DefaultConfigInput): GameConfig {
  return { players, lang, options: { rounds: 3, timerSeconds: 60, deckIds: ['core'] } };
}

export function validateConfig(config: GameConfig): LocalizedString[] | null {
  const errors: LocalizedString[] = [];
  if (config.players.length < 2)
    errors.push({ en: 'Need at least 2 players', fa: 'حداقل ۲ بازیکن لازم است' });
  return errors.length ? errors : null;
}
```

### 5.2 State shape convention

Each `GameState` **embeds primitive sub-states** rather than re-implementing them. A typical state:

```ts
// src/games/example/logic.ts
import type {
  GameStateBase, GameActionBase, GameConfig,
} from '../../sdk/types';
import type { TurnOrderState } from '../../engine/turnOrder';
import type { TimerState } from '../../engine/timer';
import type { DeckState } from '../../engine/deck';
import type { ScoreState } from '../../engine/scoring';
import * as turnOrder from '../../engine/turnOrder';
import * as timer from '../../engine/timer';
import * as deck from '../../engine/deck';
import * as scoring from '../../engine/scoring';
import { rng } from '../../engine/rng';

export interface ExampleState extends GameStateBase {
  phase: 'idle' | 'playing' | 'roundEnd' | 'gameEnd';
  round: number;
  turn: TurnOrderState;
  clock: TimerState;
  deck: DeckState<string>;            // deck of content item ids
  score: ScoreState;
}

export type ExampleAction =
  | { type: 'START'; seed: number }
  | { type: 'CORRECT'; now: number }
  | { type: 'SKIP'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'NEXT_TURN'; seed: number }
  | { type: 'END' };

export function createInitialState(config: GameConfig, seed: number): ExampleState { /* … */ }

export function reducer(state: ExampleState, action: ExampleAction): ExampleState {
  switch (action.type) {
    case 'TICK':   return { ...state, clock: timer.tick(state.clock, action.now) };
    case 'CORRECT': {
      const next = deck.draw(state.deck, 1, /*seed*/ 0);     // pure
      return { ...state, deck: next.deck,
               score: scoring.add(state.score, currentPlayer(state), 1) };
    }
    /* … */
    default: return state;
  }
}
```

**Conventions (binding):**

- The reducer is a `switch` on `action.type`; the `default` returns `state` unchanged (never throws on unknown actions — forward-compat with persisted action logs).
- Reducer **never** mutates; always returns a new object (spread or structural update).
- Any randomness/time comes from `action.seed` / `action.now`. The reducer may call **pure** `rng(seed)` helpers but never the global RNG.
- Set `state.finished = true` (and `phase` to a terminal phase) when a win-condition fires; the host watches `finished` to navigate to Results.

---

## 6. Engine primitives (signatures + state)

Every primitive is a **pure module** under `src/engine/`. Pattern: a serializable `XState` interface + pure functions that take state and return new state (and possibly a derived payload). No primitive imports React, stores, services, or `Date`/`Math.random`.

All primitives are namespaced (`import * as deck from '../../engine/deck'`). The barrel `src/engine/index.ts` re-exports them for the host.

### 6.1 roster

The roster is the **persistent list of people** (lives in `rosterStore`, §10). The `roster.ts` primitive is the pure op library used by both the store and Setup.

```ts
// src/engine/roster.ts
import type { PlayerId, ColorToken } from '../sdk/types';

export interface Player {
  id: PlayerId;
  name: string;
  emoji?: string;
  color?: ColorToken;
  createdAt: number;                  // ms epoch, supplied by caller
}

/** A named, reusable group ("Family", "Friday crew"). */
export interface SavedGroup {
  id: string;
  name: string;
  memberIds: PlayerId[];
  createdAt: number;
}

export interface RosterState {
  players: Player[];                  // canonical order = insertion order
  groups: SavedGroup[];
}

export const emptyRoster: () => RosterState;

export function addPlayer(s: RosterState, p: Omit<Player, 'id' | 'createdAt'>,
                          id: PlayerId, now: number): RosterState;
export function updatePlayer(s: RosterState, id: PlayerId,
                             patch: Partial<Omit<Player, 'id'>>): RosterState;
export function removePlayer(s: RosterState, id: PlayerId): RosterState;
export function reorderPlayers(s: RosterState, orderedIds: PlayerId[]): RosterState;

export function saveGroup(s: RosterState, name: string, memberIds: PlayerId[],
                          id: string, now: number): RosterState;
export function deleteGroup(s: RosterState, id: string): RosterState;

/** Resolve a saved group (or ad-hoc ids) to PlayerSeat[] for a GameConfig. */
export function toSeats(s: RosterState, memberIds: PlayerId[]): import('../sdk/types').PlayerSeat[];
```

### 6.2 teams

```ts
// src/engine/teams.ts
import type { PlayerId, TeamId, LocalizedString } from '../sdk/types';

export interface Team {
  id: TeamId;
  name: LocalizedString | string;
  memberIds: PlayerId[];
  color?: import('../sdk/types').ColorToken;
}

export interface TeamSetState {
  teams: Team[];
}

export const emptyTeamSet: () => TeamSetState;

export function createTeams(count: number, makeId: (i: number) => TeamId): TeamSetState;
export function assign(s: TeamSetState, teamId: TeamId, playerId: PlayerId): TeamSetState;
export function unassign(s: TeamSetState, playerId: PlayerId): TeamSetState;

/** Even, deterministic split of players across `count` teams using a seed. */
export function autoBalance(playerIds: PlayerId[], count: number, seed: number,
                            makeId: (i: number) => TeamId): TeamSetState;

export function teamOf(s: TeamSetState, playerId: PlayerId): TeamId | undefined;
export function isComplete(s: TeamSetState, allPlayerIds: PlayerId[]): boolean;
```

### 6.3 turnOrder

Supports the three required modes: `sequential`, `circular`, `random`.

```ts
// src/engine/turnOrder.ts
import type { PlayerId } from '../sdk/types';

export type TurnMode = 'sequential' | 'circular' | 'random';

export interface TurnOrderState {
  mode: TurnMode;
  order: PlayerId[];                  // seating order
  index: number;                      // cursor into `order`
  round: number;                      // completed full passes (for sequential/circular)
  /** For 'random': ids already used this round so we don't repeat until refilled. */
  remaining?: PlayerId[];
}

export function init(order: PlayerId[], mode: TurnMode, seed: number): TurnOrderState;

/** Current player whose turn it is. */
export function current(s: TurnOrderState): PlayerId;

/**
 * Advance the cursor.
 *  - sequential: index+1; stops at end (index === order.length signals round done)
 *  - circular:   wraps to 0, increments round on wrap
 *  - random:     pops next from a seeded-shuffled `remaining`; refills+increments round when empty
 * `seed` only consumed in 'random' mode.
 */
export function next(s: TurnOrderState, seed: number): TurnOrderState;

export function isRoundComplete(s: TurnOrderState): boolean;
export function reset(s: TurnOrderState, seed: number): TurnOrderState;
export function peekNext(s: TurnOrderState, seed: number): PlayerId; // who comes next (for "pass to X")
```

### 6.4 timer

The timer is **pure data**; the real clock is injected. Screens call `ctx.clock` and dispatch `{ type:'TICK', now }`; the reducer folds `now` into the timer.

```ts
// src/engine/timer.ts
export type TimerMode = 'countdown' | 'stopwatch';

export interface TimerState {
  mode: TimerMode;
  durationMs: number;                 // for countdown (0 for stopwatch)
  /** Accumulated elapsed ms while running, excluding current run segment. */
  accumulatedMs: number;
  /** Wall-clock ms when the current run segment started, or null when paused. */
  startedAt: number | null;
  running: boolean;
}

export function create(mode: TimerMode, durationMs: number): TimerState;
export function start(s: TimerState, now: number): TimerState;
export function pause(s: TimerState, now: number): TimerState;
export function reset(s: TimerState, now: number): TimerState;

/** Idempotent fold of the current clock value; safe to call every animation frame. */
export function tick(s: TimerState, now: number): TimerState;

/** Pure selectors (no clock needed beyond what tick stored, but accept `now` for live read). */
export function elapsedMs(s: TimerState, now: number): number;
export function remainingMs(s: TimerState, now: number): number;   // countdown only, clamped >= 0
export function isExpired(s: TimerState, now: number): boolean;     // countdown reached 0
```

### 6.5 deck

A deck draws from **content item ids** (the actual bilingual content lives in `content/*.json`; the deck only shuffles ids so state stays small + serializable).

```ts
// src/engine/deck.ts
export interface DeckState<T = string> {
  drawPile: T[];
  discardPile: T[];
  current?: T;                        // the item currently in play (top of table)
}

export function create<T>(items: T[], seed: number): DeckState<T>;      // shuffled draw pile

export interface DrawResult<T> { deck: DeckState<T>; drawn: T[]; reshuffled: boolean; }

/** Draw n; auto-reshuffle discard into draw when empty (deterministic via seed). */
export function draw<T>(s: DeckState<T>, n: number, seed: number): DrawResult<T>;

export function discard<T>(s: DeckState<T>, item: T): DeckState<T>;
export function setCurrent<T>(s: DeckState<T>, item: T): DeckState<T>;
export function remaining<T>(s: DeckState<T>): number;
export function isExhausted<T>(s: DeckState<T>): boolean;               // both piles empty
export function reshuffle<T>(s: DeckState<T>, seed: number): DeckState<T>;
```

### 6.6 scoring

Generic ledger keyed by `PlayerId` **or** `TeamId` (both are strings); games choose the key space.

```ts
// src/engine/scoring.ts
export interface ScoreState {
  /** subjectId (PlayerId or TeamId as string) -> running total. */
  totals: Record<string, number>;
  /** Append-only log for "play-by-play" UI and undo. */
  log: ScoreEvent[];
}

export interface ScoreEvent {
  subjectId: string;
  delta: number;
  reason?: string;                    // i18n key or content tag, NOT display text
  at: number;                         // supplied by caller (now)
}

export function create(subjectIds: string[]): ScoreState;              // all start at 0
export function add(s: ScoreState, subjectId: string, delta: number,
                    reason?: string, at?: number): ScoreState;
export function set(s: ScoreState, subjectId: string, value: number, at?: number): ScoreState;
export function undoLast(s: ScoreState): ScoreState;

export function total(s: ScoreState, subjectId: string): number;
export function standings(s: ScoreState): { subjectId: string; total: number }[]; // desc, stable
export function leader(s: ScoreState): string | undefined;
```

### 6.7 voting

Both required shapes: **vote-for-option** and **vote-for-player**. One state type, discriminated by `target`.

```ts
// src/engine/voting.ts
import type { PlayerId } from '../sdk/types';

export type VoteTarget = 'option' | 'player';

export interface VoteState {
  target: VoteTarget;
  /** allowed targets: option ids (strings) or PlayerIds. */
  choices: string[];
  /** voterId -> chosen targetId. One vote per voter; re-voting overwrites. */
  ballots: Record<string, string>;
  voters: PlayerId[];                 // who is eligible to vote
  open: boolean;
}

export function openOption(choices: string[], voters: PlayerId[]): VoteState;
export function openPlayer(candidates: PlayerId[], voters: PlayerId[]): VoteState;

export function cast(s: VoteState, voterId: PlayerId, choiceId: string): VoteState;
export function retract(s: VoteState, voterId: PlayerId): VoteState;
export function close(s: VoteState): VoteState;

export function tally(s: VoteState): Record<string, number>;           // choiceId -> count
/** Winner(s); array length > 1 means a tie. Deterministic order. */
export function winners(s: VoteState): string[];
export function allVoted(s: VoteState): boolean;
export function turnout(s: VoteState): number;                         // 0..1
```

### 6.8 revealGate

The pass-the-phone safety curtain. Models "hand the phone to player X; they tap to reveal their private info; they tap to hide before passing on."

```ts
// src/engine/revealGate.ts
import type { PlayerId } from '../sdk/types';

export type GatePhase = 'handoff' | 'revealed' | 'hidden' | 'done';

export interface RevealGateState {
  /** queue of players who must each privately view their secret, in order. */
  queue: PlayerId[];
  index: number;                      // whose turn to view
  phase: GatePhase;
}

export function init(queue: PlayerId[]): RevealGateState;
export function holder(s: RevealGateState): PlayerId | undefined;       // current viewer
export function reveal(s: RevealGateState): RevealGateState;            // handoff -> revealed
export function hide(s: RevealGateState): RevealGateState;              // revealed -> hidden
export function pass(s: RevealGateState): RevealGateState;              // hidden -> next handoff / done
export function isDone(s: RevealGateState): boolean;
export function progress(s: RevealGateState): { viewed: number; total: number };
```

The matching SDK UI component `<Curtain>` (spec 02) renders the "Pass the phone to **{name}**" screen and the tap-to-reveal/hide affordance, dispatching the corresponding actions.

### 6.9 phaseMachine

A declarative phase graph. Games describe legal transitions; the reducer asks the machine whether a transition is allowed and what the next phase is. Keeps `phase` strings disciplined and lets the host render a generic `<PhaseHeader>`.

```ts
// src/engine/phaseMachine.ts
export interface PhaseNode<P extends string> {
  id: P;
  /** legal next phases from here. */
  to: P[];
  /** true if reaching this phase means the match is over (host -> Results). */
  terminal?: boolean;
}

export interface PhaseMachine<P extends string> {
  initial: P;
  nodes: Record<P, PhaseNode<P>>;
}

export function defineMachine<P extends string>(m: PhaseMachine<P>): PhaseMachine<P>;
export function canGo<P extends string>(m: PhaseMachine<P>, from: P, to: P): boolean;
/** Returns `to` if legal, otherwise returns `from` (never throws — see §5 default rule). */
export function go<P extends string>(m: PhaseMachine<P>, from: P, to: P): P;
export function isTerminal<P extends string>(m: PhaseMachine<P>, phase: P): boolean;
```

Usage sketch:

```ts
const machine = defineMachine({
  initial: 'idle',
  nodes: {
    idle:     { id: 'idle',     to: ['playing'] },
    playing:  { id: 'playing',  to: ['roundEnd'] },
    roundEnd: { id: 'roundEnd', to: ['playing', 'gameEnd'] },
    gameEnd:  { id: 'gameEnd',  to: [], terminal: true },
  },
});
// in reducer: phase: go(machine, state.phase, 'roundEnd')
```

### 6.10 results / win-conditions

Turns final state into standings + a localized headline the Results screen renders.

```ts
// src/engine/results.ts
import type { LocalizedString } from '../sdk/types';
import type { ScoreState } from './scoring';

export interface Standing {
  subjectId: string;                  // PlayerId or TeamId
  rank: number;                       // 1-based; ties share a rank
  total: number;
  isWinner: boolean;
}

export interface MatchResult {
  standings: Standing[];
  winners: string[];                  // subjectIds sharing rank 1 (>1 => tie)
  /** Localized headline tokens; UI maps to a sentence (e.g. "{name} wins!"). */
  outcome:
    | { kind: 'winner'; subjectId: string }
    | { kind: 'tie'; subjectIds: string[] }
    | { kind: 'noContest' };
  /** Optional custom note from the game (already localized). */
  note?: LocalizedString;
}

/** Standard score-based evaluation; highest total wins (or lowest if lowerWins). */
export function fromScores(score: ScoreState, opts?: { lowerWins?: boolean }): MatchResult;

/** Build standings from an arbitrary subject->value map for non-score games. */
export function fromValues(values: Record<string, number>,
                           opts?: { lowerWins?: boolean }): MatchResult;
```

A game with a bespoke win condition (e.g. social-deduction "spy escaped") constructs a `MatchResult` directly in its reducer/selector and stores it in state, or computes it in `ResultsScreen` from final state.

### 6.11 rng (seeded randomness)

Pure, deterministic PRNG used **inside** reducers (seed comes from the action payload). The **impure** entropy source that produces those seeds is `services/random.ts` (§7).

```ts
// src/engine/rng.ts
/** mulberry32: returns a generator function producing floats in [0,1). */
export function rng(seed: number): () => number;

/** Fisher–Yates using a seed; returns a NEW shuffled array (input untouched). */
export function shuffle<T>(items: readonly T[], seed: number): T[];

/** Deterministic pick of one item. */
export function pick<T>(items: readonly T[], seed: number): T;

/** Deterministic integer in [min, max]. */
export function int(min: number, max: number, seed: number): number;

/** Derive a child seed deterministically (for chaining multiple draws from one action seed). */
export function deriveSeed(seed: number, salt: number): number;
```

---

## 7. `GameContext` — how services are injected into a game

`GameContext` is the **impure** counterpart to the pure engine. Screens receive it via the `ctx` prop (already wired by `GameHostPage`) and via the `useGameContext()` hook. It bundles: localization, the real clock, an entropy source for seeds, sound/haptics (mute-aware), navigation flags, and convenience access to the active config. Screens use it to (a) get a real `now`/`seed` to put into actions, and (b) trigger feedback.

```ts
// appended to src/sdk/types.ts
import type { TFunction } from 'i18next';

export interface GameContext {
  /* localization */
  lang: Lang;
  /** Translate a UI catalog key (chrome). */
  t: TFunction;
  /** Resolve a LocalizedString (game content) to the current language. */
  localize: (ls: LocalizedString) => string;
  setLang: (lang: Lang) => void;

  /* impure sources for action payloads (the ONLY sanctioned entropy/clock in games) */
  clock: ClockService;
  random: RandomService;

  /* feedback (respect global mute in settings) */
  sound: SoundService;
  haptics: HapticsService;

  /* environment */
  prefersDark: boolean;
  muted: boolean;
  reducedMotion: boolean;
  isOnline: boolean;
}

export interface ClockService {
  now: () => number;                                  // Date.now wrapper
  /** Subscribe to animation frames; returns an unsubscribe fn. Used to drive TICK. */
  onFrame: (cb: (now: number) => void) => () => void;
  /** Fixed-interval ticker (ms); returns unsubscribe. */
  interval: (ms: number, cb: (now: number) => void) => () => void;
}

export interface RandomService {
  /** A fresh 32-bit seed (crypto-backed) to embed in an action payload. */
  seed: () => number;
}

export interface SoundService {
  play: (id: SoundId) => void;
  preload: (ids: SoundId[]) => void;
  stop: (id?: SoundId) => void;
}
export type SoundId =
  | 'tap' | 'correct' | 'wrong' | 'tick' | 'timeUp'
  | 'reveal' | 'win' | 'lose' | 'shuffle' | 'pass';

export interface HapticsService {
  light: () => void;
  medium: () => void;
  heavy: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
}
```

**Wiring (host side).** `GameHostPage` builds a single memoized `GameContext` from the providers and stores:

```ts
// inside GameHostPage.tsx (sketch)
const ctx: GameContext = useMemo(() => ({
  lang, t, localize, setLang,
  clock: clockService,                 // services/clock.ts singleton
  random: randomService,               // services/random.ts singleton
  sound:  muted ? noopSound  : soundService,
  haptics: muted ? noopHaptics : hapticsService,
  prefersDark, muted, reducedMotion, isOnline,
}), [lang, muted, prefersDark, reducedMotion, isOnline]);

return (
  <GameContextProvider value={ctx}>
    <ActiveScreen state={state} config={config} dispatch={dispatch} ctx={ctx} nav={nav} />
  </GameContextProvider>
);
```

```ts
// src/sdk/context.ts
import { createContext, useContext } from 'react';
import type { GameContext } from './types';

export const GameContextObject = createContext<GameContext | null>(null);
export const GameContextProvider = GameContextObject.Provider;

export function useGameContext(): GameContext {
  const v = useContext(GameContextObject);
  if (!v) throw new Error('useGameContext must be used within GameContextProvider');
  return v;
}
```

**Why two layers?** The reducer stays pure & unit-testable (no `ctx`); screens are where impurity is allowed, and they only ever inject the *results* of impurity (`now`, `seed`) into action payloads. Example:

```tsx
function PlayScreen({ state, dispatch, ctx }: GameScreenProps<ExampleState, ExampleAction>) {
  useEffect(() => ctx.clock.onFrame((now) => dispatch({ type: 'TICK', now })), [ctx, dispatch]);
  const onCorrect = () => { ctx.sound.play('correct'); ctx.haptics.success();
                            dispatch({ type: 'CORRECT', now: ctx.clock.now() }); };
  // …
}
```

---

## 8. Auto-discovery registry & the home catalog

Adding a game = adding a folder. The registry eagerly imports every `index.ts` under `src/games/*/`.

```ts
// src/games/registry.ts
import type { AnyGameModule, GameId, GameManifest } from '../sdk/types';

const modules = import.meta.glob<{ default: AnyGameModule }>(
  './*/index.ts',
  { eager: true },
);

function validate(m: AnyGameModule, key: string): void {
  if (!m?.manifest?.id) throw new Error(`Game at ${key} is missing manifest.id`);
  if (!m.logic?.reducer || !m.logic?.createInitialState)
    throw new Error(`Game "${m.manifest.id}" missing pure logic`);
  if (!m.screens?.Setup || !m.screens?.Play || !m.screens?.Results)
    throw new Error(`Game "${m.manifest.id}" missing a required screen`);
}

const byId = new Map<GameId, AnyGameModule>();
for (const [key, mod] of Object.entries(modules)) {
  const m = mod.default;
  validate(m, key);
  // folder name MUST equal manifest.id (dev-only assertion)
  const folder = key.split('/')[1];
  if (import.meta.env.DEV && folder !== m.manifest.id)
    throw new Error(`Folder "${folder}" != manifest.id "${m.manifest.id}"`);
  if (byId.has(m.manifest.id)) throw new Error(`Duplicate game id "${m.manifest.id}"`);
  byId.set(m.manifest.id, m);
}

/** Lookup a single module (for the host). */
export function getGame(id: GameId): AnyGameModule | undefined { return byId.get(id); }

/** All modules (rarely needed directly). */
export function allGames(): AnyGameModule[] { return [...byId.values()]; }

/** The lightweight CATALOG the home grid consumes (manifests only, sorted). */
export function getCatalog(opts?: { includeExperimental?: boolean }): GameManifest[] {
  return allGames()
    .map((m) => m.manifest)
    .filter((mf) => opts?.includeExperimental || !mf.experimental)
    .sort((a, b) => a.category.localeCompare(b.category)
                 || a.id.localeCompare(b.id));
}
```

**Catalog usage on Home.** `HomePage` calls `getCatalog()` once and renders a responsive grid of colorful `<GameCard>`s (color from `manifest.color`, icon from `manifest.icon`, title/tagline via `localize`). Tapping a card navigates to `/<gameId>` (the host). The catalog returns **only manifests** (no logic/screens), so the home grid stays cheap and never pulls heavy game code until a game is opened. (If lazy code-splitting per game is desired later, swap `{ eager: true }` for lazy globs in a follow-up; the catalog API stays identical because manifests would then be split into a separate `manifest`-only glob.)

> **Optimization note (non-breaking):** to keep first paint light, a parallel `import.meta.glob('./*/manifest.ts', { eager: true })` may back `getCatalog()` while `index.ts` modules are loaded lazily on demand by `getGame()`. The public functions above remain the contract.

---

## 9. Routing & generic Setup → Play → Results hosting

Routing uses **`HashRouter`** (Capacitor-friendly). One generic host page drives any game.

```ts
// src/app/routes.ts
export const ROUTES = {
  home: '/',
  players: '/players',
  settings: '/settings',
  game: '/g/:gameId',                 // host; phase chosen by session/state, not URL
} as const;

export const buildGamePath = (gameId: string) => `/g/${gameId}`;
```

```tsx
// src/app/AppRouter.tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/g/:gameId" element={<GameHostPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  );
}
```

### 9.1 The generic host: `GameHostPage`

`GameHostPage` is the **only** place that knows how to run a game generically. It:

1. Reads `:gameId`, looks up the module via `getGame(id)`; 404s if missing.
2. Loads or creates the **session** for this `gameId` from `sessionStore` (§10).
3. Decides which screen to render purely from session + state:
   - no session, or session at `phase === 'setup'` → **Setup**
   - session exists and `state && !state.finished` → **Play**
   - `state.finished === true` → **Results**
4. Builds `dispatch` that: runs `module.logic.reducer(state, action)`, writes the new state into the session, and triggers debounced persistence.
5. Builds `nav` (`toSetup/toPlay/toResults/exit/playAgain`) by mutating the session's `screen` field and/or clearing state.
6. Builds and provides `GameContext` (§7).

```ts
// Session screen is an explicit host-level enum, independent of game phase strings.
export type HostScreen = 'setup' | 'play' | 'results';
```

```tsx
// src/app/pages/GameHostPage.tsx (control flow sketch)
const { gameId } = useParams();
const module = getGame(gameId!);
if (!module) return <NotFoundPage />;

const session = useSessionStore((s) => s.sessions[gameId!]);
const startMatch = (config: GameConfig) => {
  const seed = randomService.seed();
  const state = module.logic.createInitialState(config, seed);
  sessionStore.start(gameId!, { config, state, screen: 'play', updatedAt: clock.now() });
};

const dispatch = (action: GameActionBase) => {
  const next = module.logic.reducer(session.state, action);
  const screen: HostScreen = next.finished ? 'results' : session.screen;
  sessionStore.update(gameId!, { state: next, screen, updatedAt: clock.now() });
};

const Screen =
  !session || session.screen === 'setup' ? module.screens.Setup
  : session.screen === 'results' || session.state?.finished ? module.screens.Results
  : module.screens.Play;
```

**Screen responsibilities**

- **SetupScreen**: composes roster/team pickers + this game's options; calls `nav` → on confirm it calls `startMatch(config)` (exposed via `ctx`/props) and transitions to Play. Uses `module.validateConfig` to gate the Start button.
- **PlayScreen**: the game loop. Drives timer via `ctx.clock`, dispatches actions, renders SDK UI (curtain, deck, scoreboard, voting). When `state.finished` flips, host auto-routes to Results.
- **ResultsScreen**: renders `MatchResult` (standings, winner banner, confetti). Offers `nav.playAgain()` (new match, same game) and `nav.exit()` (Home).

**Exit & resume.** Leaving mid-match keeps the session persisted. Returning to `/g/:gameId` while a non-finished session exists shows a **"Resume / Start over"** prompt (host-level), implemented in `GameHostPage` before mounting a screen.

---

## 10. Persistence: roster + in-progress sessions

Two persistence tiers, both via **zustand `persist`** with a **custom `StateStorage` backed by `idb-keyval`** (IndexedDB) for durability, plus an automatic localStorage fallback mirror for synchronous first paint.

### 10.1 idb-keyval StateStorage adapter

```ts
// src/store/persist/idbStorage.ts
import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

export const idbStorage: StateStorage = {
  getItem:    async (name) => (await get<string>(name)) ?? null,
  setItem:    async (name, value) => { await set(name, value); },
  removeItem: async (name) => { await del(name); },
};
```

```ts
// src/store/persist/keys.ts
export const STORE_KEYS = {
  roster:   'sgw.roster.v1',
  sessions: 'sgw.sessions.v1',
  settings: 'sgw.settings.v1',
} as const;
```

### 10.2 rosterStore (players + saved groups)

```ts
// src/store/rosterStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from './persist/idbStorage';
import { STORE_KEYS } from './persist/keys';
import * as roster from '../engine/roster';
import type { Player, SavedGroup, RosterState } from '../engine/roster';
import type { PlayerId } from '../sdk/types';

interface RosterStore extends RosterState {
  addPlayer: (p: Omit<Player, 'id' | 'createdAt'>) => PlayerId;
  updatePlayer: (id: PlayerId, patch: Partial<Omit<Player, 'id'>>) => void;
  removePlayer: (id: PlayerId) => void;
  reorder: (orderedIds: PlayerId[]) => void;
  saveGroup: (name: string, memberIds: PlayerId[]) => string;
  deleteGroup: (id: string) => void;
}

export const useRosterStore = create<RosterStore>()(
  persist(
    (set, get) => ({
      players: [], groups: [],
      addPlayer: (p) => { /* uses roster.addPlayer with makeId + Date.now */ return id; },
      /* … delegate every op to the pure engine/roster functions … */
    }),
    {
      name: STORE_KEYS.roster,
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      partialize: (s) => ({ players: s.players, groups: s.groups }), // persist data only
    },
  ),
);
```

### 10.3 sessionStore (in-progress matches per game)

One session per `gameId` (resume the last unfinished match). Stored as plain JSON.

```ts
// src/store/sessionStore.ts
import type { GameConfig, GameStateBase, GameId } from '../sdk/types';
import type { HostScreen } from '../app/pages/GameHostPage';

export interface GameSession {
  gameId: GameId;
  config: GameConfig;
  state: GameStateBase;               // concrete game state, serialized
  screen: HostScreen;                 // 'setup' | 'play' | 'results'
  stateVersion: number;               // copied from manifest at start (for migrate)
  startedAt: number;
  updatedAt: number;
}

interface SessionStore {
  sessions: Record<GameId, GameSession>;
  start: (gameId: GameId, init: Omit<GameSession, 'gameId' | 'startedAt'>) => void;
  update: (gameId: GameId, patch: Partial<GameSession>) => void;
  setScreen: (gameId: GameId, screen: HostScreen) => void;
  clear: (gameId: GameId) => void;    // play-again / start over
  get: (gameId: GameId) => GameSession | undefined;
}

// create<SessionStore>()(persist(…, { name: STORE_KEYS.sessions,
//   storage: createJSONStorage(() => idbStorage), version: 1 }))
```

**Migration on load.** When `GameHostPage` reads a session whose `stateVersion < module.manifest.stateVersion`, it calls `module.logic.migrate?.(session.state, session.stateVersion)`; if no migrator exists, it discards the stale session (offers "Start over"). This keeps old saves from crashing new logic.

### 10.4 settingsStore

```ts
// src/store/settingsStore.ts
export interface Settings {
  theme: 'system' | 'light' | 'dark';
  language: Lang;
  muted: boolean;                     // global mute (sound + haptics)
  haptics: boolean;
}
// persisted under STORE_KEYS.settings via idbStorage; drives ThemeProvider/DirProvider/SoundService.
```

### 10.5 Supabase (optional, additive)

`authStore` + `services/supabase.ts` provide optional sign-in. When signed in, a background sync mirrors `roster` and finished-match `results` to Supabase tables; **local stores remain authoritative** and the app is fully functional with `services/supabase.ts` returning `null`. No engine, game, or host code may hard-depend on Supabase. (Detailed in a later spec; out of scope here beyond the no-dependency rule.)

### 10.6 Serialization invariants (binding)

- All persisted shapes are plain JSON: arrays, records, numbers, strings, booleans, `null`. **No** `Map`, `Set`, `Date`, class instances, or functions in `GameState`, `GameConfig`, roster, or session.
- IDs are strings (branded at the type level only).
- `updatedAt`/`startedAt`/`createdAt` are `number` ms-epoch, always supplied by the impure caller, never produced inside pure code.

---

## 11. How to add a game (checklist)

1. `mkdir src/games/<id>/` (id = lowercase, url-safe, permanent).
2. `manifest.ts` — fill `GameManifest` (`id` === folder name).
3. `config.ts` — `defaultConfig`, options type + `readOptions`, `validateConfig`.
4. `logic.ts` — `State`/`Action` types, **pure** `createInitialState(config, seed)` + `reducer(state, action)`, optional `migrate`. Compose engine primitives; take randomness/clock from action payloads only.
5. `logic.test.ts` — vitest: deterministic given fixed seeds; cover each action + win-condition.
6. `content/*.json` — bilingual `LocalizedString` content (decks/words/roles/locations).
7. `screens/{SetupScreen,PlayScreen,ResultsScreen}.tsx` — compose `src/sdk/ui`; dispatch actions; use `ctx` for clock/seed/sound/haptics.
8. `index.ts` — assemble and `export default` the `GameModule`.
9. Done. The registry auto-discovers it; the card appears on Home. **No shared file is edited.**

---

## Appendix A — reference `src/sdk/index.ts` barrel

```ts
// src/sdk/index.ts — the single import surface for games' screens
export type * from './types';
export { useGameContext, GameContextProvider } from './context';
export * from './ui';                 // Button, Card, Screen, Curtain, TimerRing, …
// NOTE: games import engine primitives in logic.ts directly from ../../engine/*,
// NOT through the sdk barrel, to keep pure logic free of React-coupled exports.
```

## Appendix B — error & invariant conventions

- **Reducers never throw on unknown actions** — `default: return state`. This keeps replay/migration of older action shapes safe.
- **Pure code never reads wall-clock or RNG.** Lint rule (spec 01) bans `Date.now`, `Math.random`, `performance.now`, and `crypto` imports inside `src/engine/**` and `src/games/**/logic.ts`.
- **Engine functions are total**: out-of-range cursors clamp; empty decks reshuffle or report `isExhausted`; closing an already-closed vote is a no-op. They return inputs unchanged rather than throwing where a no-op is sensible.
- **Branded ids** are constructed only via `engine/ids.ts` (`makeId(seed)` / `asPlayerId(s)`); never cast inline outside that module.
- **Host owns impurity**: persistence, clock, RNG entropy, sound, haptics, navigation. Games touch these only through `GameContext` (screens) — never inside `logic.ts`.
- **One session per gameId**; starting a new match while one exists prompts the user (Resume / Start over) before clobbering.

> This document is the contract. Engine signatures (§6), the plugin types (§3–§5), `GameContext` (§7), the registry/catalog (§8), routing/hosting (§9), and persistence (§10) are binding on all other specs. Changes here are breaking changes everywhere.
