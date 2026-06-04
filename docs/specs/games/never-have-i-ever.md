# Game Spec — Never Have I Ever — confess or lose a life

**Game id:** `never-have-i-ever`
**Folder:** `src/games/never-have-i-ever/`
**Category:** Party / confession
**Status:** Spec — ready to implement
**Conforms to:** `docs/specs/00-architecture.md` (SDK primitives, shared types, `GameModule`/`GameManifest`/`GameContext`)

> This document is self-contained: an engineer can implement the game from it with no further questions. All shared type names (`LocalizedString`, `GameModule`, `GameManifest`, `GameContext`, SDK primitive hooks) are assumed to match the architecture spec exactly.

---

## 1. Concept & Player Range

Classic drinking-game format, dry-friendly. A statement of the form *"Never have I ever ..."* is shown. Each player privately or openly indicates whether they **have** done it. Every **"have"** costs that player a life (classic mode) or scores a point against them (points mode). The cleanest player wins.

- **Players:** **3–16**, free-for-all (no teams).
- **Device model:** pass-and-play on ONE phone passed around the group.
- **Two answering styles** (see §6 — `RevealMode`):
  - **Sequential reveal (secret):** the phone is passed player-by-player; each privately taps Have / Have-not behind a `RevealGate`. Nobody sees others' taps until the round resolves.
  - **Honor count (open):** the host taps a single number = how many people "have" done it (group answers out loud, host tallies). Faster, no passing within a round; uses an honor system.
- **Two game modes** (see §6 — `GameMode`):
  - **Classic (elimination):** every player starts with N lives (default 10). Lose a life per "have". A player with 0 lives is **out**. Last player standing wins. If the deck runs out before one remains, fewest "haves" wins.
  - **Points:** no elimination. Play a fixed number of statements (rounds). Each "have" = +1 to that player's `haveCount`. Lowest `haveCount` at the end wins (fewest confessions).

---

## 2. File List & Responsibilities

```
src/games/never-have-i-ever/
  index.ts                     # default-exports GameModule (manifest + logic + screens + i18n)
  manifest.ts                  # GameManifest: id, title/desc/tagline (LocalizedString), icon, colors, ranges, flags
  logic.ts                     # PURE createInitialState(cfg) + reducer(state, action); selectors; no RNG/clock
  logic.test.ts                # vitest unit tests for reducer + selectors (see §13)
  i18n.ts                      # UI string catalogs { en, fa } for this game's screens
  types.ts                     # GameConfig, NhieState, NhieAction, content types (local to game)
  content/
    statements.classic.json    # bilingual statement deck — "classic"/everyday intensity
    statements.spicy.json      # bilingual statement deck — "spicy" intensity
    statements.wild.json       # bilingual statement deck — "wild" intensity
    index.ts                   # imports the three JSON files, validates, exports merged StatementDeck
  screens/
    SetupScreen.tsx            # roster, intensity, mode, lives, deck size, reveal mode -> startGame
    PlayScreen.tsx             # statement card + answering UI (sequential RevealGate OR honor counter) -> resolve
    ResultsScreen.tsx          # ranking, eliminations timeline, rematch / change settings
```

**Hard rule:** adding/maintaining this game NEVER edits a shared file. The registry auto-discovers via `import.meta.glob('./games/*/index.ts', { eager: true })`.

---

## 3. Manifest (`manifest.ts`)

```ts
import type { GameManifest } from '../../sdk/types';

export const manifest: GameManifest = {
  id: 'never-have-i-ever',
  title:   { en: 'Never Have I Ever', fa: 'من هیچ‌وقت' },
  tagline: { en: 'Confess or lose a life', fa: 'اعتراف کن یا یک جان از دست بده' },
  description: {
    en: 'A statement appears. Everyone who HAS done it loses a life. Last clean player — or the one with the fewest confessions — wins.',
    fa: 'یک جمله ظاهر می‌شود. هر کس آن را انجام داده باشد یک جان از دست می‌دهد. آخرین بازیکن پاک — یا کسی که کمترین اعتراف را دارد — برنده است.',
  },
  icon: '🙈',                       // also used on the home grid card
  accent: 'var(--color-game-nhie)', // token defined in @theme; fallback gradient in colors below
  colors: { from: '#FF5E8A', to: '#FF9A4D' }, // card gradient (playful/colorful)
  category: 'party',
  minPlayers: 3,
  maxPlayers: 16,
  estimatedMinutes: [10, 25],
  supportsTeams: false,
  needsTimer: false,
  needsDeck: true,
  usesSecrecy: true,               // engages RevealGate in sequential mode
  contentLocales: ['en', 'fa'],
  // surfaced for filtering/age gating on the home grid:
  intensities: ['classic', 'spicy', 'wild'],
};
```

> `accent`/`colors`: register `--color-game-nhie` under `@theme` in global CSS if a shared token list exists; otherwise the gradient in `colors` is the source of truth for the card and headers.

---

## 4. Content Schema

UI strings live in `i18n.ts`. Game **CONTENT** (the statements) lives in `content/*.json` as bilingual data, one file per intensity.

### 4.1 Types (`types.ts`)

```ts
import type { LocalizedString } from '../../sdk/types';

export type Intensity = 'classic' | 'spicy' | 'wild';

export interface Statement {
  id: string;                 // stable, unique across ALL decks, e.g. "nhie-c-001"
  text: LocalizedString;      // MUST start conceptually with "Never have I ever ..." (en) / "من هیچ‌وقت ... ام/نکرده‌ام" (fa)
  intensity: Intensity;
  tags?: string[];            // optional themes: 'travel','romance','embarrassing','food','tech','childhood'
  nsfw?: boolean;             // true => only included when allowNsfw config is on (wild deck mostly)
}

export interface StatementDeckFile {
  intensity: Intensity;
  version: number;            // bump when content changes; used for content-sync invalidation
  items: Statement[];
}

export type StatementDeck = Statement[]; // merged, filtered view exported by content/index.ts
```

### 4.2 JSON file shape

`content/statements.classic.json`:

```json
{
  "intensity": "classic",
  "version": 1,
  "items": [
    {
      "id": "nhie-c-001",
      "text": { "en": "Never have I ever fallen asleep in a meeting.", "fa": "من هیچ‌وقت در یک جلسه خوابم نبرده." },
      "intensity": "classic",
      "tags": ["embarrassing", "work"]
    }
  ]
}
```

### 4.3 `content/index.ts` responsibilities

- Import all three JSON files (typed as `StatementDeckFile`).
- Lightweight runtime validation (dev only): assert unique `id`s, non-empty `en`/`fa`, valid `intensity`. Throw in dev, warn in prod.
- Export helpers consumed by `logic.ts` / `SetupScreen`:

```ts
export const ALL_STATEMENTS: StatementDeck;                 // merged
export function getDeck(opts: {
  intensities: Intensity[];
  allowNsfw: boolean;
  tags?: string[];           // optional include-filter
}): StatementDeck;            // filtered (NOT shuffled — shuffling is the SDK deck primitive's job via seed)
export const DECK_VERSIONS: Record<Intensity, number>;
```

> **Purity note:** `getDeck` is a deterministic filter only. Shuffling happens in the reducer using a `seed` passed in the action payload, via the SDK deck helper — never `Math.random()` inside content or logic.

### 4.4 Sample bilingual content (≥12 real items)

These are production-ready seed items. IDs are stable; `fa` is natural, idiomatic Persian (RTL).

**Classic (`statements.classic.json`)**

| id | en | fa | tags |
|----|----|----|------|
| nhie-c-001 | Never have I ever fallen asleep in a meeting. | من هیچ‌وقت در یک جلسه خوابم نبرده. | embarrassing, work |
| nhie-c-002 | Never have I ever sent a text to the wrong person. | من هیچ‌وقت پیام را برای آدم اشتباهی نفرستاده‌ام. | tech, embarrassing |
| nhie-c-003 | Never have I ever forgotten someone's name right after meeting them. | من هیچ‌وقت بلافاصله بعد از آشنایی اسم کسی را فراموش نکرده‌ام. | embarrassing |
| nhie-c-004 | Never have I ever eaten food that fell on the floor. | من هیچ‌وقت غذایی را که روی زمین افتاده نخورده‌ام. | food |
| nhie-c-005 | Never have I ever pretended to laugh at a joke I didn't get. | من هیچ‌وقت الکی به جوکی که نفهمیدم نخندیده‌ام. | social |

**Spicy (`statements.spicy.json`)**

| id | en | fa | tags |
|----|----|----|------|
| nhie-s-001 | Never have I ever stalked an ex on social media. | من هیچ‌وقت دوست‌سابقم را در شبکه‌های اجتماعی تعقیب نکرده‌ام. | romance, tech |
| nhie-s-002 | Never have I ever lied about my age. | من هیچ‌وقت درباره سنم دروغ نگفته‌ام. | embarrassing |
| nhie-s-003 | Never have I ever pretended to be sick to skip something. | من هیچ‌وقت برای جا زدن از کاری خودم را به مریضی نزده‌ام. | social |
| nhie-s-004 | Never have I ever read someone else's messages without permission. | من هیچ‌وقت بدون اجازه پیام‌های شخص دیگری را نخوانده‌ام. | tech, romance |
| nhie-s-005 | Never have I ever had a crush on a friend's partner. | من هیچ‌وقت به پارتنرِ یک دوست علاقه پنهانی پیدا نکرده‌ام. | romance |

**Wild (`statements.wild.json`)**

| id | en | fa | tags |
|----|----|----|------|
| nhie-w-001 | Never have I ever sent a risky text I instantly regretted. | من هیچ‌وقت پیام جسورانه‌ای نفرستاده‌ام که فوراً پشیمان شوم. | romance |
| nhie-w-002 | Never have I ever broken something and blamed someone else. | من هیچ‌وقت چیزی را نشکسته‌ام و تقصیر را گردن دیگری نینداخته‌ام. | embarrassing |
| nhie-w-003 | Never have I ever ghosted someone after a great date. | من هیچ‌وقت بعد از یک قرار عالی کسی را ناغافل رها نکرده‌ام. | romance |
| nhie-w-004 | Never have I ever snooped through a host's bathroom cabinet. | من هیچ‌وقت کابینت دستشویی میزبان را فضولانه نگشته‌ام. | embarrassing |

> Total seed items above: 14 (5 classic + 5 spicy + 4 wild). Ship more per deck at implementation time (target ≥40 each); these are the canonical authoring style. Every `en` reads as "Never have I ever ..."; every `fa` reads as "من هیچ‌وقت ... (ن)..." in correct negated form so the screen prepends nothing — the full sentence lives in the data.

---

## 5. SDK Primitives Consumed (via `GameContext`)

The game **never reimplements** engine primitives. It consumes the following from `GameContext` / SDK UI (names per architecture spec):

| Primitive | Use in this game |
|-----------|------------------|
| `roster` | Active players (3–16), provided by the global player setup; game reads `ctx.players`. |
| `deck` | Shuffle + draw statements deterministically from a seed; `drawNext`, `remaining`, `isEmpty`. |
| `scoring` | Per-player counters: `lives` (classic) and `haveCount` (both modes). Game stores these in its own state but uses SDK scoring helpers/types for ranking + display. |
| `turnOrder` | Order in which the phone is passed during **sequential reveal**; cycles through players. |
| `revealGate` | The pass-and-play secrecy gate for sequential reveal (hide/confirm/reveal handoff UI). |
| `phaseMachine` | Drives `phase` transitions: `setup → statement → answering → reveal → roundResult → (statement|results)`. |
| `results` | Final ranking screen scaffolding (podium, replay, share). |
| `haptics` | Light tick on each Have/Have-not tap; success buzz on win; respects global mute. |
| `sfx` (howler) | Card flip, life-lost sting, elimination, victory; respects global mute. |
| `i18n` | `ctx.t` + `dir` for RTL; statements rendered from `LocalizedString` by current locale. |

The game declares which it needs via `manifest` flags (`needsDeck`, `usesSecrecy`, `supportsTeams:false`, `needsTimer:false`).

---

## 6. GameConfig (`types.ts`)

All Setup options. Produced by `SetupScreen`, consumed by `createInitialState`.

```ts
export type GameMode = 'classic' | 'points';
export type RevealMode = 'sequential' | 'honor';

export interface GameConfig {
  mode: GameMode;                 // 'classic' (elimination) | 'points'
  revealMode: RevealMode;         // 'sequential' (secret pass) | 'honor' (host tallies)

  // Roster snapshot taken at start (from global roster). Order = initial turn order.
  playerIds: string[];            // length 3..16, validated

  // Content selection
  intensities: Intensity[];       // >=1 selected; subset of ['classic','spicy','wild']
  allowNsfw: boolean;             // default false; gates nsfw items in 'wild'
  tags?: string[];                // optional theme filter (empty/undefined = all)

  // Classic-mode tuning
  startingLives: number;          // default 10; range 1..20 (ignored in points mode)

  // Round/length control
  deckSize: number;               // number of statements to play this game; clamped to available
                                  //   default: classic = min(available, 60); points = min(available, 12)
  // Determinism: caller supplies the master seed so the reducer can shuffle purely.
  seed: number;                   // RNG seed captured at start (e.g. Date.now() in the screen, NOT in reducer)
}

export const CONFIG_DEFAULTS = {
  mode: 'classic' as GameMode,
  revealMode: 'sequential' as RevealMode,
  intensities: ['classic'] as Intensity[],
  allowNsfw: false,
  startingLives: 10,
  deckSizeClassic: 60,
  deckSizePoints: 12,
} as const;
```

Validation (in `SetupScreen` before dispatch, also defensively in `createInitialState`):
- `playerIds.length` in `[3,16]` and all unique & present in roster.
- `intensities.length >= 1`.
- `startingLives` in `[1,20]`.
- `deckSize >= 1` and clamped to `getDeck(...).length`. If filtered deck is empty (e.g., over-narrow tags), Setup blocks start with an inline error.

---

## 7. State Shape (`types.ts`)

```ts
export type Phase =
  | 'statement'     // statement shown, "Start answering" CTA
  | 'answering'     // collecting answers (sequential passes OR honor counter)
  | 'reveal'        // round resolved, showing who lost a life / who confessed
  | 'results';      // game over

export interface PlayerRuntime {
  id: string;
  lives: number;        // classic: starts at startingLives; points: unused (stays = startingLives sentinel, not shown)
  haveCount: number;    // total "have" answers this game
  eliminated: boolean;  // classic only; true when lives === 0
  eliminatedAtRound?: number; // round index when eliminated (for timeline + tiebreak)
}

export interface RoundRecord {
  index: number;            // 0-based round number
  statementId: string;
  // who answered "have" this round (player ids). Used for reveal + history.
  haveIds: string[];
  // snapshot of remaining (alive) players who could answer this round
  participantIds: string[];
}

export interface NhieState {
  config: GameConfig;
  phase: Phase;

  // Deck managed via SDK deck primitive but mirrored here for purity/serialization:
  drawOrder: string[];      // shuffled statement ids (deterministic from config.seed)
  drawIndex: number;        // index of CURRENT statement within drawOrder
  currentStatementId: string | null;

  players: PlayerRuntime[]; // keyed-by-array; order is stable turn order

  // Sequential-reveal answering progress (null when not in 'answering' sequentially):
  answering: {
    queue: string[];        // remaining player ids to answer this round (alive only)
    cursor: number;         // index into queue of the player currently holding the phone
    answers: Record<string, boolean>; // playerId -> hasDone (true = "have")
  } | null;

  rounds: RoundRecord[];    // completed rounds (history)
  roundIndex: number;       // current round (0-based)

  // Resolution outcome for the just-finished round (for 'reveal' phase UI):
  lastResult: {
    haveIds: string[];
    livesLost: Record<string, number>;     // playerId -> 1 (classic) for losers
    newlyEliminated: string[];             // ids that hit 0 lives this round
  } | null;

  winnerIds: string[];      // computed at game over (usually length 1; ties possible in points/deck-exhausted)
  gameOver: boolean;
}
```

> `lives` for points mode: not displayed; ranking uses `haveCount`. We still keep the field uniform to simplify SDK scoring binding.

---

## 8. Actions & Reducer Transitions (`logic.ts`)

Reducer is **PURE**: no `Date.now()`, no `Math.random()`. Any randomness/time enters via action payload (`seed`, `now`). Signature:

```ts
export function createInitialState(config: GameConfig, deck: StatementDeck): NhieState;
export function reducer(state: NhieState, action: NhieAction): NhieState;
```

### 8.1 Action union

```ts
export type NhieAction =
  // lifecycle
  | { type: 'START_ANSWERING' }                                   // statement -> answering
  // sequential reveal answering
  | { type: 'ANSWER'; playerId: string; hasDone: boolean }        // record current player's answer
  | { type: 'PASS_TO_NEXT' }                                      // advance RevealGate cursor
  // honor mode answering
  | { type: 'SET_HONOR_HAVES'; playerIds: string[] }             // host marks which players "have"
  // resolve round (both modes)
  | { type: 'RESOLVE_ROUND' }                                     // apply life loss / haveCount, compute lastResult
  // advance
  | { type: 'NEXT_STATEMENT'; seed?: number }                     // reveal -> next statement OR -> results
  // controls
  | { type: 'SKIP_STATEMENT'; seed?: number }                    // discard current, draw next, no life change
  | { type: 'END_GAME' }                                          // force finish -> compute winners -> results
  | { type: 'RESET'; config: GameConfig; deck: StatementDeck };  // rematch (new shuffle from new seed in config)
```

### 8.2 Transition table

| Action | Valid in phase | Effect | Next phase |
|--------|----------------|--------|------------|
| `START_ANSWERING` | `statement` | Sequential: build `answering = { queue: aliveTurnOrder, cursor: 0, answers: {} }`. Honor: set `answering` to `null` (UI uses a counter). | `answering` |
| `ANSWER` (seq) | `answering` | Guard: `playerId === queue[cursor]`. Set `answers[playerId] = hasDone`. Does NOT advance cursor (PASS does). Idempotent re-tap allowed (overwrites). | `answering` |
| `PASS_TO_NEXT` (seq) | `answering` | `cursor++`. If `cursor >= queue.length` → all answered; auto-derive `haveIds` from `answers` and transition (still `answering` until `RESOLVE_ROUND`, but UI shows "reveal all" CTA). No-op past end. | `answering` |
| `SET_HONOR_HAVES` (honor) | `answering` | Validate ids ⊆ alive participants. Store as pending result: set `answering = { queue: [], cursor: 0, answers: fromIds(playerIds) }`. | `answering` |
| `RESOLVE_ROUND` | `answering` | Compute `haveIds` from `answers`. For each have: `haveCount++`; classic also `lives--`, and if `lives===0` set `eliminated=true, eliminatedAtRound=roundIndex` and push to `newlyEliminated`. Build `lastResult`. Push `RoundRecord` to `rounds`. Clear `answering`. Then evaluate game-over (see §9): if over → set `winnerIds`, `gameOver=true`. | `reveal` |
| `NEXT_STATEMENT` | `reveal` | If `gameOver` → `results`. Else `drawIndex++`; if `drawIndex >= drawOrder.length` (deck exhausted) → compute winners (§9 deck-exhausted rule), `gameOver=true`, phase `results`. Else set `currentStatementId = drawOrder[drawIndex]`, `roundIndex++`, clear `lastResult`. | `statement` or `results` |
| `SKIP_STATEMENT` | `statement` or `reveal` | Discard current statement with no life/score change. `drawIndex++`; if exhausted → winners + `results`. Else set next statement, clear `answering`/`lastResult`. (Does NOT increment `roundIndex` since no round was played; or increments a separate `skipCount` — see note.) | `statement` or `results` |
| `END_GAME` | any non-`results` | Compute winners over current state (§9), `gameOver=true`. | `results` |
| `RESET` | any | Return `createInitialState(action.config, action.deck)`. | `statement` |

**Notes**
- `roundIndex` counts only *played* rounds; `SKIP_STATEMENT` advances `drawIndex` but not `roundIndex`.
- `RESOLVE_ROUND` is the single mutation point for `lives`/`haveCount`. `ANSWER`/`SET_HONOR_HAVES` only stage answers. This keeps tests simple and makes the reveal animation a pure read of `lastResult`.
- All updates are immutable (return new objects/arrays). No mutation of inputs.

### 8.3 Reducer sketch (core resolve)

```ts
function resolveRound(state: NhieState): NhieState {
  const answers = state.answering?.answers ?? {};
  const haveIds = Object.keys(answers).filter((id) => answers[id] === true);

  const livesLost: Record<string, number> = {};
  const newlyEliminated: string[] = [];

  const players = state.players.map((p) => {
    if (!haveIds.includes(p.id) || p.eliminated) return p;
    const haveCount = p.haveCount + 1;
    if (state.config.mode === 'classic') {
      const lives = p.lives - 1;
      livesLost[p.id] = 1;
      const eliminated = lives <= 0;
      if (eliminated) newlyEliminated.push(p.id);
      return { ...p, haveCount, lives, eliminated,
        eliminatedAtRound: eliminated ? state.roundIndex : p.eliminatedAtRound };
    }
    return { ...p, haveCount }; // points mode
  });

  const participantIds = state.players.filter((p) => !p.eliminated).map((p) => p.id);
  const round: RoundRecord = {
    index: state.roundIndex,
    statementId: state.currentStatementId!,
    haveIds,
    participantIds,
  };

  const next: NhieState = {
    ...state,
    players,
    rounds: [...state.rounds, round],
    answering: null,
    lastResult: { haveIds, livesLost, newlyEliminated },
    phase: 'reveal',
  };
  return applyGameOverIfAny(next); // §9
}
```

---

## 9. Win / Scoring Rules

`applyGameOverIfAny(state)` and final `computeWinners(state)`:

### 9.1 Classic (elimination)
- A player is **out** when `lives === 0`.
- **Game over** when:
  - exactly **one** player remains alive → that player is the sole winner; OR
  - **zero** players remain alive (everyone eliminated same round) → winner(s) = the player(s) eliminated **latest** (max `eliminatedAtRound`); tie among those → fewest `haveCount`; still tied → shared win; OR
  - the deck is exhausted (`NEXT_STATEMENT` past end) with ≥2 alive → winner(s) among alive = **most lives**, tiebreak fewest `haveCount`, then shared.

### 9.2 Points
- No elimination. Game over when `roundIndex + 1 >= config.deckSize` after resolving (i.e., the configured number of statements has been played) OR deck exhausted.
- **Winner(s)** = **lowest** `haveCount` (fewest confessions). Tie → all tied players share the win. (Optional surfaced secondary stat: "cleanest streak" but not used for ranking.)

### 9.3 Ranking for ResultsScreen
- **Classic:** order = alive first (by `lives` desc, then `haveCount` asc), then eliminated by `eliminatedAtRound` desc (later = better), then `haveCount` asc.
- **Points:** order = `haveCount` asc, then (stable) original order.
- `computeWinners` returns `winnerIds` = the top rank bucket (handles ties → multiple ids).

```ts
export function rankPlayers(state: NhieState): PlayerRuntime[];  // ordered best -> worst
export function computeWinners(state: NhieState): string[];      // top bucket ids
```

---

## 10. Screen-by-Screen Breakdown

All screens compose **SDK UI** components (per architecture spec): `Screen`, `AppBar`, `Button`, `Card`, `SegmentedControl`, `Stepper`, `Chip`, `PlayerAvatar`, `PlayerList`, `RevealGate`, `Podium`, `CounterBadge`, `Sheet`, `Toast`. Each control dispatches game actions or calls SDK setup. RTL via logical utilities; statements render `text[locale]`.

### 10.1 SetupScreen (`screens/SetupScreen.tsx`)

Purpose: collect `GameConfig`, then `ctx.startGame(config)` (which calls `createInitialState`).

On screen (top → bottom):
1. **AppBar** — title `t('nhie.title')`, back to home, info button (opens rules `Sheet`).
2. **Roster section** — `PlayerList` bound to the GLOBAL roster (SDK). Shows current players with `PlayerAvatar`; toggle who plays this game; "Manage players" opens the shared roster editor. Live validation chip: `3–16 players`. Dispatches nothing game-specific; updates `playerIds`.
3. **Game mode** — `SegmentedControl` → `mode`: `Classic (lives)` | `Points`. Selecting `Classic` reveals **Lives** `Stepper` (`startingLives`, 1–20, default 10). Selecting `Points` reveals **Statements** `Stepper` (`deckSize`, default 12).
4. **Answer style** — `SegmentedControl` → `revealMode`: `Pass & hide (secret)` | `Honor count (open)`. Helper text explains each.
5. **Intensity** — multi-select `Chip` row → `intensities`: `Classic` | `Spicy` | `Wild`. At least one required. Selecting `Wild` reveals **Allow 18+ items** toggle → `allowNsfw` (off by default; if age-gating exists, requires confirm).
6. **Deck length** (classic only) — `Stepper` `deckSize` (default 60, max = available). For points it's set in step 3.
7. **Deck availability line** — live count: `t('nhie.deckCount', { n })` from `getDeck(...)`. If `n < required minimum` show inline error and disable Start.
8. **Start button** — primary `Button` `t('common.start')`. Disabled until valid. On press: build `GameConfig` (capture `seed = Date.now()` HERE, in the screen, not the reducer), call `ctx.startGame(config)` → engine builds initial state and routes to PlayScreen.

Dispatch summary: SetupScreen does not dispatch reducer actions; it calls the SDK `startGame(config)`. The reducer entry is `createInitialState`.

### 10.2 PlayScreen (`screens/PlayScreen.tsx`)

Renders by `state.phase`. Header always shows a compact **scoreboard strip**: per alive player a `PlayerAvatar` + `CounterBadge` (classic: ❤️×lives; points: count of confessions). Eliminated players dimmed with a skull.

**Phase `statement`:**
- Big animated **Card** (framer-motion flip-in) with current statement `text[locale]`, intensity `Chip`, round indicator `t('nhie.round', { n: roundIndex+1 })`.
- Primary **Button** `t('nhie.startAnswering')` → `dispatch(START_ANSWERING)`.
- Secondary **Button** `t('nhie.skip')` → `dispatch(SKIP_STATEMENT, { seed: Date.now() })` (no penalty).
- SFX card flip; haptic light tick.

**Phase `answering` — sequential (`revealMode==='sequential'`):**
- **RevealGate** wraps the answer UI. Shows "Pass to **{currentPlayer.name}**" hand-off screen; current holder taps "I'm {name}, show me" to reveal the private question + two big buttons:
  - **Have ✓** (`I have`) → `dispatch(ANSWER, { playerId, hasDone: true })`
  - **Have not ✗** (`I have not`) → `dispatch(ANSWER, { playerId, hasDone: false })`
- After tapping, button morphs to **"Pass phone"** → `dispatch(PASS_TO_NEXT)`; RevealGate re-hides for the next player.
- Progress dots show `cursor+1 / queue.length` (no answer values leaked).
- When `cursor >= queue.length`: show **"Reveal results"** primary Button → `dispatch(RESOLVE_ROUND)`.
- Haptic tick per tap; subtle "locked in" SFX.

**Phase `answering` — honor (`revealMode==='honor'`):**
- No passing. A tappable **PlayerList of alive players**; tap toggles a player as "have" (highlighted). Selected set is local UI state.
- Live counter `t('nhie.haveCount', { n })`.
- Primary **Button** `t('nhie.resolve')` → `dispatch(SET_HONOR_HAVES, { playerIds })` then immediately `dispatch(RESOLVE_ROUND)` (or a single combined "Apply" that does both in sequence). 
- "Nobody" shortcut Button → resolves with empty set.

**Phase `reveal`:**
- Animated reveal of `lastResult`: each `haveId` avatar flips, shows **−1 life** (classic, heart pops) or **+1** confession (points). `newlyEliminated` get a skull burst + elimination SFX + stronger haptic.
- If round had zero haves → "Everyone's innocent!" celebratory micro-state.
- Updated scoreboard strip animates counters.
- If `state.gameOver` → primary **Button** `t('nhie.seeResults')` → `dispatch(NEXT_STATEMENT)` (routes to results since gameOver).
- Else primary **Button** `t('nhie.next')` → `dispatch(NEXT_STATEMENT, { seed: Date.now() })`.
- Overflow menu: **End game now** → `dispatch(END_GAME)`.

**Phase `results`:** PlayScreen delegates to ResultsScreen (router or conditional render).

Actions dispatched by PlayScreen: `START_ANSWERING`, `ANSWER`, `PASS_TO_NEXT`, `SET_HONOR_HAVES`, `RESOLVE_ROUND`, `NEXT_STATEMENT`, `SKIP_STATEMENT`, `END_GAME`.

### 10.3 ResultsScreen (`screens/ResultsScreen.tsx`)

- **Podium** (SDK) of top ranks from `rankPlayers(state)`; winner(s) (`winnerIds`) get crown + confetti (framer-motion) + victory SFX + success haptic.
- **Full ranking list** — `PlayerList` ordered by `rankPlayers`; each row shows mode-appropriate stat (classic: lives left + rounds survived; points: total confessions). Winner badge for ties shows multiple crowns.
- **Round timeline** (collapsible `Sheet`) — for each `RoundRecord`: statement text + chips of who confessed; elimination markers.
- **Fun stats** (optional): "Most confessions" (max `haveCount`), "Cleanest" (min), "Last one standing".
- Buttons:
  - **Rematch (same settings)** → `dispatch(RESET, { config: { ...config, seed: Date.now() }, deck })` (new shuffle, same players/options) → back to PlayScreen.
  - **Change settings** → navigate to SetupScreen (keep roster).
  - **Home** → leave game (SDK navigation).
- Optional sign-in upsell `Toast`: "Sign in to save stats" (only if signed-out and `supabase` configured) — non-blocking.

---

## 11. Pass-and-Play Handoff & Secrecy (RevealGate)

Secrecy applies **only** in `revealMode === 'sequential'`.

- Each player's answer is entered behind the SDK **`RevealGate`**, which enforces a 3-step handoff:
  1. **Hide screen:** full-bleed cover "Pass the phone to **{nextName}**". No statement/answer visible.
  2. **Confirm holder:** "I am {name} — tap to see." Prevents the wrong person peeking.
  3. **Private answer:** statement + Have / Have-not buttons. After answering, immediately re-cover with "Pass phone" CTA → `PASS_TO_NEXT`.
- The reducer never stores per-player answers in a way the UI reveals early: during `answering`, the scoreboard/progress shows only **counts/cursor**, never who answered what. Individual answers surface only at `reveal` (all at once) via `lastResult.haveIds`.
- **Honor mode** has no secrecy: the host openly taps who confessed (group answers aloud). RevealGate is bypassed.
- Anti-cheat niceties: progress dots don't encode answers; back-button during answering returns to the Hide cover (does not reveal previous answers); app backgrounding re-locks the gate on resume.
- Global **mute** disables SFX/haptics during handoff; reduced-motion disables flip animations (fade instead).

---

## 12. Edge Cases

1. **Minimum players mid-game (classic):** game ends as soon as 1 player remains (handled in `applyGameOverIfAny`). Cannot drop below 3 mid-game because no removal action exists during play; roster is locked at start.
2. **Everyone confesses on the last life:** multiple players hit 0 in one round → "everyone out" rule (§9.1): latest-eliminated (all same round) → fewest `haveCount` tiebreak → possible shared win.
3. **Nobody confesses (empty haves):** valid round; no life/score change; reveal shows innocent state; `RoundRecord.haveIds = []`.
4. **Deck exhausted before a classic winner:** `NEXT_STATEMENT`/`SKIP_STATEMENT` past end → winners by most-lives rule (§9.1).
5. **Over-narrow content filter (deck empty):** SetupScreen blocks Start with inline error; never reach Play with empty `drawOrder`.
6. **`deckSize` > available:** clamp to available in `createInitialState`; Setup shows the clamped number.
7. **Re-tap / change answer (sequential):** allowed before `PASS_TO_NEXT`; `ANSWER` overwrites `answers[playerId]`. After passing, no edit (cursor advanced).
8. **Honor set includes an eliminated player:** filtered out in `SET_HONOR_HAVES` validation (only alive participants count).
9. **Skip on last statement:** treated as deck-exhausted → results.
10. **Single intensity with all items nsfw and `allowNsfw=false`:** filtered deck empty → handled as #5.
11. **Duplicate statement ids across files:** content validator throws in dev; CI guards.
12. **Locale switch mid-game:** statements re-render from `text[newLocale]`; no state change; `dir` flips; layout uses logical utilities so it just works.
13. **Reduced motion / mute:** animations → fades; SFX/haptics suppressed; logic unchanged.
14. **Persistence/resume:** entire `NhieState` is serializable (no functions, no class instances) → zustand persist + idb-keyval can restore an in-progress game; `answering` re-locks via RevealGate on resume.
15. **Points mode, `deckSize` reached with ties:** multiple winners returned; Podium/ranking render shared first place.

---

## 13. Unit Tests (`logic.test.ts`)

Use vitest. All deterministic (seeded). No mocks of clock/RNG needed because reducer is pure.

**`createInitialState`**
1. Builds `players` with `lives === startingLives`, `haveCount === 0`, `eliminated === false` for each `playerId`.
2. `drawOrder` length === clamped `deckSize`; all ids exist in deck; deterministic for a fixed `seed` (same seed → same order; different seed → different order with high probability).
3. `phase === 'statement'`, `currentStatementId === drawOrder[0]`, `drawIndex === 0`, `roundIndex === 0`.
4. Clamps `deckSize` to available deck length.

**`START_ANSWERING`**
5. Sequential: creates `answering.queue` = alive turn order, `cursor 0`, empty `answers`; phase `answering`.
6. Honor: phase `answering`, `answering` null (or empty-staged), counter UI path.

**`ANSWER` (sequential)**
7. Records `answers[playerId]`; does NOT advance cursor.
8. Re-tap overwrites previous answer.
9. Guard: `ANSWER` for a player ≠ `queue[cursor]` is a no-op (state unchanged).

**`PASS_TO_NEXT`**
10. Advances cursor; past end is a no-op / flags "all answered".

**`SET_HONOR_HAVES`**
11. Stores given ids as `answers=true`; filters out eliminated/non-participant ids.

**`RESOLVE_ROUND` — classic**
12. Each `have` loses exactly 1 life and gains 1 `haveCount`; non-haves unchanged.
13. Player reaching 0 lives → `eliminated=true`, `eliminatedAtRound=roundIndex`, listed in `lastResult.newlyEliminated`.
14. Pushes a `RoundRecord` with correct `haveIds`/`participantIds`; clears `answering`; phase `reveal`.
15. Empty haves → no changes; `RoundRecord.haveIds=[]`; phase `reveal`.

**`RESOLVE_ROUND` — points**
16. Each have gains `haveCount`; `lives` untouched; no elimination ever.

**Game-over detection**
17. Classic: when one player remains alive → `gameOver=true`, `winnerIds=[lastAlive]`.
18. Classic: all eliminated same round → winners = fewest-haveCount among them (tie → multiple).
19. Classic deck-exhausted with ≥2 alive → winners = most lives, tiebreak fewest haves.
20. Points: reaching `deckSize` rounds → `gameOver=true`; winners = min `haveCount` (tie → multiple ids).

**`NEXT_STATEMENT`**
21. When `gameOver` → phase `results` (no draw advance).
22. Else advances `drawIndex`, sets next `currentStatementId`, increments `roundIndex`, clears `lastResult`.
23. Advancing past last statement → `results` with computed winners.

**`SKIP_STATEMENT`**
24. Advances `drawIndex` without changing any `lives`/`haveCount`; does not increment `roundIndex`.
25. Skip on last statement → `results`.

**`END_GAME`**
26. From any non-results phase → `results`, `gameOver=true`, winners computed from current standings.

**`RESET`**
27. Returns a fresh initial state from new config/seed (new shuffle), clears all history.

**Selectors**
28. `rankPlayers` orders correctly for classic (alive-by-lives then eliminated-by-round) and points (haveCount asc).
29. `computeWinners` returns the full top bucket (handles ties).

**Immutability/purity**
30. Reducer never mutates the input state object/arrays (assert original unchanged after each action).
31. No `Math.random`/`Date.now` reachable in reducer (lint/spy assertion); identical action sequence + seeds → identical state (snapshot).

---

## 14. i18n Keys (`i18n.ts`) — minimum set

```
nhie.title, nhie.tagline, nhie.rules
nhie.mode.classic, nhie.mode.points, nhie.lives, nhie.statements
nhie.answer.sequential, nhie.answer.honor, nhie.answer.help
nhie.intensity.classic, nhie.intensity.spicy, nhie.intensity.wild, nhie.allowNsfw
nhie.deckCount  // "{{n}} statements available"
nhie.round      // "Round {{n}}"
nhie.startAnswering, nhie.skip, nhie.resolve, nhie.next, nhie.seeResults
nhie.haveBtn, nhie.haveNotBtn, nhie.passPhone, nhie.imName  // "{{name}}, tap to see"
nhie.haveCount  // "{{n}} confessed"
nhie.nobody, nhie.innocent  // "Everyone's innocent!"
nhie.lifeLost, nhie.eliminated, nhie.lastStanding
nhie.results.cleanest, nhie.results.mostConfessions, nhie.rematch, nhie.changeSettings
```

All keys present in both `en` and `fa`. Persian must use correct RTL phrasing; counts use i18next pluralization where relevant.

---

## 15. GameModule wiring (`index.ts`)

```ts
import type { GameModule } from '../../sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer, rankPlayers, computeWinners } from './logic';
import { getDeck } from './content';
import SetupScreen from './screens/SetupScreen';
import PlayScreen from './screens/PlayScreen';
import ResultsScreen from './screens/ResultsScreen';
import { en, fa } from './i18n';

const module: GameModule = {
  manifest,
  i18n: { en, fa },
  logic: { createInitialState, reducer, rankPlayers, computeWinners },
  getDeck,                       // engine calls with config to produce deck before createInitialState
  screens: { SetupScreen, PlayScreen, ResultsScreen },
};

export default module;          // discovered by import.meta.glob('./games/*/index.ts', { eager: true })
```

> Exact `GameModule` field names must match `docs/specs/00-architecture.md`. If the architecture defines `getDeck` differently (e.g., engine passes the merged content and game only filters), adapt the wrapper here only — `logic.ts` stays pure and screen/content responsibilities are unchanged.

---

## 16. Acceptance Criteria

- 3–16 players; both modes; both reveal modes all reachable and validated from Setup.
- Reducer is pure and fully covered by the §13 tests (all passing).
- Sequential reveal never leaks answers before `reveal` phase; RevealGate enforces handoff.
- Bilingual content renders correctly in en and fa with full RTL; ≥12 seed items shipped (style per §4.4).
- Adding this game required zero edits to shared files (registry auto-discovery).
- App functions fully offline and signed-out; state is serializable and resumable.
