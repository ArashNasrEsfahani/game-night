# Game Spec — Minesweeper (1–4 players) (`minesweeper`)

> **Status: PLANNED — not yet implemented.** This is a design plan kept on file per request; no code exists yet. When built, it conforms to the SDK contract in `docs/specs/00-architecture.md` and mirrors the structure/purity rules of the existing games (see `docs/specs/games/codenames.md` and the live `src/games/dowr/`).
> Game id: `minesweeper` · Folder (future): `src/games/minesweeper/`
> Engine primitives used: `rng`, `turnOrder`, `scoring`, `phaseMachine`, `results`. (No `revealGate`/`deck`/`voting` — the board is fully shared, no per-player secrets.)

A pass-and-play take on classic Minesweeper for **one phone, 1–4 players**. One shared grid with hidden mines. Solo plays like the classic game (clear every safe cell without detonating). With 2–4 players it becomes a turn-based **competitive sweep**: players alternate revealing cells, scoring for the safe cells they uncover and losing a life when they hit a mine. Most points when the board is cleared (or last sweeper standing) wins.

---

## 1. Player Range & Modes

| Aspect | Value |
| --- | --- |
| Min players | 1 |
| Recommended | 2–4 |
| Max players | 4 (turn-taking on one device; more makes waits too long) |
| Teams | None — free-for-all individuals |
| Turn unit | Individual player (round-robin via `turnOrder`) |
| Device model | Pass-and-play on one phone (passed to the next player each turn) |

### Modes (`endMode` / play style)
- **`solo` (1 player)** — Classic Minesweeper. One sweeper, configurable `lives` (default 1 = true classic; >1 = forgiving). Clear all safe cells to win. A stopwatch tracks time; score = time + safe cells. Hitting a mine with no lives left = loss.
- **`versus` (2–4 players)** — Round-robin turns. Each turn the active player reveals exactly one cell (flagging is a free pre-action). Safe reveals score; a mine costs a life. Game ends when the board is swept **or** all-but-one players are eliminated.

> All modes share one reducer; player count drives the turn model. `solo` is just `versus` with a single seat and the timer surfaced.

---

## 2. Content Schema

**None.** Minesweeper has no bilingual content pool — the board is generated from numbers/mines, not words. There are no `content/*.json` files and nothing added to the i18n *content*; only UI chrome strings live in `src/i18n/{en,fa}.json` under a `mine.*` namespace (labels: flags left, mines, lives, your turn, boom, swept, etc.). Persian digits are rendered via the existing locale number formatter.

---

## 3. GameConfig (setup options)

```ts
export type MineDifficulty = 'easy' | 'medium' | 'hard' | 'custom';

export interface MinesweeperOptions {
  /** Board columns × rows. Square-ish, sized for a phone. */
  cols: number;   // easy 8, medium 10, hard 12
  rows: number;   // easy 8, medium 12, hard 16
  /** Number of mines. Density ≈ 15–20% of cells. */
  mines: number;  // easy 10, medium 24, hard 40
  difficulty: MineDifficulty;
  /** Lives per player before elimination. Solo default 1 (classic). Versus default 2. */
  lives: number;
  /** Reveal the full board with a brief "boom" flash when a mine is hit (vs. silent mark). */
  showMineOnHit: boolean;
  /** End a versus game the instant the board is swept even if players still have lives. */
  sweepEndsGame: boolean; // default true
  /** Master seed for mine layout (mines placed on FIRST reveal for first-click safety). */
  seed: number;
}

export const DEFAULT_OPTIONS = {
  cols: 10, rows: 12, mines: 24, difficulty: 'medium',
  lives: 2, showMineOnHit: true, sweepEndsGame: true,
};
```

Setup option summary:

| Option | UI control | Values | Default |
| --- | --- | --- | --- |
| Players | roster chips (1–4) | pick seats | all |
| Difficulty | `SegmentedControl` | easy / medium / hard / custom | medium |
| Board size (custom) | two `Stepper`s | 6–14 cols, 6–18 rows | — |
| Mines (custom) | `Stepper` | 5 … (cols·rows − 9) | — |
| Lives | `Stepper` | 1–5 | 1 solo / 2 versus |
| Reveal mine on hit | `Toggle` | on/off | on |

Validation: `mines ≤ cols·rows − 9` (leave room for a safe first-click 3×3); `cols·rows ≥ 16`; players 1–4.

---

## 4. State Shape (pure, JSON-serializable)

```ts
export type MinePhase = 'playing' | 'gameOver';

export interface Cell {
  index: number;          // 0..n-1, row-major (index = r*cols + c)
  mine: boolean;          // assigned on first reveal
  adjacent: number;       // 0..8 neighbouring mines (computed once mines are placed)
  revealed: boolean;
  flagged: boolean;
  /** Who revealed it (seat id) — for per-player tinting + score attribution. */
  revealedBy: string | null;
  /** True for a detonated mine (hit), so it renders as an explosion, not a flag. */
  exploded: boolean;
}

export interface MineSeat {
  id: string;
  name: string;
  score: number;          // safe cells this player has uncovered
  lives: number;
  eliminated: boolean;
}

export interface MinesweeperState extends GameStateBase {
  phase: MinePhase;
  options: MinesweeperOptions;
  cols: number; rows: number;
  board: Cell[];
  minesPlaced: boolean;   // false until the first reveal seeds the layout
  seats: MineSeat[];
  turnNo: number;         // active seat = seats[turnNo % seats.length] (skipping eliminated)
  safeRemaining: number;  // safe cells not yet revealed; reaching 0 = board swept
  /** Transient one-render flash for SFX/animation; cleared via CLEAR_FLASH. */
  flash: { type: 'boom' | 'safe' | 'win'; index?: number } | null;
  winnerIds: string[];    // most score (versus) / the solo player on a clean sweep
  winReason: 'swept' | 'lastSurvivor' | 'soloWin' | 'soloLoss' | null;
}
```

---

## 5. Actions & Reducer

```ts
export type MinesweeperAction =
  | { type: 'REVEAL'; index: number; seed: number }   // seed only consumed on the first reveal
  | { type: 'FLAG'; index: number }                   // toggle a flag (free, does not pass the turn)
  | { type: 'CHORD'; index: number }                  // reveal neighbours of a satisfied number
  | { type: 'CLEAR_FLASH' }
  | { type: 'RESET' };
```

### 5.1 `createInitialState(config, seed)`
Pure. Builds an **un-mined** board: `cols·rows` cells all `hidden/!mine/adjacent:0`, `minesPlaced:false`, seats from the roster (scores 0, lives = options.lives), `turnNo:0`, `safeRemaining = cols·rows − mines`, `phase:'playing'`. Mines are **not** placed yet — see first-click safety.

### 5.2 First-click safety (mine placement)
On the **first** `REVEAL{index, seed}` (when `!minesPlaced`):
1. Compute the forbidden set = the clicked `index` + its up-to-8 neighbours (guarantees an opening).
2. Seeded-shuffle the remaining cell indices (via `engine/rng`), take the first `mines` → mine positions. Pure & reproducible from `seed`.
3. Compute every cell's `adjacent` count. Set `minesPlaced:true`.
4. Proceed to the normal reveal of `index`.

This keeps the reducer pure (seed arrives in the action) and means the first move can never lose.

### 5.3 `REVEAL` resolution
Guard: ignore if `phase!=='playing'`, cell already `revealed`, or `flagged`. Active seat = current player.
- **Mine hit:** mark `exploded`, set `flash:{type:'boom',index}`; active seat `lives--`; if `lives<=0` → `eliminated=true`. Then **pass the turn** (advance `turnNo` to next non-eliminated seat). Check end conditions (§6). The mine cell stays revealed/exploded (removed from the unknowns) so play continues around it. Solo: a hit with no lives left ends the game (`soloLoss`).
- **Safe cell:** flood-reveal. If the cell's `adjacent===0`, cascade to all connected zero-cells and their numbered borders (classic flood fill, iterative/stack — pure). Every newly-revealed safe cell: `revealed:true`, `revealedBy = activeSeat.id`, `safeRemaining--`, and **+1 to the active seat's score**. Set `flash:{type:'safe'}`. Then pass the turn. If `safeRemaining===0` → board swept (§6).

### 5.4 `FLAG`
Toggle `flagged` on a hidden cell. **Free action** — does not advance `turnNo` (the active player may flag suspects, then reveal to end their turn). No score effect. Ignored on revealed cells.

### 5.5 `CHORD` (quality-of-life)
On an already-revealed numbered cell whose adjacent flags === its number, reveal all non-flagged neighbours (each runs the §5.3 safe/mine path, attributed to the active seat). A wrong flag here can detonate a mine — same life cost. Counts as the player's reveal for the turn.

> Any action in the wrong phase, or on an illegal cell, returns the **same state reference** (no-op) — guards double-taps and stale screens. Turn passing always **skips eliminated** seats; if only one non-eliminated seat remains it keeps that seat.

---

## 6. Win / Scoring Rules

- **Score** = number of safe cells a player has personally revealed (flood-fill cascades reward the player who triggered them — skill + luck).
- **Versus end — board swept:** when `safeRemaining===0` (all safe cells revealed). Winner = highest `score`; ties shared (tie-break: fewest mines hit, then shared). `winReason:'swept'`.
- **Versus end — last survivor:** if every seat but one is `eliminated`, the survivor wins (`lastSurvivor`) even if cells remain. With `sweepEndsGame` and simultaneous conditions, "swept" takes precedence.
- **Solo win:** `safeRemaining===0` → `soloWin` (score = cells + a time bonus shown on results). **Solo loss:** mine hit with `lives===0` → `soloLoss`, reveal the whole board.
- **All eliminated (versus, rare with shared board):** ranked by score; top score(s) win.

---

## 7. Screen-by-Screen

### 7.1 `SetupScreen.tsx`
Roster chips (1–4), difficulty `SegmentedControl`, custom size/mine `Stepper`s (shown when `custom`), lives `Stepper`, reveal-on-hit `Toggle`, live "≈ N mines on a C×R board" hint, validation, Start → `nav.startMatch(config)` (with a fresh `seed`).

### 7.2 `PlayScreen.tsx` (the board)
- **Header:** whose turn (seat name, accent-tinted) + per-seat chips showing score and lives (hearts); mines remaining = `mines − flags`; solo also shows the running stopwatch (screen-local, resume-safe — measured vs wall clock, never stored).
- **Board:** a responsive `MineGrid` component (new, local). Cols/rows from state; cells sized to fit width with ≥36px tap targets; pinch/scroll not required at default sizes. Tap = `REVEAL`; long-press (or a flag-mode toggle button) = `FLAG`; double-tap a number = `CHORD`. Revealed numbers colour-coded 1–8; a cell tinted faintly by `revealedBy`'s accent so you can see who cleared what. Exploded mines animate a boom; flood reveals stagger-animate.
- **Flag-mode toggle** button (👆/🚩) for touch ergonomics so flagging doesn't need long-press.
- On `gameOver`, route to Results (and play win/lose SFX).

### 7.3 `ResultsScreen.tsx`
`WinnerBanner` (most cells / clean sweep / boom), `Scoreboard` of seats by score (display: `{n} cells`, hearts for survivors), final board revealed (all mines shown), solo shows time. Buttons: Play again (`nav.playAgain` → fresh seed/board) and Home.

---

## 8. SDK Primitives Consumed

| Primitive | Use |
| --- | --- |
| `rng` | Seeded mine placement on first reveal (`engine/rng` shuffle), excluding the first-click 3×3. |
| `turnOrder` | Round-robin over 1–4 seats, skipping eliminated players. |
| `scoring` | Per-seat safe-cell tallies; winner selection + Results scoreboard. |
| `phaseMachine` | `playing → gameOver`. |
| `results` | Winner presentation + rematch wiring. |
| `clock` (ctx) | Solo stopwatch only — lives in the screen, passed nowhere into the reducer (purity). |
| `haptics`/`sound` | Tap, safe reveal, flag, boom, win/lose SFX (honour global mute). |

---

## 9. Edge Cases

1. **First click is always safe** — mines placed after it, excluding its 3×3. (test)
2. **Flood fill** opens the full connected zero-region + its number border; each cell scored once. (test)
3. **Flag then reveal** — flag is free, doesn't pass the turn; revealing a flagged cell is a no-op (must unflag first). (test)
4. **Chord with correct flags** clears neighbours; **chord with a wrong flag** can detonate (life lost). (test)
5. **Mine hit doesn't end a versus game** (unless it eliminates the last rival or empties solo lives) — play continues around the exploded cell. (test)
6. **Turn skips eliminated** seats; single remaining seat keeps playing solo to sweep. (test)
7. **Simultaneous sweep + elimination** → `swept` wins (board-clear precedence). 
8. **`mines === safe-cell boundary`** — validation forbids overfill (`mines ≤ cols·rows−9`).
9. **Resume mid-game** — board + scores are serializable; the solo stopwatch re-anchors to wall clock on remount (no time jump).
10. **RTL** — grid is row-major and direction-agnostic; numbers shown in locale digits; header/labels use logical properties.
11. **Action after `gameOver`** → no-op (same ref).
12. **Tapping a revealed cell** (non-chord) → no-op.

---

## 10. Unit Test Cases (`logic.test.ts`)

Fixtures: `setup({players, cols, rows, mines, seed})`; a deterministic `firstReveal(state, index)`.

1. `createInitialState` builds `cols·rows` hidden cells, `minesPlaced:false`, `safeRemaining = cells − mines`, seats scored 0 with `options.lives`.
2. First `REVEAL` places exactly `mines` mines, **none** in the clicked 3×3, and is deterministic for a fixed seed.
3. First reveal can never be a mine (property test over many seeds).
4. Flood fill from a zero-cell reveals the whole connected opening; `safeRemaining` and score drop/rise by the exact count.
5. Revealing a numbered (non-zero) safe cell reveals only it (+1 score, turn passes).
6. Mine hit: `lives--`, cell `exploded`, turn passes; not game-over while rivals/lives remain.
7. Mine hit eliminating the last rival → `gameOver`, `lastSurvivor`.
8. Board swept → `gameOver`, `swept`, winner = top score, ties shared.
9. Solo: sweep → `soloWin`; mine with 0 lives → `soloLoss` + full board revealed.
10. `FLAG` toggles, doesn't change `turnNo`; reveal of a flagged cell is a no-op.
11. `CHORD` clears neighbours when flag-count matches; detonates on a mis-flag.
12. Turn order skips eliminated seats.
13. Wrong-phase / illegal-cell actions return the same reference.
14. Reducer never mutates a frozen input; every result is JSON round-trip stable; no `Math.random`/`Date` in `logic.ts` (seed-driven).

---

## 11. File List (when built)

```
src/games/minesweeper/
├─ index.ts            # GameModule { manifest, createInitialState, reducer, screens }
├─ manifest.ts         # id 'minesweeper', titles en/fa, color, icon, minPlayers 1, maxPlayers 4
├─ logic.ts            # PURE: createInitialState, reducer, mine placement, flood fill, selectors
├─ logic.test.ts       # vitest (§10)
├─ config.ts           # MinesweeperOptions, DEFAULT_OPTIONS, normalizeOptions, validateConfig
├─ components/
│  └─ MineGrid.tsx     # responsive tap/flag/chord grid, per-player tint, boom + flood animations
└─ screens/
   ├─ SetupScreen.tsx
   ├─ PlayScreen.tsx
   └─ ResultsScreen.tsx
```

### manifest (draft)
```ts
export const manifest: GameManifest = {
  id: 'minesweeper',
  name: { en: 'Minesweeper', fa: 'مین‌یاب' },
  tagline: { en: "Sweep safely — don't hit a mine!", fa: 'بی‌خطر پاک کن — رو مین نری!' },
  minPlayers: 1,
  maxPlayers: 4,
  color: 'teal',           // tweak to fit the palette when added
  stateVersion: 1,
  // + howToPlay / description (en+fa), per the other manifests
};
```

> Adding the game later = drop this folder in `src/games/` (registry auto-discovers it) + add a `mine.*` i18n block to `en.json`/`fa.json` + an emblem in `sdk/ui/emblems.ts`. No shared contract changes. **Do not build until explicitly requested.**
