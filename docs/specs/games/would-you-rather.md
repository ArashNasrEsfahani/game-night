# Would You Rather — Implementation Spec

> Game ID: `would-you-rather`
> Type: free-for-all, pass-and-play, deck-driven voting game
> Status: ready to implement
> Conforms to: `docs/specs/00-architecture.md` (SDK primitives, `GameModule` / `GameManifest` / `GameContext`, `LocalizedString`, pure-reducer contract, auto-discovery registry).

---

## 1. Concept & Overview

Two mutually-exclusive options are shown ("Would you rather **A** or **B**?"). Every player commits to **A** or **B**, the group reveals the split as a colorful `VoteBar`, then debates before moving to the next prompt. Optionally, players who side with the **majority** earn a point ("go with the crowd"), turning a pure conversation game into a light competition.

Two play modes:

- **Vote mode** (secret-ish, per-player): the device is passed around; each player privately taps A or B on a handoff screen, then passes on. After everyone has tapped, the split is revealed.
- **Quick-reveal mode** (count hands): no per-player device tap. One reader holds the phone, reads the prompt aloud, the group raises hands, the reader enters two tallies (A count / B count), then reveals.

The game is **content-driven**: a bundled deck of bilingual A/B option pairs, each tagged with an `intensity` band (mild → spicy). Players pick a deck/intensity at setup.

---

## 2. Player Range & Modes

| Aspect | Value |
| --- | --- |
| Min players | **2** |
| Max players | **20** |
| Team structure | none — **free-for-all** |
| Turn order | not used for play (no "active player"); used only for the vote-mode handoff sequence |
| Default round length | 10 prompts (configurable 5 / 10 / 15 / 20 / "whole deck") |

### Modes
- `vote` — per-player secret tap behind a `RevealGate` handoff. Default.
- `quick` — count-hands; reader enters A/B tallies on one screen.

In `quick` mode the result is a **group tally** (counts), so "majority points" can still be awarded to *the side*, but cannot be attributed to specific players unless `quickAttributePoints` is on (see scoring). By default `quick` mode disables per-player points (it has no per-player data).

---

## 3. SDK Primitives Consumed

This game consumes the following engine primitives via `GameContext` (per `00-architecture.md`). It **never** reimplements them.

| Primitive | Usage |
| --- | --- |
| `roster` | source of players (`Player[]`, set up once app-wide). Read-only here. |
| `turnOrder` | ordering used to sequence the vote-mode handoff (who taps next). Read-only. |
| `deck` | shuffle + draw of `WyrItem` prompts from the selected pool, using the **seeded** shuffle the engine exposes. The reducer receives drawn items / seeds via action payloads; the deck primitive itself supplies the seeded order. |
| `voting` | tallying A/B votes into counts and computing majority. We use its count/aggregate helpers; the canonical per-player choices still live in our state for replay. |
| `scoring` | optional majority points; `scoring` holds the canonical score map surfaced to `ResultsScreen` and cross-game stats. |
| `revealGate` | the "Pass to **{name}** — tap when ready" secrecy gate between voters in `vote` mode, and the "Pass back to the group" gate before reveal. |
| `phaseMachine` | drives `setup → prompt → collecting → reveal → debate → (loop) → results`. |
| `results` | renders final standings / summary and "Play again" / "Home". |
| `ui` (`sdk/ui`) | all visual components: `Screen`, `AppBar`, `Button`, `Card`, `OptionCard`, `VoteBar`, `Stepper`, `SegmentedControl`, `Chip`, `IntensityMeter`, `PlayerAvatar`, `ProgressDots`, `Confetti`, `Sound`/haptics hooks. (Names per architecture UI kit; if a component is missing it is composed from `Card`+`Button`.) |
| `i18n` | `t()` for UI strings (catalog `games.wyr.*`); game **content** is read directly from the bilingual JSON via `LocalizedString` + current locale. |

Randomness rule: **the reducer is pure.** All shuffles/draws are performed by the `deck` primitive (engine side) which passes results (next item, or a shuffle seed) into action payloads. The reducer never calls `Math.random()` or `Date.now()`.

---

## 4. File Layout & Responsibilities

```
src/games/would-you-rather/
├─ index.ts                  # default-exports the GameModule (wires manifest + logic + screens)
├─ manifest.ts               # GameManifest: id, title, blurb, icon, colors, range, capabilities
├─ logic.ts                  # PURE createInitialState(cfg) + reducer(state, action) -> state; selectors; types
├─ logic.test.ts             # vitest unit tests for logic.ts (see §13)
├─ types.ts                  # WyrItem, WyrConfig, WyrState, WyrAction, enums (imported by logic + screens)
├─ content/
│  ├─ classic.en-fa.json     # default bilingual deck (mixed intensities)
│  ├─ spicy.en-fa.json       # spicy/party deck
│  └─ index.ts               # typed loader: import.meta.glob of ./*.json -> DeckIndex
└─ screens/
   ├─ SetupScreen.tsx        # deck + intensity + mode + length + points toggle -> dispatch START
   ├─ PlayScreen.tsx         # phase-aware: prompt/collecting/reveal/debate; dispatches play actions
   └─ ResultsScreen.tsx      # standings (if points) or recap of split history; play-again/home
```

`index.ts`, `manifest.ts`, `logic.ts`, `logic.test.ts`, `content/*.json`, and `screens/{Setup,Play,Results}` are **required** by the modularity convention. Adding this folder is the only change needed — the registry auto-discovers it via `import.meta.glob('./games/*/index.ts', { eager: true })`.

### 4.1 `index.ts` sketch

```ts
import type { GameModule } from "../../sdk/types";
import { manifest } from "./manifest";
import { createInitialState, reducer, selectors } from "./logic";
import SetupScreen from "./screens/SetupScreen";
import PlayScreen from "./screens/PlayScreen";
import ResultsScreen from "./screens/ResultsScreen";

const module: GameModule<WyrConfig, WyrState, WyrAction> = {
  manifest,
  createInitialState,
  reducer,
  selectors,
  screens: { Setup: SetupScreen, Play: PlayScreen, Results: ResultsScreen },
};
export default module;
```

### 4.2 `manifest.ts` sketch

```ts
import type { GameManifest } from "../../sdk/types";
import wyrIcon from "./assets/icon.svg"; // or an emoji/lucide id per kit

export const manifest: GameManifest = {
  id: "would-you-rather",
  title: { en: "Would You Rather", fa: "کدوم رو ترجیح می‌دی؟" },
  blurb: {
    en: "Two options. Pick a side. Reveal the split. Defend your choice.",
    fa: "دو گزینه. یک طرف رو انتخاب کن. نتیجه رو ببین. از انتخابت دفاع کن.",
  },
  icon: wyrIcon,
  accent: "fuchsia",                 // maps to a @theme token gradient
  minPlayers: 2,
  maxPlayers: 20,
  estMinutes: [5, 20],
  tags: ["party", "talk", "vote", "no-teams"],
  capabilities: { teams: false, timer: false, deck: true, voting: true, scoring: "optional" },
  contentPacks: ["classic", "spicy"],
  defaultLocaleContent: "classic",
};
```

---

## 5. Content Schema

### 5.1 Types

```ts
// types.ts
export interface LocalizedString { en: string; fa: string }

export type Intensity = "mild" | "medium" | "spicy";

export interface WyrItem {
  id: string;                 // stable, unique within deck, e.g. "classic-001"
  optionA: LocalizedString;   // the "A" choice
  optionB: LocalizedString;   // the "B" choice
  intensity: Intensity;       // filter band
  tags?: string[];            // optional theme tags ("food","superpower","ethics"...)
  note?: LocalizedString;     // optional debate prompt / clarification shown after reveal
}

export interface WyrDeck {
  id: string;                 // "classic" | "spicy" | custom id
  name: LocalizedString;
  description?: LocalizedString;
  intensityDefault: Intensity;
  items: WyrItem[];
}
```

### 5.2 JSON file shape (`content/classic.en-fa.json`)

```json
{
  "id": "classic",
  "name": { "en": "Classic", "fa": "کلاسیک" },
  "description": { "en": "Crowd-pleasers for any group.", "fa": "مناسب هر جمعی." },
  "intensityDefault": "mild",
  "items": [ /* WyrItem[] */ ]
}
```

### 5.3 Content loader (`content/index.ts`)

```ts
import type { WyrDeck } from "../types";

const files = import.meta.glob<{ default: WyrDeck }>("./*.json", { eager: true });

export const DECKS: Record<string, WyrDeck> = Object.fromEntries(
  Object.values(files).map((m) => [m.default.id, m.default]),
);

export const DECK_LIST: WyrDeck[] = Object.values(DECKS);

export function poolFor(deckId: string, maxIntensity: Intensity): WyrItem[] {
  const order: Intensity[] = ["mild", "medium", "spicy"];
  const ceil = order.indexOf(maxIntensity);
  return (DECKS[deckId]?.items ?? []).filter(
    (it) => order.indexOf(it.intensity) <= ceil,
  );
}
```

`maxIntensity` is a **ceiling**: choosing `medium` includes `mild` + `medium`; choosing `spicy` includes all.

### 5.4 Sample bilingual content (≥ 12 real items)

`content/classic.en-fa.json` `items`:

```json
[
  {
    "id": "classic-001",
    "intensity": "mild",
    "tags": ["superpower"],
    "optionA": { "en": "Be able to fly", "fa": "بتونی پرواز کنی" },
    "optionB": { "en": "Be able to turn invisible", "fa": "بتونی نامرئی بشی" }
  },
  {
    "id": "classic-002",
    "intensity": "mild",
    "tags": ["food"],
    "optionA": { "en": "Only ever eat pizza", "fa": "تا آخر عمر فقط پیتزا بخوری" },
    "optionB": { "en": "Only ever eat kabab", "fa": "تا آخر عمر فقط کباب بخوری" }
  },
  {
    "id": "classic-003",
    "intensity": "mild",
    "tags": ["time"],
    "optionA": { "en": "Travel to the past", "fa": "به گذشته سفر کنی" },
    "optionB": { "en": "Travel to the future", "fa": "به آینده سفر کنی" }
  },
  {
    "id": "classic-004",
    "intensity": "mild",
    "tags": ["lifestyle"],
    "optionA": { "en": "Always be 10 minutes late", "fa": "همیشه ۱۰ دقیقه دیر برسی" },
    "optionB": { "en": "Always be 20 minutes early", "fa": "همیشه ۲۰ دقیقه زود برسی" }
  },
  {
    "id": "classic-005",
    "intensity": "medium",
    "tags": ["social"],
    "optionA": { "en": "Lose the ability to lie", "fa": "دیگه نتونی دروغ بگی" },
    "optionB": { "en": "Believe every lie you hear", "fa": "هر دروغی رو که می‌شنوی باور کنی" }
  },
  {
    "id": "classic-006",
    "intensity": "medium",
    "tags": ["money"],
    "optionA": { "en": "Be rich but always tired", "fa": "ثروتمند باشی ولی همیشه خسته" },
    "optionB": { "en": "Be broke but always well-rested", "fa": "بی‌پول باشی ولی همیشه سرحال" }
  },
  {
    "id": "classic-007",
    "intensity": "mild",
    "tags": ["pets"],
    "optionA": { "en": "Have a dog that talks", "fa": "سگی داشته باشی که حرف بزنه" },
    "optionB": { "en": "Have a cat that does chores", "fa": "گربه‌ای داشته باشی که کارای خونه رو بکنه" }
  },
  {
    "id": "classic-008",
    "intensity": "medium",
    "tags": ["tech"],
    "optionA": { "en": "Give up your phone for a month", "fa": "یه ماه گوشیت رو کنار بذاری" },
    "optionB": { "en": "Give up showering for a week", "fa": "یه هفته حموم نری" }
  },
  {
    "id": "classic-009",
    "intensity": "mild",
    "tags": ["weather"],
    "optionA": { "en": "Live somewhere it's always summer", "fa": "جایی زندگی کنی که همیشه تابستونه" },
    "optionB": { "en": "Live somewhere it's always winter", "fa": "جایی زندگی کنی که همیشه زمستونه" }
  },
  {
    "id": "classic-010",
    "intensity": "medium",
    "tags": ["ability"],
    "optionA": { "en": "Speak every language", "fa": "همه‌ی زبون‌ها رو بلد باشی" },
    "optionB": { "en": "Play every musical instrument", "fa": "همه‌ی سازها رو بلد باشی بزنی" }
  },
  {
    "id": "classic-011",
    "intensity": "spicy",
    "tags": ["social"],
    "optionA": { "en": "Have your search history made public", "fa": "تاریخچه‌ی جست‌وجوت عمومی بشه" },
    "optionB": { "en": "Have your texts read aloud at dinner", "fa": "پیام‌هات سر شام بلند خونده بشه" }
  },
  {
    "id": "classic-012",
    "intensity": "spicy",
    "tags": ["ethics"],
    "optionA": { "en": "Always know when someone is lying", "fa": "همیشه بفهمی کی داره دروغ می‌گه" },
    "optionB": { "en": "Always get away with your own lies", "fa": "همیشه دروغ‌های خودت لو نره" }
  },
  {
    "id": "classic-013",
    "intensity": "medium",
    "tags": ["adventure"],
    "optionA": { "en": "Explore deep space", "fa": "اعماق فضا رو کشف کنی" },
    "optionB": { "en": "Explore the deep ocean", "fa": "اعماق اقیانوس رو کشف کنی" }
  },
  {
    "id": "classic-014",
    "intensity": "mild",
    "tags": ["food"],
    "optionA": { "en": "Never eat sweets again", "fa": "دیگه هیچ‌وقت شیرینی نخوری" },
    "optionB": { "en": "Never drink tea again", "fa": "دیگه هیچ‌وقت چای نخوری" },
    "note": { "en": "Tough one for a Persian household!", "fa": "برای یه خونه‌ی ایرانی سخته!" }
  }
]
```

(14 items shipped in `classic`; `spicy.en-fa.json` ships its own `spicy`-heavy set, same schema. Authoring guideline: each item must read naturally in both languages — translate the *idea*, not word-for-word; keep both options parallel in length.)

---

## 6. GameConfig (`WyrConfig`)

Produced by `SetupScreen`, passed to `createInitialState`.

```ts
export type RoundLength = 5 | 10 | 15 | 20 | "all";
export type Mode = "vote" | "quick";

export interface WyrConfig {
  playerIds: string[];          // from roster, length 2..20 (engine-validated)
  deckId: string;               // selected deck, default "classic"
  maxIntensity: Intensity;      // ceiling filter, default = deck.intensityDefault
  mode: Mode;                   // "vote" (default) | "quick"
  roundLength: RoundLength;     // default 10
  awardMajorityPoints: boolean; // default false
  quickAttributePoints: boolean;// default false; only meaningful when mode==="quick"
  tieCountsForBoth: boolean;    // on a tie, award the point to BOTH sides? default true
  shuffleSeed: number;          // seed provided by engine deck primitive at start
}
```

Defaults helper:

```ts
export const defaultConfig = (deckId = "classic"): Omit<WyrConfig,"playerIds"|"shuffleSeed"> => ({
  deckId,
  maxIntensity: DECKS[deckId]?.intensityDefault ?? "mild",
  mode: "vote",
  roundLength: 10,
  awardMajorityPoints: false,
  quickAttributePoints: false,
  tieCountsForBoth: true,
});
```

---

## 7. State Shape (`WyrState`)

```ts
export type Phase =
  | "setup"        // pre-start (rarely held here; START moves to prompt)
  | "prompt"       // showing the two options to the group (pre-collection)
  | "collecting"   // gathering choices (vote: handoff loop; quick: tally entry)
  | "reveal"       // VoteBar shown, split + (optional) points applied
  | "debate"       // free talk; "Next" available
  | "results";     // finished

export type Side = "A" | "B";

export interface RoundRecord {
  itemId: string;
  countA: number;
  countB: number;
  majority: Side | "tie";
  // per-player choices captured this round (vote mode, or quick w/ attribution off => empty)
  choices: Record<string /*playerId*/, Side>;
}

export interface WyrState {
  config: WyrConfig;

  phase: Phase;

  // deck progression
  order: string[];              // itemIds in shuffled play order (deck primitive output)
  index: number;                // 0-based pointer into `order`; current item = order[index]
  total: number;                // planned number of prompts this game (min(roundLength, pool))

  // current-round collection
  choices: Record<string, Side>;   // playerId -> Side (vote mode, live)
  quickCounts: { A: number; B: number } | null; // quick mode tally being entered
  handoffIndex: number;            // vote mode: index into turnOrder of who taps next
  lastChoiceBy: string | null;     // for "choice locked" feedback / undo target

  // reveal output for current round
  current: { countA: number; countB: number; majority: Side | "tie" } | null;

  // history + scoring
  history: RoundRecord[];
  scores: Record<string, number>;  // playerId -> points (mirrors `scoring` primitive)
}
```

Selectors (`logic.ts`, pure):

```ts
export const selectors = {
  currentItemId: (s: WyrState) => s.order[s.index] ?? null,
  progress: (s: WyrState) => ({ done: s.index, total: s.total }),
  everyoneVoted: (s: WyrState) =>
    s.config.playerIds.every((id) => s.choices[id] !== undefined),
  nextVoterId: (s: WyrState) => /* turnOrder[handoffIndex] not yet voted */ null,
  isFinished: (s: WyrState) => s.phase === "results",
  standings: (s: WyrState) =>
    [...s.config.playerIds]
      .map((id) => ({ id, score: s.scores[id] ?? 0 }))
      .sort((a, b) => b.score - a.score),
};
```

---

## 8. Actions & Reducer Transitions

All actions are plain objects with a `type` and explicit payload. **No randomness or time inside the reducer** — seeds/orderings arrive in payloads.

```ts
export type WyrAction =
  | { type: "START"; order: string[]; total: number }      // deck primitive supplies shuffled itemIds
  | { type: "BEGIN_COLLECTION" }                            // prompt -> collecting
  | { type: "CHOOSE"; playerId: string; side: Side }        // vote mode: one player commits
  | { type: "UNDO_CHOICE"; playerId: string }               // vote mode: correct a mistap before reveal
  | { type: "ADVANCE_HANDOFF" }                             // vote mode: move gate to next voter
  | { type: "SET_QUICK_COUNTS"; A: number; B: number }      // quick mode: reader enters tallies
  | { type: "REVEAL" }                                      // collecting -> reveal (compute split + points)
  | { type: "ENTER_DEBATE" }                                // reveal -> debate (no-op data; UI affordance)
  | { type: "NEXT" }                                        // commit RoundRecord, advance index or -> results
  | { type: "SKIP" }                                        // discard current prompt, draw next w/o scoring
  | { type: "RESTART"; order: string[]; total: number }     // results -> fresh game, same config
  | { type: "ABORT" };                                      // jump straight to results (early end)
```

### 8.1 Transition table

| Action | Valid in phase | State changes | Next phase |
| --- | --- | --- | --- |
| `START` | `setup` | `order = action.order`; `total = action.total`; `index = 0`; clear `choices`, `quickCounts`, `current`; `handoffIndex = 0`; `history = []`; `scores = {all:0}` | `prompt` |
| `BEGIN_COLLECTION` | `prompt` | reset `choices={}`, `quickCounts=null`, `handoffIndex=0`, `lastChoiceBy=null` | `collecting` |
| `CHOOSE` | `collecting` (vote) | `choices[playerId]=side`; `lastChoiceBy=playerId`. Idempotent overwrite allowed before reveal. | `collecting` |
| `UNDO_CHOICE` | `collecting` (vote) | delete `choices[playerId]`; if `lastChoiceBy===playerId` set `null` | `collecting` |
| `ADVANCE_HANDOFF` | `collecting` (vote) | `handoffIndex = min(handoffIndex+1, playerIds.length)` | `collecting` |
| `SET_QUICK_COUNTS` | `collecting` (quick) | `quickCounts = { A, B }` (clamped ≥0; A+B may be ≤ player count, reader's responsibility) | `collecting` |
| `REVEAL` | `collecting` | compute `countA/countB` (vote: tally `choices`; quick: from `quickCounts`); `majority = A>B?'A':B>A?'B':'tie'`; set `current`; **apply points** per §9 into `scores` | `reveal` |
| `ENTER_DEBATE` | `reveal` | none (marker) | `debate` |
| `NEXT` | `reveal` or `debate` | push `RoundRecord` (from `current` + `choices`) to `history`; `index++`. If `index >= total` OR pool exhausted → `results`; else clear round buffers (`choices={}`,`quickCounts=null`,`handoffIndex=0`,`current=null`) | `prompt` or `results` |
| `SKIP` | `prompt`,`collecting`,`reveal`,`debate` | do **not** score, do **not** record history; `index++`; clear round buffers. If exhausted → `results` else `prompt`. (`SKIP` from `reveal` removes any points already applied this round — see note.) | `prompt` or `results` |
| `RESTART` | `results` | same as `START` but keep `config`; `order/total` from payload | `prompt` |
| `ABORT` | any non-`results` | finalize: if current round was revealed but not committed, optionally commit; set phase | `results` |

Notes & guarantees:
- **Out-of-phase actions are no-ops** (reducer returns the same state reference) so accidental double-taps cannot corrupt state. This is asserted in tests.
- `REVEAL` is **pure & deterministic**: counts derive only from `choices`/`quickCounts`. Points are applied here so `current` and `scores` are always consistent in one transition.
- `SKIP` from `reveal`/`debate`: because points are applied at `REVEAL`, `SKIP` must **roll back** the points it added this round. Implementation: recompute `scores` by re-reducing `history` from zero (cheap, ≤20 rounds) rather than tracking deltas — keeps reducer pure and avoids drift. (Equivalently, store the pre-reveal `scores` snapshot in state and restore on `SKIP`; spec mandates the recompute approach for simplicity. See test T-14.)
- `index` advances on `NEXT` and `SKIP` only; `current item = order[index]`.

### 8.2 Reducer skeleton

```ts
export function reducer(state: WyrState, action: WyrAction): WyrState {
  switch (action.type) {
    case "START":
    case "RESTART": {
      const scores = Object.fromEntries(state.config.playerIds.map(id => [id, 0]));
      return { ...state, phase: "prompt", order: action.order, total: action.total,
        index: 0, choices: {}, quickCounts: null, handoffIndex: 0,
        lastChoiceBy: null, current: null, history: [], scores };
    }
    case "BEGIN_COLLECTION":
      if (state.phase !== "prompt") return state;
      return { ...state, phase: "collecting", choices: {}, quickCounts: null,
        handoffIndex: 0, lastChoiceBy: null };
    case "CHOOSE":
      if (state.phase !== "collecting" || state.config.mode !== "vote") return state;
      return { ...state, choices: { ...state.choices, [action.playerId]: action.side },
        lastChoiceBy: action.playerId };
    case "UNDO_CHOICE": {
      if (state.phase !== "collecting") return state;
      const { [action.playerId]: _drop, ...rest } = state.choices;
      return { ...state, choices: rest,
        lastChoiceBy: state.lastChoiceBy === action.playerId ? null : state.lastChoiceBy };
    }
    case "ADVANCE_HANDOFF":
      if (state.phase !== "collecting") return state;
      return { ...state, handoffIndex:
        Math.min(state.handoffIndex + 1, state.config.playerIds.length) };
    case "SET_QUICK_COUNTS":
      if (state.phase !== "collecting" || state.config.mode !== "quick") return state;
      return { ...state, quickCounts: { A: Math.max(0, action.A), B: Math.max(0, action.B) } };
    case "REVEAL": {
      if (state.phase !== "collecting") return state;
      const { countA, countB } = tally(state);
      const majority: Side | "tie" = countA > countB ? "A" : countB > countA ? "B" : "tie";
      const scores = applyPoints(state, { countA, countB, majority });
      return { ...state, phase: "reveal", current: { countA, countB, majority }, scores };
    }
    case "ENTER_DEBATE":
      return state.phase === "reveal" ? { ...state, phase: "debate" } : state;
    case "NEXT": {
      if (state.phase !== "reveal" && state.phase !== "debate") return state;
      const rec = makeRecord(state);
      const history = [...state.history, rec];
      const index = state.index + 1;
      const done = index >= state.total || index >= state.order.length;
      return { ...state, phase: done ? "results" : "prompt", history, index,
        choices: {}, quickCounts: null, handoffIndex: 0, current: null, lastChoiceBy: null };
    }
    case "SKIP": {
      if (state.phase === "setup" || state.phase === "results") return state;
      const index = state.index + 1;
      const done = index >= state.total || index >= state.order.length;
      const scores = recomputeScores(state.config, state.history); // roll back this round
      return { ...state, phase: done ? "results" : "prompt", index, scores,
        choices: {}, quickCounts: null, handoffIndex: 0, current: null, lastChoiceBy: null };
    }
    case "ABORT":
      return state.phase === "results" ? state : { ...state, phase: "results" };
    default:
      return state;
  }
}
```

Helpers (pure, in `logic.ts`): `tally`, `applyPoints`, `makeRecord`, `recomputeScores`.

---

## 9. Win / Scoring Rules

Scoring is **optional** and off by default — Would You Rather is primarily a talk game.

`applyPoints(state, {countA,countB,majority})` rules:

1. If `config.awardMajorityPoints === false` → no score change (return scores unchanged). This is the default; the game then has **no winner** (Results shows the split history only).
2. **Vote mode** (per-player choices known):
   - If `majority === "A"` or `"B"`: every player whose choice equals `majority` gets **+1**.
   - If `majority === "tie"`: if `config.tieCountsForBoth` → **all voters +1**; else **no one** scores.
   - Players who didn't vote (edge: skipped handoff) score nothing.
3. **Quick mode**:
   - Per-player attribution is unavailable, so individual scores can't move unless `config.quickAttributePoints === true` AND choices were somehow captured (not in standard quick flow) — in standard quick flow, **points are not awarded to players**. Instead the **side** that won is logged in `history` for the recap. (Quick mode therefore has no per-player leaderboard by default; Results shows side-win tallies "A won 6 / B won 4".)
4. Points are applied exactly once, at `REVEAL`. `SKIP` rolls them back via `recomputeScores`.

**Winner**: highest `scores` after the final `NEXT` (when `awardMajorityPoints` and vote mode). Ties in score are shown as co-winners. With points off, there is no winner — Results is a recap.

```ts
function applyPoints(s, { majority }) {
  const scores = { ...s.scores };
  if (!s.config.awardMajorityPoints) return scores;
  if (s.config.mode === "quick" && !s.config.quickAttributePoints) return scores;
  for (const [pid, side] of Object.entries(s.choices)) {
    const win = majority === "tie" ? s.config.tieCountsForBoth : side === majority;
    if (win) scores[pid] = (scores[pid] ?? 0) + 1;
  }
  return scores;
}
```

---

## 10. Screen-by-Screen Breakdown

All screens are composed from `sdk/ui`. They are **dumb dispatchers**: they read state via `selectors`, render UI, and dispatch actions. They receive `{ state, dispatch, ctx }: GameContext<WyrConfig,WyrState,WyrAction>`.

### 10.1 SetupScreen

Purpose: collect `WyrConfig` and dispatch `START` (engine attaches `order`/`total`/`shuffleSeed`).

On screen:
- `AppBar` — title `t("games.wyr.title")`, back to Home.
- **Players summary** — `Chip` row of `roster` avatars with count badge `n / 20`; "Edit players" links to the shared roster screen (does not belong to this game). If `< 2` players, the Start button is disabled with helper text.
- **Deck picker** — horizontal `Card` carousel, one `OptionCard` per `DECK_LIST` entry showing localized `name` + `description`. Selecting sets `deckId`; resets `maxIntensity` to that deck's `intensityDefault`.
- **Intensity** — `IntensityMeter` / `SegmentedControl` (`mild | medium | spicy`) bound to `maxIntensity`; shows live pool size: `t("games.wyr.poolSize", { n })`.
- **Mode** — `SegmentedControl` (`vote | quick`) with a one-line explainer each. Switching to `quick` disables the per-player points sub-toggle.
- **Length** — `SegmentedControl` (`5 | 10 | 15 | 20 | all`), clamped to pool size.
- **Scoring** — `Switch` "Award point for going with the majority" → `awardMajorityPoints`. Sub-`Switch` (vote only) "Count ties for everyone" → `tieCountsForBoth`. In quick mode, an info `Chip` notes scoring is per-side only.
- **Start** — primary `Button` (full-width, accent gradient). Disabled if players `< 2` or pool `=== 0`. On tap: build `WyrConfig`, ask the engine `deck` primitive for a seeded shuffled `order` of the filtered pool + computed `total = min(lengthOrAll, pool.length)`, dispatch `START`.

Dispatches: `START` (with engine-supplied `order`, `total`). No game state mutated before Start beyond local form state.

### 10.2 PlayScreen

Phase-aware single screen. Reads `selectors.currentItemId` → resolves `WyrItem` from `DECKS` → renders the current locale string via `pick(localized, locale)`.

Common chrome: `AppBar` with `ProgressDots`/counter `selectors.progress` ("{done} / {total}"), a mute-aware sound icon (global), and a kebab menu (`Skip`, `End game` → `ABORT`).

**Phase `prompt`**
- Big `Card` with the question header `t("games.wyr.wouldYouRather")`.
- Two large `OptionCard`s (A on start side, B on end side; stacked vertically on narrow screens) showing `optionA`/`optionB`. **Non-interactive here** (just a preview/read-aloud).
- Primary `Button`:
  - vote mode → `t("games.wyr.startVoting")` → dispatch `BEGIN_COLLECTION` (then immediately enter handoff for player[0]).
  - quick mode → `t("games.wyr.countHands")` → dispatch `BEGIN_COLLECTION`.

**Phase `collecting` — VOTE mode (RevealGate handoff loop)**
- A `RevealGate` overlay: "Pass to **{playerName}**" + that player's `PlayerAvatar`; a "I'm {name} — ready" `Button` reveals the two `OptionCard`s **only for that player**.
- The two `OptionCard`s are now **tappable**. Tapping A or B:
  1. dispatch `CHOOSE { playerId: currentVoterId, side }`
  2. play SFX + haptic
  3. show a brief "locked in" confirmation with `UNDO_CHOICE` affordance (small "change" link) — only available until they hand off.
  4. dispatch `ADVANCE_HANDOFF`, then re-raise the `RevealGate` for the next voter.
- `currentVoterId = turnOrder[handoffIndex]`. The screen drives the handoff using `handoffIndex`; **choices stay hidden** (no running tally shown) to preserve secrecy and avoid bandwagoning.
- When `selectors.everyoneVoted` (or `handoffIndex >= playerIds.length`): show "Everyone's in — pass back to the group" `RevealGate`, then a `Reveal split` `Button` → dispatch `REVEAL`.

**Phase `collecting` — QUICK mode (count hands)**
- The two `OptionCard`s shown together (reader reads aloud).
- Two `Stepper`s: "Hands for A" / "Hands for B", each 0..playerCount. On change dispatch `SET_QUICK_COUNTS { A, B }`. Helper line shows `A + B` vs player count (warn if `> n`, allow `< n` for abstentions).
- `Reveal split` `Button` (enabled once at least one count > 0) → dispatch `REVEAL`.

**Phase `reveal`**
- `VoteBar` — animated split bar, A vs B, with counts and percentages; majority side highlighted; `Confetti` burst if `awardMajorityPoints`.
- Per-side labels = `optionA`/`optionB`. Optional `note` shown as a `Card` below ("Debate prompt").
- If points on (vote): small toast / inline chips "+1" over winning avatars (we *can* show choices now). If quick: "Side A wins 6–4" banner only.
- Buttons: `Debate` `Button` → `ENTER_DEBATE`; `Next` `Button` → `NEXT`. (Debate is optional; `Next` is always available from reveal.)

**Phase `debate`**
- Same `VoteBar` (now static) + the `note`/optional discussion prompt enlarged.
- Single primary `Next` `Button` → `NEXT`.
- Kebab: `Skip remaining` not offered here; `End game` → `ABORT`.

After `NEXT`, if not done → back to `prompt` for `order[index]`; if done → navigate to Results (router) since `phase === "results"`.

Dispatches summary: `BEGIN_COLLECTION`, `CHOOSE`, `UNDO_CHOICE`, `ADVANCE_HANDOFF`, `SET_QUICK_COUNTS`, `REVEAL`, `ENTER_DEBATE`, `NEXT`, `SKIP`, `ABORT`.

### 10.3 ResultsScreen

Reads `selectors.standings`, `state.history`, `state.config`.

On screen:
- `AppBar` "Results" / `t("games.wyr.results")`.
- **If `awardMajorityPoints` && vote mode** — `results` standings list: ranked `PlayerAvatar` + score chips; top score(s) get a `Confetti` + crown; co-winners shown together. Subtitle "Most in step with the crowd".
- **Else (points off, or quick mode)** — **Recap** mode: a vertical list of `RoundRecord`s, each a compact `VoteBar` mini with the two option labels and the split (e.g. "Fly 7 — Invisible 2"), plus the running "A won X / B won Y" summary at top. No winner declared.
- **Most divisive prompt** highlight: the round whose `|countA-countB|` is smallest (closest to 50/50) shown as a fun stat `Card` ("Biggest debate").
- Buttons: `Play again` `Button` → engine reshuffles, dispatch `RESTART { order, total }`; `Change settings` → back to `SetupScreen` (keep roster); `Home` → router Home. Optional `Share` (later) renders split history as text.

Dispatches: `RESTART`. (`ABORT` already landed us here.)

---

## 11. Pass-and-Play Handoff & Secrecy (RevealGate)

The single device is passed around in **vote mode**; secrecy matters so players don't bandwagon.

- **Per-voter gate**: before each player taps, a full-screen `RevealGate` (opaque, accent background) shows "Give the phone to **{name}**" + avatar + a deliberate confirm `Button`. Options are hidden until confirmed. This is the same `revealGate` primitive used by hidden-role games.
- **No live tally**: during `collecting`, the screen never shows how many chose A vs B, nor who chose what. Only after `REVEAL` is the split shown.
- **Order**: handoff follows `turnOrder` via `handoffIndex`. The screen names the next voter; players physically pass the phone.
- **Mistap correction**: a player may `UNDO_CHOICE` / re-`CHOOSE` *while still holding the device* (before `ADVANCE_HANDOFF`). Once handed off, their choice is locked (no retro-edit, preserving secrecy).
- **Back-to-group gate**: after the last voter, a final `RevealGate` ("Pass back to the group — ready to reveal?") prevents the last voter from privately seeing the result first.
- **Quick mode** needs no secrecy gate (group votes by hand-raise); the reader simply enters counts. A short note advises the reader to read aloud first, then count.
- **Resilience**: state persists (zustand `persist` + idb-keyval) so a lock/refresh mid-game restores the exact phase, `index`, `choices`, and `handoffIndex`. The `RevealGate` re-shows on restore so a returning device still hides in-progress choices.

---

## 12. Edge Cases

| Case | Handling |
| --- | --- |
| `< 2` players at setup | Start disabled; helper text "Add at least 2 players". |
| Pool smaller than chosen length | `total = min(length, pool.length)`; if pool `=== 0` (over-filtered) Start disabled with "No prompts at this intensity". |
| `roundLength: "all"` | `total = pool.length`. |
| Player abstains in vote mode (skips without tapping) | Allowed — `ADVANCE_HANDOFF` can move on; that player has no entry in `choices`, scores nothing; counts reflect only actual votes. |
| Quick counts exceed player count | Allowed but warned (reader error); reveal still uses entered counts. |
| Quick counts both 0 | `Reveal` disabled until at least one > 0. |
| Tie split | `majority = "tie"`; reveal shows a centered 50/50 bar; points per `tieCountsForBoth`. |
| Double-tap / out-of-phase action | Reducer no-ops (returns same ref); UI also guards buttons. |
| `SKIP` after reveal (points applied) | `recomputeScores` from `history` rolls back the skipped round's points. |
| Player removed from roster mid-game | Engine roster is locked once `START` fires (config snapshots `playerIds`); reducer only references `config.playerIds`, so external roster edits don't affect an in-flight game. |
| Locale switch mid-game | Pure content re-render via `pick(localized, locale)`; no state change. RTL flips layout via logical utilities + `dir`. |
| Duplicate prompt | Impossible within a game — `order` is a shuffled set of unique itemIds, sliced to `total`. |
| App backgrounded during handoff | Persisted; on resume the `RevealGate` for the current voter re-shows (no choice leak). |
| Mute on | `Sound`/haptic calls are global-mute aware; no-ops when muted. |

---

## 13. Unit Tests — `logic.test.ts` (vitest)

Pure-reducer tests; no React, no clock, no RNG. Use a fixed `config`, fixed `order` from payloads.

| # | Test | Asserts |
| --- | --- | --- |
| T-01 | `createInitialState(cfg)` shape | phase `setup`, `index 0`, empty `choices`/`history`, all `scores` 0, `config` stored. |
| T-02 | `START` initializes | sets `order`, `total`, phase `prompt`, scores reset to 0 for all players. |
| T-03 | `BEGIN_COLLECTION` from `prompt` | phase `collecting`, buffers cleared. |
| T-04 | `BEGIN_COLLECTION` out of phase | no-op (same ref). |
| T-05 | `CHOOSE` in vote mode | records `choices[pid]=side`, sets `lastChoiceBy`. |
| T-06 | `CHOOSE` overwrite before reveal | second `CHOOSE` for same player replaces side. |
| T-07 | `CHOOSE` in quick mode | no-op (mode guard). |
| T-08 | `UNDO_CHOICE` | removes entry; clears `lastChoiceBy` if it matched. |
| T-09 | `ADVANCE_HANDOFF` clamps | never exceeds `playerIds.length`. |
| T-10 | `SET_QUICK_COUNTS` clamps negatives to 0 | `{A:-3,B:2}` → `{A:0,B:2}`. |
| T-11 | `REVEAL` vote tally + majority | counts derived from `choices`; majority correct for A>B, B>A. |
| T-12 | `REVEAL` quick tally | counts from `quickCounts`; majority correct. |
| T-13 | `REVEAL` tie | majority `"tie"`; with `tieCountsForBoth` all voters +1; without, none. |
| T-14 | Points off by default | `awardMajorityPoints:false` → scores unchanged after `REVEAL`. |
| T-15 | Majority points (vote) | only majority-side voters +1; abstainers unchanged. |
| T-16 | Quick mode no per-player points | scores unchanged even with `awardMajorityPoints` (no `quickAttributePoints`). |
| T-17 | `NEXT` records history + advances | `history` gets a `RoundRecord`; `index++`; buffers cleared. |
| T-18 | `NEXT` to results at `total` | when `index+1 >= total` → phase `results`. |
| T-19 | `NEXT` exhausts pool early | when `index+1 >= order.length` → `results` even if `< total`. |
| T-20 | `SKIP` rolls back points | reveal+score, then `SKIP` → scores recomputed from history (round's points removed); no history entry added; `index++`. |
| T-21 | `SKIP` from `prompt` | advances index, no history, no score change. |
| T-22 | `recomputeScores` determinism | re-reducing the same `history` yields identical `scores` (idempotent). |
| T-23 | Out-of-phase guards | `REVEAL` in `prompt`, `NEXT` in `collecting`, `CHOOSE` in `reveal` all no-op. |
| T-24 | Full game integration | 3-prompt scripted game (vote, points on) → correct standings, history length 3, phase `results`. |
| T-25 | `RESTART` keeps config, resets play | new `order`/`total`, scores 0, history empty, phase `prompt`. |
| T-26 | `ABORT` jumps to results | from `debate`/`collecting` → phase `results`; from `results` no-op. |
| T-27 | Purity | reducer does not mutate input (deep-freeze input state, assert no throw). |
| T-28 | Determinism | same `(state, action)` twice → deep-equal outputs. |

Minimal fixtures:

```ts
const cfg = (over: Partial<WyrConfig> = {}): WyrConfig => ({
  playerIds: ["p1","p2","p3"], deckId: "classic", maxIntensity: "spicy",
  mode: "vote", roundLength: 3, awardMajorityPoints: true,
  quickAttributePoints: false, tieCountsForBoth: true, shuffleSeed: 1, ...over,
});
const started = reducer(createInitialState(cfg()), { type:"START", order:["a","b","c"], total:3 });
```

---

## 14. i18n Keys (catalog `games.wyr.*`)

UI strings live in the locale catalogs (en + fa); content stays in JSON.

```
games.wyr.title
games.wyr.blurb
games.wyr.wouldYouRather        // "Would you rather…" / "کدوم رو ترجیح می‌دی…"
games.wyr.optionA / optionB
games.wyr.startVoting
games.wyr.countHands
games.wyr.passTo                // "Give the phone to {name}" / "گوشی رو بده به {name}"
games.wyr.imReady               // "I'm {name} — ready"
games.wyr.lockedIn / change
games.wyr.passBackToGroup
games.wyr.revealSplit
games.wyr.handsForA / handsForB
games.wyr.debate / next / skip / endGame
games.wyr.results / playAgain / changeSettings / home
games.wyr.poolSize              // "{n} prompts available"
games.wyr.sideWins              // "{side} wins {a}–{b}"
games.wyr.biggestDebate / mostInStep
games.wyr.needTwoPlayers / noPromptsAtIntensity
```

Both `en` and `fa` values are authored in the shared catalog files; this game only references keys.

---

## 15. Definition of Done

- [ ] Folder added under `src/games/would-you-rather/` with all files in §4; no shared file edited; registry auto-discovers it.
- [ ] `logic.ts` pure; all §13 tests pass (`vitest`), including purity/determinism.
- [ ] `classic` deck ships ≥ 14 bilingual items; `spicy` deck ships its own; both validate against `WyrDeck`.
- [ ] Three screens render from `sdk/ui`, dispatch only the actions in §8, and work in both modes.
- [ ] Full RTL: layout uses logical utilities; A/B option order respects `dir`.
- [ ] Light/dark + global mute + haptics honored; SFX on choose/reveal.
- [ ] Offline: state persists across reload; `RevealGate` re-shows on resume (no choice leak).
- [ ] Works signed-out; if signed-in, scores/history can sync to Supabase via the shared stats primitive (no game-specific backend code).
