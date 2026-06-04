# Game Spec — Most Likely To (point at a player)

**Game ID:** `most-likely-to`
**Category:** Social / Party / Voting
**Status:** Approved for implementation
**Conforms to:** `docs/specs/00-architecture.md` (SDK contract, type names, primitive names)

> One phone, passed around. A "Most likely to…" prompt appears, every player votes **for a player**, and the app reveals who got the most votes. Repeat for a deck of prompts, then optionally crown an overall winner.

---

## 1. Summary & Design Intent

Most Likely To is a **free-for-all** social-judgement game. There are no teams and no turn order in the usual sense — every player participates in every round by casting **one vote per round for another player** (or, in a config option, including themselves). The fun is purely social: prompts range from wholesome to spicy via an **intensity** setting, and the reveal is the punchline.

Two voting styles are supported, both true to **pass-and-play on one device**:

1. **Pass-device taps** (default, fully secret): the phone is handed to each player in turn; each player privately taps the player they're voting for behind a **RevealGate**, then passes on. Nobody sees others' individual votes.
2. **Simultaneous count** (fast, public): everyone points/shouts at once and one operator enters the **tally** (number of votes each player received) on a single screen. Faster for big, rowdy groups; not secret.

The game is intentionally lightweight: it leans almost entirely on shared SDK primitives (`roster`, `deck`, `voting`, `revealGate`, `phaseMachine`, `results`) and adds only the thin glue of "a vote targets a player".

---

## 2. Player Range & Modes

| Property | Value |
| --- | --- |
| Min players | **3** |
| Max players | **20** |
| Recommended | 4–10 |
| Mode | **Free-for-all** (no teams, no turn order) |
| Roster source | Shared app roster (players set up once, reused across games) |

**Why min 3:** With 2 players a "most likely to" vote is degenerate (each can only point at the other, or themselves). The reveal needs at least a 3-way choice to be interesting. The SDK `roster` primitive enforces min/max via `manifest.minPlayers` / `manifest.maxPlayers`; SetupScreen blocks "Start" below 3.

**Self-voting:** Off by default (`allowSelfVote: false`). When off, a player cannot vote for themselves in pass-device mode (their own card is disabled). When on, self-votes are allowed.

---

## 3. Content Schema

Game CONTENT lives as **bilingual JSON data files** in `src/games/most-likely-to/content/`. UI strings (buttons, labels) live in the i18n catalogs, NOT here. Content is the prompt deck only.

### 3.1 Types

```ts
// Shared SDK type (from 00-architecture.md), repeated here for reference:
// export interface LocalizedString { en: string; fa: string }

/** Intensity tiers, ordered from mildest to spiciest. */
export type Intensity = 'family' | 'casual' | 'spicy';

/** A single "Most likely to…" prompt. */
export interface MltPrompt {
  /** Stable unique id, kebab-case, never reused/renumbered. Used for dedupe + history. */
  id: string;
  /** The prompt text. Phrased to complete "…is most likely to …". */
  text: LocalizedString;
  /** Intensity tier this prompt belongs to. */
  intensity: Intensity;
  /** Optional thematic tags for future filtering (e.g. "travel", "work"). Not used by logic v1. */
  tags?: string[];
  /** Optional emoji shown beside the prompt for color/playfulness. */
  emoji?: string;
}

/** A named, shippable deck of prompts. */
export interface MltDeck {
  /** Stable deck id, kebab-case. */
  id: string;
  /** Display name. */
  name: LocalizedString;
  /** Short description for the deck picker. */
  description: LocalizedString;
  /** Schema/content version, bumped when items change, for cache + sync. */
  version: number;
  /** Prompts. A deck MAY mix intensities; selected intensity filters at runtime. */
  prompts: MltPrompt[];
}
```

### 3.2 Files

```
content/
  decks.ts          // imports the JSON files, default-exports MltDeck[] (typed)
  classic.json      // the bundled "Classic" deck (MltDeck)
  spicy.json        // the bundled "Night Out" deck (mostly spicy/casual)
```

- `decks.ts` is the single import surface: `import decks from './content/decks'`. It validates (dev-only assertion) that all `prompt.id` are unique across decks.
- Custom user decks (sign-in / IndexedDB) are merged in at runtime by the SDK content layer, NOT hardcoded here. v1 ships only bundled decks.

### 3.3 Sample Content (≥12 bilingual items)

Below is `classic.json` (abbreviated to representative items across all three intensities). All Persian strings are natural, idiomatic translations, written RTL-safe (no leading/trailing LTR punctuation issues).

```json
{
  "id": "classic",
  "name": { "en": "Classic", "fa": "کلاسیک" },
  "description": {
    "en": "Crowd-pleasing prompts for any group.",
    "fa": "سوال‌های دوست‌داشتنی برای هر جمعی."
  },
  "version": 1,
  "prompts": [
    {
      "id": "mlt-overslept-alarm",
      "intensity": "family",
      "emoji": "⏰",
      "text": {
        "en": "Most likely to sleep through their alarm",
        "fa": "به احتمال زیاد خوابش می‌بره و آلارمش رو نمی‌شنوه"
      }
    },
    {
      "id": "mlt-cry-at-movie",
      "intensity": "family",
      "emoji": "🍿",
      "text": {
        "en": "Most likely to cry during a movie",
        "fa": "به احتمال زیاد وسط فیلم گریه‌ش می‌گیره"
      }
    },
    {
      "id": "mlt-become-famous",
      "intensity": "family",
      "emoji": "🌟",
      "text": {
        "en": "Most likely to become famous",
        "fa": "به احتمال زیاد مشهور می‌شه"
      }
    },
    {
      "id": "mlt-forget-birthday",
      "intensity": "family",
      "emoji": "🎂",
      "text": {
        "en": "Most likely to forget a friend's birthday",
        "fa": "به احتمال زیاد تولد یه دوستش رو فراموش می‌کنه"
      }
    },
    {
      "id": "mlt-survive-zombies",
      "intensity": "casual",
      "emoji": "🧟",
      "text": {
        "en": "Most likely to survive a zombie apocalypse",
        "fa": "به احتمال زیاد توی حمله‌ی زامبی‌ها زنده می‌مونه"
      }
    },
    {
      "id": "mlt-start-business",
      "intensity": "casual",
      "emoji": "💼",
      "text": {
        "en": "Most likely to start their own business",
        "fa": "به احتمال زیاد کسب‌وکار خودش رو راه می‌ندازه"
      }
    },
    {
      "id": "mlt-get-lost",
      "intensity": "casual",
      "emoji": "🗺️",
      "text": {
        "en": "Most likely to get lost using GPS",
        "fa": "به احتمال زیاد با وجود جی‌پی‌اس هم گم می‌شه"
      }
    },
    {
      "id": "mlt-laugh-wrong-time",
      "intensity": "casual",
      "emoji": "😂",
      "text": {
        "en": "Most likely to laugh at the wrong moment",
        "fa": "به احتمال زیاد سر بزنگاه خنده‌ش می‌گیره"
      }
    },
    {
      "id": "mlt-spend-savings",
      "intensity": "casual",
      "emoji": "💸",
      "text": {
        "en": "Most likely to blow their savings on something silly",
        "fa": "به احتمال زیاد پس‌اندازش رو سر یه چیز مسخره خرج می‌کنه"
      }
    },
    {
      "id": "mlt-text-ex",
      "intensity": "spicy",
      "emoji": "📱",
      "text": {
        "en": "Most likely to text their ex at 2am",
        "fa": "به احتمال زیاد ساعت دو نصفه‌شب به اکسش پیام می‌ده"
      }
    },
    {
      "id": "mlt-start-drama",
      "intensity": "spicy",
      "emoji": "🎭",
      "text": {
        "en": "Most likely to start drama in the group chat",
        "fa": "به احتمال زیاد توی گروه دردسر درست می‌کنه"
      }
    },
    {
      "id": "mlt-flirt-stranger",
      "intensity": "spicy",
      "emoji": "😏",
      "text": {
        "en": "Most likely to flirt with a total stranger",
        "fa": "به احتمال زیاد با یه غریبه‌ی کامل لاس می‌زنه"
      }
    },
    {
      "id": "mlt-spill-secret",
      "intensity": "spicy",
      "emoji": "🤐",
      "text": {
        "en": "Most likely to spill a secret they swore to keep",
        "fa": "به احتمال زیاد رازی رو که قول داده بود لو می‌ده"
      }
    },
    {
      "id": "mlt-be-late",
      "intensity": "family",
      "emoji": "🐢",
      "text": {
        "en": "Most likely to be late to their own party",
        "fa": "به احتمال زیاد به مهمونی خودش هم دیر می‌رسه"
      }
    },
    {
      "id": "mlt-win-argument",
      "intensity": "casual",
      "emoji": "🗣️",
      "text": {
        "en": "Most likely to win any argument",
        "fa": "به احتمال زیاد توی هر بحثی برنده می‌شه"
      }
    }
  ]
}
```

> 15 items shown (≥12 required). The shipped `classic.json` should contain ~40 prompts and `spicy.json` ~30, but the schema and tone above are the contract.

---

## 4. GameConfig (Setup Options)

```ts
export type VotingStyle = 'pass-device' | 'simultaneous';
export type TieBreak = 'co-winners' | 'random';

export interface MltConfig {
  /** Chosen deck id (must exist in available decks). */
  deckId: string;
  /**
   * Intensity ceiling: include prompts whose intensity is at or below this tier.
   * 'family' -> family only; 'casual' -> family+casual; 'spicy' -> all.
   */
  intensity: Intensity;
  /** How votes are collected. */
  votingStyle: VotingStyle;
  /** Number of prompts/rounds to play this session. Clamped to available pool size. */
  roundCount: number;
  /** May a player vote for themselves? Default false. */
  allowSelfVote: boolean;
  /**
   * Per-round tie handling when two+ players share the top vote count.
   * 'co-winners' reveals all tied players; 'random' picks one using the action seed.
   */
  tieBreak: TieBreak;
  /** Show the running overall scoreboard between rounds. Default true. */
  showRunningScores: boolean;
}
```

### 4.1 Defaults & Validation

| Field | Default | Constraint |
| --- | --- | --- |
| `deckId` | first available deck (`'classic'`) | must be a known deck |
| `intensity` | `'casual'` | one of the three tiers |
| `votingStyle` | `'pass-device'` | enum |
| `roundCount` | `min(10, poolSize)` | `1 ≤ roundCount ≤ poolSize` |
| `allowSelfVote` | `false` | boolean |
| `tieBreak` | `'co-winners'` | enum |
| `showRunningScores` | `true` | boolean |

`poolSize` = number of prompts in the deck whose `intensity` is ≤ ceiling. SetupScreen recomputes `poolSize` whenever `deckId` or `intensity` changes and clamps the `roundCount` slider's max.

`createInitialState(cfg)` receives a **validated** `MltConfig` (SetupScreen guarantees it). The reducer never re-validates config; it trusts the contract.

---

## 5. State Shape

The reducer is **PURE**. No clock, no RNG, no I/O. Any randomness (deck shuffle order, random tie-break) is supplied via the **action payload `seed`** and applied with a deterministic pure PRNG from the SDK (`sdk/rng`).

```ts
/** Per-round record of who got how many votes. Keyed by playerId -> count. */
export type VoteTally = Record<string, number>;

export type MltPhase =
  | 'prompt'        // prompt is shown, ready to begin voting
  | 'voting'        // collecting votes (pass-device sequence OR simultaneous entry)
  | 'reveal'        // most-voted player(s) revealed for this round
  | 'finished';     // all rounds done; show ResultsScreen

export interface MltRound {
  /** Index into orderedPromptIds. */
  index: number;
  /** The prompt id being played this round. */
  promptId: string;
  /** Final tally for this round (playerId -> votes). Filled when leaving 'voting'. */
  tally: VoteTally;
  /** Winner(s) of this round after tie resolution. Empty until reveal. */
  winnerIds: string[];
  /** True if this round ended with a tie that was broken by config.tieBreak. */
  wasTie: boolean;
}

export interface MltState {
  /** Echo of the config used to create this state (immutable). */
  config: MltConfig;
  /** Ordered, shuffled list of prompt ids to play (length === config.roundCount). */
  orderedPromptIds: string[];
  /** Snapshot of participating player ids at game start (order = roster order). */
  playerIds: string[];
  /** Current phase. */
  phase: MltPhase;
  /** 0-based index of the current round within orderedPromptIds. */
  currentRound: number;
  /**
   * Pass-device only: index into playerIds of the player currently voting.
   * 0 .. playerIds.length-1 during 'voting'; null otherwise.
   */
  activeVoterIndex: number | null;
  /**
   * Pass-device only: votes cast so far THIS round, voterId -> targetId.
   * Individual votes are kept ONLY to (a) detect double counting and (b) allow
   * an "undo last vote" within the round. Never surfaced to other players.
   */
  pendingVotes: Record<string, string>;
  /** Completed rounds (length === currentRound when in 'prompt'/'voting'). */
  rounds: MltRound[];
  /**
   * Running overall tally across all completed rounds.
   * playerId -> total number of "most-likely" WINS (not raw votes). See §6.
   */
  scores: Record<string, number>;
  /**
   * Running overall RAW votes received across all rounds (secondary metric +
   * tiebreak for overall winner). playerId -> total votes received.
   */
  rawVotes: Record<string, number>;
}
```

### 5.1 Derived (not stored)

- `currentPromptId = orderedPromptIds[currentRound]`
- `remainingVoters` (pass-device) = `playerIds.filter(id => !(id in pendingVotes))`
- Overall winner(s): computed by the `results` primitive from `scores` (primary) with `rawVotes` as tiebreak; see §6.4.

---

## 6. Scoring & Win Rules

### 6.1 Per-round resolution (on `SUBMIT_VOTES` / leaving `voting`)

1. Build `tally: VoteTally` from votes:
   - **pass-device:** count `pendingVotes` values → `tally[targetId]++`.
   - **simultaneous:** the operator's entered counts ARE the tally (payload).
2. `max = Math.max(...Object.values(tally))` (0 if nobody received a vote — only possible in simultaneous mode if operator submits all zeros; guarded — see edge cases).
3. `topPlayers = playerIds.filter(id => (tally[id] ?? 0) === max && max > 0)`.
4. Tie resolution:
   - `wasTie = topPlayers.length > 1`.
   - if `wasTie && config.tieBreak === 'random'`: `winnerIds = [pickOne(topPlayers, seed)]` (pure PRNG on the action `seed`).
   - else: `winnerIds = topPlayers` (co-winners).
5. Update overall:
   - each `id in winnerIds`: `scores[id] += 1`.
   - each player: `rawVotes[id] += tally[id] ?? 0`.

### 6.2 Round "win" definition

A player's **score** = number of rounds in which they were a (co-)winner — i.e. "times you were judged Most Likely". This is the headline metric. `rawVotes` is the tiebreaker and a fun secondary stat ("total votes received").

### 6.3 Self-vote handling

If `config.allowSelfVote === false`, the reducer ignores any vote where `voterId === targetId` (defense in depth; the UI also prevents it). Such a vote is dropped (not counted), and that voter is still marked as "voted" (their pass is complete). This keeps the flow moving even on a misclick path.

### 6.4 Overall winner (end of game)

Computed by the `results` primitive, NOT stored as a field:

- Rank by `scores` descending; tiebreak by `rawVotes` descending; final tiebreak: stable by roster order.
- The top entry (or entries, if fully tied on both metrics) is the **overall winner**. ResultsScreen may show a single crown or co-winners.
- "Overall winner" is **optional** in the UX sense: if every player has score 0 (impossible unless 0 rounds), or the host just wants stats, the full leaderboard is always shown regardless.

### 6.5 No elimination, no failure state

Every player plays every round. There is no losing condition; the game simply ends after `roundCount` rounds.

---

## 7. Actions & Reducer Transitions

All actions are dispatched by screens; the reducer is pure. `seed` is a `number` produced by the screen at dispatch time (e.g. from `sdk/rng` seeded by `Date.now()` + counter) — the reducer treats it as data.

```ts
export type MltAction =
  | { type: 'START_GAME'; seed: number }
  | { type: 'BEGIN_VOTING' }
  | { type: 'CAST_VOTE'; voterId: string; targetId: string }
  | { type: 'UNDO_LAST_VOTE' }
  | { type: 'SUBMIT_VOTES'; tally?: VoteTally; seed: number }
  | { type: 'NEXT_ROUND' }
  | { type: 'SKIP_PROMPT'; seed: number }
  | { type: 'RESET' };
```

### 7.1 Transition Table

| Action | Valid in phase | Effect | Resulting phase |
| --- | --- | --- | --- |
| `START_GAME` | (initial / `finished`) | Shuffle prompt pool with `seed`, take `roundCount` → `orderedPromptIds`; snapshot `playerIds`; zero `scores`/`rawVotes`; `currentRound=0`; clear `rounds`. | `prompt` |
| `BEGIN_VOTING` | `prompt` | Clear `pendingVotes`; if pass-device set `activeVoterIndex=0`, else `null`. | `voting` |
| `CAST_VOTE` | `voting` (pass-device only) | If `targetId===voterId` and `!allowSelfVote`, record voter as voted with no target (drop). Else `pendingVotes[voterId]=targetId`. Advance `activeVoterIndex` to next player who hasn't voted; if all voted, leave index at last (UI then enables Reveal) — phase unchanged. | `voting` |
| `UNDO_LAST_VOTE` | `voting` (pass-device) | Remove the most recently added entry from `pendingVotes`; set `activeVoterIndex` back to that voter. No-op if empty. | `voting` |
| `SUBMIT_VOTES` | `voting` | Build `tally` (from `pendingVotes` in pass-device, or from `action.tally` in simultaneous); compute `winnerIds`/`wasTie` (using `seed` for random tiebreak); push `MltRound`; update `scores`+`rawVotes`; clear `pendingVotes`; `activeVoterIndex=null`. | `reveal` |
| `NEXT_ROUND` | `reveal` | If `currentRound+1 < roundCount`: `currentRound++` → `prompt`. Else → `finished`. | `prompt` or `finished` |
| `SKIP_PROMPT` | `prompt` | Replace `orderedPromptIds[currentRound]` with an unused prompt from the pool (chosen via `seed`); if pool exhausted, no-op. Does not advance round. | `prompt` |
| `RESET` | any | Return to a fresh state from `config` (same as `createInitialState(config)`); phase becomes the pre-game state and `START_GAME` is required again. | `prompt`-pre (initial) |

**Guard rule:** any action received in an invalid phase is a **no-op** (returns the same state reference). This keeps the reducer total and prevents corrupted transitions from rapid taps / replays. Unit tests assert these no-ops.

### 7.2 `createInitialState`

```ts
export function createInitialState(config: MltConfig): MltState {
  return {
    config,
    orderedPromptIds: [],     // populated by START_GAME (needs seed)
    playerIds: [],            // populated by START_GAME from GameContext roster snapshot
    phase: 'prompt',          // shows "Ready?" until START_GAME runs; see note
    currentRound: 0,
    activeVoterIndex: null,
    pendingVotes: {},
    rounds: [],
    scores: {},
    rawVotes: {},
  };
}
```

> **Note on player snapshot:** `createInitialState` is pure and has no roster access. The roster snapshot (`playerIds`) and shuffle both require runtime data, so `START_GAME`'s payload also carries `playerIds: string[]` injected from `GameContext.roster.activePlayerIds`. (Added to the action: `{ type:'START_GAME'; seed:number; playerIds:string[]; promptPool:string[] }` where `promptPool` is the intensity-filtered list of candidate prompt ids the screen computed from content. The reducer shuffles `promptPool` and slices `roundCount`.) This keeps the reducer free of content/roster imports and fully testable with plain arrays.

Final `START_GAME` shape:

```ts
| { type: 'START_GAME'; seed: number; playerIds: string[]; promptPool: string[] }
```

---

## 8. SDK Primitives Consumed

Per the modularity contract, this game **reimplements nothing**. It consumes (names from `00-architecture.md`):

| Primitive | Use in Most Likely To |
| --- | --- |
| `roster` | Source of players, min/max enforcement, names, avatars/colors, active player set. `START_GAME` snapshots `roster.activePlayerIds`. |
| `deck` | Generic shuffle/draw/exhaustion helpers used to build `orderedPromptIds` and to power `SKIP_PROMPT`. Game supplies its own `MltPrompt` content but uses `deck` for ordering. |
| `voting` | The vote-collection model: pass-device "one voter at a time" sequencing and simultaneous tally entry. Provides the `<VoteGrid>` interaction & target selection; this game maps a vote → a `targetId`. |
| `revealGate` | The "Pass to <Name>" handoff + secrecy shield between voters in pass-device mode, and the dramatic round reveal. |
| `phaseMachine` | Drives `prompt → voting → reveal → finished`; the reducer's phase field mirrors it; SDK supplies transition guards/animations. |
| `scoring` | Accumulates `scores` (wins) and `rawVotes`; provides the leaderboard sort used by `results`. |
| `results` | Computes ranking + overall winner(s) from `scores`/`rawVotes`; renders the end screen leaderboard. |
| `rng` | Pure seeded PRNG (`shuffle(arr, seed)`, `pickOne(arr, seed)`) so the reducer stays deterministic. |
| `haptics` / `sound` | Tap feedback on vote, drumroll on reveal, fanfare on winner — via global mute. Side-effects live in screens, never the reducer. |

**NOT used:** `teams`, `turnOrder` (no turn order beyond the voting pass sequence, which `voting` owns), `timer` (no per-round clock in v1).

---

## 9. GameModule Wiring

```
src/games/most-likely-to/
  index.ts            // default-exports the GameModule
  manifest.ts         // GameManifest (id, names, range, icon, color, tags)
  logic.ts            // PURE: createInitialState + reducer (+ helpers tally/resolveRound)
  logic.test.ts       // vitest unit tests (see §13)
  config.ts           // default MltConfig + validation/clamp helpers (pure, testable)
  content/
    decks.ts
    classic.json
    spicy.json
  screens/
    SetupScreen.tsx
    PlayScreen.tsx
    ResultsScreen.tsx
```

### 9.1 `manifest.ts`

```ts
import type { GameManifest } from '@/sdk/types';

export const manifest: GameManifest = {
  id: 'most-likely-to',
  name: { en: 'Most Likely To', fa: 'به احتمال زیاد' },
  tagline: {
    en: 'Point at the friend most likely to…',
    fa: 'به دوستی اشاره کن که به احتمال زیاد…',
  },
  minPlayers: 3,
  maxPlayers: 20,
  estimatedMinutes: 10,
  icon: 'hand-pointing',          // SDK icon key
  accentColor: 'var(--color-game-mlt)', // playful color token defined in @theme
  tags: ['party', 'voting', 'no-teams', 'family-or-spicy'],
  supportsTeams: false,
  category: 'social',
};
```

### 9.2 `index.ts`

```ts
import type { GameModule } from '@/sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer } from './logic';
import { defaultConfig, validateConfig } from './config';
import SetupScreen from './screens/SetupScreen';
import PlayScreen from './screens/PlayScreen';
import ResultsScreen from './screens/ResultsScreen';

const module: GameModule<MltConfig, MltState, MltAction> = {
  manifest,
  defaultConfig,
  validateConfig,
  createInitialState,
  reducer,
  screens: { Setup: SetupScreen, Play: PlayScreen, Results: ResultsScreen },
};

export default module;
```

> Auto-discovery: the registry's `import.meta.glob('./games/*/index.ts', { eager: true })` picks this up. **No shared file is edited** to add the game.

---

## 10. Screen-by-Screen Breakdown

All screens are composed from `sdk/ui` components, dispatch `MltAction`s through `GameContext`, and pull players from `GameContext.roster`. They are **bilingual + RTL**: use logical utilities (`ms-/me-/ps-/pe-/text-start`) and `t()` for all chrome; prompt text comes from `LocalizedString` resolved by the current locale.

### 10.1 SetupScreen.tsx

**Purpose:** choose config, confirm roster ≥3, start.

On screen:
- `<RosterSummary>` (SDK) — shows active players, opens shared roster editor; enforces 3–20. Start disabled when invalid (with helper text).
- `<DeckPicker>` (SDK `deck` UI) bound to `deckId` — cards per available deck with name/description.
- `<SegmentedControl>` for **intensity** (Family / Casual / Spicy) — each option shows a tiny sample count badge (`poolSize`).
- `<SegmentedControl>` for **voting style** (Pass-device taps / Simultaneous count) with a one-line explainer each.
- `<Slider>` for **roundCount** (1..poolSize), live label "N rounds".
- `<Toggle>` **allow self-vote**.
- `<SegmentedControl>` **tie-break** (Co-winners / Random).
- `<Toggle>` **show running scores**.
- `<PrimaryButton>` **Start game**.

Dispatch / actions:
- Local component state holds a draft `MltConfig`; each control updates it via `validateConfig` (clamps `roundCount`, recomputes `poolSize`).
- **Start game** → builds `promptPool` (filter deck prompts by intensity ceiling → ids), generates a `seed`, calls `ctx.startGame(config)` which internally `createInitialState(config)` then dispatches `START_GAME { seed, playerIds, promptPool }`, then routes to Play.

SDK components: `RosterSummary`, `DeckPicker`, `SegmentedControl`, `Slider`, `Toggle`, `PrimaryButton`, `InfoNote`.

### 10.2 PlayScreen.tsx

Renders differently per `phase`. It reads `state.phase`, `state.currentRound`, roster, and the resolved current prompt.

**phase `prompt`:**
- `<PromptCard>` — big colorful card with `emoji` + prompt text (current locale), round counter "Round k / N", intensity chip.
- `<RunningScoreStrip>` (only if `showRunningScores`) — compact leaderboard from `state.scores`.
- Buttons: `<SecondaryButton>` **Skip** → `SKIP_PROMPT { seed }`; `<PrimaryButton>` **Start voting** → `BEGIN_VOTING`.

**phase `voting` — pass-device:**
- `<RevealGate>` (SDK `revealGate`) shows **"Pass the phone to {name}"** with a tap-to-reveal shield. Behind the gate:
  - `<VoteGrid>` (SDK `voting`) — grid of player chips (name + avatar color). The active voter's own chip is disabled when `!allowSelfVote`. Tapping a chip → `CAST_VOTE { voterId: activeVoter, targetId }`, fires haptic, then the gate re-shields and advances to the next voter ("Pass to {nextName}").
  - `<TextButton>` **Undo** → `UNDO_LAST_VOTE` (steps back one voter; available to the operator before fully passing on).
- Progress indicator "Voted: x / total" (counts of voters done, never WHO voted for whom).
- When all players have voted, the gate shows **"All votes in — tap to reveal"** → `SUBMIT_VOTES {}` then `reveal`.

**phase `voting` — simultaneous:**
- `<TallyEntry>` (SDK `voting`) — single public screen: one stepper per player to enter how many votes each received. Live total shown; a hint warns if total ≠ player count (allowed but flagged, since abstentions/multi-points happen IRL).
- `<PrimaryButton>` **Reveal** → `SUBMIT_VOTES { tally, seed }` → `reveal`.

**phase `reveal`:**
- `<RevealStage>` (SDK `revealGate`/`results`) — drumroll then big reveal of `winnerIds` ("🎉 {name} is most likely!"). Co-winners shown side by side; if `wasTie && random`, a subtle "tie broken" note.
- Per-round mini-tally bar chart (from `round.tally`) — playful, optional expand.
- Fanfare sound + celebratory haptic (respect global mute).
- `<PrimaryButton>` **Next** → `NEXT_ROUND` (label becomes **See results** on the last round).

SDK components: `PromptCard`, `RunningScoreStrip`, `RevealGate`, `VoteGrid`, `TallyEntry`, `RevealStage`, `PrimaryButton`, `SecondaryButton`, `TextButton`, `PhaseTransition` (framer-motion wrapper).

### 10.3 ResultsScreen.tsx

**Purpose:** crown winner(s), show full stats, offer replay.

On screen:
- `<WinnerBanner>` (SDK `results`) — overall winner(s) with crown, accent color, confetti (framer-motion), fanfare.
- `<Leaderboard>` (SDK `results`) — rows ranked by `scores` (wins) then `rawVotes`. Each row: rank, player, "wins" count, "votes received" count, and a fun superlative if they led a memorable round.
- `<RoundRecap>` (collapsible) — list of each round's prompt + winner(s), so the group can relive it.
- Buttons:
  - `<PrimaryButton>` **Play again (same setup)** → `RESET` then `START_GAME` with a fresh `seed` (new shuffle) and same config.
  - `<SecondaryButton>` **Change settings** → route back to SetupScreen (keeps draft config).
  - `<TextButton>` **Back to games** → home.
  - (Optional, sign-in only) `<TextButton>` **Save stats** → persists results via Supabase; hidden when signed out.

SDK components: `WinnerBanner`, `Leaderboard`, `RoundRecap`, `PrimaryButton`, `SecondaryButton`, `TextButton`.

---

## 11. Pass-and-Play Handoff & Secrecy (RevealGate)

Secrecy only matters in **pass-device** mode (simultaneous is openly public by design).

Flow per round (pass-device):
1. After **Start voting**, `activeVoterIndex = 0`.
2. `RevealGate` displays a **full-screen shield**: "Pass the phone to **{playerIds[activeVoterIndex] name}**. Don't peek!" — neutral colors, no vote data visible. This is the handoff barrier.
3. The active voter taps **"I'm {name} — show me"** to lift the shield. Only the `<VoteGrid>` for THIS voter is shown.
4. Voter taps a target → `CAST_VOTE`. The grid immediately re-shields (no confirmation that lingers, so the next person can't infer the choice from screen state).
5. Gate advances to next un-voted player and repeats.
6. After the last voter, the gate shows a neutral **"All votes are in — tap to reveal"**; tapping dispatches `SUBMIT_VOTES`. Crucially, the **reveal is only shown after the device is implicitly back with the group**, and shows only the aggregate (most-voted), never per-voter choices.

Secrecy guarantees:
- `pendingVotes` (who-voted-for-whom) is **never rendered** anywhere. It exists only to enable `UNDO_LAST_VOTE` and double-count protection, and is cleared on `SUBMIT_VOTES`.
- The reveal exposes only `tally` (counts) and `winnerIds` (the most-voted), so individual ballots stay secret — matching real-life "everybody points, but you can't always tell who pointed where" while still being defensible.
- Between voters the screen carries **no residual state** that could leak the prior choice (re-shield on each cast).

Robustness: if the app is backgrounded/closed mid-voting, zustand `persist` restores `phase: 'voting'`, `activeVoterIndex`, and `pendingVotes` so the round resumes exactly where it left off — behind the gate.

---

## 12. Edge Cases

| # | Situation | Handling |
| --- | --- | --- |
| 1 | Roster drops below 3 after setup (player removed) | SetupScreen Start stays disabled; if it happens after START (shouldn't, roster locked during play), the snapshot `playerIds` is used regardless — game continues with the players it started with. |
| 2 | `roundCount` > available prompts | `validateConfig` clamps to `poolSize`; slider max reflects this. |
| 3 | Intensity filter yields 0 prompts (impossible with bundled decks, possible with a bad custom deck) | SetupScreen shows "No prompts at this intensity" and disables Start. |
| 4 | Self-vote attempted while disabled | Reducer drops the vote, marks voter as done (see §6.3); UI disables own chip so this is a defensive guard only. |
| 5 | Per-round tie | Resolved by `config.tieBreak`: co-winners (default) reveal all; random picks one via `seed`. `wasTie` flagged for UI. |
| 6 | Nobody received a vote (simultaneous: operator submits all zeros) | `max === 0` → `winnerIds = []`, `wasTie = false`. Reveal shows a playful "No clear answer — everyone's safe!" and `scores` unchanged; round still recorded. |
| 7 | Simultaneous tally total ≠ player count | Allowed (people abstain or multiple point at one). UI flags it as a soft warning, not a block. |
| 8 | Double tap on a vote chip (pass-device) | `activeVoterIndex` already advanced; second tap targets the NEXT voter or is a no-op if guard sees that voter already in `pendingVotes`. Idempotent. |
| 9 | `UNDO_LAST_VOTE` with empty `pendingVotes` | No-op (same state ref). |
| 10 | `SKIP_PROMPT` when pool exhausted (all prompts already in `orderedPromptIds`) | No-op; UI hides Skip when no spare prompts remain. |
| 11 | Action dispatched in wrong phase (replay, rapid taps) | No-op by the phase guard (§7.1). |
| 12 | App backgrounded mid-game | zustand `persist` restores full `MltState`; resumes at exact phase/voter. |
| 13 | All players tie every round | Each round adds to everyone's score → overall winner resolved by `rawVotes`, then roster order; Leaderboard shows co-leaders. |
| 14 | Single-locale player names containing the other script | Names render as-is; layout uses logical properties so mixed LTR/RTL names don't break the grid. |
| 15 | `roundCount === poolSize` then `SKIP_PROMPT` | No spare prompt → no-op (case 10). |

---

## 13. Unit Tests — `logic.test.ts`

All tests use plain arrays/objects (no roster/content imports) and a fixed `seed` for determinism. Reducer purity is asserted by checking no input mutation and stable references on no-ops.

**createInitialState**
1. returns phase `'prompt'`, empty `orderedPromptIds`, empty `playerIds`, zeroed `scores`/`rawVotes`, and echoes `config`.

**START_GAME**
2. shuffles `promptPool` deterministically for a given `seed` (snapshot the order; same seed → same order).
3. slices to `config.roundCount` (e.g. pool 20, roundCount 5 → length 5).
4. snapshots `playerIds` from payload in order.
5. resets `scores`/`rawVotes` to `{}` and `currentRound` to 0; phase → `'prompt'`.

**BEGIN_VOTING**
6. pass-device: sets `activeVoterIndex = 0`, clears `pendingVotes`, phase → `'voting'`.
7. simultaneous: sets `activeVoterIndex = null`, phase → `'voting'`.
8. no-op when not in `'prompt'`.

**CAST_VOTE (pass-device)**
9. records `pendingVotes[voter] = target` and advances `activeVoterIndex` to next un-voted player.
10. self-vote with `allowSelfVote:false` → vote dropped, voter still marked done, index advances.
11. self-vote with `allowSelfVote:true` → vote recorded.
12. casting the final vote leaves phase `'voting'` (reveal is a separate action) and all players present in `pendingVotes`.
13. no-op in simultaneous mode / wrong phase.
14. does not mutate the input state object (immutability check).

**UNDO_LAST_VOTE**
15. removes the most recent vote and rewinds `activeVoterIndex` to that voter.
16. no-op when `pendingVotes` empty.

**SUBMIT_VOTES — tally & resolution**
17. pass-device: tally derived from `pendingVotes`; correct counts per target.
18. simultaneous: uses `action.tally` verbatim.
19. clear single winner: `winnerIds = [topId]`, `wasTie:false`, `scores[topId] += 1`.
20. tie + `tieBreak:'co-winners'`: `winnerIds` = all tied, each gets `scores += 1`, `wasTie:true`.
21. tie + `tieBreak:'random'`: exactly one winner chosen deterministically by `seed`; same seed → same pick.
22. `rawVotes` incremented by each player's received count regardless of winning.
23. all-zero tally (simultaneous): `winnerIds:[]`, `wasTie:false`, scores unchanged, round still pushed.
24. pushes a `MltRound` with correct `index`, `promptId`, `tally`, `winnerIds`, `wasTie`; clears `pendingVotes`; `activeVoterIndex:null`; phase → `'reveal'`.
25. no-op when not in `'voting'`.

**NEXT_ROUND**
26. mid-game: increments `currentRound`, phase → `'prompt'`.
27. last round: phase → `'finished'`, `currentRound` unchanged.
28. no-op when not in `'reveal'`.

**SKIP_PROMPT**
29. replaces current prompt id with an unused pool prompt (deterministic by `seed`); round index unchanged; phase stays `'prompt'`.
30. no-op when pool exhausted (no spare prompt) or wrong phase.

**RESET**
31. returns a fresh initial state equal to `createInitialState(config)` for the same config.

**Scoring integration (multi-round)**
32. play 3 deterministic rounds end-to-end (BEGIN→CAST*→SUBMIT→NEXT) and assert final `scores`, `rawVotes`, and `rounds.length === 3`.
33. overall-winner ranking (via `results` helper or inline sort) ranks by `scores` then `rawVotes` then roster order — assert ordering on a crafted scenario including a `scores` tie broken by `rawVotes`.

**Purity / guards**
34. every action returns the SAME state reference when dispatched in an invalid phase (reference equality).
35. no action mutates its input `state` (deep-freeze the input in test and assert no throw).

---

## 14. i18n Keys (UI chrome, not content)

Namespaced under `games.mostLikelyTo.*` in both `en` and `fa` catalogs. Representative keys:

```
games.mostLikelyTo.title
games.mostLikelyTo.tagline
games.mostLikelyTo.setup.deck
games.mostLikelyTo.setup.intensity.{family|casual|spicy}
games.mostLikelyTo.setup.votingStyle.{passDevice|simultaneous}
games.mostLikelyTo.setup.rounds            // "{{count}} rounds"
games.mostLikelyTo.setup.allowSelfVote
games.mostLikelyTo.setup.tieBreak.{coWinners|random}
games.mostLikelyTo.setup.showScores
games.mostLikelyTo.setup.start
games.mostLikelyTo.setup.needMorePlayers   // "Add at least {{min}} players"
games.mostLikelyTo.play.round              // "Round {{k}} of {{n}}"
games.mostLikelyTo.play.startVoting
games.mostLikelyTo.play.skip
games.mostLikelyTo.play.passTo             // "Pass the phone to {{name}}"
games.mostLikelyTo.play.imName             // "I'm {{name}} — show me"
games.mostLikelyTo.play.votedProgress      // "{{done}} / {{total}} voted"
games.mostLikelyTo.play.undo
games.mostLikelyTo.play.allVotesIn
games.mostLikelyTo.play.enterTally
games.mostLikelyTo.play.reveal
games.mostLikelyTo.play.next
games.mostLikelyTo.play.seeResults
games.mostLikelyTo.reveal.winner           // "{{name}} is most likely! 🎉"
games.mostLikelyTo.reveal.coWinners
games.mostLikelyTo.reveal.tieBroken
games.mostLikelyTo.reveal.noVotes          // "No clear answer — everyone's safe!"
games.mostLikelyTo.results.overallWinner
games.mostLikelyTo.results.wins            // "{{count}} wins"
games.mostLikelyTo.results.votesReceived
games.mostLikelyTo.results.playAgain
games.mostLikelyTo.results.changeSettings
games.mostLikelyTo.results.backToGames
games.mostLikelyTo.results.saveStats
```

All prompt TEXT is data (`MltPrompt.text`), resolved via the current locale — never an i18n key.

---

## 15. Theme & Accent

- Define `--color-game-mlt` in the global `@theme` block (Tailwind v4 CSS-first) — a vivid, friendly hue distinct from other game cards (suggested: warm coral/magenta). The home card and in-game accents use this token.
- Light/dark: rely on SDK semantic tokens; the accent must meet contrast in both.
- RTL: every layout uses logical utilities; the `PromptCard`, `VoteGrid`, and `Leaderboard` all flow correctly with `dir="rtl"`. Emoji and counts are direction-neutral.

---

## 16. Implementation Checklist (definition of done)

- [ ] `manifest.ts`, `index.ts`, `config.ts` typed against SDK contract.
- [ ] `logic.ts` pure; passes all §13 tests; `vitest` green.
- [ ] `content/classic.json` (~40 prompts) + `content/spicy.json` (~30) with unique ids, real en+fa, intensity tagged; `decks.ts` dedupe assertion.
- [ ] Three screens composed from `sdk/ui`; no engine primitive reimplemented.
- [ ] Pass-device secrecy verified (no per-ballot leak; re-shield on each cast).
- [ ] Simultaneous tally entry with soft total warning.
- [ ] Persisted mid-game resume works (zustand `persist`).
- [ ] Full RTL + light/dark verified; global mute respected for SFX/haptics.
- [ ] Auto-discovered by the registry with **zero edits** to shared files.
