# Game Spec — Dowr (دور) — Word-Conveying Relay (REFERENCE GAME)

> **Status:** Authoritative implementation spec. Concrete enough to implement with no further questions.
> **Game id:** `dowr`
> **Conforms to:** `docs/specs/00-architecture.md` (SDK contract — exact type / primitive names used below).
> **Role:** This is the **reference game**. It must exercise *every* SDK engine primitive: `roster`, `teams`, circular `turnOrder`, `timer`, `deck`, `scoring`, `revealGate`, `phaseMachine`, and `results`. Other games are validated against the patterns established here.

---

## 1. Concept & Player Experience

**Dowr** (Persian: دور, "round / lap / circle") is a fast, verbal word-conveying relay played **pass-and-play on one phone**. The device travels around a circle of players. On each turn one player is the **describer**: they privately read a secret word, then describe it **out loud without saying the word itself** while their **partner** (teams mode) or the **whole group** (solo mode) guesses. Correct guesses score points; the describer taps **Correct** to advance to the next word, or **Skip** to pass. A countdown timer (with tick SFX near the end) bounds each turn. When time runs out, a round summary is shown and the device is handed to the next describer around the circle.

It is the bilingual (English + Persian, full RTL) "Catch Phrase / Taboo-lite" of the app.

### 1.1 Player range & modes

| | |
|---|---|
| **Players** | **2–10** (hard min 2, hard max 10). |
| **Mode: Teams** | Players are seated in a **circle** and paired into **same-color teams**. Each describer's guesser is their **teammate**. Requires an **even** player count (2, 4, 6, 8, 10). Pairing = circular seating: seat `i` pairs with the player who will receive the device when it is that pair's turn. See §6 (turnOrder) for exact pairing math. |
| **Mode: Solo** | No teams. Each player describes in turn; **everyone else** guesses. Each player scores individually. Any player count 2–10. |

> **Why this is the reference game:** Teams mode forces `teams` + circular `turnOrder` + per-team `scoring`; Solo mode forces per-player `scoring`; the secret word forces `revealGate`; the countdown forces `timer`; the no-repeat word pool forces `deck`; multi-phase turn flow forces `phaseMachine`; the cross-round totals force `results`.

---

## 2. File Layout & Responsibilities

All paths relative to project root. Folder is **self-contained**; adding/removing the game = adding/removing this folder only (auto-discovery via `import.meta.glob('./games/*/index.ts', { eager: true })` in the registry — **never edit a shared file**).

```
src/games/dowr/
├─ index.ts                     # default-exports the GameModule (manifest + logic + screens). The ONLY discovery entry point.
├─ manifest.ts                  # GameManifest: id, title, description, tags, art, player range, modes, default config.
├─ logic.ts                     # PURE createInitialState(cfg) + reducer(state, action). No clock/RNG/IO. Exports types.
├─ logic.test.ts                # vitest unit tests for logic.ts (see §13).
├─ config.ts                    # DowrConfig type + DEFAULT_CONFIG + config validation/normalization helpers (pure).
├─ deck.ts                      # Pure helpers to flatten/filter content JSON into a WordCard[] pool by category/difficulty.
├─ content/
│  ├─ food.json                 # WordCard[] — category "food"
│  ├─ objects.json              # WordCard[] — category "objects"
│  ├─ jobs.json                 # WordCard[] — category "jobs"
│  ├─ places.json               # WordCard[] — category "places"
│  ├─ animals.json              # WordCard[] — category "animals"
│  └─ index.ts                  # imports the 5 JSON files, exports CONTENT: Record<DowrCategory, WordCard[]> (typed).
└─ screens/
   ├─ SetupScreen.tsx           # Configure mode/players/categories/difficulty/rounds/timer/skip. Dispatches START.
   ├─ PlayScreen.tsx            # Drives the turn loop (RoundIntro→Reveal→Describe→Summary). Dispatches turn actions.
   └─ ResultsScreen.tsx         # Final standings, winner banner, replay. Dispatches RESET / NEW_GAME.
```

### 2.1 Responsibilities at a glance

- **`logic.ts`** — single source of game truth. Pure functions only. All randomness arrives via action payload `seed`. Time arrives via `nowMs` in payloads / via the SDK `timer` (state stores only timer config + remaining derived from ticks dispatched as actions).
- **`screens/*`** — render SDK UI, read state from the SDK store, dispatch actions. **No game rules** in screens (e.g. screens never compute the winner; they read `selectWinners(state)`).
- **`deck.ts` / `content/`** — data only + pure selection. No React.

---

## 3. SDK Contract Consumed (from `00-architecture.md`)

The game **never reimplements** these. It declares which primitives it uses in the manifest and consumes them through `GameContext`.

### 3.1 Shared types (assumed exact names)

```ts
// from src/sdk/types.ts
export interface LocalizedString { en: string; fa: string }

export type GameId = string;

export interface Player {
  id: string;            // stable uuid
  name: string;          // free text (either language)
  colorId: string;       // token id, e.g. 'red' | 'amber' | ... (see §3.4)
  avatarSeed?: string;   // optional, for generated avatar
}

export interface Team {
  id: string;
  colorId: string;       // team color token
  name?: LocalizedString;
  playerIds: string[];   // ordered
}

export interface GameManifest {
  id: GameId;
  title: LocalizedString;
  description: LocalizedString;
  tags: LocalizedString[];          // shown on the game card
  accentColorId: string;            // card accent token
  icon: string;                     // icon id in /icons.svg or emoji
  minPlayers: number;
  maxPlayers: number;
  supportsTeams: boolean;
  supportsSolo: boolean;
  estMinutes: [number, number];     // [min, max] estimated play time
  usesPrimitives: SdkPrimitiveId[]; // declared dependencies, for docs/validation
  defaultConfig: unknown;           // game-specific; here DowrConfig (default)
}

export type SdkPrimitiveId =
  | 'roster' | 'teams' | 'turnOrder' | 'timer'
  | 'deck' | 'scoring' | 'voting' | 'revealGate'
  | 'phaseMachine' | 'results';

export interface GameModule<S = unknown, A = unknown, C = unknown> {
  manifest: GameManifest;
  createInitialState: (ctx: CreateStateArgs<C>) => S;
  reducer: (state: S, action: A) => S;
  Setup: React.ComponentType<GameScreenProps<S, A, C>>;
  Play: React.ComponentType<GameScreenProps<S, A, C>>;
  Results: React.ComponentType<GameScreenProps<S, A, C>>;
}

export interface CreateStateArgs<C> {
  config: C;
  players: Player[];      // the active roster, ordered as seated
  teams?: Team[];         // present iff config.mode === 'teams'
  seed: number;           // master seed for deterministic deck build
}

export interface GameScreenProps<S, A, C> {
  state: S;
  config: C;
  ctx: GameContext;       // SDK services (below)
  dispatch: (action: A) => void;
}
```

### 3.2 `GameContext` (SDK services injected into screens)

```ts
export interface GameContext {
  roster: RosterApi;        // active players, names, colors, ordering
  teams: TeamsApi;          // team membership + colors (teams mode)
  turnOrder: TurnOrderApi;  // circular order, current index, advance()
  timer: TimerApi;          // start/stop/tick a countdown; emits TICK & EXPIRE
  rng: RngApi;              // seeded RNG → produces seed values for action payloads
  sound: SoundApi;          // play('tick'|'correct'|'skip'|'expire'|'win'), respects global mute
  haptics: HapticsApi;      // light()/success()/warn(), respects global mute
  i18n: I18nApi;            // t(key), localize(LocalizedString), dir: 'ltr'|'rtl', lang
  nav: NavApi;              // goHome(), replay(), share()
}
```

#### Primitive APIs used (signatures relied upon)

```ts
interface TimerApi {
  // Pure-ish controller: SDK owns the interval; on each tick it calls back so the
  // screen can dispatch a TICK action carrying the authoritative remaining seconds.
  start(opts: { seconds: number; onTick: (remaining: number) => void; onExpire: () => void }): void;
  pause(): void;
  resume(): void;
  stop(): void;
  isRunning(): boolean;
}

interface RngApi {
  // Deterministic from master seed; nextSeed() yields a fresh integer seed to embed
  // in an action payload so the reducer stays pure but reproducible.
  nextSeed(): number;
}

interface TurnOrderApi {
  // The reducer holds the canonical pointer; this is a thin read helper for screens.
  order(): number[];        // seat indices in travel order
  currentIndex(): number;
}
```

> **Purity rule (critical):** the reducer **never** calls `rng`, `timer`, `Date.now`, or `Math.random`. Screens obtain `seed` from `ctx.rng.nextSeed()` and `remaining` from the timer callback, then put them in the action payload. The reducer is a pure `(state, action) => state`.

### 3.3 SDK UI components consumed (from `src/sdk/ui/`)

| Component | Use in Dowr |
|---|---|
| `<Screen>` | Page scaffold (safe-area padding, scroll, RTL-aware). |
| `<AppBar title actions>` | Top bar with back / mute / title. |
| `<Card>` / `<CardGrid>` | Generic surface; category chips container. |
| `<Button variant size>` | Primary actions (Start, Correct, Skip, Pass, Replay). Variants: `primary`/`secondary`/`ghost`/`danger`. |
| `<SegmentedControl>` | Mode (Teams/Solo), difficulty, timer length. |
| `<Chip selected onToggle>` | Category multi-select; difficulty. |
| `<Stepper min max value>` | Rounds count. |
| `<Toggle>` | Skip-penalty on/off. |
| `<PlayerRoster editable seating>` | Pick players + seating order + colors (wraps `RosterApi`). |
| `<TeamBadge colorId>` | Color dot/pill for current describer & partner. |
| `<RevealGate>` | **Secrecy primitive.** "Pass to {name} — tap & hold to reveal" → shows word only while held / after explicit reveal; hides on release/handoff. Wraps `revealGate`. |
| `<TimerRing seconds remaining>` | Circular countdown with color states; pulses on tick. |
| `<ScoreboardList>` | Live + final standings (per team / per player). |
| `<WinnerBanner>` | Confetti + winner(s) on Results. |
| `<PhaseTransition>` | framer-motion wrapper between phases. |
| `<EmptyState>` / `<Toast>` | Errors (e.g. deck exhausted). |

### 3.4 Color tokens (teams + roster)

Color ids come from the shared theme tokens (defined via `@theme` in CSS). Dowr only references ids: `red, orange, amber, lime, green, teal, cyan, blue, indigo, violet, pink, rose`. Team colors are assigned by `TeamsApi`; Dowr never hardcodes hex.

---

## 4. Content Schema & Sample Data

### 4.1 Types

```ts
// src/games/dowr/content/index.ts (and re-exported via deck.ts)
export type DowrCategory = 'food' | 'objects' | 'jobs' | 'places' | 'animals';
export type DowrDifficulty = 'easy' | 'med' | 'hard';

export interface WordCard {
  id: string;                 // globally unique within the game, stable. Format: `${cat}-${nnn}`
  word: LocalizedString;      // the secret word to convey (en + fa)
  category: DowrCategory;
  difficulty: DowrDifficulty;
  /** Optional taboo/forbidden words to display to the describer as a challenge (not enforced). */
  hints?: { taboo?: LocalizedString[] };
}
```

- **Files:** one JSON array per category in `content/<category>.json`. Each item is a `WordCard`.
- **Aggregation:** `content/index.ts` imports all 5 and exports:
  ```ts
  export const CONTENT: Record<DowrCategory, WordCard[]> = { food, objects, jobs, places, animals };
  export const ALL_CARDS: WordCard[] = Object.values(CONTENT).flat();
  ```
- **Category "All":** not a stored category; it is the union (`ALL_CARDS`) produced when the user selects all categories. See `deck.ts`.
- **Validation (dev-time, in `logic.test.ts` + a `validateContent()` helper in `deck.ts`):**
  - `id` unique across all files.
  - `word.en` and `word.fa` non-empty.
  - `category` matches the file it lives in.
  - `difficulty ∈ {easy, med, hard}`.

### 4.2 Sample content (≥12 real bilingual items)

> These are seed items; production files will be larger (target ≥ 40 per category). Persian uses natural everyday spelling; ZWNJ used where idiomatic.

**`content/food.json`**
```json
[
  { "id": "food-001", "word": { "en": "Pizza",      "fa": "پیتزا" },   "category": "food",   "difficulty": "easy", "hints": { "taboo": [{ "en": "cheese", "fa": "پنیر" }, { "en": "slice", "fa": "برش" }] } },
  { "id": "food-002", "word": { "en": "Saffron",    "fa": "زعفران" },  "category": "food",   "difficulty": "med" },
  { "id": "food-003", "word": { "en": "Pomegranate","fa": "انار" },    "category": "food",   "difficulty": "easy" },
  { "id": "food-004", "word": { "en": "Tahdig",     "fa": "ته‌دیگ" },  "category": "food",   "difficulty": "hard" }
]
```

**`content/objects.json`**
```json
[
  { "id": "obj-001", "word": { "en": "Umbrella",   "fa": "چتر" },       "category": "objects", "difficulty": "easy" },
  { "id": "obj-002", "word": { "en": "Lantern",    "fa": "فانوس" },     "category": "objects", "difficulty": "med" },
  { "id": "obj-003", "word": { "en": "Compass",    "fa": "قطب‌نما" },   "category": "objects", "difficulty": "hard" }
]
```

**`content/jobs.json`**
```json
[
  { "id": "job-001", "word": { "en": "Doctor",     "fa": "پزشک" },      "category": "jobs",    "difficulty": "easy" },
  { "id": "job-002", "word": { "en": "Carpenter",  "fa": "نجار" },      "category": "jobs",    "difficulty": "med" },
  { "id": "job-003", "word": { "en": "Astronaut",  "fa": "فضانورد" },   "category": "jobs",    "difficulty": "hard" }
]
```

**`content/places.json`**
```json
[
  { "id": "plc-001", "word": { "en": "Beach",      "fa": "ساحل" },      "category": "places",  "difficulty": "easy" },
  { "id": "plc-002", "word": { "en": "Bazaar",     "fa": "بازار" },     "category": "places",  "difficulty": "med" },
  { "id": "plc-003", "word": { "en": "Persepolis", "fa": "تخت جمشید" }, "category": "places",  "difficulty": "hard" }
]
```

**`content/animals.json`**
```json
[
  { "id": "ani-001", "word": { "en": "Cat",        "fa": "گربه" },      "category": "animals", "difficulty": "easy" },
  { "id": "ani-002", "word": { "en": "Camel",      "fa": "شتر" },       "category": "animals", "difficulty": "easy" },
  { "id": "ani-003", "word": { "en": "Peacock",    "fa": "طاووس" },     "category": "animals", "difficulty": "med" },
  { "id": "ani-004", "word": { "en": "Hedgehog",   "fa": "جوجه‌تیغی" }, "category": "animals", "difficulty": "hard" }
]
```

Total above = **17 items** across all categories, all real bilingual.

---

## 5. Game Configuration (`DowrConfig`)

```ts
// src/games/dowr/config.ts
export type DowrMode = 'teams' | 'solo';
export type DowrTimerLen = 60 | 120;
export type DowrDifficultySel = DowrDifficulty | 'random'; // 'random' = mix all difficulties

export interface DowrConfig {
  mode: DowrMode;                 // 'teams' | 'solo'
  categories: DowrCategory[];     // 1..5 selected; empty is invalid → normalized to all
  difficulty: DowrDifficultySel;  // 'easy'|'med'|'hard'|'random'
  rounds: number;                 // total turns-per-player loops; 1..10, default 3
  timerSeconds: DowrTimerLen;     // 60 | 120
  skipPenalty: boolean;           // true → skip costs -1; false → skip is free
}

export const DEFAULT_CONFIG: DowrConfig = {
  mode: 'teams',
  categories: ['food', 'objects', 'jobs', 'places', 'animals'],
  difficulty: 'random',
  rounds: 3,
  timerSeconds: 60,
  skipPenalty: false,
};
```

### 5.1 Config validation / normalization (pure, in `config.ts`)

```ts
export function normalizeConfig(c: Partial<DowrConfig>): DowrConfig;
// Rules:
// - categories: drop unknowns; if empty → all five.
// - rounds: clamp to [1, 10].
// - timerSeconds: coerce to nearest of {60,120}; default 60.
// - mode: if 'teams' but player count is odd → SetupScreen blocks Start (see §11.2); config itself unchanged.
// - difficulty: if not in set → 'random'.
```

> **`rounds` semantics:** one *round* = the device makes one full lap of the circle (each describer takes exactly one turn). After `rounds` laps, the game ends. (See §6.3.)

---

## 6. Roster, Teams & Circular Turn Order

### 6.1 Roster (`roster` primitive)

- Players are configured **once** at the app level (shared roster store) and **selected** into this game via `<PlayerRoster>`. The selected, **seated order** is passed to `createInitialState` as `players: Player[]` (index = seat).
- Each player has `name` + `colorId`. In **solo** mode the player's own `colorId` is used; in **teams** mode the **team color** overrides per-player display.

### 6.2 Teams (`teams` primitive) — circle seating & same-color pairs

- Teams mode requires **even** N. The SDK `TeamsApi` builds `N/2` teams of 2.
- **Pairing rule (circular adjacency):** seats are arranged in a circle `0,1,2,…,N-1`. Pairs are **adjacent seats**: `(0,1), (2,3), (4,5), …`. Each pair shares a `colorId`. This makes the "device travels around the circle" physically natural: the phone goes seat 0 (describer) → its partner seat 1 (guesser) is next to them, then moves on to seat 2, etc.
- `Team[]` (from `CreateStateArgs.teams`) is consumed as-is; Dowr does **not** compute teams itself. It only reads `team.playerIds` and `team.colorId`.

### 6.3 Turn order (`turnOrder` primitive) — circular

The **describer rotation** visits **every player** exactly once per round (lap), in seat order, wrapping with modulo.

- **Solo:** describer = seat `turnPointer % N`. Guessers = everyone else.
- **Teams:** describer = seat `turnPointer % N`. Guesser = describer's **partner** (the other member of describer's team). Because pairs are adjacent, when seat 0 describes, seat 1 guesses; next turn seat 1 describes, seat 0 guesses; then seat 2 describes, seat 3 guesses; etc. → both teammates get describer turns; the team's score accumulates across both.

> **Round/turn counting:**
> - A **turn** = one describer's timed session.
> - A **round (lap)** completes after `N` turns (pointer wrapped once).
> - Game ends after `config.rounds` laps → total turns = `config.rounds * N`.

```ts
// Derivations kept in logic.ts as pure selectors:
export const describerSeat = (s: DowrState) => s.turnPointer % s.seatCount;
export const currentRound  = (s: DowrState) => Math.floor(s.turnPointer / s.seatCount) + 1; // 1-based
export const totalTurns    = (s: DowrState) => s.config.rounds * s.seatCount;
export const isLastTurn     = (s: DowrState) => s.turnPointer + 1 >= totalTurns(s);
```

---

## 7. Deck Building (`deck` primitive)

`deck.ts` is pure data selection; the **shuffle** is performed in the reducer using the `seed` from the action payload via a small deterministic PRNG (e.g. mulberry32) **passed in / implemented purely** — no `Math.random`.

```ts
// src/games/dowr/deck.ts
export function buildPool(cfg: DowrConfig): WordCard[];
// 1. cats = cfg.categories (already normalized non-empty).
// 2. pool = cats.flatMap(c => CONTENT[c]).
// 3. if cfg.difficulty !== 'random' → pool = pool.filter(w => w.difficulty === cfg.difficulty).
// 4. return pool (UNSHUFFLED, stable order). Shuffle happens in reducer with seed.

export function shuffle<T>(arr: T[], seed: number): T[]; // pure Fisher–Yates w/ mulberry32(seed)

export function validateContent(): string[]; // returns array of problems; empty = ok (used in tests)
```

- **No-repeat per session:** the shuffled pool is stored in state as `deck: WordCard[]` with a `deckPointer`. Cards are consumed front-to-back across **all turns and all rounds** (the pool is *not* reshuffled per turn). A card is never shown twice in a session.
- **Pool exhaustion:** if `deckPointer` reaches `deck.length` mid-turn, the turn **ends early** with a `DECK_EXHAUSTED` reason (timer stops). If the pool is empty at game start (no cards for the filter), `createInitialState` still succeeds but `phase` starts as `error` and SetupScreen prevents this anyway (see §11.2 / §12).
- **Sizing guidance (non-blocking):** SetupScreen warns if `pool.length < estimated needs` but never blocks (cards/turn is unbounded by design; describers go as fast as they can).

---

## 8. Complete State Shape

```ts
// src/games/dowr/logic.ts
export type DowrPhase =
  | 'roundIntro'   // "Pass the phone to {describer}" handoff card (RevealGate locked)
  | 'reveal'       // RevealGate held/opened: describer reads the secret word
  | 'describing'   // timer running; Correct/Skip tappable
  | 'turnSummary'  // per-turn recap before next handoff
  | 'gameOver'     // all turns done → Results
  | 'error';       // unrecoverable (empty deck); shown as EmptyState

export type TurnEndReason = 'timeExpired' | 'deckExhausted' | 'manualEnd';

export interface TurnEvent {
  cardId: string;
  result: 'correct' | 'skip';
}

export interface TurnRecord {
  turnIndex: number;        // 0-based global turn (== turnPointer at start of turn)
  round: number;            // 1-based lap
  describerSeat: number;
  describerPlayerId: string;
  guesserPlayerIds: string[]; // partner (teams) or everyone-else (solo)
  scorerId: string;         // teamId (teams) or playerId (solo) credited
  correct: number;
  skipped: number;
  delta: number;            // net points this turn (correct - (skipPenalty ? skipped : 0))
  endReason: TurnEndReason;
  events: TurnEvent[];      // ordered log of correct/skip for this turn
}

export interface DowrState {
  // ── config & participants (immutable for the session) ──
  config: DowrConfig;
  seatCount: number;                 // N (players.length)
  playerIds: string[];               // index = seat
  teams: Team[];                     // [] in solo mode
  /** seat → scorerId: teamId in teams mode, playerId in solo mode. */
  seatToScorer: string[];

  // ── deck ──
  deck: WordCard[];                  // shuffled once at init; no-repeat pool
  deckPointer: number;               // index of NEXT card to serve

  // ── turn pointer & phase ──
  turnPointer: number;               // 0..totalTurns-1; describerSeat = turnPointer % N
  phase: DowrPhase;

  // ── current turn working state ──
  currentCardId: string | null;      // the card currently shown to describer (null in intro/summary)
  timerRemaining: number;            // seconds left in current turn (authoritative, from TICK)
  turnCorrect: number;               // running counts for the in-progress turn
  turnSkipped: number;
  turnEvents: TurnEvent[];           // in-progress log
  lastTurnEndReason: TurnEndReason | null;

  // ── results / scoring ──
  history: TurnRecord[];             // completed turns, in order
  scores: Record<string, number>;   // scorerId → cumulative net points (teamId or playerId)

  // ── misc ──
  errorCode: 'EMPTY_DECK' | null;
}
```

### 8.1 Score keys

- **Teams mode:** `scores` keyed by `teamId`; `seatToScorer[seat] = teamId of that seat's player`.
- **Solo mode:** `scores` keyed by `playerId`; `seatToScorer[seat] = playerId`.

This single abstraction (`seatToScorer` + `scores: Record<string,number>`) lets the reducer be **mode-agnostic** for scoring — a key reference-game pattern.

---

## 9. `createInitialState`

```ts
export function createInitialState({ config, players, teams, seed }: CreateStateArgs<DowrConfig>): DowrState {
  const cfg = normalizeConfig(config);
  const pool = buildPool(cfg);
  const deck = shuffle(pool, seed);

  const seatCount = players.length;
  const playerIds = players.map(p => p.id);
  const tms = cfg.mode === 'teams' ? (teams ?? []) : [];

  // seatToScorer
  const seatToScorer = players.map((p, seat) =>
    cfg.mode === 'teams'
      ? (tms.find(t => t.playerIds.includes(p.id))?.id ?? p.id)
      : p.id
  );

  // initial scores: every scorer at 0
  const scorerIds = cfg.mode === 'teams' ? tms.map(t => t.id) : playerIds;
  const scores = Object.fromEntries(scorerIds.map(id => [id, 0]));

  const empty = deck.length === 0;

  return {
    config: cfg, seatCount, playerIds, teams: tms, seatToScorer,
    deck, deckPointer: 0,
    turnPointer: 0,
    phase: empty ? 'error' : 'roundIntro',
    currentCardId: null,
    timerRemaining: cfg.timerSeconds,
    turnCorrect: 0, turnSkipped: 0, turnEvents: [],
    lastTurnEndReason: null,
    history: [],
    scores,
    errorCode: empty ? 'EMPTY_DECK' : null,
  };
}
```

---

## 10. Actions & Reducer Transitions

### 10.1 Action union

```ts
export type DowrAction =
  | { type: 'BEGIN_TURN' }                              // roundIntro → reveal (handoff done)
  | { type: 'REVEAL_WORD' }                             // reveal: serve first card, → describing, start timer
  | { type: 'TICK'; remaining: number }                // authoritative remaining from SDK timer
  | { type: 'CORRECT'; seed: number }                  // describing: +1, serve next card (seed unused now; reserved)
  | { type: 'SKIP' }                                    // describing: optional -1, serve next card
  | { type: 'TIME_UP' }                                 // describing: timer hit 0 → end turn (timeExpired)
  | { type: 'END_TURN_EARLY' }                          // describing: manual end (e.g. give-up) → manualEnd
  | { type: 'NEXT_TURN' }                               // turnSummary → next roundIntro OR gameOver
  | { type: 'RESET' };                                  // any → fresh game with same config (re-seeded externally)
```

> Note on randomness: the shuffle consumes `seed` once at init. Card serving is sequential from the pre-shuffled deck, so `CORRECT`/`SKIP` need no seed. The `seed` field on `CORRECT` is **reserved** for future variants (e.g. "draw random from remaining"); reducer ignores it today. Keeping it documents the purity convention.

### 10.2 Transition table

| Action | Valid in phase | Effect on state | Phase after | SFX/Haptics (screen-side) |
|---|---|---|---|---|
| `BEGIN_TURN` | `roundIntro` | Reset working turn fields: `turnCorrect=0`, `turnSkipped=0`, `turnEvents=[]`, `currentCardId=null`, `timerRemaining=config.timerSeconds`, `lastTurnEndReason=null`. | `reveal` | — |
| `REVEAL_WORD` | `reveal` | Serve next card: `currentCardId = deck[deckPointer].id`, `deckPointer++`. If pool empty (`deckPointer>=deck.length` before serving) → end turn `deckExhausted` (see below). | `describing` (or `turnSummary` if exhausted) | `correct`? no — silent reveal |
| `TICK` | `describing` | `timerRemaining = clamp(remaining, 0, config.timerSeconds)`. Does **not** change phase (TIME_UP does). | `describing` | screen plays `tick` SFX on last 5s |
| `CORRECT` | `describing` | `turnCorrect++`; push `{cardId: currentCardId!, result:'correct'}` to `turnEvents`. Serve next card: if `deckPointer < deck.length` → `currentCardId = deck[deckPointer].id; deckPointer++` and stay `describing`. Else → finalize turn with `deckExhausted`. | `describing` (or `turnSummary`) | `correct` + `haptics.success()` |
| `SKIP` | `describing` | `turnSkipped++`; push `{cardId,result:'skip'}`. Serve next card same as CORRECT (else `deckExhausted`). (Penalty applied at turn finalization, not here.) | `describing` (or `turnSummary`) | `skip` + `haptics.warn()` |
| `TIME_UP` | `describing` | Finalize current turn with reason `timeExpired` (see §10.3 finalize). | `turnSummary` | `expire` + `haptics.warn()` |
| `END_TURN_EARLY` | `describing` | Finalize current turn with reason `manualEnd`. | `turnSummary` | `skip` |
| `NEXT_TURN` | `turnSummary` | `turnPointer++`. If `turnPointer >= totalTurns(state)` → `phase='gameOver'`. Else reset working fields (mirror BEGIN_TURN's resets but keep pointer) and `phase='roundIntro'`. | `roundIntro` or `gameOver` | `win` on entering gameOver |
| `RESET` | any | Return `createInitialState` shape — **but reducer is pure**, so RESET only flags; actual re-seed is done by the screen calling the SDK to recreate state with a fresh seed. Reducer implementation: rebuild from stored `config`/`playerIds`/`teams` is **not possible purely without a new seed**, therefore `RESET` is handled by the SDK host (screen dispatches `nav.replay()` which re-invokes `createInitialState`). The reducer treats `RESET` as a no-op guard. | unchanged | — |

> **RESET clarification:** Because `createInitialState` needs a fresh `seed` (which only the impure `ctx.rng` can provide), "play again" is implemented at the screen layer (`ResultsScreen` → `ctx.nav.replay()` re-runs `createInitialState({...same config, players, teams, seed: ctx.rng.nextSeed()})`). The `RESET` action exists in the union for completeness and is a no-op in the reducer (keeps reducer pure & total). Tested as a no-op in §13.

### 10.3 Turn finalization (helper, pure)

Called by `TIME_UP`, `END_TURN_EARLY`, and the deck-exhausted branches of `REVEAL_WORD`/`CORRECT`/`SKIP`.

```ts
function finalizeTurn(s: DowrState, reason: TurnEndReason): DowrState {
  const seat = s.turnPointer % s.seatCount;
  const scorerId = s.seatToScorer[seat];
  const delta = s.turnCorrect - (s.config.skipPenalty ? s.turnSkipped : 0);
  // delta may be negative if skipPenalty and skips > corrects. Scores can go below 0.

  const record: TurnRecord = {
    turnIndex: s.turnPointer,
    round: Math.floor(s.turnPointer / s.seatCount) + 1,
    describerSeat: seat,
    describerPlayerId: s.playerIds[seat],
    guesserPlayerIds: guessersFor(s, seat),
    scorerId,
    correct: s.turnCorrect,
    skipped: s.turnSkipped,
    delta,
    endReason: reason,
    events: s.turnEvents,
  };

  return {
    ...s,
    phase: 'turnSummary',
    currentCardId: null,
    lastTurnEndReason: reason,
    history: [...s.history, record],
    scores: { ...s.scores, [scorerId]: (s.scores[scorerId] ?? 0) + delta },
  };
}

function guessersFor(s: DowrState, seat: number): string[] {
  if (s.config.mode === 'solo') {
    return s.playerIds.filter((_, i) => i !== seat);
  }
  // teams: partner = other member of seat's team
  const scorer = s.seatToScorer[seat];
  const team = s.teams.find(t => t.id === scorer);
  return (team?.playerIds ?? []).filter(id => id !== s.playerIds[seat]);
}
```

### 10.4 Reducer guards

- Any action received in an invalid phase → **return state unchanged** (defensive; reducer is total). Tested in §13.
- `TICK` with `remaining <= 0` does **not** itself end the turn — the screen must dispatch `TIME_UP`. (Keeps timer authority explicit and testable.) The reducer clamps to 0.

---

## 11. Scoring & Win Rules

### 11.1 Scoring

- **+1** per `CORRECT`.
- **Skip:** if `config.skipPenalty === true`, each `SKIP` contributes **−1** at turn finalization; if `false`, skips are free (0).
- Per-turn `delta = correct − (skipPenalty ? skipped : 0)`. Applied to the turn's `scorerId`.
- **Cumulative:** `scores[scorerId]` summed across all that scorer's turns and rounds.
- Scores **may go negative** when `skipPenalty` is on and skips outnumber corrects.

### 11.2 Win determination (pure selector — screens never compute it)

```ts
export interface Standing { scorerId: string; score: number; rank: number; }

export function selectStandings(s: DowrState): Standing[];
// Sort scorers by score DESC. Assign rank (1-based) with ties sharing a rank
// (e.g. two firsts → both rank 1, next is rank 3).

export function selectWinners(s: DowrState): string[];
// All scorerIds tied for the top score. length > 1 ⇒ a TIE.

export function selectDisplayName(s: DowrState, scorerId: string, ctx: GameContext): string;
// teams: team.name (localized) or fallback "Team {color}". solo: player.name.
```

- **Winner = highest cumulative score.** Ties → **shared win** (`selectWinners` returns multiple ids; WinnerBanner shows "It's a tie!").
- Display: `<ScoreboardList>` shows all standings sorted desc with rank, color, and score; `<WinnerBanner>` highlights rank-1.

---

## 12. Screen-by-Screen Breakdown

All screens get `{ state, config, ctx, dispatch }` (`GameScreenProps`). They render **only** SDK UI; all rules come from `logic.ts` selectors.

### 12.1 `SetupScreen.tsx`

**Purpose:** collect `DowrConfig` + selected/seated players, then start the game.

**Layout (top→bottom):**
1. `<AppBar>` — back to Home, mute toggle, title = `t('dowr.title')`.
2. **Mode** — `<SegmentedControl>` Teams / Solo. Bound to local `mode`.
3. **Players & seating** — `<PlayerRoster editable seating>` (wraps `RosterApi`): add/select players from shared roster, drag to set seating order, assign colors. In **Teams** mode it visually groups adjacent seats into colored pairs and shows a live "circle" preview.
4. **Categories** — row of `<Chip>` (All, Food, Objects, Jobs, Places, Animals). "All" toggles all on/off; selecting individual chips updates `categories`. Always ≥1 selected (block deselecting the last).
5. **Difficulty** — `<SegmentedControl>` Easy / Med / Hard / Random.
6. **Rounds** — `<Stepper min={1} max={10} value={rounds}>`.
7. **Timer** — `<SegmentedControl>` 60s / 120s.
8. **Skip penalty** — `<Toggle>` with label `t('dowr.skipPenalty')`.
9. **Pool size hint** — small caption: "≈ {buildPool(cfg).length} words available" (`<Toast>`/inline). Warn (not block) if very small.
10. **Start** — `<Button variant="primary" size="lg">` `t('common.start')`.

**Validation before Start (disable button + inline reasons):**
- Players in `[2,10]`.
- Teams mode ⇒ even count and every seat assigned to a team (TeamsApi guarantees pairing on even counts).
- `categories.length ≥ 1`.
- `buildPool(cfg).length ≥ 1` (else "No words match these filters").

**On Start:** the screen asks the SDK host to instantiate the game:
```ts
const seed = ctx.rng.nextSeed();
const teams = mode === 'teams' ? ctx.teams.pairAdjacent(seatedPlayers) : undefined;
host.start({ config: normalizeConfig({mode, categories, difficulty, rounds, timerSeconds, skipPenalty}),
             players: seatedPlayers, teams, seed });
// host then calls createInitialState and navigates to PlayScreen.
```
(There is **no** `START` reducer action — `createInitialState` is the entry. SetupScreen does not dispatch into the reducer; it constructs initial state via the host.)

**SDK primitives used:** `roster`, `teams`, `rng`, `i18n`, `sound` (button taps), `nav`.

---

### 12.2 `PlayScreen.tsx`

**Purpose:** drive the turn loop; render per-`phase`. Uses `<PhaseTransition>` to animate between phases.

#### Phase `roundIntro` (handoff)
- Full-bleed `<Card>` colored with current describer's team/player color.
- Big text: `t('dowr.passTo', { name })` where `name = describer's name`. In teams mode also shows partner: `t('dowr.partnerIs', { name })` and `<TeamBadge colorId>`.
- Round indicator: `t('dowr.roundOf', { round: currentRound(state), total: config.rounds })`.
- `<Button>` `t('dowr.imReady')` → **dispatch `BEGIN_TURN`**.
- Secrecy: nothing secret shown yet.

#### Phase `reveal` (RevealGate)
- `<RevealGate>` component: shows "Tap & hold to reveal — only {describer} should look". While held (or after explicit reveal tap, per RevealGate UX), it reveals the current word.
- Because the word is served by `REVEAL_WORD`, the flow is: entering `reveal` phase the screen immediately dispatches **`REVEAL_WORD`** to serve the first card into `currentCardId`, then `<RevealGate>` gates *display* of `localize(card.word)`. (Serving ≠ showing; RevealGate controls showing.)
  - Display the word large; optionally show `hints.taboo` as a "don't say" list.
- A `<Button>` `t('dowr.startDescribing')` confirms the describer has seen it → transitions UI into the running timer (the timer starts here): screen calls `ctx.timer.start({ seconds: config.timerSeconds, onTick: r => dispatch({type:'TICK', remaining:r}), onExpire: () => dispatch({type:'TIME_UP'}) })`.
  - Phase is already `describing` after `REVEAL_WORD`; RevealGate + "Start describing" is the **secrecy curtain** within `describing` before the timer visibly runs. (Implementation: a local `gateOpen` flag; timer starts on confirm.)
  > Alternative accepted: keep an explicit `reveal` phase until confirm. Either is fine; the reducer supports serving on `REVEAL_WORD` and the screen owns the curtain. **Chosen:** `REVEAL_WORD` moves phase to `describing`; the screen shows the RevealGate curtain first and only starts the timer + Correct/Skip controls after "Start describing". This keeps reducer phases minimal while preserving secrecy.

#### Phase `describing` (active turn)
- `<TimerRing seconds={config.timerSeconds} remaining={state.timerRemaining}>` prominent at top; turns amber <15s, red <5s; pulses each tick. Screen plays `tick` SFX on `remaining ≤ 5`.
- **Word card:** the current word shown to the describer (`localize(deck card for currentCardId)`). (In teams mode the *guesser* must not see it — but pass-and-play means only the describer holds the phone; the word is meant for the describer. This is by design: the describer reads & describes.)
- Two big controls:
  - `<Button variant="primary">` `t('dowr.correct')` → **dispatch `CORRECT` ({seed: ctx.rng.nextSeed()})**; `sound.play('correct')`, `haptics.success()`.
  - `<Button variant="secondary">` `t('dowr.skip')` → **dispatch `SKIP`**; `sound.play('skip')`, `haptics.warn()`. Label shows "(−1)" when `skipPenalty`.
- Live turn tally: `t('dowr.tally', { correct, skipped })`.
- `<Button variant="ghost">` `t('dowr.endTurn')` → **dispatch `END_TURN_EARLY`** (stops timer first).
- On `TIME_UP` (from timer `onExpire`) → reducer finalizes; screen stops timer, `sound.play('expire')`.
- If a serve hits deck end (reducer auto-finalizes `deckExhausted`) the screen detects phase moved to `turnSummary` and stops the timer + shows a `<Toast>` "Out of words!".

#### Phase `turnSummary`
- Recap `<Card>`: describer name + color, `correct`, `skipped`, `delta` (with sign), end reason chip (`time up` / `out of words` / `ended`).
- Mini live `<ScoreboardList>` (current cumulative standings via `selectStandings`).
- `<Button variant="primary">` label is dynamic:
  - if `isLastTurn(state)` → `t('dowr.seeResults')`
  - else → `t('dowr.nextPlayer')`
  → **dispatch `NEXT_TURN`**. On entering `gameOver`, screen navigates to ResultsScreen and `sound.play('win')`.

**SDK primitives used:** `turnOrder` (read describer), `teams` (partner/color), `timer`, `deck` (current card lookup), `scoring` (live standings), `revealGate`, `phaseMachine` (phase rendering), `sound`, `haptics`, `i18n`.

**Timer lifecycle rules (screen):**
- Start on "Start describing" confirm.
- `pause()` if app backgrounded / route blur (visibility change) → `resume()` on return. (Optional but specified: handle `document.visibilitychange`.)
- `stop()` on `CORRECT`/`SKIP`? **No** — timer keeps running across cards within a turn. Only `TIME_UP`, `END_TURN_EARLY`, and `deckExhausted` stop it.

---

### 12.3 `ResultsScreen.tsx`

**Purpose:** final standings + winner + replay.

**Layout:**
1. `<AppBar>` — title `t('dowr.resultsTitle')`, home action.
2. `<WinnerBanner>` — confetti; shows `selectWinners(state)` names + colors; "It's a tie!" if >1.
3. `<ScoreboardList>` — full `selectStandings(state)`: rank, color/badge, name, score. Teams mode shows team name + member names; solo shows player.
4. **Per-round breakdown** (collapsible): list `state.history` grouped by round → who described, correct/skip, delta. Uses `<Card>` rows.
5. Actions:
   - `<Button variant="primary">` `t('dowr.playAgain')` → `ctx.nav.replay()` (re-`createInitialState` with same config + fresh seed). Screens may also dispatch `RESET` (no-op) for symmetry.
   - `<Button variant="secondary">` `t('dowr.changeSetup')` → `ctx.nav` back to SetupScreen (keep config prefilled).
   - `<Button variant="ghost">` `t('common.home')` → `ctx.nav.goHome()`.
   - (If signed in) `<Button variant="ghost">` `t('common.share')` → `ctx.nav.share(summary)`.

**SDK primitives used:** `results`, `scoring`, `teams`/`roster` (names/colors), `i18n`, `sound`, `nav`.

---

## 13. i18n Keys

UI strings live in catalogs (`src/i18n/<lng>/dowr.json`), **not** in this game's content. Required keys (en values shown; fa supplied in `fa/dowr.json`):

```jsonc
{
  "dowr.title": "Dowr",
  "dowr.tagline": "Describe it — don't say it!",
  "dowr.mode.teams": "Teams", "dowr.mode.solo": "Solo",
  "dowr.cat.all": "All", "dowr.cat.food": "Food", "dowr.cat.objects": "Objects",
  "dowr.cat.jobs": "Jobs", "dowr.cat.places": "Places", "dowr.cat.animals": "Animals",
  "dowr.diff.easy": "Easy", "dowr.diff.med": "Medium", "dowr.diff.hard": "Hard", "dowr.diff.random": "Random",
  "dowr.rounds": "Rounds", "dowr.timer": "Timer", "dowr.skipPenalty": "Skip costs −1 point",
  "dowr.poolHint": "≈ {{count}} words available",
  "dowr.passTo": "Pass the phone to {{name}}",
  "dowr.partnerIs": "Your partner: {{name}}",
  "dowr.roundOf": "Round {{round}} of {{total}}",
  "dowr.imReady": "I'm ready",
  "dowr.revealHold": "Only {{name}} should look — tap & hold to reveal",
  "dowr.startDescribing": "Start describing",
  "dowr.dontSay": "Don't say:",
  "dowr.correct": "Correct", "dowr.skip": "Skip", "dowr.skipPenaltyTag": "(−1)",
  "dowr.endTurn": "End turn",
  "dowr.tally": "Correct: {{correct}} · Skipped: {{skipped}}",
  "dowr.outOfWords": "Out of words!",
  "dowr.end.timeExpired": "Time's up", "dowr.end.deckExhausted": "Out of words", "dowr.end.manualEnd": "Ended early",
  "dowr.nextPlayer": "Next player", "dowr.seeResults": "See results",
  "dowr.resultsTitle": "Results", "dowr.tie": "It's a tie!",
  "dowr.playAgain": "Play again", "dowr.changeSetup": "Change setup"
}
```

---

## 14. Pass-and-Play, Device Handoff & Secrecy (RevealGate)

This is the heart of the reference game and the SDK `revealGate` contract.

1. **Single device.** Only one player holds the phone at any time. The app never assumes a second screen.
2. **Handoff card (`roundIntro`).** Before each turn, the screen shows a non-secret "Pass to {describer}" card. This gives time to physically pass the phone. Nothing sensitive is on screen.
3. **RevealGate (`reveal`/curtain).** The secret word is **never** shown until the holder explicitly engages `<RevealGate>` (tap-and-hold, or tap-to-reveal then it auto-hides on blur/handoff). This ensures the previous holder cannot peek when passing, and (in teams) prevents the guesser from accidentally seeing it.
   - The word is served into state by `REVEAL_WORD`, but **rendered** only behind the gate.
   - On leaving the screen / `visibilitychange` to hidden, the gate re-locks.
4. **Describer-only word during `describing`.** The describer keeps holding the phone for the whole turn; the guesser(s) only listen. The word + Correct/Skip controls are for the describer.
5. **Summary is non-secret.** `turnSummary` shows only counts, safe to display while passing to the next describer.
6. **Mute/haptics.** All SFX/haptics route through `ctx.sound`/`ctx.haptics`, honoring the global mute (no per-game sound code).

---

## 15. Edge Cases

| # | Situation | Handling |
|---|---|---|
| E1 | **Odd player count in Teams mode** | SetupScreen disables Start with reason; offers "switch to Solo" or "add/remove a player". `createInitialState` is never called with an odd teams config. |
| E2 | **Empty deck after filters** (e.g. Hard + only Food) | SetupScreen blocks Start ("No words match"). Defensive: if ever reached, `createInitialState` sets `phase='error'`, `errorCode='EMPTY_DECK'`; PlayScreen renders `<EmptyState>` with "Change filters". |
| E3 | **Deck exhausted mid-turn** | `REVEAL_WORD`/`CORRECT`/`SKIP` serving past end → `finalizeTurn(state,'deckExhausted')`; timer stopped; `<Toast>` "Out of words!"; summary shows reason. Remaining turns still play but will also immediately exhaust → each subsequent turn ends with 0 cards (delta 0). (Acceptable; pool sizing hint warns earlier.) |
| E4 | **Timer expires with a card mid-air** | `TIME_UP` finalizes; the not-yet-resolved current card is **not** counted (only resolved events count). |
| E5 | **Skip penalty drives score negative** | Allowed; standings sort still correct; WinnerBanner can show a negative top score. |
| E6 | **All-tie final** | `selectWinners` returns all scorers; banner shows tie; all share rank 1. |
| E7 | **App backgrounded mid-turn** | `visibilitychange` → `timer.pause()`; on return `timer.resume()`. State (remaining) is from last `TICK`. |
| E8 | **Player taps Correct/Skip rapidly** | Reducer is synchronous & idempotent per dispatch; each tap consumes exactly one card; guarded to `describing` phase only. |
| E9 | **2 players, Teams mode** | Valid: one team of 2; both describe to each other across rounds. turnPointer alternates 0,1,0,1… both credited to the same team. |
| E10 | **rounds=1** | Each player describes once; game ends after N turns. |
| E11 | **Action in wrong phase** | Reducer returns state unchanged (no throw). |
| E12 | **Reveal but never confirmed before time** | Timer doesn't start until "Start describing"; no auto-expire while gated. If player abandons, they can `endTurn` (0 score). |
| E13 | **Duplicate content ids across files** | `validateContent()` returns problems; covered by a unit test that fails the build conceptually (test asserts empty problems). |
| E14 | **Mid-game player edits** | Roster is locked once `createInitialState` runs; editing players is only possible via `changeSetup` (new game). |

---

## 16. `manifest.ts`

```ts
import type { GameManifest } from '../../sdk/types';
import { DEFAULT_CONFIG } from './config';

export const manifest: GameManifest = {
  id: 'dowr',
  title: { en: 'Dowr', fa: 'دور' },
  description: {
    en: 'Describe the word out loud without saying it — race the clock as the phone circles the group.',
    fa: 'کلمه را بدون گفتن خودش توضیح بده و در زمان مسابقه بده؛ گوشی دور جمع می‌چرخد.'
  },
  tags: [
    { en: 'Party', fa: 'مهمانی' },
    { en: 'Words', fa: 'کلمات' },
    { en: 'Teams', fa: 'تیمی' },
  ],
  accentColorId: 'violet',
  icon: 'word-relay',           // id in /icons.svg (or emoji '🗣️' fallback)
  minPlayers: 2,
  maxPlayers: 10,
  supportsTeams: true,
  supportsSolo: true,
  estMinutes: [5, 20],
  usesPrimitives: ['roster','teams','turnOrder','timer','deck','scoring','revealGate','phaseMachine','results'],
  defaultConfig: DEFAULT_CONFIG,
};
```

## 17. `index.ts` (discovery entry)

```ts
import type { GameModule } from '../../sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer } from './logic';
import type { DowrState, DowrAction, DowrConfig } from './logic';
import { SetupScreen } from './screens/SetupScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ResultsScreen } from './screens/ResultsScreen';

const module: GameModule<DowrState, DowrAction, DowrConfig> = {
  manifest,
  createInitialState,
  reducer,
  Setup: SetupScreen,
  Play: PlayScreen,
  Results: ResultsScreen,
};

export default module;   // registry picks this up via import.meta.glob
```

---

## 18. Unit Tests — `logic.test.ts` (vitest)

Pure logic only; no React, no timers, no RNG. Use a fixed `seed` for determinism.

**Fixtures:** helper `makeState(overrides)` building solo & teams states with small synthetic decks (e.g. inject a known deck by calling `createInitialState` then overriding `deck`/`deckPointer`, or expose an internal `_forDeck` test seam). Helper `play(state, actions[])` to fold actions.

### Content & deck
1. `validateContent()` returns `[]` (all ids unique, both langs present, category matches file, valid difficulty).
2. `buildPool` with one category returns only that category's cards.
3. `buildPool` with difficulty filter returns only matching difficulty; `'random'` returns all difficulties.
4. `buildPool` with empty categories normalized → all categories (via normalizeConfig).
5. `shuffle(arr, seed)` is deterministic (same seed → same order) and a permutation (same multiset) and pure (input not mutated).

### Config
6. `normalizeConfig` clamps `rounds` to [1,10]; coerces bad timer to 60; empty categories → all; bad difficulty → 'random'.

### createInitialState
7. Solo: `seatToScorer` = playerIds; `scores` all 0 keyed by playerId; `phase='roundIntro'`; `deckPointer=0`; `timerRemaining=config.timerSeconds`.
8. Teams: `seatToScorer` maps each seat to its teamId; `scores` keyed by teamIds at 0.
9. Empty pool → `phase='error'`, `errorCode='EMPTY_DECK'`.

### Phase machine / actions
10. `BEGIN_TURN` from `roundIntro` resets turn fields and → `reveal`.
11. `REVEAL_WORD` from `reveal` serves `deck[0]`, `deckPointer=1`, → `describing`.
12. `REVEAL_WORD` when deck empty (deckPointer at end) → `turnSummary` with reason `deckExhausted`, delta 0.
13. `TICK` updates `timerRemaining` clamped to [0, timerSeconds]; phase stays `describing`; `TICK` with negative → 0.
14. `CORRECT` increments `turnCorrect`, logs event, serves next card, `deckPointer++`, stays `describing`.
15. `CORRECT` on last card → `finalizeTurn('deckExhausted')` → `turnSummary`.
16. `SKIP` increments `turnSkipped`, logs event, serves next card; with `skipPenalty=false` delta unaffected until finalize.
17. `TIME_UP` finalizes: pushes `TurnRecord` with correct/skipped/delta/endReason='timeExpired'; updates `scores[scorerId]`.
18. `END_TURN_EARLY` finalizes with reason `manualEnd`.

### Scoring
19. delta with `skipPenalty=false`: `delta === correct`.
20. delta with `skipPenalty=true`: `delta === correct - skipped` (can be negative; score may go below 0).
21. Teams: two turns by both teammates accumulate into the **same** teamId.
22. Solo: each player's turns accumulate into their **own** playerId.

### Turn pointer / rounds
23. `NEXT_TURN` increments `turnPointer`; before last → `roundIntro` (fields reset); deck pointer preserved (no reshuffle).
24. `NEXT_TURN` on last turn (`turnPointer+1 >= rounds*N`) → `phase='gameOver'`.
25. `describerSeat`, `currentRound`, `totalTurns`, `isLastTurn` selectors correct across a full N=3, rounds=2 walkthrough (6 turns).
26. No-repeat: across a full game, the multiset of served `cardId`s has no duplicates and is a prefix of the shuffled deck.

### Selectors / win
27. `selectStandings` sorts desc with correct tie-aware ranks.
28. `selectWinners` returns single top scorer; and returns **all** tied scorers on a tie.

### Guards / purity
29. Any action in an invalid phase returns the **same** state reference-equal value (or deep-equal) — no mutation.
30. `RESET` is a no-op in the reducer (returns input unchanged).
31. Reducer never mutates input: dispatching `CORRECT` does not change the original state object (frozen-input test with `Object.freeze`).

### Full integration (pure)
32. Simulate a complete solo game (N=2, rounds=1, deck of 4) via `play()`: BEGIN_TURN→REVEAL_WORD→CORRECT→SKIP→TIME_UP→NEXT_TURN→…→gameOver; assert final `scores`, `history.length === 2`, winner correct.
33. Simulate a complete teams game (N=4, rounds=1): assert team totals and winner; assert `guesserPlayerIds` are correct partners.

---

## 19. Acceptance Checklist (definition of done)

- [ ] Folder is self-contained; appears on Home via auto-discovery with **no** edits to shared files.
- [ ] All 9 declared primitives are actually consumed (roster, teams, turnOrder, timer, deck, scoring, revealGate, phaseMachine, results).
- [ ] Full RTL: every screen uses logical utilities; Persian renders right-to-left; numbers/labels mirror correctly.
- [ ] Reducer is pure (passes frozen-input + determinism tests); ≥ the 33 tests above pass.
- [ ] Bilingual content loads; no-repeat across a session; difficulty/category filters work.
- [ ] Secrecy: word never visible outside RevealGate; re-locks on handoff/visibility change.
- [ ] Timer ticks with SFX in last 5s; respects global mute; pause/resume on background.
- [ ] Teams & Solo both fully playable 2–10 players; ties handled; replay re-seeds.
