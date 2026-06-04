# Heads Up! — Phone on Forehead, Tilt to Play

> Game plugin spec. Conforms to `docs/specs/00-architecture.md`. This document is implementation-complete: a developer should be able to build the game with no further questions.

- **Game id:** `heads-up`
- **Folder:** `src/games/heads-up/`
- **Status:** spec / approved plan
- **Introduces a new shared SDK primitive:** the **Motion-sensor SDK wrapper** (`sdk/motion`). Spec'd in §11. This is the only new shared file this game requires; the game folder itself never edits a shared file (auto-discovery registry rule).

---

## 1. Concept & Player Range

Heads Up! is a fast, loud, physical guessing game. One player is the **Guesser**: they hold the phone flat against their forehead, screen facing **out** so everyone else (the **Cluers**) can see the word but the Guesser cannot. The Cluers act out / describe the word. The Guesser tilts the phone:

- **Tilt DOWN** (chin-to-chest, top edge tips toward the floor) = **GOT IT** → score, advance to next word.
- **Tilt UP** (look up at ceiling, top edge tips toward sky) = **PASS / skip** → no score, advance to next word.

A round runs for a fixed time. When time expires the phone is passed to the next Guesser. A **tap-button fallback is REQUIRED** for devices without a working motion sensor, for accessibility, and for desktop/test play.

### 1.1 Player range & modes

| Property | Value |
| --- | --- |
| Min players | 2 |
| Max players | 16 |
| Roster source | shared **Roster** primitive (players configured once, reused across games) |

Two **modes** (set in Setup):

1. **`solo`** — *Solo guesser vs. group cluers.* One person at a time is the Guesser; everyone else gives clues. Players take turns being Guesser in **Turn Order**. Each Guesser plays one timed round. Personal score = words they got. Highest personal score wins. Works for 2–16 players (with 2, they simply alternate Guesser/Cluer).
2. **`teams`** — *Teams.* Players are split into teams via the shared **Teams** primitive. On a team's turn, one team member is the Guesser and their **own teammates** are the Cluers (the other team(s) stay quiet / watch the clock). Score accrues to the team. After `rounds` rounds per team (configurable), highest team total wins. Requires ≥ 4 players (≥ 2 per team) — enforced in Setup validation; with < 4 players Setup forces `solo`.

> "Round" in this game = one Guesser's single timed turn with the phone on the forehead. `config.rounds` controls how many turns **each participant unit** (player in solo, team in teams) gets across the whole match.

---

## 2. File List & Responsibilities

All files live under `src/games/heads-up/`. None of these may import sibling games or edit shared files; they only import from `@/sdk/*` and shared types.

```
src/games/heads-up/
  index.ts                      # default-exports the GameModule (id, manifest, logic, screens, content loader)
  manifest.ts                   # GameManifest: id, title/desc/howToPlay (LocalizedString), icon, color, range, tags, capabilities
  logic.ts                      # PURE createInitialState(cfg) + reducer(state, action) -> state. No clock/RNG inside.
  logic.test.ts                 # vitest unit tests (see §13)
  config.ts                     # HeadsUpConfig type + DEFAULT_CONFIG + buildSetupSchema() for the generic Setup form
  types.ts                      # HeadsUpState, HeadsUpAction, Card, RoundResult, RoundEntry, Participant, etc.
  content.ts                    # deck loader: import.meta.glob of ./content/*.json, validates & exposes Deck[] (typed)
  content/
    index.json                  # deck catalog: list of deck ids + LocalizedString names + category + icon/color
    animals.json
    movies.json
    actions.json
    food.json
    famous-people.json
    around-the-house.json
  screens/
    SetupScreen.tsx             # deck picker + mode + time + rounds; composed from sdk/ui
    PlayScreen.tsx              # the forehead screen: big word, color flash, motion handling, fallback buttons
    ResultsScreen.tsx           # per-round got/passed lists + standings + rematch/new
  assets/
    sfx.ts                      # maps logical SFX names -> howler keys registered with sdk/sound (got/pass/tick/start/end)
```

### File responsibilities

- **`index.ts`** — the single entry the registry discovers via `import.meta.glob('./games/*/index.ts', { eager: true })`. Default export is a `GameModule` object wiring everything together. Lazy-imports screens via `React.lazy` so the home grid stays light.
- **`manifest.ts`** — pure metadata, no React. Drives the colorful home card and the Setup header.
- **`logic.ts`** — the only file that mutates game state. Pure functions, fully covered by tests. **No `Date.now()`, no `Math.random()`** — clock comes from the SDK Timer primitive via actions, randomness comes in action payloads as a `seed`.
- **`config.ts`** — config typing + defaults + a declarative setup schema the generic Setup renderer consumes.
- **`content.ts`** — loads & validates decks; the only place that touches `content/*.json`.
- **`screens/*`** — dumb-ish view layer: read `ctx.state`, call SDK UI, dispatch actions. No game rules here.

---

## 3. Shared Types Consumed (from architecture spec)

These names are owned by `docs/specs/00-architecture.md`; this game imports them and does not redefine them.

```ts
// from @/sdk/types
export type LocalizedString = { en: string; fa: string };

export interface GameManifest {
  id: string;
  title: LocalizedString;
  description: LocalizedString;
  howToPlay: LocalizedString;
  icon: string;                 // icon key or emoji
  color: string;                // theme token / hex used for the card gradient
  minPlayers: number;
  maxPlayers: number;
  tags: LocalizedString[];      // e.g. "party", "active", "fast"
  capabilities?: {
    motion?: boolean;           // declares it can use the Motion primitive (true here)
    haptics?: boolean;
    sound?: boolean;
  };
}

export interface GameModule<Cfg = unknown, State = unknown, Action = unknown> {
  manifest: GameManifest;
  createInitialState: (cfg: Cfg) => State;
  reducer: (state: State, action: Action) => State;
  screens: {
    Setup: React.LazyExoticComponent<React.FC<GameContext<Cfg, State, Action>>>;
    Play: React.LazyExoticComponent<React.FC<GameContext<Cfg, State, Action>>>;
    Results: React.LazyExoticComponent<React.FC<GameContext<Cfg, State, Action>>>;
  };
  setupSchema?: SetupSchema;    // optional declarative setup config (see §6)
  defaultConfig: Cfg;
}

// GameContext is what the engine hands to every screen.
export interface GameContext<Cfg, State, Action> {
  config: Cfg;
  state: State;
  dispatch: (action: Action) => void;
  sdk: SdkBundle;               // roster, teams, turnOrder, timer, deck, scoring, voting, revealGate, phaseMachine, results, sound, haptics, motion, ui, i18n
  setConfig: (patch: Partial<Cfg>) => void; // used by Setup before the match starts
  finish: () => void;           // tells engine the game is over → route to Results
}
```

### SDK primitives consumed (and which this game does NOT use)

| Primitive | Used? | How Heads Up! uses it |
| --- | --- | --- |
| **Roster** | yes | source of players (configured once, reused). Read for names/avatars/count. |
| **Teams** | yes (teams mode) | split roster into teams; map team → members; team color. |
| **turnOrder** | yes | rotation of Guessers (solo) or teams (teams mode); `current`, `advance(seed)`, `cycleComplete`. |
| **Timer** | yes | per-round countdown. Emits `TICK` and `EXPIRE` actions into the reducer; reducer never reads the clock itself. |
| **Deck** | yes | shuffled, drawable card pile per round. Built from selected Deck content; shuffle seed passed in actions. |
| **Scoring** | yes | accumulate got/passed per participant; produce standings. |
| **RevealGate** | yes | the device-handoff "Pass to <name> — tap when ready" gate before each round so the next Guesser doesn't peek. |
| **phaseMachine** | yes | drives `setup → handoff → countdown → playing → roundEnd → ... → finished`. |
| **Results** | yes | final standings table + per-round breakdown rendering. |
| **Sound** | yes | got/pass/tick/start/end SFX (global mute respected). |
| **Haptics** | yes | buzz on got/pass and on last-seconds tick (global mute respected). |
| **Motion** | yes (**new**) | tilt detection. See §11. |
| **UI** | yes | all on-screen controls/typography/layout. |
| **i18n** | yes | UI strings; content is bilingual data. |
| Voting | **no** | Heads Up! has no group vote. |

---

## 4. Content Schema

Game **content** (the words) is bilingual JSON data, NOT i18n UI catalog strings. Each deck is one file in `content/`. A catalog file `content/index.json` lists the decks for the Setup picker.

### 4.1 TypeScript shapes (`types.ts` / `content.ts`)

```ts
export type DeckCategory =
  | 'animals' | 'movies' | 'actions' | 'food' | 'people' | 'household' | 'mixed';

/** One guessable card. `word` is what's shown big on the forehead. */
export interface Card {
  id: string;                   // stable, unique within deck, kebab-case (used as React key & in results)
  word: LocalizedString;        // the big word shown on screen
  hint?: LocalizedString;       // optional small sub-line shown under the word to help cluers (NOT the answer)
  difficulty?: 1 | 2 | 3;       // 1=easy,2=med,3=hard. Optional; defaults to 2. May filter later.
}

/** A deck file = metadata + cards. */
export interface Deck {
  id: string;                   // matches filename sans .json, kebab-case
  name: LocalizedString;        // shown in Setup picker
  category: DeckCategory;
  icon: string;                 // emoji / icon key for the deck chip
  color: string;                // theme token used for the deck chip + the in-play color flash base
  cards: Card[];                // >= 12 per shipping deck (validated)
}

/** content/index.json shape. */
export interface DeckCatalogEntry {
  id: string;
  name: LocalizedString;
  category: DeckCategory;
  icon: string;
  color: string;
  count: number;                // number of cards (for the picker subtitle)
}
```

### 4.2 Loader (`content.ts`)

```ts
const modules = import.meta.glob('./content/*.json', { eager: true });
// build Deck[] (skip index.json), validate: unique ids, >=12 cards, every card has en+fa word.
export const DECKS: Deck[] = /* parsed & frozen */;
export const DECK_CATALOG: DeckCatalogEntry[] = /* from index.json (source of truth for ordering) */;
export function getDeck(id: string): Deck | undefined;
```

Validation (dev-time `console.error`, throws in tests):
- deck `id` unique and matches filename
- ≥ 12 cards
- every `card.word.en` and `card.word.fa` non-empty
- every `card.id` unique within deck

### 4.3 Example deck file (`content/animals.json`)

```json
{
  "id": "animals",
  "name": { "en": "Animals", "fa": "حیوانات" },
  "category": "animals",
  "icon": "🐾",
  "color": "var(--color-game-animals)",
  "cards": [
    { "id": "elephant", "word": { "en": "Elephant", "fa": "فیل" } },
    { "id": "giraffe",  "word": { "en": "Giraffe",  "fa": "زرافه" } },
    { "id": "penguin",  "word": { "en": "Penguin",  "fa": "پنگوئن" } }
  ]
}
```

---

## 5. Sample Bilingual Content (≥ 12 items)

Real English + real Persian. These ship in the deck files. (More cards exist per deck; these are representative and copy-pasteable.)

### Animals — `content/animals.json`
| id | en | fa |
| --- | --- | --- |
| elephant | Elephant | فیل |
| giraffe | Giraffe | زرافه |
| penguin | Penguin | پنگوئن |
| kangaroo | Kangaroo | کانگورو |
| dolphin | Dolphin | دلفین |
| crocodile | Crocodile | تمساح |

### Movies — `content/movies.json`
| id | en | fa |
| --- | --- | --- |
| titanic | Titanic | تایتانیک |
| the-lion-king | The Lion King | شیرشاه |
| frozen | Frozen | یخ‌زده |
| harry-potter | Harry Potter | هری پاتر |

### Actions (charades verbs) — `content/actions.json`
| id | en | fa |
| --- | --- | --- |
| swimming | Swimming | شنا کردن |
| dancing | Dancing | رقصیدن |
| sneezing | Sneezing | عطسه کردن |

### Food — `content/food.json`
| id | en | fa |
| --- | --- | --- |
| pizza | Pizza | پیتزا |
| watermelon | Watermelon | هندوانه |
| ice-cream | Ice Cream | بستنی |

> Total above = 16 distinct bilingual items across four categories (≥ 12 required). Two more decks — `famous-people.json` (e.g. Einstein → اینشتین) and `around-the-house.json` (e.g. Refrigerator → یخچال) — ship with ≥ 12 cards each but are abbreviated here.

---

## 6. GameConfig (Setup options)

```ts
export interface HeadsUpConfig {
  /** Selected deck ids. >=1. If multiple, cards are merged then shuffled. */
  deckIds: string[];
  /** Match mode. */
  mode: 'solo' | 'teams';
  /** Seconds per round (one Guesser's turn). */
  roundSeconds: number;         // 30 | 45 | 60 | 90, default 60
  /** How many rounds (turns) each participant unit (player in solo, team in teams) gets. */
  rounds: number;               // 1..5, default 1
  /** Use device tilt? If false, force button-only mode. Auto-set false if no sensor. */
  motionEnabled: boolean;       // default true
  /** Penalty for a pass. */
  passPenalty: 0 | 1;           // default 0 (pass = no points lost). 1 = -1 point.
  /** Allow the deck to wrap if it runs out mid-round. */
  recycleDeck: boolean;         // default true
}

export const DEFAULT_CONFIG: HeadsUpConfig = {
  deckIds: ['animals'],
  mode: 'solo',
  roundSeconds: 60,
  rounds: 1,
  motionEnabled: true,
  passPenalty: 0,
  recycleDeck: true,
};
```

### Declarative setup schema (`setupSchema`)

The generic Setup form consumes this so the screen needs minimal custom code. Shape (from architecture):

```ts
export const setupSchema: SetupSchema = {
  fields: [
    { key: 'deckIds', kind: 'deck-multi', source: 'content', min: 1, required: true,
      label: { en: 'Decks', fa: 'دسته‌ها' } },
    { key: 'mode', kind: 'segmented', label: { en: 'Mode', fa: 'حالت' },
      options: [
        { value: 'solo',  label: { en: 'Solo', fa: 'انفرادی' } },
        { value: 'teams', label: { en: 'Teams', fa: 'تیمی' }, disabledWhen: 'playersLt4' },
      ] },
    { key: 'roundSeconds', kind: 'segmented', label: { en: 'Round time', fa: 'زمان دور' },
      options: [30,45,60,90].map(v => ({ value: v, label: { en: `${v}s`, fa: `${v} ثانیه` } })) },
    { key: 'rounds', kind: 'stepper', min: 1, max: 5, label: { en: 'Rounds each', fa: 'تعداد دور' } },
    { key: 'passPenalty', kind: 'toggle', label: { en: 'Pass costs a point', fa: 'رد کردن امتیاز کم می‌کند' },
      onValue: 1, offValue: 0 },
    { key: 'motionEnabled', kind: 'toggle', label: { en: 'Tilt to play', fa: 'بازی با کج کردن' },
      hint: { en: 'Tilt down = correct, up = pass', fa: 'پایین=درست، بالا=رد' } },
  ],
};
```

`buildSetupSchema()` in `config.ts` returns this and may disable `motionEnabled` (force off + show note) when `sdk.motion.isSupported()` is false.

---

## 7. State Shape

```ts
/** A participant unit: a single player (solo) or a team (teams). */
export interface Participant {
  id: string;                   // playerId (solo) or teamId (teams)
  kind: 'player' | 'team';
  guesserId: string | null;     // current Guesser playerId for this unit's active round
}

/** One word's outcome inside a round. */
export interface RoundEntry {
  cardId: string;
  result: 'got' | 'passed';
}

/** One completed (or in-progress) round = one Guesser's timed turn. */
export interface RoundResult {
  participantId: string;        // who scored (player or team)
  guesserId: string;            // the person holding the phone
  roundIndex: number;           // 0-based turn index for this participant
  entries: RoundEntry[];        // chronological list of words & outcomes
  got: number;                  // derived count cached for results
  passed: number;
}

export type HeadsUpPhase =
  | 'setup'        // never seen in-game; placeholder before createInitialState routes to handoff
  | 'handoff'      // RevealGate: "Pass to <name>" — Guesser must NOT see word yet
  | 'countdown'    // 3-2-1-GO before the timer starts
  | 'playing'      // word shown, timer running, tilt/buttons live
  | 'roundEnd'     // brief summary of the just-finished round, then advance
  | 'finished';    // match over → ResultsScreen

export interface HeadsUpState {
  phase: HeadsUpPhase;

  // participants & rotation
  mode: 'solo' | 'teams';
  participants: Participant[];   // ordered for turnOrder
  turnIndex: number;             // index into participants of whose turn it is
  roundOfParticipant: Record<string, number>; // participantId -> rounds already completed
  totalRoundsPerParticipant: number;           // = config.rounds

  // active round
  deck: string[];                // queue of remaining cardIds for THIS round (shuffled)
  deckCursor: number;            // index of current card in `deck`
  currentCardId: string | null;  // === deck[deckCursor] or null between rounds
  flash: null | 'got' | 'passed';// transient: drives the colored screen flash; cleared by CLEAR_FLASH
  currentEntries: RoundEntry[];  // outcomes accumulated in the live round (moves into rounds[] at end)

  // timing (values are pushed in by the Timer primitive via actions; reducer never reads a clock)
  roundSeconds: number;          // config
  secondsLeft: number;           // updated by TICK
  countdownLeft: number;         // 3..0 during 'countdown'

  // results
  rounds: RoundResult[];         // all completed rounds across the match

  // input
  inputMode: 'motion' | 'button';// resolved at start; can flip to 'button' via SET_INPUT_MODE
  passPenalty: 0 | 1;
  recycleDeck: boolean;

  // bookkeeping
  matchOver: boolean;
}
```

### Derived selectors (in `logic.ts`, pure, used by screens — not stored)

```ts
export function standings(s: HeadsUpState): Array<{ participantId: string; got: number; passed: number; score: number }>;
export function currentParticipant(s: HeadsUpState): Participant;
export function isLastRound(s: HeadsUpState): boolean;
export function score(got: number, passed: number, penalty: 0 | 1): number; // got - passed*penalty
```

---

## 8. Actions & Reducer Transitions

All randomness/time enters via payloads. Every action is a discriminated union member of `HeadsUpAction`.

```ts
export type HeadsUpAction =
  | { type: 'START_MATCH'; seed: number }                 // build first round's deck, go to handoff
  | { type: 'BEGIN_HANDOFF' }                             // (re)enter handoff for current participant
  | { type: 'CONFIRM_READY' }                             // RevealGate passed → countdown
  | { type: 'COUNTDOWN_TICK' }                            // 3→2→1; at 0 → playing & first card shown
  | { type: 'TICK'; secondsLeft: number }                 // Timer pushes remaining seconds
  | { type: 'MARK_GOT'; seed: number }                    // current word correct
  | { type: 'MARK_PASS'; seed: number }                   // current word skipped
  | { type: 'CLEAR_FLASH' }                               // remove the transient color flash
  | { type: 'TIME_UP' }                                   // Timer expired → roundEnd
  | { type: 'END_ROUND' }                                 // commit currentEntries → rounds[], advance turn
  | { type: 'NEXT_PARTICIPANT'; seed: number }            // build next round's deck, → handoff or finished
  | { type: 'SET_INPUT_MODE'; mode: 'motion' | 'button' } // fallback toggle
  | { type: 'RESET_MATCH'; seed: number };                // rematch with same config
```

### Transition table

| Action | Valid in phase | Effect | Next phase |
| --- | --- | --- | --- |
| `START_MATCH` | (initial) | Build `participants` from roster/teams; `turnIndex=0`; build first round deck = shuffle(merged cards, seed); `deckCursor=0`; `currentCardId=null`; clear `currentEntries`. | `handoff` |
| `BEGIN_HANDOFF` | roundEnd, finished(no) | Set `currentCardId=null`; ensure deck built for current participant. | `handoff` |
| `CONFIRM_READY` | handoff | Start countdown: `countdownLeft=3`. | `countdown` |
| `COUNTDOWN_TICK` | countdown | `countdownLeft -= 1`. If reaches 0: `secondsLeft = roundSeconds`, `currentCardId = deck[deckCursor]`, clear `currentEntries`. | countdown (if >0) / `playing` (if 0) |
| `TICK` | playing | `secondsLeft = action.secondsLeft`. (No card change.) | `playing` |
| `MARK_GOT` | playing | Push `{cardId,result:'got'}` to `currentEntries`; `flash='got'`; advance card (see §8.1 with seed). | `playing` |
| `MARK_PASS` | playing | Push `{cardId,result:'passed'}`; `flash='passed'`; advance card (seed). | `playing` |
| `CLEAR_FLASH` | playing | `flash=null`. | `playing` |
| `TIME_UP` | playing | Stop input; keep `currentEntries`. | `roundEnd` |
| `END_ROUND` | roundEnd | Build `RoundResult` from `currentEntries` (compute got/passed); push to `rounds`; `roundOfParticipant[pid]+=1`. | `roundEnd` (stays; screen then dispatches NEXT_PARTICIPANT) |
| `NEXT_PARTICIPANT` | roundEnd | If every participant reached `totalRoundsPerParticipant` → `matchOver=true`. Else advance `turnIndex` (wrap), pick next participant whose rounds < total, build fresh deck = shuffle(seed), reset cursor/entries, set guesser. | `finished` (if over) / `handoff` |
| `SET_INPUT_MODE` | any | `inputMode = action.mode`. | unchanged |
| `RESET_MATCH` | finished | Re-run `createInitialState` semantics with same config; build first deck with seed. | `handoff` |

### 8.1 Card advance helper (pure)

```ts
function advanceCard(s: HeadsUpState, seed: number): Pick<HeadsUpState,'deck'|'deckCursor'|'currentCardId'> {
  let cursor = s.deckCursor + 1;
  let deck = s.deck;
  if (cursor >= deck.length) {
    if (s.recycleDeck) { deck = shuffle(s.deck, seed); cursor = 0; } // reshuffle, keep going
    else { return { deck, deckCursor: cursor, currentCardId: null }; } // ran out → null word
  }
  return { deck, deckCursor: cursor, currentCardId: deck[cursor] ?? null };
}
```

If `currentCardId` becomes `null` (deck exhausted, no recycle) while still `playing`, PlayScreen shows an "Out of words!" state; only `TICK`/`TIME_UP` remain meaningful.

### 8.2 `shuffle(ids, seed)` — pure, deterministic

Fisher–Yates seeded by a small PRNG (mulberry32). Defined in `@/sdk/deck` and re-used; the game passes a `seed` from the action. **Never call `Math.random()` in the reducer.**

---

## 9. Scoring & Win Rules

- `score(got, passed, penalty) = got - passed * penalty`.
- **Solo mode:** each player's score = sum across their rounds. Highest total wins. Ties → shared placement (Results shows tied rank).
- **Teams mode:** team score = sum of all its rounds (any member as Guesser). Highest team total wins.
- A round's `got`/`passed` are computed from `entries` at `END_ROUND` and cached on `RoundResult`.
- **Match end:** every participant has completed `totalRoundsPerParticipant` rounds → `NEXT_PARTICIPANT` sets `matchOver`, phase `finished`, engine routes to ResultsScreen.
- Standings are produced by `standings()` (pure), sorted by `score desc`, then `got desc`, then participant order (stable) for tie display.

---

## 10. Screens

All screens are `React.FC<GameContext<HeadsUpConfig, HeadsUpState, HeadsUpAction>>`, lazy-loaded. They use only `ctx.sdk.ui.*` components, `ctx.sdk.i18n` (`t()`), and dispatch actions. Layout is mobile-first, RTL-safe (logical utilities `ms-/me-/ps-/pe-/text-start/text-end`), and respects light/dark + global mute.

### 10.1 SetupScreen

**Purpose:** choose decks, mode, time, rounds before the match.

On screen (top→bottom):
- `ui.ScreenHeader` with `manifest.title`, `manifest.icon`, colored gradient (`manifest.color`).
- `ui.HowToPlayCallout` — collapsible, renders `manifest.howToPlay` (bilingual).
- **Roster summary** via `ui.RosterBadge` — shows current player count + "Edit players" (opens shared Roster sheet; configured once, reused).
- **Deck picker** `ui.DeckPicker` (multi-select chips) fed by `DECK_CATALOG`; each chip shows deck icon, name, count. ≥ 1 required.
- **Mode** `ui.SegmentedControl` (Solo / Teams). Teams disabled with tooltip when players < 4. Selecting Teams reveals `ui.TeamsEditor` (shared Teams primitive) for splitting players.
- **Round time** `ui.SegmentedControl` (30/45/60/90s).
- **Rounds each** `ui.Stepper` (1–5).
- **Pass costs a point** `ui.Toggle`.
- **Tilt to play** `ui.Toggle` (auto-off + note if `sdk.motion.isSupported()` is false).
- `ui.PrimaryButton` **"Start"** — disabled until valid.

Validation before enabling Start:
- ≥ 1 deck selected; merged card count ≥ 8 (warn, not block, if low).
- players in `[2,16]`.
- teams mode → ≥ 2 teams, each ≥ 1 player, ≥ 4 players total.

Dispatches / calls:
- field changes → `ctx.setConfig({...})`.
- **Start** → `ctx.dispatch({ type:'START_MATCH', seed: sdk.rng.seed() })` then engine advances phase to `handoff` and routes to PlayScreen. (The seed is generated **outside** the reducer, in the click handler.)

SDK UI used: `ScreenHeader, HowToPlayCallout, RosterBadge, DeckPicker, SegmentedControl, TeamsEditor, Stepper, Toggle, PrimaryButton`.

### 10.2 PlayScreen

The heart of the game. Phase-driven render via `sdk.phaseMachine` / `state.phase`.

#### Phase `handoff` (RevealGate)
- `sdk.ui.RevealGate` full-screen: big "Pass the phone to **<Guesser name>**" (solo: next player; teams: the team's chosen Guesser), team color background.
- Instruction line: "Hold it on your forehead. Don't peek!" — guarantees the Guesser doesn't see the first word early.
- `ui.PrimaryButton` "I'm ready" → `dispatch(CONFIRM_READY)`.
- Plays `start` SFX softly; light haptic.

#### Phase `countdown`
- Huge centered `3 / 2 / 1 / GO!` using `ui.BigNumber` with a pop animation (framer-motion `key={countdownLeft}` scale spring).
- A repeating timer (in screen, via `sdk.timer.interval(1000)`) dispatches `COUNTDOWN_TICK`. On reaching 0 the reducer flips to `playing`.
- `tick` SFX per number; haptic blip.

#### Phase `playing` (the forehead screen)
Full-bleed, landscape-friendly (screen is sideways on forehead). Center stack:
- **Color flash layer**: an absolutely-positioned overlay whose background = green on `flash==='got'`, amber/orange on `flash==='passed'`, transparent otherwise. Animated opacity 0→1→0 (~450 ms) via framer-motion; on animation complete dispatch `CLEAR_FLASH`. This is the "colored flash" requirement.
- **Big word**: `ui.BigWord` renders `card.word[lang]` at max legible size (auto-fit, RTL aware). Optional `hint` as a small sub-line.
- **Timer ring**: `ui.TimerRing` bound to `state.secondsLeft / roundSeconds`. Turns red < 10s.
- **Score pill**: small "Got: N" counter (`state.currentEntries` got count).
- **Fallback controls (REQUIRED)**: two large tap zones / buttons —
  - left/bottom **PASS** (`ui.GhostButton`, amber) → `dispatch(MARK_PASS, seed)`
  - right/top **GOT IT** (`ui.PrimaryButton`, green) → `dispatch(MARK_GOT, seed)`
  These are always present (so the game is playable with zero motion). When `inputMode==='motion'` they shrink to a thin always-tappable strip + a hint "or tilt the phone".
- **Input mode toggle**: tiny `ui.IconButton` to switch motion↔button mid-game → `dispatch(SET_INPUT_MODE,{mode})`.

Motion handling (when `inputMode==='motion'`):
- Subscribe to `sdk.motion.onTilt(handler, { threshold, debounceMs })` (see §11). On a debounced **down** gesture → `dispatch(MARK_GOT, {seed})`; **up** → `dispatch(MARK_PASS, {seed})`. Unsubscribe on unmount / phase change.
- After each gesture, the wrapper enforces a **re-center**: the next gesture only fires after the phone returns near level (prevents a single tilt double-firing). This is the wrapper's responsibility, not the reducer's.

Timer:
- On entering `playing`, screen starts `sdk.timer.countdown(state.secondsLeft)` → emits `TICK` each second and `TIME_UP` at 0.
- < 4s remaining → `tick` SFX + escalating haptic.

Feedback on GOT/PASS:
- `got` SFX + success haptic; `passed` SFX + light haptic. (All gated by global mute via the Sound/Haptics primitives.)

Edge: if `currentCardId === null` (deck out, no recycle) → show `ui.EmptyState` "Out of words — wait for time!".

#### Phase `roundEnd`
- `ui.RoundSummary`: this Guesser's name, "Got N · Passed M", a compact list of the round's words colored by outcome (got=green check, passed=amber skip) from `state.currentEntries`.
- `ui.PrimaryButton`:
  - if more participants/rounds remain → "Next" → `dispatch(END_ROUND)` then `dispatch(NEXT_PARTICIPANT, {seed})` → back to `handoff`.
  - if this was the last → "See results" → `dispatch(END_ROUND)` then `dispatch(NEXT_PARTICIPANT,{seed})` (sets `matchOver`) → engine routes to Results via `ctx.finish()`.

SDK UI used: `RevealGate, BigNumber, BigWord, TimerRing, PrimaryButton, GhostButton, IconButton, RoundSummary, EmptyState`.

### 10.3 ResultsScreen

- `ui.ScreenHeader` "Results" + confetti (framer-motion) for winner; `end` SFX once.
- `ui.Standings` (from Results primitive): ranked rows — name/avatar (or team color+name), score, got, passed; winner highlighted; ties share rank.
- **Per-round breakdown**: `ui.Accordion` per `RoundResult` → Guesser, got/passed counts, the word list (got vs passed) rendered bilingually. This is the "results list of got/passed" requirement.
- Buttons: `ui.PrimaryButton` "Rematch" → `dispatch(RESET_MATCH,{seed})` (same config) → `handoff`. `ui.SecondaryButton` "New game" → `ctx.finish()` to home / back to Setup.

SDK UI used: `ScreenHeader, Standings, Accordion, PrimaryButton, SecondaryButton`.

---

## 11. Motion-Sensor SDK Wrapper (NEW shared primitive)

Lives at `src/sdk/motion/` (shared, NOT in the game folder). The game only consumes it via `ctx.sdk.motion`. Spec'd here because Heads Up! introduces it.

### 11.1 Goals
- Abstract `DeviceMotionEvent` / `DeviceOrientationEvent` (and iOS 13+ permission prompt) today; swappable for **Capacitor Motion** later behind the same interface.
- Emit semantic **tilt gestures** (`'down'`, `'up'`) — not raw degrees — so screens stay simple and the reducer stays pure.
- Provide capability detection + graceful fallback so the tap buttons are always the source of truth.

### 11.2 Public API

```ts
export type TiltDirection = 'up' | 'down';

export interface TiltEvent {
  direction: TiltDirection;     // resolved gesture
  beta: number;                 // raw front-back tilt in degrees (debug)
  at: number;                   // timestamp (ms) — for screens only, NEVER passed into the reducer
}

export interface MotionOptions {
  /** Degrees from the "level on forehead" baseline to count as a gesture. Default 35. */
  threshold?: number;
  /** Min ms between accepted gestures. Default 700. */
  debounceMs?: number;
  /** Degrees within which the phone is considered "re-centered" before another gesture can fire. Default 15. */
  recenterWithin?: number;
  /** Invert up/down (for upside-down holds / LTR vs RTL handedness). Default false. */
  invert?: boolean;
}

export interface MotionHandle {
  /** Stop listening and release the sensor. */
  stop(): void;
  /** Re-baseline "level" to the current physical orientation (call when the user says "ready"). */
  calibrate(): void;
}

export interface MotionSdk {
  /** Is a usable motion/orientation sensor present in this environment? */
  isSupported(): boolean;
  /** iOS 13+ requires a user-gesture permission request. Resolves to granted?. No-op elsewhere. */
  requestPermission(): Promise<boolean>;
  /** Subscribe to debounced, re-centered tilt gestures. Returns a handle to stop/calibrate. */
  onTilt(handler: (e: TiltEvent) => void, opts?: MotionOptions): MotionHandle;
}
```

### 11.3 Behaviour & implementation notes
- **Baseline:** "level on forehead" ≈ `beta` near 90° when held vertically against the forehead in landscape; the wrapper records a baseline on `calibrate()` / first stable reading and measures deltas, so absolute orientation differences across devices don't matter.
- **Gesture resolution:** delta beyond `+threshold` from baseline (top edge toward floor) → `'down'` (GOT). Beyond `-threshold` (top edge toward sky) → `'up'` (PASS). `invert` swaps these.
- **Debounce + re-center:** after firing, ignore further events until (a) `debounceMs` elapsed AND (b) orientation returns within `recenterWithin` of baseline. Prevents double-fires from one physical tilt.
- **Permission:** `requestPermission()` wraps `DeviceMotionEvent.requestPermission?.()` (iOS). PlayScreen calls it from the "I'm ready" tap (a user gesture) during `handoff`, then `calibrate()`.
- **Capability:** `isSupported()` checks `'DeviceOrientationEvent' in window` (and that events actually arrive within a short probe). If false → Setup forces `motionEnabled=false`, PlayScreen forces `inputMode='button'`.
- **Capacitor later:** a `CapacitorMotionSdk` implements `MotionSdk` using `@capacitor/motion`; the bundle picks the impl at startup. Game code is untouched.
- **Purity boundary:** the wrapper lives entirely in the view layer. It converts physical input into **dispatched actions** with a `seed` minted at dispatch time. The reducer never sees degrees, time, or the sensor.

---

## 12. Pass-and-Play Handoff & Secrecy (RevealGate)

- The single phone is passed each round. The **secrecy** concern: the **Guesser must not see the upcoming word**, while **Cluers must**.
- The `handoff` phase uses the shared **RevealGate** primitive to interpose a full-screen "Pass to <name> — tap I'm ready" between rounds. `currentCardId` is `null` during `handoff`/`countdown`, so even a peeking Guesser sees no word; the first word is only set when `countdownLeft` hits 0 (i.e., when the phone is already on the forehead facing the Cluers).
- The 3-2-1 countdown gives the Guesser time to place the phone on the forehead before the word appears.
- Screen faces **out**: PlayScreen uses large, mirror-friendly typography; orientation lock to landscape is requested in `playing` (best-effort `screen.orientation.lock`, ignored if unsupported).
- At `roundEnd` the phone is held normally again to read the summary, then handed to the next person via the next `handoff`.

---

## 13. Edge Cases

| Case | Handling |
| --- | --- |
| No motion sensor / permission denied | `isSupported()`/`requestPermission()` false → force `inputMode='button'`; Setup disables Tilt toggle with a note. Game fully playable with buttons. |
| Single physical tilt double-fires | Wrapper debounce + re-center gate (§11.3). Reducer is idempotent per action anyway. |
| Deck runs out mid-round | `recycleDeck=true` (default) reshuffles and continues; else `currentCardId=null`, "Out of words" UI until `TIME_UP`. |
| Fewer than 4 players in teams mode | Setup validation blocks Start / forces `solo`. |
| 2 players, solo | They alternate Guesser/Cluer each round; works. |
| Multiple decks selected | Cards merged then shuffled with one seed; card `id`s are deck-unique → namespaced as `<deckId>:<cardId>` in the deck queue to avoid collisions across decks. |
| Time expires mid-flash | `TIME_UP` still transitions to `roundEnd`; `flash` is ignored there (screen unmounts the overlay). |
| App backgrounded mid-round | Timer primitive pauses on `visibilitychange`; on resume it resumes countdown (engine concern). Reducer unaffected. |
| Rapid GOT then PASS taps | Each dispatch appends one entry & advances one card; order preserved in `currentEntries`. |
| Last card + last round → results | `NEXT_PARTICIPANT` sets `matchOver`; engine calls `finish()` → Results. |
| RTL (Persian) | All layout via logical utilities; PASS/GOT positions defined by semantic role, mirrored automatically; numbers via i18n number formatting. |
| Global mute on | Sound/Haptics primitives no-op; flash + visuals still play. |
| Tie in standings | Sorted stable; equal scores share rank in Results. |

---

## 14. Unit Tests — `logic.test.ts`

Pure-function tests (no DOM, no clock, no RNG — seeds are fixed). Each `it` below is a required case.

**createInitialState / START_MATCH**
1. `START_MATCH` (solo) builds `participants` = one per roster player, in turn order; `phase==='handoff'`; `turnIndex===0`.
2. `START_MATCH` (teams) builds one participant per team; each has a `guesserId` from its members.
3. Deck is built, shuffled deterministically for a given seed; same seed ⇒ same order; different seed ⇒ different order (with high probability over a known deck).
4. Multiple decks merge and card ids are namespaced `<deckId>:<cardId>` and unique.
5. `currentCardId` is `null` after `START_MATCH` (no word leaked during handoff).

**Handoff / countdown**
6. `CONFIRM_READY` from `handoff` → `countdown`, `countdownLeft===3`.
7. `COUNTDOWN_TICK` decrements; three ticks → `phase==='playing'`, `secondsLeft===roundSeconds`, `currentCardId===deck[0]`.

**Playing — got/pass**
8. `MARK_GOT` appends `{result:'got'}`, sets `flash='got'`, advances `deckCursor`/`currentCardId`.
9. `MARK_PASS` appends `{result:'passed'}`, sets `flash='passed'`, advances card.
10. `CLEAR_FLASH` sets `flash=null` without touching entries or cursor.
11. `TICK` only updates `secondsLeft`; does not change card or entries.
12. Sequence of GOT/PASS preserves chronological order in `currentEntries`.

**Deck recycling / exhaustion**
13. With `recycleDeck=true`, advancing past the last card reshuffles (seed) and continues (`currentCardId` non-null).
14. With `recycleDeck=false`, advancing past the last card sets `currentCardId=null` and leaves cursor ≥ length.

**Round end / advance**
15. `TIME_UP` from `playing` → `roundEnd`; `currentEntries` preserved.
16. `END_ROUND` commits a `RoundResult` with correct `got`/`passed` counts; increments `roundOfParticipant`.
17. `NEXT_PARTICIPANT` (more remain) advances `turnIndex` (wraps), builds a fresh shuffled deck (seed), resets `deckCursor=0`, clears `currentEntries`, → `handoff`.
18. `NEXT_PARTICIPANT` when all participants reached `totalRoundsPerParticipant` → `matchOver===true`, `phase==='finished'`.
19. Round-robin order: with N participants and R rounds each, exactly N×R rounds are produced before finish.

**Scoring & standings**
20. `score(got,passed,0) === got`; `score(got,passed,1) === got - passed`.
21. `standings()` sorts by score desc, then got desc, stable for ties; winner first.
22. Teams mode: a team's score sums rounds from different Guessers on that team.

**Input mode**
23. `SET_INPUT_MODE` flips `inputMode` and is allowed in any phase without altering other state.

**Reset**
24. `RESET_MATCH` returns state equivalent to a fresh `START_MATCH` with same config (same seed ⇒ identical deck); `rounds` cleared, `turnIndex=0`, `phase==='handoff'`.

**Purity / guards**
25. Reducer never mutates the input state object (frozen-input test: `Object.freeze(state)` then dispatch ⇒ no throw, new object returned).
26. Actions invalid for the current phase are no-ops (e.g., `MARK_GOT` while `handoff` returns state unchanged by identity-or-equality).

---

## 15. Manifest (`manifest.ts`) sketch

```ts
import type { GameManifest } from '@/sdk/types';

export const manifest: GameManifest = {
  id: 'heads-up',
  title:       { en: 'Heads Up!',            fa: 'حدس بزن!' },
  description: { en: 'Phone on your forehead — tilt to play.', fa: 'گوشی روی پیشانی — با کج کردن بازی کن.' },
  howToPlay:   { en: 'Hold the phone on your forehead so others can see the word. They give clues. Tilt down when you guess right, tilt up to pass.',
                 fa: 'گوشی را روی پیشانی بگیر تا بقیه کلمه را ببینند. آن‌ها سرنخ می‌دهند. وقتی درست حدس زدی پایین کج کن، برای رد کردن بالا کج کن.' },
  icon: '🙈',
  color: 'var(--color-game-headsup)',
  minPlayers: 2,
  maxPlayers: 16,
  tags: [ { en: 'Party', fa: 'مهمانی' }, { en: 'Active', fa: 'پرتحرک' }, { en: 'Fast', fa: 'سریع' } ],
  capabilities: { motion: true, haptics: true, sound: true },
};
```

## 16. Module wiring (`index.ts`) sketch

```ts
import { lazy } from 'react';
import type { GameModule } from '@/sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer } from './logic';
import { DEFAULT_CONFIG, setupSchema } from './config';
import type { HeadsUpConfig, HeadsUpState, HeadsUpAction } from './types';

const mod: GameModule<HeadsUpConfig, HeadsUpState, HeadsUpAction> = {
  manifest,
  createInitialState,
  reducer,
  defaultConfig: DEFAULT_CONFIG,
  setupSchema,
  screens: {
    Setup:   lazy(() => import('./screens/SetupScreen')),
    Play:    lazy(() => import('./screens/PlayScreen')),
    Results: lazy(() => import('./screens/ResultsScreen')),
  },
};
export default mod;
```

---

### Open dependency on the architecture spec
This spec assumes `docs/specs/00-architecture.md` defines, with these exact names: `LocalizedString`, `GameManifest`, `GameModule`, `GameContext`, `SetupSchema`, `SdkBundle`, and the SDK primitives `roster`, `teams`, `turnOrder`, `timer`, `deck` (incl. `shuffle(ids, seed)` + mulberry32 PRNG + `rng.seed()`), `scoring`, `revealGate`, `phaseMachine`, `results`, `sound`, `haptics`, `ui`, `i18n`, plus the **new** `motion` primitive specified in §11. If any name differs there, that file is the source of truth and these references should be renamed to match.
