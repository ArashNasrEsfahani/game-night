# Game Spec — Pantomime / Charades (`pantomime`)

> Act it out silently. One actor sees a prompt privately, mimes it without
> speaking, and their team races the clock to guess. Most points wins.

This document is the **complete, implementation-ready** spec for the `pantomime`
game module. It conforms strictly to the contracts defined in
`docs/specs/00-architecture.md` (referenced primitive/type names are assumed to
exist exactly as named below). An implementer should be able to build this game
with **no further questions**.

- **Game id:** `pantomime`
- **Folder:** `src/games/pantomime/`
- **Category tags:** `party`, `teams`, `active`, `timed`
- **Engine primitives consumed:** `roster`, `teams`, `turnOrder`, `timer`,
  `deck`, `scoring`, `revealGate`, `phaseMachine`, `results`
- **Engine primitives NOT used:** `voting` (no voting in Pantomime)

---

## 1. Overview & Design Intent

Pantomime is a **team** party game played **pass-and-play on one phone**. The
phone is the "prompt card holder": it is handed to the current **actor**, who
opens a `RevealGate` to privately read the prompt, then puts the phone down (or
holds it face-down) and acts the prompt out silently while their teammates
shout guesses. A running timer bounds each turn. When a teammate guesses
correctly, the actor (or scorekeeper) taps **Correct (+1)**; a prompt that is
too hard can be **Skipped**. When time runs out, the phone passes to the next
team's actor.

Design priorities:

- **Secrecy of the prompt** from the guessing team is the core mechanic — the
  prompt must never be visible until the actor explicitly reveals it, and must
  be hideable instantly (face-down handoff).
- **Speed of input** during a turn — Correct / Skip must be huge, thumb-reachable
  buttons; the timer must be glanceable.
- **Fairness** — every team gets the same number of turns; the turn order and
  actor rotation are deterministic and visible.
- **Bilingual** — all UI strings via i18n catalogs; all prompt CONTENT via
  bilingual JSON data files. Full RTL for Persian.

---

## 2. Player Range & Modes

| Property | Value |
| --- | --- |
| Min players | **4** |
| Max players | **16** |
| Structure | **Teams only** (no free-for-all) |
| Min teams | **2** |
| Max teams | **4** |
| Min players per team | **2** (you need at least one actor + one guesser) |
| Recommended | 2 teams of 2–4 |

**Why teams-only:** Pantomime needs a guesser audience separate from the actor.
A solo actor with nobody to guess is meaningless, hence min team size 2.

`GameManifest.minPlayers = 4`, `maxPlayers = 16`. Team validation (min 2 teams,
each team ≥ 2 members) is enforced in `SetupScreen` via the `teams` primitive's
validators plus a game-level guard (see §10 Edge Cases).

### Game-length modes (chosen at setup)

- **`targetScore`** — first team to reach _N_ points triggers end-of-round
  finish (the in-progress round completes so every team has equal turns), then
  the game ends.
- **`rounds`** — play a fixed number of **rounds**, where one round = every team
  has taken exactly one turn. Highest score at the end wins.

Exactly one of these is active (`GameConfig.endMode`).

---

## 3. CONTENT Schema

Prompt content lives in **bilingual JSON data files** under
`src/games/pantomime/content/`. Content is **data, not UI strings** — it is NOT
in the i18n catalogs.

### 3.1 TypeScript types (`content/types.ts`)

```ts
import type { LocalizedString } from '@/sdk/types'; // { en: string; fa: string }

/** The five decks shipped with the game. "mixed" is a virtual deck. */
export type PantomimeCategory =
  | 'movies'
  | 'animals'
  | 'actions'
  | 'famous'   // Famous People
  | 'mixed';   // virtual: union of the four real decks

export type PantomimeDifficulty = 'easy' | 'medium' | 'hard';

/** A single promptable item. */
export interface PantomimePrompt {
  /** Stable unique id, namespaced by category, e.g. "movies.titanic". */
  id: string;
  /** The phrase to act out, bilingual. */
  text: LocalizedString;
  /** Which real deck this belongs to (never "mixed"). */
  category: Exclude<PantomimeCategory, 'mixed'>;
  difficulty: PantomimeDifficulty;
  /**
   * Optional short acting hint shown ONLY to the actor inside the RevealGate,
   * never to guessers. Bilingual. Helps weaker actors.
   */
  hint?: LocalizedString;
  /**
   * Optional tags for future filtering (e.g. "kids", "classic").
   * Not surfaced in Phase 1 UI.
   */
  tags?: string[];
}

/** One JSON file per real category. */
export interface PantomimeDeckFile {
  category: Exclude<PantomimeCategory, 'mixed'>;
  /** Schema/content version for migration & sync. */
  version: number;
  prompts: PantomimePrompt[];
}
```

### 3.2 File layout

```
content/
  movies.json      // PantomimeDeckFile, category "movies"
  animals.json     // PantomimeDeckFile, category "animals"
  actions.json     // PantomimeDeckFile, category "actions"
  famous.json      // PantomimeDeckFile, category "famous"
  index.ts         // loads + validates the four files, derives "mixed"
  types.ts         // the types above
```

`content/index.ts` responsibilities:

```ts
import movies from './movies.json';
import animals from './animals.json';
import actions from './actions.json';
import famous from './famous.json';
import type { PantomimeDeckFile, PantomimePrompt, PantomimeCategory } from './types';

const FILES: PantomimeDeckFile[] = [movies, animals, actions, famous];

/** All prompts indexed by id (dev assertion: ids unique). */
export const ALL_PROMPTS: Record<string, PantomimePrompt> = /* built from FILES */;

/** Return prompt ids for the requested categories + difficulties. */
export function selectPromptIds(
  categories: PantomimeCategory[],
  difficulties: PantomimeDifficulty[],
): string[];
```

> **Important:** the **reducer never imports content**. The screen layer resolves
> the chosen categories/difficulties into a flat array of prompt **ids** and
> passes that array into `createInitialState(cfg)` via `cfg.promptIds`. The deck
> primitive then operates purely on ids. This keeps the reducer pure and
> content-agnostic (see §6, §7).

### 3.3 Sample content (≥ 12 real bilingual items)

These are real, ship-able items. Persian (`fa`) values are real translations.

`content/movies.json`:

```json
{
  "category": "movies",
  "version": 1,
  "prompts": [
    { "id": "movies.titanic",       "category": "movies", "difficulty": "easy",
      "text": { "en": "Titanic",            "fa": "تایتانیک" } },
    { "id": "movies.the-lion-king", "category": "movies", "difficulty": "easy",
      "text": { "en": "The Lion King",      "fa": "شیرشاه" } },
    { "id": "movies.harry-potter",  "category": "movies", "difficulty": "medium",
      "text": { "en": "Harry Potter",       "fa": "هری پاتر" } },
    { "id": "movies.the-matrix",    "category": "movies", "difficulty": "hard",
      "text": { "en": "The Matrix",         "fa": "ماتریکس" },
      "hint": { "en": "Dodge bullets in slow motion", "fa": "جاخالی دادن از گلوله با حرکت آهسته" } }
  ]
}
```

`content/animals.json`:

```json
{
  "category": "animals",
  "version": 1,
  "prompts": [
    { "id": "animals.elephant", "category": "animals", "difficulty": "easy",
      "text": { "en": "Elephant", "fa": "فیل" } },
    { "id": "animals.penguin",  "category": "animals", "difficulty": "easy",
      "text": { "en": "Penguin",  "fa": "پنگوئن" } },
    { "id": "animals.kangaroo", "category": "animals", "difficulty": "medium",
      "text": { "en": "Kangaroo", "fa": "کانگورو" } },
    { "id": "animals.chameleon","category": "animals", "difficulty": "hard",
      "text": { "en": "Chameleon","fa": "آفتاب‌پرست" } }
  ]
}
```

`content/actions.json`:

```json
{
  "category": "actions",
  "version": 1,
  "prompts": [
    { "id": "actions.swimming",      "category": "actions", "difficulty": "easy",
      "text": { "en": "Swimming",         "fa": "شنا کردن" } },
    { "id": "actions.brushing-teeth","category": "actions", "difficulty": "easy",
      "text": { "en": "Brushing teeth",   "fa": "مسواک زدن" } },
    { "id": "actions.driving-a-car", "category": "actions", "difficulty": "medium",
      "text": { "en": "Driving a car",    "fa": "رانندگی کردن" } },
    { "id": "actions.juggling",      "category": "actions", "difficulty": "hard",
      "text": { "en": "Juggling",         "fa": "ژانگولر بازی" } }
  ]
}
```

`content/famous.json`:

```json
{
  "category": "famous",
  "version": 1,
  "prompts": [
    { "id": "famous.charlie-chaplin", "category": "famous", "difficulty": "medium",
      "text": { "en": "Charlie Chaplin", "fa": "چارلی چاپلین" } },
    { "id": "famous.albert-einstein",  "category": "famous", "difficulty": "medium",
      "text": { "en": "Albert Einstein",  "fa": "آلبرت اینشتین" } },
    { "id": "famous.michael-jackson",  "category": "famous", "difficulty": "easy",
      "text": { "en": "Michael Jackson",  "fa": "مایکل جکسون" } },
    { "id": "famous.hafez",            "category": "famous", "difficulty": "hard",
      "text": { "en": "Hafez",            "fa": "حافظ" } }
  ]
}
```

Total: **16** sample items across 4 decks × 3 difficulties (≥ 12 required).
A production build should expand each deck to ~50+ prompts.

---

## 4. GameConfig (Setup Options)

`logic.ts` exports the config type; `SetupScreen` builds it; `createInitialState`
consumes it.

```ts
import type { PantomimeCategory, PantomimeDifficulty } from './content/types';

export interface PantomimeConfig {
  /** From the shared roster/teams primitives. Teams are arrays of playerIds. */
  teams: TeamConfig[];            // SDK type; >= 2 teams, each >= 2 players

  /** Selected decks. "mixed" expands to all four real decks at resolve time. */
  categories: PantomimeCategory[]; // non-empty; default ["mixed"]

  /** Difficulty filter. Non-empty; default all three. */
  difficulties: PantomimeDifficulty[]; // default ["easy","medium","hard"]

  /** Seconds per turn (the actor's miming window). */
  roundSeconds: number;            // 30 | 45 | 60 | 90 | 120; default 60

  /** End condition. Exactly one mode. */
  endMode: 'targetScore' | 'rounds';
  /** Used when endMode === 'targetScore'. */
  targetScore: number;             // 5 | 10 | 15 | 20; default 10
  /** Used when endMode === 'rounds'. */
  totalRounds: number;             // 3 | 5 | 7 | 10; default 5

  /** Skips allowed per turn. -1 = unlimited. */
  maxSkipsPerTurn: number;         // 0 | 1 | 2 | 3 | -1; default 2

  /** If true, a skip costs the team -1 (floored at 0 by mode rules). */
  skipPenalty: boolean;            // default false

  /** RESOLVED at setup: flat list of prompt ids for the chosen filters.
   *  The reducer is content-agnostic and only ever sees ids. */
  promptIds: string[];             // resolved via content/index.selectPromptIds

  /** Deterministic shuffle seed captured at setup (Date.now() etc.). */
  shuffleSeed: number;
}
```

### Setup defaults summary

| Option | Default | Choices |
| --- | --- | --- |
| `categories` | `["mixed"]` | movies / animals / actions / famous / mixed |
| `difficulties` | all three | easy / medium / hard (multi-select) |
| `roundSeconds` | `60` | 30 / 45 / 60 / 90 / 120 |
| `endMode` | `targetScore` | targetScore / rounds |
| `targetScore` | `10` | 5 / 10 / 15 / 20 |
| `totalRounds` | `5` | 3 / 5 / 7 / 10 |
| `maxSkipsPerTurn` | `2` | 0 / 1 / 2 / 3 / unlimited |
| `skipPenalty` | `false` | on / off |

---

## 5. STATE Shape

The state is **fully serializable** (zustand `persist` / idb-keyval friendly):
no functions, no class instances, no `Date` objects (timestamps are numbers).

```ts
export type PantomimePhase =
  | 'handoff'   // "Pass the phone to <Actor> of <Team>"  (privacy buffer)
  | 'reveal'    // RevealGate closed: actor taps to see the prompt privately
  | 'acting'    // prompt revealed to actor, timer running, team guessing
  | 'turnEnd'   // turn over (time up / deck exhausted): show turn summary
  | 'results';  // game over

export interface PantomimeTeamState {
  teamId: string;
  name: LocalizedString;     // editable team name (from teams primitive)
  color: string;             // token key for the team color chip
  playerIds: string[];       // ordered; index used for per-team actor rotation
  /** Index into playerIds of who acts on this team's NEXT turn. */
  actorCursor: number;
  score: number;
  /** Cumulative correct guesses (== score unless skipPenalty changes it). */
  correctCount: number;
  skipCount: number;         // cumulative skips across the game
}

/** Immutable-ish record of one completed turn (for ResultsScreen recap). */
export interface PantomimeTurnRecord {
  turnIndex: number;         // global, 0-based
  roundIndex: number;        // 0-based round number
  teamId: string;
  actorId: string;
  correct: number;           // prompts gotten this turn
  skipped: number;           // prompts skipped this turn
  /** Prompt ids resolved this turn (correct + skipped), for the recap. */
  promptIds: string[];
}

export interface PantomimeState {
  phase: PantomimePhase;

  /** Config echoed for reducer self-containment (no re-reading cfg). */
  config: PantomimeConfig;

  /** Teams in fixed turn order (turnOrder primitive seeded this order). */
  teams: PantomimeTeamState[];
  /** Index into `teams` whose turn it is. */
  activeTeamIndex: number;

  /** Global counters. */
  turnIndex: number;         // 0-based count of turns STARTED
  roundIndex: number;        // 0-based; increments when order wraps to team 0

  /** Deck state (deck primitive shape), holding prompt ids only. */
  deck: {
    drawPile: string[];      // shuffled remaining prompt ids
    discardPile: string[];   // resolved (correct or skipped) ids
    current: string | null;  // the prompt id currently in front of the actor
  };

  /** Per-turn transient counters (reset at turn start). */
  turn: {
    correctThisTurn: number;
    skipsThisTurn: number;
    /** ids resolved during this turn, in order, for the turn record. */
    resolvedThisTurn: string[];
  };

  /** Timer primitive snapshot (authoritative remaining ms is computed by the
   *  timer primitive from these fields; reducer only flips run/pause flags). */
  timer: {
    durationMs: number;      // roundSeconds * 1000
    /** Epoch ms when the current run segment started; null when paused. */
    startedAt: number | null;
    /** Accumulated elapsed ms from previous run segments (for pause/resume). */
    elapsedBeforeMs: number;
    status: 'idle' | 'running' | 'paused' | 'expired';
  };

  /** History for ResultsScreen recap. */
  history: PantomimeTurnRecord[];

  /** Set when an end condition is met; the round still finishes (fairness). */
  endRequested: boolean;

  /** Winner(s) resolved at results time; multiple on a tie. */
  winnerTeamIds: string[];
}
```

> **Clock & RNG are external.** The reducer never calls `Date.now()` or
> `Math.random()`. Any timestamp (`startedAt`) or shuffle decision is passed
> **in the action payload** as a `now` number or `seed` number. This keeps the
> reducer pure and unit-testable (architecture rule).

---

## 6. Actions & Reducer Transitions

`logic.ts` exports:

```ts
export function createInitialState(cfg: PantomimeConfig): PantomimeState;
export function reducer(state: PantomimeState, action: PantomimeAction): PantomimeState;
```

### 6.1 `createInitialState(cfg)`

1. Build `teams[]` from `cfg.teams`, each with `actorCursor=0`, `score=0`,
   `correctCount=0`, `skipCount=0`. Team order is `cfg.teams` order (the
   `turnOrder` primitive established/randomized this at setup; the resolved
   order is passed in).
2. `activeTeamIndex = 0`, `turnIndex = 0`, `roundIndex = 0`.
3. `deck.drawPile = shuffle(cfg.promptIds, cfg.shuffleSeed)` (pure
   seeded Fisher–Yates), `discardPile = []`, `current = null`.
4. `turn = { correctThisTurn: 0, skipsThisTurn: 0, resolvedThisTurn: [] }`.
5. `timer = { durationMs: cfg.roundSeconds*1000, startedAt: null, elapsedBeforeMs: 0, status: 'idle' }`.
6. `phase = 'handoff'`, `history = []`, `endRequested = false`, `winnerTeamIds = []`.

### 6.2 Action union

```ts
export type PantomimeAction =
  | { type: 'HANDOFF_READY' }                       // actor has the phone
  | { type: 'REVEAL_PROMPT'; now: number }          // RevealGate opened
  | { type: 'TICK'; now: number }                   // timer poll → may expire
  | { type: 'CORRECT'; now: number; seed: number }  // +1, draw next
  | { type: 'SKIP'; now: number; seed: number }     // skip, draw next
  | { type: 'PAUSE'; now: number }                  // pause timer (e.g. dispute)
  | { type: 'RESUME'; now: number }                 // resume timer
  | { type: 'TIME_UP'; now: number }                // explicit expiry commit
  | { type: 'END_TURN'; now: number }               // finalize turn → next/handoff
  | { type: 'NEXT_TURN' }                           // advance to next team/actor
  | { type: 'FINISH_GAME' }                         // compute winners → results
  | { type: 'RESET' };                              // back to initial (replay)
```

### 6.3 Transition table

| Action | Valid in phase | Effect on state |
| --- | --- | --- |
| `HANDOFF_READY` | `handoff` | `phase → 'reveal'`. No other change. (Actor now holds phone; RevealGate is closed.) |
| `REVEAL_PROMPT` | `reveal` | Draw first prompt: if `drawPile` empty → reshuffle `discardPile` with current seed into `drawPile` (see §10 exhaustion); pop `deck.current` from `drawPile`. Start timer: `timer.status='running'`, `timer.startedAt=now`, `timer.elapsedBeforeMs=0`. `phase → 'acting'`. |
| `TICK` | `acting` | Compute `elapsed = elapsedBeforeMs + (now - startedAt)`. If `elapsed >= durationMs` → set `timer.status='expired'`, `timer.startedAt=null`, and **auto-transition** as if `TIME_UP` (see below). Else no state change (UI re-reads remaining). |
| `CORRECT` | `acting` | `current` is resolved as correct: push `current` to `discardPile` & `turn.resolvedThisTurn`; `turn.correctThisTurn += 1`; active team `score += 1`, `correctCount += 1`. If end condition now met (targetScore reached) → `endRequested = true`. Draw next prompt into `deck.current` (reshuffle if needed). If deck cannot provide a prompt at all → behave like `TIME_UP`. `phase` stays `acting`. Timer keeps running. |
| `SKIP` | `acting` | Guard: if `maxSkipsPerTurn !== -1 && turn.skipsThisTurn >= maxSkipsPerTurn` → **no-op** (return state). Else: push `current` to `discardPile` & `turn.resolvedThisTurn`; `turn.skipsThisTurn += 1`; active team `skipCount += 1`. If `config.skipPenalty` → `score = max(0, score - 1)`. Draw next prompt (reshuffle if needed); if none → like `TIME_UP`. Timer keeps running. `phase` stays `acting`. |
| `PAUSE` | `acting` | `timer.elapsedBeforeMs += (now - startedAt)`; `timer.startedAt = null`; `timer.status='paused'`. `phase` stays `acting`. |
| `RESUME` | `acting` (paused) | `timer.startedAt = now`; `timer.status='running'`. |
| `TIME_UP` | `acting` | `timer.status='expired'`, `startedAt=null`. If `deck.current` is non-null, return it to `drawPile` **front** (unresolved, not counted). `phase → 'turnEnd'`. Append a `PantomimeTurnRecord` to `history` from `turn` counters. |
| `END_TURN` | `turnEnd` | Reset `turn` counters. Advance actor cursor for the team that just played (`actorCursor = (actorCursor+1) % playerIds.length`). Then either: if `endRequested` **and** the round is complete (active team was the last in order) → dispatch effect equivalent to `FINISH_GAME`. Else compute next team/round (see `NEXT_TURN` logic) and `phase → 'handoff'`. |
| `NEXT_TURN` | (internal, folded into `END_TURN`) | `activeTeamIndex = (activeTeamIndex+1) % teams.length`; if it wrapped to 0 → `roundIndex += 1`. `turnIndex += 1`. Reset `timer` to `idle` with full duration. `deck.current = null`. If `endMode==='rounds' && roundIndex >= totalRounds` → set `endRequested=true` then finish. `phase → 'handoff'`. |
| `FINISH_GAME` | `turnEnd` (or forced) | Compute `winnerTeamIds` = all teams whose `score === max(score)`. `phase → 'results'`. Timer `idle`. |
| `RESET` | any | Return `createInitialState(state.config)`. (Replay with same config; screen re-resolves a fresh shuffle seed if desired by passing a new config.) |

> **Round completion check.** A round is complete when the team that just played
> is the **last** team in turn order, i.e. `activeTeamIndex === teams.length - 1`
> at `END_TURN` time. Only then may an `endRequested` flag actually finish the
> game — guaranteeing every team had equal turns (fairness rule, §7).

> **`TICK` vs `TIME_UP`.** `TICK` is dispatched by a UI interval (e.g. every
> 200ms) to drive the countdown display; when it detects expiry it folds into the
> `TIME_UP` transition. `TIME_UP` may also be dispatched directly (e.g. on
> visibility-change/blur safety, see §9). Both are idempotent once `phase` leaves
> `acting`.

### 6.4 Draw helper (pure, inside logic.ts)

```ts
// Pure. Uses seed only; no Math.random. Returns next id + updated piles.
function drawNext(
  deck: PantomimeState['deck'],
  seed: number,
): { current: string | null; drawPile: string[]; discardPile: string[] } {
  if (deck.drawPile.length === 0) {
    if (deck.discardPile.length === 0) return { current: null, drawPile: [], discardPile: [] };
    // reshuffle discard back into draw (seeded), keep going (infinite supply)
    const reshuffled = seededShuffle(deck.discardPile, seed);
    return { current: reshuffled[0] ?? null, drawPile: reshuffled.slice(1), discardPile: [] };
  }
  return { current: deck.drawPile[0], drawPile: deck.drawPile.slice(1), discardPile: deck.discardPile };
}
```

`seededShuffle(arr, seed)` is a pure Fisher–Yates driven by a small seeded PRNG
(e.g. mulberry32). Provided by the `deck` primitive or a local util; either way
**deterministic** for tests.

---

## 7. Win / Scoring Rules

- **+1** to the active team for each `CORRECT` during a turn.
- **Skips:** by default 0 points; if `skipPenalty` is on, each skip is `-1`
  (score floored at 0).
- A team's `score` is the sum across all its turns.
- **End conditions:**
  - `endMode === 'targetScore'`: when any team's `score >= targetScore`, set
    `endRequested`. The **current round finishes** (all remaining teams in the
    order get their turn) before the game ends.
  - `endMode === 'rounds'`: after `roundIndex` reaches `totalRounds` (each team
    has had `totalRounds` turns), the game ends.
- **Winner:** team(s) with the maximum `score`. **Ties are allowed** —
  `winnerTeamIds` may contain multiple ids; ResultsScreen shows a shared win.
- **Tiebreaker (optional, OFF by default):** none in Phase 1. (A future option
  could break ties by fewer skips; not implemented now.)

---

## 8. Screen-by-Screen Breakdown

All screens are composed from `sdk/ui` components and dispatch actions via the
`GameContext` provided by the engine. Screens read derived values (e.g. remaining
ms) from the `timer` primitive selector, not by recomputing.

### 8.1 `SetupScreen.tsx`

**Purpose:** configure teams + options, then start.

| Region | SDK UI component(s) | Behavior / dispatch |
| --- | --- | --- |
| Roster & teams | `<RosterPicker>`, `<TeamBuilder>` (from `roster`/`teams` primitives) | Pull existing players from global roster store; assign to 2–4 teams; drag/auto-balance. Validates ≥2 teams, each ≥2 players. |
| Turn order | `<TurnOrderControl>` | Shows team order; "Shuffle order" button seeds `turnOrder`. |
| Categories | `<ChipMultiSelect>` | Toggle movies/animals/actions/famous/mixed. "mixed" is exclusive-ish: selecting it selects the union. Default `["mixed"]`. |
| Difficulty | `<ChipMultiSelect>` | easy/medium/hard multi-select; ≥1 required. |
| Round time | `<SegmentedControl>` | 30/45/60/90/120s. |
| End mode | `<SegmentedControl>` + dependent `<Stepper>`/`<SegmentedControl>` | targetScore (5/10/15/20) or rounds (3/5/7/10). |
| Skips | `<SegmentedControl>` (0/1/2/3/∞) + `<Toggle>` skipPenalty | |
| Start | `<PrimaryButton>` "Start game" | On press: resolve `promptIds = selectPromptIds(categories, difficulties)`; assert `promptIds.length > 0` (else show inline error, §10); capture `shuffleSeed = Date.now()`; build `PantomimeConfig`; call engine `startGame(config)` → engine calls `createInitialState` and routes to PlayScreen. |

**Live preview / validation:** disable Start until valid. Show a small estimate:
"~`promptIds.length` prompts available".

### 8.2 `PlayScreen.tsx`

The PlayScreen is a **phase machine view** keyed on `state.phase` (driven by the
`phaseMachine` primitive). It renders one of four sub-views:

#### (a) `phase === 'handoff'` — Handoff buffer
- Big card: "Pass the phone to **<actorName>** — **<teamName>**" with team color.
- SDK: `<HandoffCard>` (team color chip, actor avatar/initial), `<PrimaryButton>`
  "I'm <actorName>, ready" → dispatch `HANDOFF_READY`.
- Secrecy: NO prompt is anywhere on screen here. This buffer guarantees the phone
  changes hands before any prompt could be drawn.

#### (b) `phase === 'reveal'` — RevealGate (secret)
- SDK: **`<RevealGate>`** primitive — a full-screen "hold to reveal" / "tap to
  reveal" gate that only the actor should look at. Copy: "Only **<actorName>**
  should look. Tap to reveal your prompt."
- On reveal action (release/confirm) → dispatch `REVEAL_PROMPT { now }`.
- The gate is the secrecy boundary: until tapped, the prompt is never rendered to
  the DOM in a visible way (RevealGate keeps it occluded; see §9).

#### (c) `phase === 'acting'` — Acting + guessing
- **Prompt display** (visible to actor): `<PromptCard>` shows
  `current.text[lang]`, its `category` and `difficulty` badges, and optional
  `hint` behind a small "Show hint" disclosure (`<HintDisclosure>`).
- **Timer:** `<CountdownRing>` bound to the `timer` primitive selector (reads
  remaining ms; turns red < 10s; pulses). A `<TimerControls>` row exposes Pause
  (`PAUSE`) / Resume (`RESUME`).
- **Big action buttons** (thumb zone):
  - `<CorrectButton>` (large, green, full-width-ish) → dispatch
    `CORRECT { now, seed }`. Plays "ding" SFX + success haptic.
  - `<SkipButton>` (amber) → dispatch `SKIP { now, seed }`. Disabled when skip
    cap reached (shows "X skips left" / "no skips"). Plays "whoosh" SFX + light
    haptic.
- **Live turn tally:** `<ScorePill>` "Correct: N · Skips: M" for this turn.
- **Face-down safety:** a small "Hide / pass" button can instantly dispatch
  `PAUSE` and overlay an opaque cover (secrecy if interrupted).
- **Driving the clock:** PlayScreen runs a `setInterval` that dispatches
  `TICK { now }` (~5/sec) while `acting`. On expiry the reducer folds to
  `turnEnd`. The interval is cleared on phase change/unmount.

#### (d) `phase === 'turnEnd'` — Turn summary
- SDK: `<TurnSummaryCard>` — team name/color, actor, "Correct: N", "Skipped: M",
  and a `<ScoreBoard>` mini showing all teams' running totals.
- `<PrimaryButton>`:
  - If game will continue → label "Next turn" → dispatch `END_TURN { now }`
    (reducer advances and sets `handoff`).
  - If this `END_TURN` would finish the game → reducer routes to `results`
    automatically; button label is "See results".
- Optional `<RecapList>` of prompts resolved this turn (correct vs skipped).

### 8.3 `ResultsScreen.tsx`

**Purpose:** celebrate the winner(s) and offer replay.

| Region | SDK UI component(s) | Behavior |
| --- | --- | --- |
| Winner banner | `<WinnerBanner>` + `<Confetti>` (framer-motion) | Shows winner team name(s)/color; handles ties ("It's a tie!"). Win SFX + haptic. |
| Final standings | `<ScoreBoard>` (sorted desc) | Each team: name, color, score, correct, skips. |
| Per-turn recap | `<RecapList>` from `state.history` | Collapsible list of every turn: team, actor, correct, skipped. |
| Actions | `<PrimaryButton>` "Play again" → `RESET` (or back to Setup with same teams); `<SecondaryButton>` "Change settings" → Setup; `<TextButton>` "Home" → exits to home grid via router. | Saving stats to Supabase (if signed in) is handled by the engine `results` primitive, not the game. |

ResultsScreen uses the **`results`** primitive for layout/scoreboard and optional
Supabase stat persistence; the game only supplies the data (standings, history).

---

## 9. Pass-and-Play Handoff & Secrecy (RevealGate)

This is the safety-critical part of Pantomime.

1. **Handoff buffer (`handoff` phase)** always precedes a reveal. The screen
   explicitly names who should take the phone. No prompt is fetched or rendered
   until the actor confirms (`HANDOFF_READY`). This prevents the previous holder
   from glimpsing the next prompt.
2. **RevealGate (`reveal` phase)** occludes the prompt completely until the actor
   acts. Implementation contract for the SDK `<RevealGate>`:
   - The secret value is **not painted** (kept behind an opaque cover / not in a
     readable layout) until the reveal gesture completes.
   - Reveal is an explicit, deliberate gesture (tap-and-hold or confirm), not a
     hover, so it can't trigger accidentally while passing.
   - The prompt is **only ever drawn into `deck.current` on `REVEAL_PROMPT`** —
     i.e. the prompt id does not exist in state until the actor reveals. So even
     a state inspector wouldn't leak the next prompt before reveal. (Until reveal,
     `deck.current` is `null`.)
3. **Acting phase visibility:** during `acting` the prompt is visible (the actor
   needs it), but the screen provides an instant **Hide/Pause** affordance that
   covers the prompt and pauses the timer — used if a guesser walks behind the
   actor or the phone must be set down face-up by accident.
4. **Backgrounding safety:** PlayScreen listens for `visibilitychange` / window
   `blur`. On hide while `acting`, dispatch `PAUSE { now }` and apply the opaque
   cover, so the prompt isn't left exposed if the app is switched away and back.
5. **No echo to guessers:** there is no separate guesser screen; the single
   device IS the actor's screen. Guessers simply watch the actor mime — the
   prompt text is only for the actor. SFX for Correct/Skip are fine (they don't
   leak the answer).

Sequence per turn:

```
handoff ──HANDOFF_READY──▶ reveal ──REVEAL_PROMPT──▶ acting
   ▲                                                   │
   │                          CORRECT/SKIP (loop, draw next) │
   │                                                   │ TIME_UP / deck empty
   │                                                   ▼
   └────────────── END_TURN ◀──────────────────── turnEnd
                       │ (if end & round complete)
                       ▼
                   results
```

---

## 10. Edge Cases

| # | Case | Handling |
| --- | --- | --- |
| 1 | Fewer than 4 players or <2 valid teams | SetupScreen blocks Start; manifest `minPlayers=4` enforced; team validator requires ≥2 teams each ≥2 members. |
| 2 | A team with only 1 member | Invalid; TeamBuilder shows error, Start disabled. |
| 3 | No prompts match filters (`promptIds.length === 0`) | SetupScreen shows inline error "No prompts for these categories/difficulties" and disables Start. Reducer also guards: if `createInitialState` gets empty `promptIds`, deck is empty and first `REVEAL_PROMPT` yields `current === null` → immediate `TIME_UP`/`turnEnd`. (Prevented at setup.) |
| 4 | Deck exhausted mid-turn (drawPile + discard empty of unresolved) | `drawNext` reshuffles discard back into draw (infinite recycling) so a turn never stalls for lack of prompts; the same prompt may recur in later turns. |
| 5 | Deck exhausted with truly zero items | `current=null`; `CORRECT`/`SKIP`/`REVEAL_PROMPT` fold to `TIME_UP` → `turnEnd`. |
| 6 | Skip cap reached | `SKIP` becomes a no-op; SkipButton disabled with "No skips left". |
| 7 | `skipPenalty` would push score below 0 | Floored at 0 (`max(0, score-1)`). |
| 8 | Timer expires between renders | `TICK` detects `elapsed >= durationMs` and folds to `TIME_UP`; also direct `TIME_UP` on blur. Idempotent: once phase ≠ `acting`, repeated `TICK`/`TIME_UP` are no-ops. |
| 9 | App backgrounded mid-turn | `PAUSE` on `visibilitychange`/`blur`; opaque cover; resume requires explicit `RESUME` tap. Timer math uses `elapsedBeforeMs` so no time is lost/gained. |
| 10 | `targetScore` reached early | `endRequested=true`, but the **round finishes** so all teams get equal turns before `FINISH_GAME`. |
| 11 | Tie at the end | `winnerTeamIds` holds all top-scoring teams; ResultsScreen shows shared win. |
| 12 | Unresolved current prompt at `TIME_UP` | The in-front prompt is returned to `drawPile` front (not counted, not lost). |
| 13 | Refresh / app reload mid-game | zustand `persist` rehydrates `PantomimeState`; timer recomputes remaining from `startedAt`/`elapsedBeforeMs` (or, if stale, treat as `PAUSE` on rehydrate for safety). |
| 14 | Dispatching an action in the wrong phase | Reducer guards each action by phase (see §6.3); invalid combos return state unchanged (no throw). |
| 15 | Player removed from roster after game started | Game uses snapshot in `state.teams`; roster edits don't affect an in-progress game. |
| 16 | RTL (fa) layout | All buttons/labels use logical utilities (ms-/me-/ps-/pe-/text-start/end); CountdownRing/score chips mirror correctly; prompt text renders with correct `dir`. |

---

## 11. SDK Primitives Consumed

| Primitive | Used for |
| --- | --- |
| `roster` | Source of players in SetupScreen. |
| `teams` | Build/validate 2–4 teams; team color/name. |
| `turnOrder` | Establish & (optionally) shuffle the order teams play in. |
| `timer` | Per-turn countdown; pause/resume; expiry; remaining-ms selector for `<CountdownRing>`. Reducer only sets flags; primitive computes remaining. |
| `deck` | Seeded shuffle, draw, discard, reshuffle of prompt **ids**. |
| `scoring` | Per-team score accumulation + standings sort for ScoreBoard. |
| `revealGate` | Secret prompt occlusion during `reveal` phase. |
| `phaseMachine` | Drives `handoff → reveal → acting → turnEnd → results`. |
| `results` | Results layout, scoreboard, optional Supabase stat persistence. |

Not used: `voting` (no voting mechanic in Pantomime).

UI components from `sdk/ui` referenced: `RosterPicker`, `TeamBuilder`,
`TurnOrderControl`, `ChipMultiSelect`, `SegmentedControl`, `Stepper`, `Toggle`,
`PrimaryButton`, `SecondaryButton`, `TextButton`, `HandoffCard`, `RevealGate`,
`PromptCard`, `HintDisclosure`, `CountdownRing`, `TimerControls`,
`CorrectButton`, `SkipButton`, `ScorePill`, `TurnSummaryCard`, `ScoreBoard`,
`RecapList`, `WinnerBanner`, `Confetti`. (If a named component does not exist in
the SDK, compose from the nearest generic — e.g. `CorrectButton`/`SkipButton`
are styled `PrimaryButton`s.)

---

## 12. File List & Responsibilities

```
src/games/pantomime/
  index.ts            // default-exports GameModule (wires manifest + screens + logic)
  manifest.ts         // GameManifest (id, names, icon, colors, min/max players, tags)
  logic.ts            // PURE createInitialState + reducer + helpers (seededShuffle, drawNext)
  logic.test.ts       // vitest unit tests for the reducer (see §13)
  content/
    types.ts          // PantomimePrompt, PantomimeDeckFile, category/difficulty types
    index.ts          // load+validate 4 decks, derive "mixed", selectPromptIds()
    movies.json        // bilingual prompts
    animals.json
    actions.json
    famous.json
  screens/
    SetupScreen.tsx    // config UI → builds PantomimeConfig → startGame
    PlayScreen.tsx     // phase-machine view: handoff/reveal/acting/turnEnd
    ResultsScreen.tsx  // winner + standings + recap + replay
```

### 12.1 `manifest.ts` sketch

```ts
import type { GameManifest } from '@/sdk/types';

export const manifest: GameManifest = {
  id: 'pantomime',
  name: { en: 'Pantomime', fa: 'پانتومیم' },
  tagline: { en: 'Act it out silently', fa: 'بی‌کلام اجرا کن' },
  description: {
    en: 'One actor mimes a prompt while their team races the clock to guess.',
    fa: 'یک بازیگر بی‌کلام سرنخ را اجرا می‌کند تا تیمش پیش از پایان زمان حدس بزند.',
  },
  icon: '🎭',
  accentColor: 'grape',          // design-token key
  minPlayers: 4,
  maxPlayers: 16,
  structure: 'teams',
  tags: ['party', 'teams', 'active', 'timed'],
  estimatedMinutes: 15,
};
```

### 12.2 `index.ts` sketch

```ts
import type { GameModule } from '@/sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer } from './logic';
import SetupScreen from './screens/SetupScreen';
import PlayScreen from './screens/PlayScreen';
import ResultsScreen from './screens/ResultsScreen';

const module: GameModule = {
  manifest,
  createInitialState,
  reducer,
  screens: { Setup: SetupScreen, Play: PlayScreen, Results: ResultsScreen },
};
export default module; // auto-discovered via import.meta.glob('./games/*/index.ts')
```

> Adding this folder is the **only** action needed to register the game — no
> shared file is edited (auto-discovery registry rule).

---

## 13. Unit Tests — `logic.test.ts`

All tests exercise the **pure** reducer with explicit `now`/`seed`. Use a fixed
config builder and fixed `promptIds` so shuffles are deterministic.

```ts
const cfg = makeConfig({
  promptIds: ['p1','p2','p3','p4','p5','p6'],
  shuffleSeed: 42,
  roundSeconds: 60,
  endMode: 'rounds', totalRounds: 2,
  maxSkipsPerTurn: 2, skipPenalty: false,
  teams: [teamA(['a1','a2']), teamB(['b1','b2'])],
});
```

### Required test cases

1. **createInitialState** — phase `handoff`; 2 teams; scores 0; `drawPile.length === 6`;
   `discardPile` empty; `current === null`; timer `idle`; `roundIndex 0`, `turnIndex 0`.
2. **Seeded shuffle is deterministic** — same `shuffleSeed` ⇒ identical `drawPile`
   order across two `createInitialState` calls; different seed ⇒ (generally) different.
3. **HANDOFF_READY** — `handoff → reveal`, nothing else changes.
4. **REVEAL_PROMPT draws + starts timer** — `reveal → acting`; `current` set to
   first draw-pile id; `drawPile` length −1; timer `running` with `startedAt===now`.
5. **CORRECT increments score & draws next** — active team `score 1`,
   `correctCount 1`, `turn.correctThisTurn 1`; previous `current` moved to
   `discardPile`; new `current` set; phase stays `acting`; timer still running.
6. **Multiple CORRECT in one turn** — three CORRECTs ⇒ score 3, `correctThisTurn 3`,
   discard has 3 ids.
7. **SKIP within cap** — `skipsThisTurn 1`, `skipCount 1`, score unchanged (no
   penalty), draws next, phase `acting`.
8. **SKIP cap reached is a no-op** — with `maxSkipsPerTurn:2`, the 3rd SKIP returns
   an unchanged state (same `current`, `skipsThisTurn` still 2).
9. **SKIP with skipPenalty** — penalty config: a SKIP after some score reduces
   score by 1; floored at 0 (skip at score 0 keeps score 0).
10. **TICK before expiry is no-op** — `now` such that elapsed < duration ⇒ state
    unchanged (deep-equal), phase still `acting`.
11. **TICK at/after expiry folds to TIME_UP** — `now = startedAt + durationMs` ⇒
    phase `turnEnd`; timer `expired`; a `PantomimeTurnRecord` appended to history
    with correct counters.
12. **TIME_UP returns unresolved current to drawPile front** — current id is back
    at `drawPile[0]`, not in discard, not counted.
13. **PAUSE/RESUME preserve elapsed** — PAUSE accumulates `elapsedBeforeMs`,
    clears `startedAt`; RESUME sets new `startedAt`; net remaining unchanged given
    consistent `now`s.
14. **END_TURN advances team & resets turn** — after team A's `turnEnd`, `END_TURN`
    ⇒ phase `handoff`, `activeTeamIndex 1`, `turnIndex 1`, turn counters reset.
15. **Actor cursor rotates per team** — team A's `actorCursor` goes 0→1 after its
    first completed turn; team B unaffected until its turn ends.
16. **Round increments on wrap** — after both teams play once, `roundIndex` becomes 1.
17. **targetScore end is deferred to round end** — with `endMode:'targetScore',
    targetScore:1`: team A scores 1 on its turn (sets `endRequested`), but
    `END_TURN` goes to `handoff` (team B still owes a turn); only after team B's
    `END_TURN` does it `FINISH_GAME`.
18. **rounds end** — with `totalRounds:2`, after both teams complete round index 1,
    game transitions to `results`.
19. **Winner resolution** — higher-score team in `winnerTeamIds` (length 1).
20. **Tie resolution** — equal scores ⇒ `winnerTeamIds` length 2; phase `results`.
21. **Deck reshuffle on exhaustion** — small `promptIds` (e.g. 2) with many CORRECTs
    ⇒ discard reshuffles into draw; `drawNext` never returns `null` while ids exist;
    resolved count exceeds initial pool.
22. **Empty deck guard** — `promptIds: []` ⇒ `REVEAL_PROMPT` yields `current null`
    and folds to `turnEnd` (no throw).
23. **Phase guards** — dispatching `CORRECT` in `handoff`, or `HANDOFF_READY` in
    `acting`, returns state unchanged (no throw).
24. **RESET restores initial** — after several actions, `RESET` deep-equals a fresh
    `createInitialState(state.config)`.
25. **Purity** — calling `reducer` does not mutate the input state object
    (snapshot the input, assert deep-equal after the call).

---

## 14. Animation, Sound & Haptics (hooks, not logic)

These live in the screen layer (never in the pure reducer):

- **Correct:** green flash on `<PromptCard>`, score pill bump (framer-motion
  spring), "ding" SFX (howler), success vibration (`navigator.vibrate(30)`).
- **Skip:** card slides out (logical-direction aware for RTL), "whoosh" SFX,
  light vibration.
- **Timer < 10s:** ring turns red + gentle pulse; tick SFX optional; warning
  haptic at expiry.
- **Reveal:** card flip-in on `REVEAL_PROMPT`.
- **Results:** confetti + win jingle.
- All SFX/haptics respect the **global mute** from the settings store.

---

## 15. i18n Keys (catalog, not content)

Namespace `games.pantomime.*` in `en`/`fa` catalogs. Examples:
`setup.title`, `setup.categories`, `setup.difficulty`, `setup.roundTime`,
`setup.endMode.targetScore`, `setup.endMode.rounds`, `setup.start`,
`setup.error.noPrompts`, `handoff.passTo`, `reveal.onlyActor`, `reveal.tap`,
`acting.showHint`, `acting.correct`, `acting.skip`, `acting.skipsLeft`,
`acting.pause`, `acting.resume`, `turnEnd.correct`, `turnEnd.skipped`,
`turnEnd.next`, `turnEnd.seeResults`, `results.winner`, `results.tie`,
`results.playAgain`, `results.standings`. **Prompt text is NEVER in catalogs** —
it comes from `content/*.json` and is selected by current language.
