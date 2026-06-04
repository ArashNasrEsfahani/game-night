# Game Spec — Codenames-style ("Spy Grid" / `codenames`)

> Status: Approved-plan expansion. Implementation-ready.
> Game id: `codenames` · Folder: `src/games/codenames/`
> Conforms to the SDK contract defined in `docs/specs/00-architecture.md` (types: `LocalizedString`, `GameManifest`, `GameModule`, `GameContext`; engine primitives: `roster`, `teams`, `turnOrder`, `timer`, `deck`, `scoring`, `voting`, `revealGate`, `phaseMachine`, `results`).

A pass-and-play, single-device adaptation of a Codenames-style hidden-key word game. Two teams, each with a **spymaster**. A 5×5 grid of 25 bilingual words is generated alongside a secret **key card** (which word belongs to team A / team B / neutral / assassin). The phone is passed around the group: the spymaster privately views the key behind a **RevealGate**, gives a one-word clue + a number out loud, then hands the phone to the guessers who tap word tiles to reveal their colors. First team to reveal all of its own words wins; tapping the **assassin** loses instantly.

---

## 1. Player Range & Modes

| Aspect | Value |
| --- | --- |
| Min players | 4 (2 per team minimum: 1 spymaster + ≥1 guesser each) |
| Recommended | 4–8 |
| Max players | 16 (soft cap from shared roster; no hard logic limit) |
| Teams | Exactly **2** (`teamA`, `teamB`). Fixed — Codenames is inherently two-sided. |
| Turn unit | Team (alternating), not individual player |
| Device model | **Pass-and-play on one phone**, passed between spymaster ↔ guessers each half-turn |

### Modes (`GameConfig.mode`)
- **`classic`** — Standard rules. Spymaster gives clue + number `N`; guessers get up to `N + 1` guesses; first wrong/neutral ends turn; assassin = instant loss; first to clear all own words wins.
- **`untimed`** — Same as classic but no per-turn guess timer (timer primitive not mounted). Default.
- **`timed`** — Classic + a per-half-turn `timer` (configurable seconds) for the guessing phase. When the timer expires mid-guessing, the turn ends automatically (treated as a voluntary stop, no penalty beyond losing the turn).

> There is **no single-device "everyone is spymaster"** variant in v1. Both spymasters use the same phone at different times; secrecy is enforced by RevealGate + handoff prompts (see §8).

---

## 2. Content Schema

Game CONTENT (the word pool) ships as bilingual JSON data files under `src/games/codenames/content/`. Words are the only content type. Boards are generated at runtime from the pool (see key generator §6). Content is **data**, never UI strings — it is not part of the i18n catalogs.

### 2.1 TypeScript schema (`content/schema.ts`)

```ts
import type { LocalizedString } from '../../../sdk/types';

/** A single playable word tile candidate. */
export interface WordEntry {
  /** Stable unique id within a pack, kebab/snake; used for seeded selection + dedupe. */
  id: string;
  /** Bilingual surface text shown on the tile. */
  text: LocalizedString;
  /** Optional difficulty hint for future filtering. 1 = easy/common, 3 = hard/abstract. */
  difficulty?: 1 | 2 | 3;
  /** Optional category tag (for themed packs / future filters). */
  tags?: string[];
}

/** A named, bilingual word pack file. */
export interface WordPack {
  /** Pack id, matches filename without extension, e.g. "core". */
  id: string;
  /** Display name shown in Setup pack picker. */
  name: LocalizedString;
  /** Schema version for migration safety. */
  version: 1;
  /** RTL-safe: each word carries both languages so the board renders in active locale. */
  words: WordEntry[];
}
```

### 2.2 Loading & registry contract
- Each pack file (`content/core.json`, `content/places.json`, …) is a `WordPack`.
- `content/index.ts` eagerly imports all packs and exposes a typed array:

```ts
import type { WordPack } from './schema';
const files = import.meta.glob('./*.json', { eager: true, import: 'default' });
export const WORD_PACKS: WordPack[] = Object.values(files) as WordPack[];
export const DEFAULT_PACK_ID = 'core';
```
- The setup flow flattens the **selected** packs into one `WordEntry[]` candidate pool. The reducer never imports content directly — the resolved pool is passed into `createInitialState(cfg)` via `cfg.wordPool` so the reducer stays pure and testable.

### 2.3 Sample bilingual content (`content/core.json`, excerpt — ≥12 real items)

```json
{
  "id": "core",
  "name": { "en": "Core Words", "fa": "واژگان پایه" },
  "version": 1,
  "words": [
    { "id": "apple",    "text": { "en": "Apple",    "fa": "سیب" },     "difficulty": 1, "tags": ["food"] },
    { "id": "moon",     "text": { "en": "Moon",     "fa": "ماه" },     "difficulty": 1, "tags": ["sky"] },
    { "id": "river",    "text": { "en": "River",    "fa": "رودخانه" }, "difficulty": 1, "tags": ["nature"] },
    { "id": "bridge",   "text": { "en": "Bridge",   "fa": "پل" },      "difficulty": 1, "tags": ["place"] },
    { "id": "fire",     "text": { "en": "Fire",     "fa": "آتش" },     "difficulty": 1, "tags": ["element"] },
    { "id": "king",     "text": { "en": "King",     "fa": "پادشاه" },  "difficulty": 1, "tags": ["people"] },
    { "id": "garden",   "text": { "en": "Garden",   "fa": "باغ" },     "difficulty": 1, "tags": ["place"] },
    { "id": "tea",      "text": { "en": "Tea",      "fa": "چای" },     "difficulty": 1, "tags": ["food"] },
    { "id": "snow",     "text": { "en": "Snow",     "fa": "برف" },     "difficulty": 1, "tags": ["weather"] },
    { "id": "lion",     "text": { "en": "Lion",     "fa": "شیر" },     "difficulty": 2, "tags": ["animal"] },
    { "id": "mirror",   "text": { "en": "Mirror",   "fa": "آینه" },    "difficulty": 2, "tags": ["object"] },
    { "id": "carpet",   "text": { "en": "Carpet",   "fa": "فرش" },     "difficulty": 1, "tags": ["object"] },
    { "id": "star",     "text": { "en": "Star",     "fa": "ستاره" },   "difficulty": 1, "tags": ["sky"] },
    { "id": "desert",   "text": { "en": "Desert",   "fa": "کویر" },    "difficulty": 2, "tags": ["nature"] },
    { "id": "poet",     "text": { "en": "Poet",     "fa": "شاعر" },    "difficulty": 2, "tags": ["people"] },
    { "id": "key",      "text": { "en": "Key",      "fa": "کلید" },    "difficulty": 1, "tags": ["object"] },
    { "id": "ship",     "text": { "en": "Ship",     "fa": "کشتی" },    "difficulty": 1, "tags": ["vehicle"] },
    { "id": "spider",   "text": { "en": "Spider",   "fa": "عنکبوت" },  "difficulty": 2, "tags": ["animal"] }
  ]
}
```

> The pool must contain **≥ 25 entries per active selection** for a board; if a single small pack is chosen the UI forces multi-select or falls back to including `core`. Words with the same `id` across packs are de-duplicated (first wins) before board generation.

---

## 3. GameConfig (all setup options)

```ts
import type { WordEntry } from './content/schema';

export type CodenamesMode = 'classic' | 'untimed' | 'timed';

/** Persisted, fully-resolved config produced by SetupScreen and handed to logic. */
export interface CodenamesConfig {
  mode: CodenamesMode;

  /** Team rosters resolved from the shared roster primitive. Player ids reference RosterPlayer.id. */
  teamA: { name: LocalizedString; spymasterId: string; memberIds: string[] };
  teamB: { name: LocalizedString; spymasterId: string; memberIds: string[] };

  /** Which team starts (and therefore gets 9 words). If 'random', resolved via seed at init. */
  startingTeam: 'teamA' | 'teamB' | 'random';

  /** Selected word pack ids (>=1). */
  packIds: string[];

  /** Flattened, de-duplicated candidate pool resolved from packIds (passed in for purity). */
  wordPool: WordEntry[];

  /** Board size. Locked to 5 in v1 but parameterized for future 4x4/6x6. */
  gridSize: 5;

  /** Guess timer length in seconds for mode 'timed'. Ignored otherwise. */
  turnSeconds: number; // default 120

  /** Allow guessers the conventional "+1" bonus guess after using all N. Default true. */
  allowBonusGuess: boolean;

  /** Master seed for all randomness (board layout, key assignment, starting team). */
  seed: number;
}

export const DEFAULT_CONFIG: Omit<CodenamesConfig, 'teamA' | 'teamB' | 'wordPool' | 'seed'> = {
  mode: 'untimed',
  startingTeam: 'random',
  packIds: ['core'],
  gridSize: 5,
  turnSeconds: 120,
  allowBonusGuess: true,
};
```

Setup option summary:

| Option | UI control | Values | Default |
| --- | --- | --- | --- |
| Teams & members | `TeamBuilder` (SDK) | drag/assign roster into A/B | balanced auto-split |
| Spymaster per team | `PlayerPicker` per team | one member id each | first member |
| Team names | text fields (bilingual editable, optional) | `LocalizedString` | "Red"/"قرمز", "Blue"/"آبی" |
| Mode | `SegmentedControl` | classic / untimed / timed | untimed |
| Starting team | `SegmentedControl` | A / B / random | random |
| Word packs | `MultiSelectChips` | any `WORD_PACKS` | `[core]` |
| Guess timer | `Stepper` (only if timed) | 30–300s | 120 |
| Bonus guess (+1) | `Toggle` | on/off | on |

---

## 4. State Shape

The full reducer state. **Purely a data structure** — no functions, no class instances, JSON-serializable so it survives `zustand persist` + IndexedDB.

```ts
export type TeamId = 'teamA' | 'teamB';

/** Card role on the key card. */
export type CardRole = 'teamA' | 'teamB' | 'neutral' | 'assassin';

export interface BoardCell {
  index: number;            // 0..24, row-major
  word: LocalizedString;    // resolved bilingual text for the tile
  wordId: string;           // source WordEntry.id (for tests/debug)
  role: CardRole;           // secret key — only shown to spymaster / on reveal
  revealed: boolean;        // has been tapped & flipped by guessers
}

export type CodenamesPhase =
  | 'spymasterHandoff'  // "Pass to <Team> spymaster" prompt; RevealGate locked
  | 'clue'              // spymaster privately views key, enters clue verbally, taps "Clue given"
  | 'guesserHandoff'    // "Hide the phone — pass to guessers" prompt
  | 'guessing'          // guessers tap tiles
  | 'turnEnd'           // brief result-of-turn summary before alternating
  | 'gameOver';         // someone won / assassin triggered

export interface ClueRecord {
  team: TeamId;
  count: number;            // the spoken number N (0 = unlimited intent; treated as guesses=board, but we cap)
  guessesAllowed: number;   // computed: N (+1 if allowBonusGuess), or Infinity-cap for N=0
  guessesMade: number;
}

export interface CodenamesState {
  phase: CodenamesPhase;

  board: BoardCell[];       // length gridSize*gridSize (25)
  gridSize: 5;

  startingTeam: TeamId;     // got the extra word (9)
  currentTeam: TeamId;      // whose turn it is now

  /** Remaining unrevealed words owned by each team — drives win check + scoreboard. */
  remaining: Record<TeamId, number>;  // init: {start:9, other:8}

  /** The clue for the CURRENT guessing turn, or null before a clue is given. */
  activeClue: ClueRecord | null;

  /** Full history of clues for the ResultsScreen recap. */
  clueLog: ClueRecord[];

  /** Outcome of the most recent tile tap, for turnEnd messaging + SFX selection. */
  lastReveal: {
    cellIndex: number;
    role: CardRole;
    outcome: 'correct' | 'wrongTeam' | 'neutral' | 'assassin';
  } | null;

  /** Reason the previous turn ended (for the turnEnd banner). */
  turnEndReason:
    | 'guessedWrong'      // hit other team / neutral
    | 'usedAllGuesses'    // exhausted guessesAllowed
    | 'stopped'           // guessers chose to stop early
    | 'timeUp'            // timed mode expired
    | null;

  winner: TeamId | null;
  loser: TeamId | null;     // set when assassin hit (the team that tapped it)
  winReason: 'clearedWords' | 'opponentHitAssassin' | null;

  teamMeta: Record<TeamId, { name: LocalizedString; spymasterId: string; memberIds: string[] }>;

  config: {
    mode: CodenamesMode;
    turnSeconds: number;
    allowBonusGuess: boolean;
    gridSize: 5;
  };

  /** Monotonic counter; bumped each board generation. Lets screens key animations. */
  boardSerial: number;
}
```

Color mapping for rendering (UI concern, listed here so screens agree):

| `CardRole` | Light token | Dark token | Persian label |
| --- | --- | --- | --- |
| `teamA` (red) | `--color-team-a` | same, dimmed | تیم قرمز |
| `teamB` (blue) | `--color-team-b` | same, dimmed | تیم آبی |
| `neutral` | `--color-neutral` | beige/slate | خنثی |
| `assassin` | `--color-assassin` | near-black | جاسوس مرگ‌بار |

---

## 5. Actions & Reducer Transitions

Reducer signature (PURE — all randomness arrives as seeds in payloads):

```ts
export function reducer(state: CodenamesState, action: CodenamesAction): CodenamesState;
```

```ts
export type CodenamesAction =
  | { type: 'REVEAL_KEY_TO_SPYMASTER' }                       // RevealGate unlocked by spymaster
  | { type: 'GIVE_CLUE'; count: number }                      // spymaster confirms clue + number
  | { type: 'HANDOFF_TO_GUESSERS' }                           // key hidden, phone passed
  | { type: 'GUESS_CELL'; cellIndex: number }                 // guesser taps a tile
  | { type: 'STOP_GUESSING' }                                 // guessers end turn early
  | { type: 'TIMER_EXPIRED' }                                 // timed mode only
  | { type: 'ADVANCE_TURN' }                                  // from turnEnd -> next team's handoff
  | { type: 'NEW_BOARD'; seed: number }                       // regenerate (rematch same teams)
  | { type: 'RESET' };                                        // back to initial (config kept)
```

### 5.1 `createInitialState(cfg: CodenamesConfig): CodenamesState`
Pure. Builds the first board using `cfg.seed`:
1. Resolve `startingTeam`: if `'random'`, pick via seeded coin (`seededInt(seed, 0, 1)`).
2. Generate board via the **key generator** (§6) → 25 cells with roles + words, `revealed:false`.
3. `remaining = { [start]: 9, [other]: 8 }`.
4. `currentTeam = startingTeam`, `phase = 'spymasterHandoff'`, `activeClue = null`, `clueLog = []`, all outcome fields `null`, `winner/loser = null`, `boardSerial = 0`.

### 5.2 Transition table

| Action | Valid in phase | Effect | Next phase |
| --- | --- | --- | --- |
| `REVEAL_KEY_TO_SPYMASTER` | `spymasterHandoff` | No state change beyond phase; gate now considered passed. | `clue` |
| `GIVE_CLUE {count}` | `clue` | Clamp `count` to `[0, remaining[currentTeam]]` (0 allowed = "zero/unlimited" intent). Compute `guessesAllowed`: if `count===0` → `remaining[currentTeam]` (a sane cap, no +1); else `count + (allowBonusGuess ? 1 : 0)`. Set `activeClue = {team:currentTeam, count, guessesAllowed, guessesMade:0}`; push copy to `clueLog`. | `guesserHandoff` |
| `HANDOFF_TO_GUESSERS` | `guesserHandoff` | Phase only (key overlay now hidden). | `guessing` |
| `GUESS_CELL {cellIndex}` | `guessing` | See §5.3 resolution. | `guessing` \| `turnEnd` \| `gameOver` |
| `STOP_GUESSING` | `guessing` | Only allowed if `activeClue.guessesMade >= 1` OR `count===0`-style; set `turnEndReason='stopped'`, `activeClue=null`. | `turnEnd` |
| `TIMER_EXPIRED` | `guessing` (timed) | `turnEndReason='timeUp'`, `activeClue=null`. | `turnEnd` |
| `ADVANCE_TURN` | `turnEnd` | Flip `currentTeam`, clear `lastReveal`, `turnEndReason`, `activeClue=null`. | `spymasterHandoff` |
| `NEW_BOARD {seed}` | any (typically `gameOver`) | Re-run generator with new seed; reset board/remaining/clueLog/outcomes; keep `teamMeta`+`config`; `startingTeam` re-rolled from seed; `boardSerial++`. | `spymasterHandoff` |
| `RESET` | any | Return to `createInitialState`-equivalent for stored config (fresh seed required → caller passes via re-init; `RESET` keeps current board seed and just clears reveals). | `spymasterHandoff` |

> Any action dispatched in a wrong phase is a **no-op** (returns the same state reference) — defends against double-taps and stale handoff screens.

### 5.3 `GUESS_CELL` resolution (the core rule engine)

Given `cell = board[cellIndex]`:

1. **Guard:** if `cell.revealed` → no-op (already flipped). If no `activeClue` → no-op.
2. Set `cell.revealed = true`. Increment `activeClue.guessesMade`.
3. Determine `outcome` from `cell.role` vs `currentTeam`:
   - `cell.role === currentTeam` → **`correct`**.
   - `cell.role === assassin` → **`assassin`**.
   - `cell.role === neutral` → **`neutral`**.
   - else (the *other* team's color) → **`wrongTeam`**.
4. If the revealed role is `teamA`/`teamB`, decrement `remaining[cell.role]` (always decrement the **owner's** count, regardless of who tapped it — tapping the enemy's word helps them).
5. Set `lastReveal = { cellIndex, role: cell.role, outcome }`.
6. Apply outcome:

| outcome | remaining check | result |
| --- | --- | --- |
| `assassin` | — | `loser = currentTeam`, `winner = other`, `winReason='opponentHitAssassin'` → **`gameOver`** |
| `correct` | if `remaining[currentTeam]===0` → `winner=currentTeam`, `winReason='clearedWords'` → **`gameOver`** | else if `guessesMade >= guessesAllowed` → `turnEndReason='usedAllGuesses'` → **`turnEnd`**; else stay **`guessing`** |
| `wrongTeam` | if that decrement made `remaining[otherTeam]===0` → other team wins (`clearedWords`) → **`gameOver`** | else `turnEndReason='guessedWrong'` → **`turnEnd`** |
| `neutral` | — | `turnEndReason='guessedWrong'` → **`turnEnd`** |

> Win-by-helping edge: if a guesser taps the enemy's last word, the **enemy** wins immediately (their `remaining` hit 0). This matches Codenames and is covered by a unit test.

---

## 6. Key Generator & Board Layout (seeded, pure)

`logic.ts` contains a deterministic generator so the reducer/tests reproduce boards from a seed. Randomness = a small seeded PRNG (mulberry32 / xmur3 hash → uint32) living in `sdk/engine/rng.ts` and re-exported; **never** `Math.random()` inside logic.

```ts
// composition of key card for a 5x5 board, starting team gets 9
function keyComposition(start: TeamId): CardRole[] {
  const other: TeamId = start === 'teamA' ? 'teamB' : 'teamA';
  return [
    ...Array(9).fill(start),
    ...Array(8).fill(other),
    ...Array(7).fill('neutral'),
    'assassin',
  ]; // length 25
}

function generateBoard(pool: WordEntry[], start: TeamId, seed: number, gridSize: 5): BoardCell[] {
  const rng = makeRng(seed);
  const words  = seededSample(pool, gridSize * gridSize, rng); // 25 distinct WordEntry
  const roles  = seededShuffle(keyComposition(start), rng);    // 25 roles shuffled
  return words.map((w, i) => ({
    index: i, word: w.text, wordId: w.id, role: roles[i], revealed: false,
  }));
}
```

Determinism contract (asserted by tests):
- Same `(pool, start, seed)` ⇒ byte-identical `board`.
- Exactly 9 starting-team, 8 other, 7 neutral, 1 assassin.
- All 25 `wordId`s distinct.

---

## 7. Win / Scoring Rules

- **Primary win:** A team's `remaining` reaches `0` (all its words revealed) → `winner` set, `winReason='clearedWords'`. This can happen on the current team's correct guess **or** when the opposing guessers accidentally reveal that team's final word.
- **Assassin loss:** The team that taps the assassin loses immediately; the other team is declared `winner` with `winReason='opponentHitAssassin'`.
- **No points/score accumulation across a single board** — Codenames is win/lose per board. The `scoring` primitive is used only for **session/series** tallies (best-of-N rematches) and the `stats` integration, not per-tile.
- **Series mode (optional, via rematch):** each `NEW_BOARD` is a new round; the SDK `scoring` primitive tracks rounds won per team for the cross-board scoreboard shown on Results.
- **Tie:** impossible within one board (assassin/clear are exclusive and terminal). Series ties handled by the generic results primitive (shows "Draw").

---

## 8. Pass-and-Play Handoff & Secrecy (RevealGate)

The whole game hinges on the spymaster seeing the key while guessers do not, on one shared phone. Sequence per turn:

1. **`spymasterHandoff`** — Full-screen `HandoffCard` (SDK): "Pass the phone to **{Team} spymaster** ({spymaster name})". Big team-colored panel. The key is **not rendered** in the DOM. A single CTA "I'm the spymaster" → dispatches `REVEAL_KEY_TO_SPYMASTER`.
2. **`clue`** — `RevealGate` (SDK strict variant) wraps the `KeyOverlay`. The gate requires an explicit press-and-hold or tap-to-reveal so a glance-over-shoulder is harder. Behind the gate: the 5×5 grid is shown **with role colors** (the key), plus the spymaster's own remaining count and a clue composer (one-word clue is spoken aloud, app only captures the **number**). CTA "Clue given" → `GIVE_CLUE {count}`. The number stepper enforces `0..remaining[currentTeam]`.
3. **`guesserHandoff`** — `HandoffCard`: "Hide the key — pass the phone to the guessers." The key overlay is unmounted (not just hidden) before this screen mounts. CTA "We're ready" → `HANDOFF_TO_GUESSERS`.
4. **`guessing`** — Grid renders **without** roles (only revealed tiles show color). Spoken clue + number echoed at top (the number only; the word was verbal). Guessers tap → `GUESS_CELL`. "Stop guessing" → `STOP_GUESSING`.
5. **`turnEnd`** — Brief banner (reason + which team is next) → `ADVANCE_TURN`.

Secrecy guarantees:
- Unrevealed roles are present in `state.board` (needed for the reducer) but **PlayScreen never renders `cell.role` during `guessing`/handoff** — it gates on `phase === 'clue'` only.
- `RevealGate` defaults to **strict mode** (`requireHold`) so accidentally landing on the clue screen doesn't expose the key.
- On `guesserHandoff` the component tree for the key overlay is conditionally unmounted; React reconciliation guarantees no stale key pixels remain.
- App-level: while in `clue` phase, optional "screen dimmed until hold" affordance; haptic pulse on reveal.

---

## 9. Screen-by-Screen Breakdown

All screens are composed from `sdk/ui` and receive `ctx: GameContext` (gives access to `roster`, `teams`, `timer`, `revealGate`, `phaseMachine`, `results`, `t()` i18n, `sound`, `haptics`, plus `state` + `dispatch`).

### 9.1 `screens/SetupScreen.tsx`
Purpose: collect `CodenamesConfig`, then call `ctx.start(config)`.

| UI region | SDK component | Dispatches / calls |
| --- | --- | --- |
| Title + rules blurb | `ScreenHeader`, `RulesAccordion` | — |
| Team builder (A/B) | `TeamBuilder` (wraps `roster`+`teams`) | local config; auto-balance button |
| Spymaster per team | `PlayerPicker` ×2 | sets `teamA.spymasterId` / `teamB.spymasterId` |
| Team name editors | `LocalizedTextField` ×2 | sets team `name` |
| Mode | `SegmentedControl` | `mode` |
| Starting team | `SegmentedControl` | `startingTeam` |
| Word packs | `MultiSelectChips` (from `WORD_PACKS`) | `packIds` → resolves `wordPool` |
| Guess timer (if `timed`) | `Stepper` | `turnSeconds` |
| Bonus +1 guess | `Toggle` | `allowBonusGuess` |
| Validation + Start | `PrimaryButton` | on press: validate (§11), generate `seed`, resolve `wordPool`, `ctx.start(config)` which runs `createInitialState` |

Validation gate (button disabled + inline errors) before Start:
- Each team has ≥1 member **and** a spymaster who is a member.
- Spymasters of A and B are different players.
- Combined de-duped `wordPool.length >= 25`.

### 9.2 `screens/PlayScreen.tsx`
Single screen that switches on `state.phase` via `ctx.phaseMachine`. Renders the `Grid` component throughout but toggles role visibility.

| Phase | What's on screen | SDK components | Controls → actions |
| --- | --- | --- | --- |
| `spymasterHandoff` | Team-colored full-bleed handoff prompt naming the spymaster | `HandoffCard`, `TeamBadge` | "I'm the spymaster" → `REVEAL_KEY_TO_SPYMASTER` |
| `clue` | `RevealGate` → `KeyOverlay` (grid WITH colors), remaining counter, number `Stepper` | `RevealGate`, `Grid` (spymaster variant), `Stepper`, `Scoreboard` | "Clue given" → `GIVE_CLUE{count}` |
| `guesserHandoff` | "Hide key, pass to guessers" | `HandoffCard` | "We're ready" → `HANDOFF_TO_GUESSERS` |
| `guessing` | Grid WITHOUT colors (revealed tiles flip), clue number echo, guesses left, optional `Timer` | `Grid` (guesser variant), `ClueBanner`, `Timer`, `Scoreboard` | tile tap → `GUESS_CELL{cellIndex}`; "Stop guessing" → `STOP_GUESSING`; (timed) timer end → `TIMER_EXPIRED` |
| `turnEnd` | Banner: outcome of last reveal + next team; mini scoreboard | `Banner`, `Scoreboard`, `TeamBadge` | "Continue" → `ADVANCE_TURN` |
| `gameOver` | Hands off to ResultsScreen via `phaseMachine` (or inline `Confetti` + CTA) | `Confetti`, `PrimaryButton` | "See results" → navigate Results |

`Grid` component (`components/Grid.tsx`, local to game, built from SDK `Tile`/`Card`):
- Props: `cells: BoardCell[]`, `mode: 'spymaster' | 'guesser'`, `onTap?(index)`, `disabled`.
- Spymaster mode: every tile tinted by `role`; non-interactive.
- Guesser mode: only `revealed` tiles tinted; unrevealed tiles are neutral/tappable.
- Framer-motion flip animation on reveal keyed by `boardSerial+index`. RTL: grid is logical (row-major) and direction-agnostic; numbers/labels use logical props.
- Each tile: bilingual word in active locale, large tap target (≥44px), `aria-label` includes word + (for spymaster) role.

### 9.3 `screens/ResultsScreen.tsx`
Purpose: celebrate winner, recap, rematch.

| UI region | SDK component | Action / call |
| --- | --- | --- |
| Winner headline + reason | `ResultsHeader` (from `results`), `Confetti`, `TeamBadge` | reads `state.winner/winReason/loser` |
| Final board (all roles revealed) | `Grid` (spymaster/reveal-all variant, non-interactive) | — |
| Clue log recap | `ClueLogList` | maps `state.clueLog` |
| Series scoreboard (rounds) | `Scoreboard` (from `scoring`) | reads series tally |
| Rematch same teams | `PrimaryButton` | `NEW_BOARD{seed: freshSeed()}` |
| Back to home / change teams | `SecondaryButton` | `RESET` + navigate Setup/Home |
| Save group | `SaveGroupButton` (optional sign-in) | persists roster grouping via store |

---

## 10. SDK Primitives Consumed

| Primitive | Use in this game |
| --- | --- |
| `roster` | Player pool for assigning members to teams + picking spymasters. |
| `teams` | Two-team partition (`teamA`/`teamB`), names, membership, `TeamBadge`. |
| `turnOrder` | Alternating two-team turn sequencing (`currentTeam` flip on `ADVANCE_TURN`). |
| `timer` | Only mounted in `mode: 'timed'`; drives guessing-phase countdown → `TIMER_EXPIRED`. |
| `deck` | Word pool draw: `seededSample` from `wordPool` to fill the 25 tiles (deck = the word candidate pool). |
| `scoring` | Cross-board **series** tally (rounds won per team); not per-tile. |
| `voting` | **Not used in v1** (guesses are taps by whoever holds the phone). Reserved for a future "team consensus tap" mode. |
| `revealGate` | Strict gate guarding the `KeyOverlay` so only the spymaster sees the key. |
| `phaseMachine` | Drives `CodenamesPhase` transitions and routes PlayScreen sub-views. |
| `results` | Winner presentation, recap, rematch wiring on ResultsScreen. |

`haptics` + `sound` (global, via `GameContext`): tap feedback, distinct SFX for correct / wrong / neutral / assassin / win, honoring global mute.

---

## 11. Edge Cases

1. **Assassin on first guess** → instant `gameOver`, current team loses. (test)
2. **Win by tapping enemy's last word** → enemy wins immediately via their `remaining===0`. (test)
3. **Clue number 0** → `guessesAllowed = remaining[currentTeam]` (no +1); guessers may keep going until wrong/stop. (test)
4. **Clue number clamping** → `count` clamped to `[0, remaining[currentTeam]]`; UI stepper enforces, reducer re-clamps defensively. (test)
5. **Bonus guess off** → `guessesAllowed === count`; turn ends exactly at N correct. (test)
6. **Double-tap same tile** → second `GUESS_CELL` on a `revealed` cell is a no-op. (test)
7. **Action in wrong phase** (e.g. `GUESS_CELL` during `clue`) → no-op, returns same ref. (test)
8. **`STOP_GUESSING` before any guess** → allowed only after ≥1 guess (prevents stalling); else no-op/disabled in UI.
9. **Both teams' words could finish same tap?** Impossible — one tap reveals one cell; only one `remaining` can hit 0 per tap.
10. **Timer expiry mid-guess (timed)** → `turnEnd` with `timeUp`; already-revealed cells stay revealed.
11. **Tiny word pool (<25)** → SetupScreen blocks Start; fallback merges `core`.
12. **RTL rendering** — grid is direction-agnostic (row-major index), but tile text + labels use logical utilities; numbers shown in locale digits via i18n formatter.
13. **Persisted mid-game reload** — state is JSON-serializable; on rehydrate, if `phase==='clue'` the RevealGate re-locks (never auto-reveals) so the key isn't shown to whoever reopens the app. (UI rule, reinforced by gate default.)
14. **Same player as both spymasters** — blocked at validation.
15. **`NEW_BOARD` re-rolls starting team** so rematches aren't always the same side starting.

---

## 12. Unit Test Cases (`logic.test.ts`, vitest)

Fixtures: a deterministic `makePool(n)` returning `n` synthetic `WordEntry`s; a fixed `seed = 42`; helper `setup(overrides)` building a `CodenamesConfig`.

### Generation / init
1. `createInitialState` produces a 25-cell board with exactly 9 starting / 8 other / 7 neutral / 1 assassin.
2. Board is deterministic: same `(pool, start, seed)` ⇒ identical `board` (deep-equal across two calls).
3. All 25 `wordId`s are unique.
4. `startingTeam:'random'` resolves deterministically from seed (same seed ⇒ same start; documented value).
5. `remaining` initializes to `{start:9, other:8}` and `currentTeam===startingTeam`, `phase==='spymasterHandoff'`.

### Phase flow
6. `REVEAL_KEY_TO_SPYMASTER` moves `spymasterHandoff → clue`.
7. `GIVE_CLUE{count:2}` sets `activeClue` with `guessesAllowed===3` (bonus on) and pushes to `clueLog`; phase → `guesserHandoff`.
8. `GIVE_CLUE` with `allowBonusGuess:false` ⇒ `guessesAllowed===count`.
9. `GIVE_CLUE{count:0}` ⇒ `guessesAllowed===remaining[currentTeam]` (no +1).
10. `GIVE_CLUE{count:99}` clamps to `remaining[currentTeam]`.
11. `HANDOFF_TO_GUESSERS` moves `guesserHandoff → guessing`.

### Guess resolution
12. Correct guess (own word) flips cell, decrements `remaining[currentTeam]`, stays in `guessing` while guesses remain.
13. Correct guesses until `remaining[currentTeam]===0` ⇒ `winner===currentTeam`, `winReason==='clearedWords'`, phase `gameOver`.
14. Neutral guess ⇒ `outcome:'neutral'`, `turnEndReason:'guessedWrong'`, phase `turnEnd`, no win.
15. Wrong-team guess ⇒ decrements the **owner's** remaining, `turnEnd`; if that empties owner's remaining ⇒ owner wins (`clearedWords`).
16. Assassin guess ⇒ `loser===currentTeam`, `winner===other`, `winReason==='opponentHitAssassin'`, phase `gameOver`.
17. Exhausting `guessesAllowed` with all-correct ⇒ `turnEndReason:'usedAllGuesses'`, phase `turnEnd`.
18. Tapping an already-`revealed` cell ⇒ no-op (state ref unchanged).
19. `GUESS_CELL` with no `activeClue` / wrong phase ⇒ no-op.

### Turn alternation
20. `STOP_GUESSING` after ≥1 guess ⇒ `turnEnd` (`stopped`); before any guess ⇒ no-op.
21. `ADVANCE_TURN` flips `currentTeam`, clears `activeClue/lastReveal/turnEndReason`, phase `spymasterHandoff`.
22. After a full A-turn then B-turn, `currentTeam` returns to A and `clueLog.length===2`.

### Timer (timed mode)
23. `TIMER_EXPIRED` during `guessing` ⇒ `turnEnd` (`timeUp`); revealed cells persist.
24. `TIMER_EXPIRED` outside `guessing` ⇒ no-op.

### Rematch / reset
25. `NEW_BOARD{seed:7}` regenerates board, resets `remaining/clueLog/winner`, bumps `boardSerial`, keeps `teamMeta`+`config`, phase `spymasterHandoff`.
26. `NEW_BOARD` with a different seed yields a different board layout than the original (very-high-probability assertion via role-array inequality).
27. `RESET` clears all reveals and outcomes, returns to `spymasterHandoff`, keeps board words.

### Purity / safety
28. Reducer never mutates input (freeze the input state with `Object.freeze` deep helper; assert no throw + new references on change).
29. No `Math.random`/`Date`/`Date.now` referenced in `logic.ts` (lint/grep assertion in test or a guarded import).
30. Every reducer return is JSON-serializable (round-trip `JSON.parse(JSON.stringify(state))` deep-equals).

---

## 13. File List & Responsibilities

```
src/games/codenames/
├─ index.ts                 # default-exports GameModule { manifest, createInitialState, reducer, screens }
├─ manifest.ts              # GameManifest: id 'codenames', titles (en/fa), color, icon, minPlayers 4, maxPlayers 16, tags
├─ logic.ts                 # PURE: createInitialState, reducer, key generator, helpers (no clock/RNG calls; seed-driven)
├─ logic.test.ts            # vitest suite (§12)
├─ types.ts                 # CodenamesConfig, CodenamesState, CodenamesAction, CardRole, TeamId, ClueRecord, BoardCell, phases
├─ content/
│  ├─ schema.ts             # WordEntry, WordPack interfaces
│  ├─ index.ts              # import.meta.glob packs -> WORD_PACKS, DEFAULT_PACK_ID
│  ├─ core.json             # bilingual word pack (≥25 words; sample in §2.3)
│  └─ places.json           # optional themed pack (bilingual)
├─ components/
│  ├─ Grid.tsx              # 5x5 tile grid, spymaster vs guesser variant, flip animation, RTL-safe
│  ├─ KeyOverlay.tsx        # spymaster key view (grid + remaining), mounted only behind RevealGate
│  ├─ ClueBanner.tsx        # echoes clue number + guesses-left during guessing
│  └─ ClueLogList.tsx       # results recap of clueLog
└─ screens/
   ├─ SetupScreen.tsx       # builds CodenamesConfig -> ctx.start (§9.1)
   ├─ PlayScreen.tsx        # phase-driven board + handoffs + guessing (§9.2)
   └─ ResultsScreen.tsx     # winner + recap + rematch (§9.3)
```

### `index.ts` shape (module contract)
```ts
import type { GameModule } from '../../sdk/types';
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
export default module; // discovered by registry's import.meta.glob('./games/*/index.ts')
```

### `manifest.ts` shape
```ts
import type { GameManifest } from '../../sdk/types';
export const manifest: GameManifest = {
  id: 'codenames',
  title: { en: 'Spy Grid', fa: 'شبکهٔ جاسوسی' },
  tagline: { en: 'Two spymasters, one secret key.', fa: 'دو رئیس‌جاسوس، یک کلید مخفی.' },
  minPlayers: 4,
  maxPlayers: 16,
  teamsRequired: 2,
  accent: 'var(--color-team-a)',
  icon: 'grid',                 // references shared icon sprite
  tags: ['teams', 'words', 'deduction', 'spymaster'],
  estimatedMinutes: 15,
};
```

> Adding this game = dropping this folder in `src/games/`. No shared file edits — the registry auto-discovers it. RNG comes from `sdk/engine/rng.ts`; all other primitives via `GameContext`.
