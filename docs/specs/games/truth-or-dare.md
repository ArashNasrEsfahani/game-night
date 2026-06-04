# Game Spec — Truth or Dare (picker + prompt decks)

> Game ID: `truth-or-dare`
> Status: Ready to implement
> Conforms to: `docs/specs/00-architecture.md` (SDK contract — type and primitive names referenced here are the exact ones defined there)
> Last updated: 2026-06-04

A pass-and-play party classic. An animated **Spinner** lands on a player; that player chooses **Truth** or **Dare**; a prompt is revealed from the chosen deck; the player marks **Done** or **Skip**; play passes to the next player. Decks are bilingual (en/fa), tagged by **intensity** (mild / medium / spicy), and extensible via **custom decks**. Optional points reward completed dares (and optionally truths); the game can also run fully casual with no scoring and no end.

---

## 1. Player Range & Modes

| Aspect | Value |
| --- | --- |
| Players | **2–16** (`minPlayers: 2`, `maxPlayers: 16`) |
| Team mode | **None** — free-for-all (individuals). Does NOT consume the `teams` primitive. |
| Selection mode | `spinner` (animated wheel) **or** `sequential` (turnOrder rotation) |
| Scoring | Optional. `casual` (no points, endless) OR `points` (target-based or round-based end) |
| Device | Single shared phone, passed around (pass-and-play) |
| Secrecy | The prompt is shown openly to the group by default; an **optional RevealGate** ("private dare") can hide spicy prompts until the active player taps to reveal, for handing the phone to one person |

### Modes in detail

- **Spinner mode** — A colorful wheel with one wedge per active player. On `SPIN`, the wheel animates (seeded random rotation) and lands on `activePlayerId`. Pure logic only computes the landing target from a seed; the visual spin duration lives in the screen.
- **Sequential mode** — No wheel. The SDK `turnOrder` primitive provides the next player each round; the spinner UI is replaced by a "Next player: <name>" card.

Both modes converge on the same downstream phases (`choose -> reveal -> resolve`).

---

## 2. File Layout & Responsibilities

```
src/games/truth-or-dare/
  index.ts                  # default-exports the GameModule (manifest + logic + screens + content loader)
  manifest.ts               # GameManifest object (id, title, players, tags, intensities, icon, accent)
  logic.ts                  # PURE createInitialState(cfg) + reducer(state, action) — no clock/RNG/io
  logic.test.ts             # vitest unit tests for logic.ts
  config.ts                 # GameConfig type + DEFAULT_CONFIG + buildConfig() helpers (pure)
  content/
    truths.json             # built-in Truth deck (bilingual items, intensity-tagged)
    dares.json              # built-in Dare deck (bilingual items, intensity-tagged)
    index.ts                # loads + validates JSON, exports typed BuiltInDecks
  screens/
    SetupScreen.tsx         # roster + intensities + deck selection + mode + scoring options
    PlayScreen.tsx          # spinner/next-player + choose + reveal + resolve loop
    ResultsScreen.tsx       # leaderboard / session summary, replay & exit
  components/               # game-local presentational pieces (NOT engine primitives)
    Spinner.tsx             # framer-motion wheel; emits onLanded(playerId)
    PromptCard.tsx          # flip/reveal card for the prompt text
    ChoiceButtons.tsx       # Truth | Dare big buttons
```

### Responsibility rules (from architecture contract)

- `logic.ts` is **PURE**: `createInitialState(cfg)` and `reducer(state, action)` contain no `Date.now()`, no `Math.random()`, no I/O. All randomness enters via `action.payload.seed` (a number) produced by the screen using the SDK RNG helper.
- Screens never mutate state directly; they `dispatch(action)` via `GameContext` and render SDK UI + game-local components.
- Adding this game = adding this folder. The auto-discovery registry (`import.meta.glob('./games/*/index.ts', { eager: true })`) finds it. **No shared file is edited.**

---

## 3. Shared Types Consumed (from architecture)

```ts
// from src/sdk/types.ts
export type LocalizedString = { en: string; fa: string };

export interface Player {
  id: string;            // stable uuid from roster
  name: string;          // display name (user-entered, not localized)
  avatarColor: string;   // token-driven accent for chips/wedges
  emoji?: string;        // optional avatar emoji
}

export interface GameManifest {
  id: string;
  title: LocalizedString;
  description: LocalizedString;
  minPlayers: number;
  maxPlayers: number;
  estMinutes: [number, number];
  tags: string[];                 // e.g. ['party','spicy','no-equipment']
  accent: string;                 // theme token name for the card, e.g. 'accent-tod'
  icon: string;                   // icon id in /icons.svg sprite or emoji
  teamMode: 'none' | 'optional' | 'required';
  supportsCustomContent: boolean;
}

export interface GameModule<S, A, C> {
  manifest: GameManifest;
  createInitialState: (cfg: C, ctx: GameSeed) => S;
  reducer: (state: S, action: A) => S;
  SetupScreen: React.FC<GameScreenProps<S, A, C>>;
  PlayScreen: React.FC<GameScreenProps<S, A, C>>;
  ResultsScreen: React.FC<GameScreenProps<S, A, C>>;
  defaultConfig: C;
}

// GameContext is the runtime object screens receive (via useGameContext()):
// { state, dispatch, config, players, t, lang, dir, rng, sound, haptics, primitives, navigate }
```

`GameSeed` is `{ seed: number }` provided once at game start so `createInitialState` can deterministically shuffle without calling RNG itself.

---

## 4. SDK Primitives Consumed

This game **consumes** the following engine primitives via `GameContext.primitives` and SDK UI. It never reimplements them.

| Primitive | Used for |
| --- | --- |
| `roster` | Source of active `Player[]`; the SetupScreen reads roster, lets the user toggle who's playing. |
| `turnOrder` | In `sequential` mode: provides next player; in `spinner` mode: provides the candidate list and is advanced after each resolution to avoid back-to-back repeats (configurable). |
| `deck` | Draw-without-replacement engine for truths & dares (per-intensity filtering, reshuffle on exhaustion). The game holds two deck instances (truth, dare) as serialized deck state inside its own state. |
| `scoring` | Per-player score map + helpers (`addPoints`, `leaderboard()`); only engaged when `scoringMode === 'points'`. |
| `revealGate` | Optional secrecy gate that hides a prompt until the holder taps to reveal (for "private dare" mode). |
| `phaseMachine` | Drives the `idle -> spinning -> choosing -> revealing -> resolving -> (gameOver)` phase transitions; the reducer maps actions to phase changes via this primitive's allowed-transition table. |
| `results` | Standard results aggregation (per-player completed/skipped counts, final leaderboard) consumed by ResultsScreen. |
| `rng` (ctx) | Screen-side seeded RNG to generate the `seed` value passed into actions; logic stays pure. |
| `sound` / `haptics` (ctx) | Spin tick SFX, reveal whoosh, success/skip cues; vibration on land & reveal. Respect global mute. |

Explicitly **NOT** consumed: `teams`, `timer`, `voting` (Truth or Dare has no per-turn clock, no teams, no group vote). A future "dare timer" enhancement could opt into `timer`; out of scope here.

---

## 5. Content Schema

### 5.1 TypeScript types

```ts
// src/games/truth-or-dare/content/index.ts
import type { LocalizedString } from '../../../sdk/types';

export type Intensity = 'mild' | 'medium' | 'spicy';
export type PromptKind = 'truth' | 'dare';

export interface PromptItem {
  id: string;                 // stable, unique within its deck, kebab snake, e.g. 'truth-mild-001'
  kind: PromptKind;           // 'truth' | 'dare' (redundant with deck but enables merged custom decks)
  intensity: Intensity;
  text: LocalizedString;      // the prompt shown to the player
  tags?: string[];            // optional filters, e.g. ['icebreaker','physical','funny']
  minPlayers?: number;        // optional gate (e.g. dares needing >=3 people); default 2
  requiresProps?: boolean;    // true if it needs an object/phone/etc.; surfaced as a small icon
}

export interface DeckFile {
  schemaVersion: 1;
  deckId: string;             // 'builtin-truths' | 'builtin-dares' | custom uuid
  kind: PromptKind;
  title: LocalizedString;
  items: PromptItem[];
}

export interface BuiltInDecks {
  truths: DeckFile;
  dares: DeckFile;
}
```

### 5.2 Custom decks

- Custom decks are authored by users in the **Custom Content** area (shared app feature, not in this folder) and stored via `idb-keyval` (offline) and optionally synced to Supabase when signed in.
- A custom `DeckFile` has the **identical schema**. The game merges built-in + selected custom decks at config time into two combined pools (truth pool, dare pool), filtered by enabled intensities.
- `supportsCustomContent: true` in the manifest signals the Custom Content UI to allow creating decks for this game.
- Validation (in `content/index.ts` for built-ins; in the Custom Content importer for user decks): every item must have non-empty `text.en` AND `text.fa`, a valid `intensity`, and a unique `id` within its deck. Items failing validation are dropped with a console warning (built-ins must never fail in CI — see tests).

### 5.3 Sample bilingual content (≥12 items)

These ship in `content/truths.json` and `content/dares.json`. Persian strings are natural, idiomatic, and RTL-ready (no embedded LTR punctuation issues).

**`content/truths.json`** (excerpt)
```json
{
  "schemaVersion": 1,
  "deckId": "builtin-truths",
  "kind": "truth",
  "title": { "en": "Classic Truths", "fa": "حقیقت‌های کلاسیک" },
  "items": [
    {
      "id": "truth-mild-001", "kind": "truth", "intensity": "mild",
      "text": {
        "en": "What is the most embarrassing song on your playlist?",
        "fa": "خجالت‌آورترین آهنگی که توی پلی‌لیستت داری چیه؟"
      },
      "tags": ["funny", "icebreaker"]
    },
    {
      "id": "truth-mild-002", "kind": "truth", "intensity": "mild",
      "text": {
        "en": "If you could have any superpower, which would you pick and why?",
        "fa": "اگه می‌تونستی یه ابرقدرت داشته باشی، کدومو انتخاب می‌کردی و چرا؟"
      },
      "tags": ["icebreaker"]
    },
    {
      "id": "truth-mild-003", "kind": "truth", "intensity": "mild",
      "text": {
        "en": "What was your childhood nickname?",
        "fa": "اسم مستعار دوران بچگیت چی بود؟"
      },
      "tags": ["icebreaker"]
    },
    {
      "id": "truth-medium-001", "kind": "truth", "intensity": "medium",
      "text": {
        "en": "What is one thing you have never told anyone in this room?",
        "fa": "یه چیزی بگو که تا حالا به هیچ‌کس توی این جمع نگفتی."
      },
      "tags": ["deep"]
    },
    {
      "id": "truth-medium-002", "kind": "truth", "intensity": "medium",
      "text": {
        "en": "Who in this room would you trust with your phone unlocked for a day?",
        "fa": "بین آدمای این جمع، گوشی باز و آنلاکتو یه روز دست کی می‌سپردی؟"
      },
      "tags": ["group"], "minPlayers": 3
    },
    {
      "id": "truth-spicy-001", "kind": "truth", "intensity": "spicy",
      "text": {
        "en": "What is the boldest message you have ever sent to someone?",
        "fa": "جسورانه‌ترین پیامی که تا حالا برای کسی فرستادی چی بوده؟"
      },
      "tags": ["spicy"]
    }
  ]
}
```

**`content/dares.json`** (excerpt)
```json
{
  "schemaVersion": 1,
  "deckId": "builtin-dares",
  "kind": "dare",
  "title": { "en": "Classic Dares", "fa": "جرئت‌های کلاسیک" },
  "items": [
    {
      "id": "dare-mild-001", "kind": "dare", "intensity": "mild",
      "text": {
        "en": "Do your best impression of another player until someone guesses who it is.",
        "fa": "ادای یکی از بازیکن‌ها رو دربیار تا یکی حدس بزنه کیه."
      },
      "tags": ["funny", "physical"], "minPlayers": 3
    },
    {
      "id": "dare-mild-002", "kind": "dare", "intensity": "mild",
      "text": {
        "en": "Talk in a fake accent until it is your turn again.",
        "fa": "تا نوبت بعدیت با یه لهجهٔ ساختگی حرف بزن."
      },
      "tags": ["funny"]
    },
    {
      "id": "dare-mild-003", "kind": "dare", "intensity": "mild",
      "text": {
        "en": "Let the player on your right give you a new hairstyle with their hands.",
        "fa": "بذار نفر سمت راستت با دستاش یه مدل موی جدید برات درست کنه."
      },
      "tags": ["physical"], "minPlayers": 2
    },
    {
      "id": "dare-medium-001", "kind": "dare", "intensity": "medium",
      "text": {
        "en": "Call a contact and sing them happy birthday — even if it is not their birthday.",
        "fa": "به یکی از مخاطباتت زنگ بزن و براش تولدت مبارک بخون، حتی اگه تولدش نیست."
      },
      "tags": ["bold"], "requiresProps": true
    },
    {
      "id": "dare-medium-002", "kind": "dare", "intensity": "medium",
      "text": {
        "en": "Let the group post a single emoji as your status (you pick the app).",
        "fa": "بذار جمع یه ایموجی به‌عنوان استوریت بذاره (اپش با خودت)."
      },
      "tags": ["bold"], "requiresProps": true
    },
    {
      "id": "dare-spicy-001", "kind": "dare", "intensity": "spicy",
      "text": {
        "en": "Read aloud the last message you sent, in your most dramatic voice.",
        "fa": "آخرین پیامی که فرستادی رو با هیجانی‌ترین لحنت بلند بخون."
      },
      "tags": ["spicy"], "requiresProps": true
    }
  ]
}
```

> Total samples above: 6 truths + 6 dares = **12 bilingual items** spanning all three intensities for both kinds. The shipped files should contain many more (target ≥ 40 each) following these patterns.

---

## 6. GameConfig (all setup options)

```ts
// src/games/truth-or-dare/config.ts
import type { Intensity } from './content';

export type SelectionMode = 'spinner' | 'sequential';
export type ScoringMode = 'casual' | 'points';
export type EndCondition =
  | { type: 'endless' }                 // casual default; no end, manual stop
  | { type: 'rounds'; rounds: number }  // end after N full rotations
  | { type: 'target'; points: number }; // first to N points (points mode)

export interface ToDConfig {
  /** Subset of roster player ids participating (>= 2, <= 16). */
  playerIds: string[];

  /** Which intensities are in the draw pool. At least one must be true. */
  intensities: Record<Intensity, boolean>; // default { mild:true, medium:true, spicy:false }

  /** Deck selection. Built-ins always available; customDeckIds reference user decks. */
  useBuiltInTruths: boolean;   // default true
  useBuiltInDares: boolean;    // default true
  customDeckIds: string[];     // default []

  selectionMode: SelectionMode;     // default 'spinner'
  scoringMode: ScoringMode;         // default 'casual'

  /** Points awarded (only when scoringMode === 'points'). */
  pointsForDare: number;            // default 2
  pointsForTruth: number;           // default 1
  pointsForSkip: number;            // default 0 (can be negative as a penalty)

  endCondition: EndCondition;       // default { type: 'endless' }

  /** Force a Truth-or-Dare choice, or let players freely pick (always free here). */
  allowSkip: boolean;               // default true

  /** Secrecy: gate spicy (and optionally all) prompts behind a RevealGate tap. */
  privateReveal: 'never' | 'spicyOnly' | 'always'; // default 'never'

  /** Avoid the same player being picked twice in a row (spinner mode). */
  avoidImmediateRepeat: boolean;    // default true
}

export const DEFAULT_CONFIG: ToDConfig = {
  playerIds: [],
  intensities: { mild: true, medium: true, spicy: false },
  useBuiltInTruths: true,
  useBuiltInDares: true,
  customDeckIds: [],
  selectionMode: 'spinner',
  scoringMode: 'casual',
  pointsForDare: 2,
  pointsForTruth: 1,
  pointsForSkip: 0,
  endCondition: { type: 'endless' },
  allowSkip: true,
  privateReveal: 'never',
  avoidImmediateRepeat: true,
};
```

### Config validation (pure, in `config.ts`)

`validateConfig(cfg, roster): string[]` returns localizable error keys:
- `tod.err.tooFewPlayers` if `playerIds.length < 2`
- `tod.err.tooManyPlayers` if `playerIds.length > 16`
- `tod.err.noIntensity` if no intensity enabled
- `tod.err.noDeck` if neither built-in nor any custom deck selected for at least one kind
- `tod.err.emptyTruthPool` / `tod.err.emptyDarePool` if the filtered pool for a kind is empty given the enabled intensities
- `tod.err.targetTooLow` if `endCondition.type === 'target'` and `points < 1`

---

## 7. State Shape

```ts
// src/games/truth-or-dare/logic.ts
import type { Intensity, PromptItem, PromptKind } from './content';
import type { ToDConfig, EndCondition } from './config';
import type { DeckState } from '../../sdk/primitives/deck';
import type { ScoreState } from '../../sdk/primitives/scoring';
import type { RevealGateState } from '../../sdk/primitives/revealGate';

export type Phase =
  | 'idle'        // waiting to spin / show next player
  | 'spinning'    // wheel animating (spinner mode only)
  | 'choosing'    // active player picks Truth or Dare
  | 'revealing'   // prompt drawn; possibly behind RevealGate
  | 'resolving'   // prompt shown; awaiting Done/Skip
  | 'gameOver';   // end condition met

export type Outcome = 'done' | 'skip';

export interface TurnRecord {
  turnIndex: number;
  playerId: string;
  kind: PromptKind;          // chosen Truth/Dare
  promptId: string;
  intensity: Intensity;
  outcome: Outcome;
  pointsDelta: number;       // points awarded this turn (0 in casual)
}

export interface ToDState {
  config: ToDConfig;
  phase: Phase;

  /** Ordered participating player ids (frozen subset of roster at start). */
  playerIds: string[];

  /** Whose turn it is now (null only before first spin in fresh idle). */
  activePlayerId: string | null;

  /** Last picked player id, for avoidImmediateRepeat. */
  lastPlayerId: string | null;

  /** The choice the active player made this turn. */
  currentKind: PromptKind | null;

  /** The drawn prompt awaiting resolution. */
  currentPrompt: PromptItem | null;

  /** Two serialized deck instances (draw-without-replacement). */
  truthDeck: DeckState<PromptItem>;
  dareDeck: DeckState<PromptItem>;

  /** Scoring sub-state (only mutated in points mode). */
  scores: ScoreState;        // playerId -> number

  /** Optional secrecy gate state; null when not gating this prompt. */
  reveal: RevealGateState | null;

  /** Counters. */
  turnIndex: number;         // total turns resolved
  roundIndex: number;        // completed full rotations (turnIndex / playerCount)
  spinSerial: number;        // increments each spin → React key for re-mount/animation

  /** Append-only history for results + undo. */
  history: TurnRecord[];

  /** Set when phase === 'gameOver'. */
  endReason: EndCondition['type'] | null;
}
```

### `createInitialState(cfg, { seed }): ToDState`

Pure. Steps:
1. Build truth pool = (built-in truths if enabled) + (selected custom truth decks), filtered by `cfg.intensities` and `minPlayers <= cfg.playerIds.length`.
2. Build dare pool likewise.
3. `truthDeck = deck.create(truthPool, seed)`, `dareDeck = deck.create(darePool, seed ^ 0x9e3779b9)` (derive a second seed so the two shuffles differ deterministically).
4. `scores = scoring.create(cfg.playerIds)` (all zero).
5. `phase = 'idle'`, `activePlayerId = null`, `lastPlayerId = null`, all current* null, counters 0, history `[]`, `endReason = null`.

> All shuffling uses the SDK `deck` primitive seeded from the passed `seed`; `createInitialState` itself calls no RNG.

---

## 8. Actions & Reducer Transitions

Action union:

```ts
export type ToDAction =
  | { type: 'SPIN'; seed: number }                       // spinner mode: pick active player
  | { type: 'SPIN_LANDED'; playerId: string }            // wheel finished → commit landing
  | { type: 'NEXT_PLAYER' }                              // sequential mode: advance turnOrder
  | { type: 'CHOOSE'; kind: PromptKind; seed: number }   // active player picks Truth/Dare; seed for draw
  | { type: 'REVEAL' }                                   // RevealGate: holder taps to show prompt
  | { type: 'RESOLVE'; outcome: Outcome }                // Done / Skip → score + record
  | { type: 'REDRAW'; seed: number }                     // optional: draw a different prompt, same kind
  | { type: 'UNDO' }                                     // revert the last resolved turn
  | { type: 'END_GAME' }                                 // manual end (casual/endless)
  | { type: 'RESET'; seed: number };                     // restart whole session with same config
```

### Transition table

| Action | Valid in phase | Effect | New phase |
| --- | --- | --- | --- |
| `SPIN` | `idle` (spinner mode) | Compute landing target deterministically from `seed` over eligible players (exclude `lastPlayerId` if `avoidImmediateRepeat` and >1 player). Increment `spinSerial`. Store pending target internally via the `SPIN_LANDED` follow-up. | `spinning` |
| `SPIN_LANDED` | `spinning` | Set `activePlayerId = payload.playerId`, `lastPlayerId = previous active`. Clear `currentKind/currentPrompt`. | `choosing` |
| `NEXT_PLAYER` | `idle` (sequential mode) | `activePlayerId = turnOrder.next(playerIds, lastPlayerId)`; set `lastPlayerId`. Increment `spinSerial` (for consistent keying). | `choosing` |
| `CHOOSE` | `choosing` | Set `currentKind = kind`. Draw from the matching deck: `deck.draw(deckState, seed)` → `currentPrompt`; persist updated `DeckState`. If pool exhausted, deck reshuffles (see edge cases). Decide gating: if `privateReveal === 'always'` OR (`'spicyOnly'` && prompt.intensity === 'spicy'), create `reveal = revealGate.create()`; else `reveal = null`. | `revealGate ? 'revealing' : 'resolving'` |
| `REVEAL` | `revealing` | `reveal = revealGate.reveal(reveal)`. | `resolving` |
| `REDRAW` | `revealing` \| `resolving` | Draw another prompt of `currentKind` with new `seed` (puts current prompt back / discards per deck policy); re-evaluate gating. Bounded by a soft cap surfaced in UI (no logic limit). | `revealing` or `resolving` (same rule as CHOOSE) |
| `RESOLVE` | `resolving` (or `revealing` if `allowSkip` lets skip-before-reveal — see note) | Compute `pointsDelta` (points mode: done→ kind==='dare'?pointsForDare:pointsForTruth; skip→pointsForSkip; casual→0). Apply via `scoring.add`. Push `TurnRecord` to `history`. `turnIndex++`; if `turnIndex % playerCount === 0` then `roundIndex++`. Clear `currentKind/currentPrompt/reveal`. Evaluate end condition (see §9). | `gameOver` if ended, else `idle` |
| `UNDO` | any non-`idle` after ≥1 resolved turn, OR `gameOver` | Pop last `TurnRecord`; subtract its `pointsDelta`; restore the deck (return prompt to deck via `deck.undoDraw`); decrement counters; set `activePlayerId` back to that record's player; `endReason = null`. | `resolving` (re-show that prompt) |
| `END_GAME` | any except `gameOver` | Set `endReason = 'endless'` (manual). | `gameOver` |
| `RESET` | any | Return `createInitialState(config, { seed })`. | `idle` |

**Invalid action in a wrong phase = no-op** (reducer returns `state` unchanged). This keeps the reducer total and testable.

**Skip-before-reveal note:** When a gated (private) prompt is in `revealing` and `allowSkip` is true, the UI may offer "Skip without revealing." That dispatches `RESOLVE { outcome: 'skip' }`; the reducer accepts `RESOLVE` from `revealing` only when `outcome === 'skip'` (you cannot mark Done something you never revealed).

### Reducer sketch (key branches)

```ts
export function reducer(state: ToDState, action: ToDAction): ToDState {
  switch (action.type) {
    case 'SPIN': {
      if (state.phase !== 'idle' || state.config.selectionMode !== 'spinner') return state;
      return { ...state, phase: 'spinning', spinSerial: state.spinSerial + 1 };
    }
    case 'SPIN_LANDED': {
      if (state.phase !== 'spinning') return state;
      return {
        ...state, phase: 'choosing',
        lastPlayerId: state.activePlayerId,
        activePlayerId: action.playerId,
        currentKind: null, currentPrompt: null, reveal: null,
      };
    }
    case 'CHOOSE': {
      if (state.phase !== 'choosing' || !state.activePlayerId) return state;
      const deckKey = action.kind === 'truth' ? 'truthDeck' : 'dareDeck';
      const { item, next } = deckPrim.draw(state[deckKey], action.seed);
      const gate = shouldGate(state.config, item) ? revealGatePrim.create() : null;
      return {
        ...state,
        currentKind: action.kind,
        currentPrompt: item,
        [deckKey]: next,
        reveal: gate,
        phase: gate ? 'revealing' : 'resolving',
      };
    }
    case 'RESOLVE': {
      const okPhase =
        state.phase === 'resolving' ||
        (state.phase === 'revealing' && action.outcome === 'skip');
      if (!okPhase || !state.activePlayerId || !state.currentKind || !state.currentPrompt) return state;
      const delta = computeDelta(state.config, state.currentKind, action.outcome);
      const scores = scoringPrim.add(state.scores, state.activePlayerId, delta);
      const rec: TurnRecord = {
        turnIndex: state.turnIndex,
        playerId: state.activePlayerId,
        kind: state.currentKind,
        promptId: state.currentPrompt.id,
        intensity: state.currentPrompt.intensity,
        outcome: action.outcome,
        pointsDelta: delta,
      };
      const turnIndex = state.turnIndex + 1;
      const roundIndex = turnIndex % state.playerIds.length === 0
        ? state.roundIndex + 1 : state.roundIndex;
      const ended = evalEnd(state.config, { scores, roundIndex, activePlayerId: state.activePlayerId });
      return {
        ...state, scores,
        history: [...state.history, rec],
        turnIndex, roundIndex,
        currentKind: null, currentPrompt: null, reveal: null,
        phase: ended ? 'gameOver' : 'idle',
        endReason: ended ?? null,
      };
    }
    // ...NEXT_PLAYER, REVEAL, REDRAW, UNDO, END_GAME, RESET
    default: return state;
  }
}
```

Helpers `shouldGate`, `computeDelta`, `evalEnd`, `pickSpinTarget(state, seed)` are pure and unit-tested.

---

## 9. Win / Scoring Rules

- **Casual mode (`scoringMode: 'casual'`)** — no points. Default `endCondition` is `endless`; the game ends only when a player taps **End Game** (`END_GAME`). Results show participation stats (turns taken, dares vs truths, skips), no winner. If config sets `rounds`, casual can still auto-end after N rounds, still without a winner.
- **Points mode (`scoringMode: 'points'`)** — each resolution applies a delta:
  - Done + Dare → `pointsForDare` (default 2)
  - Done + Truth → `pointsForTruth` (default 1)
  - Skip → `pointsForSkip` (default 0; may be negative)
- **End conditions** (`evalEnd`):
  - `endless` → never auto-ends (except `END_GAME`).
  - `rounds: N` → ends when `roundIndex >= N` (i.e., after the action that completes the Nth full rotation).
  - `target: P` → ends when any player's score `>= P` after a resolution.
- **Winner** (points mode only): highest score in `scores`. Ties → all tied players are co-winners (`results.leaderboard()` returns sorted desc; ResultsScreen highlights all with max). Casual mode reports no winner.

---

## 10. Screen-by-Screen Breakdown

All screens receive `GameScreenProps = { ctx: GameContext }` and pull `state, dispatch, config, players, t, dir, sound, haptics, rng` from `ctx`. All text via `t()`; layout uses logical utilities (`ms-*/me-*/text-start`) and `rtl:`/`ltr:` variants; `dir` already set on `<html>`.

### 10.1 SetupScreen

Purpose: configure a session before the first spin. Dispatches nothing into the game reducer; instead builds a `ToDConfig` and calls `ctx.startGame(config)` (SDK helper that runs `createInitialState` with a fresh `rng.seed()` and routes to PlayScreen).

On screen:
- **Header** — game title + estimated time chip. SDK `<ScreenHeader>`.
- **Roster selector** — SDK `<RosterPicker>` bound to `roster` primitive: chips for every saved player with checkboxes; "Add player" inline; saved-group quick-load. Selecting toggles membership of `playerIds`. Shows count `n/16` and a min-2 warning. (SDK component; emits selected ids.)
- **Intensity toggles** — SDK `<SegmentedToggleGroup>` of three pills (Mild / Medium / Spicy), each multi-select on/off; spicy pill carries a small flame icon and a content-warning tooltip. At least one required.
- **Deck selection** — SDK `<ChecklistGroup>`: "Built-in Truths", "Built-in Dares", plus any custom decks for this game (from Custom Content store). Each row shows item count after intensity filter.
- **Selection mode** — SDK `<SegmentedControl>` Spinner | Sequential (icons: wheel / list).
- **Scoring** — SDK `<SegmentedControl>` Casual | Points. When Points: reveal a small form (SDK `<Stepper>` controls) for `pointsForDare`, `pointsForTruth`, `pointsForSkip`, and an `<RadioGroup>` for end condition (Endless / N rounds with stepper / First to P points with stepper).
- **Secrecy** — SDK `<RadioGroup>` for `privateReveal`: Off / Spicy only / Always (with a one-line explainer about handing the phone over).
- **Advanced (collapsible)** — `<Switch>` for `avoidImmediateRepeat`, `<Switch>` for `allowSkip`.
- **Validation banner** — SDK `<InlineAlert>` rendering `validateConfig()` error keys via `t()`.
- **Start button** — SDK `<PrimaryButton>`; disabled while validation errors exist. On tap → `ctx.startGame(buildConfig(form))`.

Controls → actions: none into the game reducer (setup precedes state creation). Start triggers `createInitialState`.

### 10.2 PlayScreen

The core loop, rendered by `phase`. Uses framer-motion for transitions; SFX/haptics on key events.

Common chrome:
- SDK `<ScreenHeader>` with: mute toggle (global), score pill (points mode) or turn counter (casual), overflow menu (Undo / End game / Restart → dispatch `UNDO` / `END_GAME` / `RESET`).
- SDK `<PlayerStrip>` showing all participants; active player highlighted with `avatarColor`.

By phase:

- **`idle`**
  - Spinner mode: game-local `<Spinner players={participants} />` (one colored wedge per player) + a big SDK `<PrimaryButton>` "Spin". Tap → `dispatch({ type:'SPIN', seed: rng.seed() })`; play `sfx.spinStart`; on animation end the component calls `onLanded(id)` → `dispatch({ type:'SPIN_LANDED', playerId:id })`; haptic pulse + `sfx.land`. (The landing id is computed by the component from the same logic helper `pickSpinTarget(state, seed)` so the wheel and reducer agree — the screen passes the seed; the helper is exported from `logic.ts`.)
  - Sequential mode: a "Next up" card with the next player's name (peeked via `turnOrder`); SDK `<PrimaryButton>` "Next player" → `dispatch({ type:'NEXT_PLAYER' })`.

- **`spinning`** — wheel animates; controls disabled. Tick SFX loop. No user actions accepted (reducer ignores them).

- **`choosing`**
  - Big banner "<Name>, your turn!" with the active player's color.
  - game-local `<ChoiceButtons>`: two large buttons **Truth** (calm color) and **Dare** (hot color). Tap Truth → `dispatch({ type:'CHOOSE', kind:'truth', seed: rng.seed() })`; Dare likewise. `sfx.choose`, haptic tick.

- **`revealing`** (only when gated)
  - SDK `<RevealGate>` component bound to `state.reveal`: a covered card reading "Pass the phone to <Name>. Tap to reveal — others, look away." A **Reveal** button → `dispatch({ type:'REVEAL' })`. If `allowSkip`, a secondary "Skip" → `dispatch({ type:'RESOLVE', outcome:'skip' })`. `sfx.whoosh` on reveal; haptic.

- **`resolving`**
  - game-local `<PromptCard>` showing `currentPrompt.text[lang]`, an intensity badge, and a props icon if `requiresProps`. Flip-in animation.
  - SDK action row: **Done** (success) → `dispatch({ type:'RESOLVE', outcome:'done' })`; **Skip** (if `allowSkip`) → `outcome:'skip'`; **Redraw** (ghost button) → `dispatch({ type:'REDRAW', seed: rng.seed() })`. `sfx.success` / `sfx.skip` accordingly; success haptic on Done.

- **`gameOver`** — auto-navigates to ResultsScreen (`ctx.navigate('results')`), or renders a "See results" button.

### 10.3 ResultsScreen

Consumes the `results` primitive over `state.history` + `state.scores`.

On screen:
- SDK `<ScreenHeader>` "Results".
- **Points mode:** SDK `<Leaderboard>` (sorted desc, co-winners crowned, confetti via framer-motion + `sfx.win`). Each row: player chip, score, mini-stats (dares done / truths done / skips).
- **Casual mode:** SDK `<StatsGrid>` summary: total turns, truths vs dares ratio, most-dared player, skip count — no winner.
- **Spiciest moment** card: highlights the highest-intensity completed prompt from history (fun flavor).
- Action row: SDK `<PrimaryButton>` **Play again** → `dispatch({ type:'RESET', seed: rng.seed() })` then `ctx.navigate('play')`; `<SecondaryButton>` **New setup** → `ctx.navigate('setup')`; `<GhostButton>` **Home** → `ctx.navigate('home')`.

---

## 11. Pass-and-Play Handoff & Secrecy (RevealGate)

Truth or Dare is mostly **open** (the whole group hears the prompt), so secrecy is opt-in:

- Default `privateReveal: 'never'` — prompts show immediately in `resolving`; the phone stays visible to all.
- `'spicyOnly'` — only `intensity === 'spicy'` prompts enter the `revealing` phase behind a `<RevealGate>`. Use case: a spicy dare meant for one person to read privately and then act on.
- `'always'` — every prompt is gated; good for a more theatrical "pass the phone" cadence.

RevealGate flow (driven by `revealGate` primitive):
1. After `CHOOSE`, if gating applies, `reveal = revealGate.create()` and phase → `revealing`.
2. Screen shows a neutral cover with the active player's name: "Pass to <Name>." No prompt text is in the DOM until revealed (the primitive exposes `isRevealed`; the screen conditionally renders the text), preventing shoulder-surfing and avoiding leaking via DOM inspection.
3. Holder taps **Reveal** → `REVEAL` → `revealGate.reveal` → phase `resolving`, prompt rendered.
4. Optional "Skip without revealing" keeps the prompt secret (records a skip).

Handoff cues: on entering `choosing` and `revealing`, fire a short haptic + soft chime so whoever holds the phone knows to pass it. The `<PlayerStrip>` and big name banner make the target unambiguous.

---

## 12. Edge Cases

1. **Deck exhaustion** — `deck.draw` on an empty draw pile auto-reshuffles the discard back in (excluding the just-drawn item when possible). If a kind's pool has only 1 item, every draw returns it; `avoidImmediateRepeat` does not apply to prompts (only to player picks). Surfaced subtly: a "deck reshuffled" toast.
2. **Empty pool after filtering** — caught at setup by `validateConfig` (`emptyTruthPool`/`emptyDarePool`); Start is disabled, so the reducer never faces an empty deck.
3. **2-player game + `avoidImmediateRepeat`** — with 2 players the constraint forces strict alternation; with 1 eligible player remaining (the other was last) the helper still picks the only other player. Never deadlocks.
4. **Single eligible player** can't occur (min 2), but `pickSpinTarget` defensively falls back to including `lastPlayerId` if exclusion empties the candidate set.
5. **Player removed mid-session** — roster is **frozen** into `state.playerIds` at start; mid-game roster edits do not affect an active session (prevents index drift). Changing players requires New Setup.
6. **`minPlayers` on a prompt** — items whose `minPlayers > playerIds.length` are filtered out of the pool at `createInitialState`, so they never appear.
7. **Skip a gated prompt** — allowed only as `RESOLVE { outcome:'skip' }` from `revealing`; `outcome:'done'` from `revealing` is a no-op (can't complete an unseen prompt).
8. **Undo across game end** — `UNDO` from `gameOver` reverts the final turn, clears `endReason`, returns to `resolving`. `RESET` always available.
9. **Redraw loop** — no hard limit (some prompts may be props-required and unwanted); each redraw consumes from the deck and may reshuffle. UI may show a soft "tried N" hint but logic imposes no cap.
10. **Negative scores** — `pointsForSkip` can be negative; scores may go below zero. Leaderboard handles negatives; no clamping.
11. **Target reached on a skip with negative skip points** — `evalEnd` only ends on `target` when some score `>= P`; a skip that lowers a score won't end the game, which is correct.
12. **Mute / haptics off** — all `sound`/`haptics` calls go through ctx helpers that respect the global mute store; no-ops when muted. Logic never touches sound.
13. **RTL** — Persian content renders right-to-left; the spinner wedge text and prompt card use logical alignment; the wheel rotation direction is visual-only and identical in both directions.
14. **Re-mount / refresh mid-game** — game state lives in the SDK game-session store with zustand `persist`; on reload the same `ToDState` rehydrates (decks, history, phase). `spinSerial` keys the wheel so animations don't replay stale.

---

## 13. Unit Tests — `logic.test.ts`

Pure-function tests (no React, no timers, no real RNG — seeds are fixed integers). Each row is at least one `it()`.

**createInitialState**
1. Produces `phase==='idle'`, null active/current, empty history, zeroed scores for all `playerIds`.
2. Filters truth/dare pools by enabled intensities (spicy off → no spicy items in either deck).
3. Filters out prompts whose `minPlayers > playerIds.length`.
4. Truth and dare decks get different shuffles for the same base seed (derived second seed).
5. Includes selected custom decks merged with built-ins; respects `useBuiltIn*` flags.

**SPIN / SPIN_LANDED / NEXT_PLAYER**
6. `SPIN` from `idle` (spinner mode) → `phase==='spinning'`, `spinSerial` incremented.
7. `SPIN` ignored when `selectionMode==='sequential'` (no-op) and when not in `idle`.
8. `SPIN_LANDED` sets `activePlayerId`, moves old active into `lastPlayerId`, phase → `choosing`.
9. `pickSpinTarget` excludes `lastPlayerId` when `avoidImmediateRepeat` and >1 candidate; is deterministic for a fixed seed.
10. `pickSpinTarget` falls back to including `lastPlayerId` when it is the only candidate.
11. `NEXT_PLAYER` (sequential) advances `turnOrder` correctly and wraps; updates `lastPlayerId`; phase → `choosing`.

**CHOOSE**
12. `CHOOSE truth` draws from truthDeck, sets `currentKind/currentPrompt`, advances deck state, phase → `resolving` when not gated.
13. `CHOOSE` sets phase → `revealing` and creates `reveal` when `privateReveal:'always'`.
14. `CHOOSE` with `privateReveal:'spicyOnly'` gates only when drawn prompt is spicy (test both gated and non-gated by seeding draws).
15. Same seed → same drawn prompt (determinism).
16. `CHOOSE` ignored outside `choosing`.

**REVEAL**
17. `REVEAL` from `revealing` flips gate and phase → `resolving`; no-op elsewhere.

**RESOLVE — scoring**
18. Points mode: Done+Dare adds `pointsForDare`; Done+Truth adds `pointsForTruth`; Skip adds `pointsForSkip`.
19. Casual mode: `pointsDelta===0` regardless of outcome; scores stay zero.
20. Negative `pointsForSkip` decreases score (can go below zero).
21. `RESOLVE` pushes a correct `TurnRecord` (ids, intensity, outcome, delta) and increments `turnIndex`.
22. `roundIndex` increments only when `turnIndex % playerCount === 0`.
23. `RESOLVE done` is a no-op from `revealing` (must reveal first); `RESOLVE skip` IS allowed from `revealing`.
24. After resolve, current* and reveal are cleared and phase → `idle` (when not ended).

**End conditions**
25. `rounds: N` → game over exactly after the resolve completing the Nth rotation; `endReason==='rounds'`.
26. `target: P` → game over when a player reaches `>= P`; `endReason==='target'`.
27. `endless` → never auto-ends across many resolves.
28. `END_GAME` from any non-gameOver phase → `gameOver`, `endReason` set; ignored when already `gameOver`.

**REDRAW**
29. `REDRAW` draws a different/again prompt of `currentKind`, updates deck, re-evaluates gating.

**UNDO**
30. `UNDO` after one resolved turn: pops history, subtracts `pointsDelta`, restores deck draw, restores `activePlayerId`, decrements counters, phase → `resolving`.
31. `UNDO` from `gameOver` clears `endReason` and reverts the final turn.
32. `UNDO` with empty history is a no-op.

**Deck behavior**
33. Drawing past pool size reshuffles (no crash, returns valid item) — drive by drawing pool.length+1 times.
34. Single-item pool always returns that item; no exception.

**RESET & purity**
35. `RESET` returns a state deep-equal to a fresh `createInitialState(config, {seed})`.
36. Unknown/invalid actions return the same state reference (total reducer).
37. Reducer does not mutate input (freeze input with `Object.freeze` / structural-equality check on a clone).

**validateConfig (config.test or here)**
38. Flags tooFew/tooMany players, noIntensity, noDeck, emptyTruthPool/emptyDarePool, targetTooLow appropriately.

---

## 14. Manifest

```ts
// src/games/truth-or-dare/manifest.ts
import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'truth-or-dare',
  title: { en: 'Truth or Dare', fa: 'جرئت یا حقیقت' },
  description: {
    en: 'Spin, pick Truth or Dare, and reveal a prompt. Pass the phone around!',
    fa: 'بچرخون، جرئت یا حقیقت رو انتخاب کن و سؤال یا چالش رو ببین. گوشی رو دست‌به‌دست کن!',
  },
  minPlayers: 2,
  maxPlayers: 16,
  estMinutes: [10, 40],
  tags: ['party', 'spicy', 'no-equipment', 'pass-and-play'],
  accent: 'accent-tod',          // @theme token defined in CSS
  icon: 'tod',                   // /icons.svg sprite id (fallback emoji 🎯 / 🌶️)
  teamMode: 'none',
  supportsCustomContent: true,
};
```

## 15. index.ts (module wiring)

```ts
// src/games/truth-or-dare/index.ts
import type { GameModule } from '../../sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer } from './logic';
import { DEFAULT_CONFIG, type ToDConfig } from './config';
import type { ToDState, ToDAction } from './logic';
import SetupScreen from './screens/SetupScreen';
import PlayScreen from './screens/PlayScreen';
import ResultsScreen from './screens/ResultsScreen';

const mod: GameModule<ToDState, ToDAction, ToDConfig> = {
  manifest,
  createInitialState,
  reducer,
  SetupScreen,
  PlayScreen,
  ResultsScreen,
  defaultConfig: DEFAULT_CONFIG,
};

export default mod;
```

---

## 16. Theme & i18n Notes

- Add `--color-accent-tod` and its on-color to the app `@theme` block in CSS (Tailwind v4 CSS-first). The game card uses `bg-accent-tod`/`text-accent-tod-foreground` logical classes. (Token only; defined in the shared theme CSS the same way every game's accent is — adding the token is part of theme setup, not a per-game shared-file edit of code.)
- UI strings (buttons, labels, errors `tod.err.*`, phase banners) live in the i18n catalogs `src/i18n/en.json` & `fa.json` under a `tod.*` namespace. Game **content** (prompts) stays in `content/*.json` as bilingual data — never in i18n catalogs.
- All copy renders via `t()`; numbers/counters use locale-aware formatting; layout uses logical properties so RTL works without per-component overrides.
