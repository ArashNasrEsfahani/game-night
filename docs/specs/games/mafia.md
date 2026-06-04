# Game Spec — Mafia / Werewolf (مافیا)

> Hidden-roles, night/day, pass-and-play on one phone. Device = role-dealer + narrator assistant.
> Game id: `mafia`. Status: spec complete, ready to implement with no further questions.

This spec conforms strictly to the contracts that live in `docs/specs/00-architecture.md`.
It references these architecture types/primitives by their exact names: `LocalizedString`,
`GameManifest`, `GameModule`, `GameContext`, and the SDK engine primitives `roster`, `teams`,
`turnOrder`, `timer`, `deck`, `scoring`, `voting`, `revealGate`, `phaseMachine`, `results`, plus
the SDK UI components catalogued in §11. Where this spec needs a type the architecture does not
provide, it is declared locally under the `mafia` namespace and lives inside `src/games/mafia/`.

---

## 0. Table of Contents

1. Overview & design goals
2. Player range & modes
3. Role sub-plugin system (the headline feature)
4. Content schema + 14 sample bilingual items
5. `MafiaConfig` (all setup options) + presets
6. State shape
7. Actions & reducer transitions (full table)
8. Phase machine
9. Voting model
10. Win-condition checker & scoring
11. SDK primitives consumed
12. SetupScreen / PlayScreen / ResultsScreen breakdown
13. Pass-and-play handoff & secrecy (RevealGate)
14. Narrator scripts & optional voiceover
15. Edge cases
16. File list & responsibilities
17. Unit-test cases for `logic.test.ts`
18. Public type signatures (copy-ready)

---

## 1. Overview & design goals

Mafia (a.k.a. Werewolf) is a social deduction game. Players are secretly dealt roles split into
two main factions — **Town** (مردم‌شهر) and **Mafia** (مافیا) — plus optional **neutral** roles.
The phone is the single shared device: it deals roles privately (one player at a time via
`revealGate`), then acts as the **narrator assistant**, running the night/day loop, prompting each
role's night action, timing the day discussion, collecting nominations and votes by tapping names,
eliminating players, and continuously checking the win condition.

Design goals specific to this game:

- **Roles are sub-plugins.** Each role is a self-contained object (id, faction, bilingual reveal
  text, optional night action descriptor, win/parity contribution). New roles = new file in
  `src/games/mafia/roles/`, auto-discovered. NEVER edit a shared file to add a role.
- **Pure logic.** All randomness (the shuffle seed, any tie-break seed) enters through action
  payloads. `logic.ts` exports `createInitialState(cfg)` and `reducer(state, action)` with no clock,
  no `Math.random`, no I/O. Narration timing & SFX live in screens/SDK, never in the reducer.
- **Narrator-assisted, not enforced.** The device shows the narrator (or any player acting as
  narrator) what to say and who to tap; it does not police whether players actually close their
  eyes. Night actions are *recorded on the device* by the narrator. This keeps the engine
  authoritative for alive/dead tracking and win detection while preserving the analog social feel.
- **Bilingual EN/FA, full RTL.** All UI via SDK UI components and i18n catalogs; all game CONTENT
  (role names, reveal text, narrator lines) as bilingual JSON `LocalizedString`.

---

## 2. Player range & modes

| Aspect | Value |
| --- | --- |
| Min players | **5** (enforced; below this the night/day loop is degenerate) |
| Recommended | 6–14 |
| Soft max | **20** (presets provided through 20) |
| Hard max | **30** (custom builder allows more; UI warns past 20) |
| Roster source | shared `roster` primitive (players set up once, reused across games) |

**Modes** (selected on SetupScreen, stored in `MafiaConfig.mode`):

- `"device-narrator"` (default) — the device runs the full scripted night/day loop. One player
  (often eliminated first, or a volunteer) reads the on-screen narrator prompts aloud and taps to
  record night actions. **All N rostered players get a role.**
- `"dedicated-narrator"` — one rostered player is designated `narratorPlayerId` and does NOT receive
  a role; they operate the device throughout. Playable count = N − 1 (so min roster = 6).
- `"silent"` — minimal prompts, no scripted flavor lines, faster pacing; the device only shows
  "Mafia, wake up" style cues and the action targets. Good for experienced groups.

`mode` only affects which narrator strings are surfaced and whether a player is excluded from
dealing; it does NOT change the reducer's role-assignment math except for excluding
`narratorPlayerId` from the dealt pool.

---

## 3. Role sub-plugin system

Roles are the central extensibility point. Each role lives in `src/games/mafia/roles/<roleId>.ts`
and default-exports a `MafiaRole`. They are auto-discovered with
`import.meta.glob('./roles/*.ts', { eager: true })` inside `src/games/mafia/roles/index.ts`, which
builds a `Record<RoleId, MafiaRole>` registry. Adding a role never requires editing logic, screens,
or content of other roles.

### 3.1 `MafiaRole` interface

```ts
export type RoleId = string;            // e.g. "mafia", "detective"
export type Faction = "town" | "mafia" | "neutral";

/** Describes a night action a role may perform. Pure description — execution is data-driven. */
export interface NightActionSpec {
  /** Stable action key, unique per role, e.g. "mafia.kill", "doctor.save". */
  key: string;
  /** Order index within the night; lower wakes first. Mafia ~10, Detective ~20, Doctor ~30, etc. */
  order: number;
  /** How many targets the narrator must tap. Usually 1; 0 = passive/info-only. */
  targetCount: 0 | 1 | 2;
  /** Whether the actor may target themselves (Doctor self-save, etc.). */
  canTargetSelf: boolean;
  /** Whether dead/eliminated players are valid targets (almost always false). */
  canTargetDead: boolean;
  /** May this action be skipped by the narrator (e.g. Sniper holds fire)? */
  skippable: boolean;
  /** Semantic effect applied during night resolution (see §8.4). */
  effect: NightEffect;
  /** Bilingual narrator prompt shown when this role wakes. */
  prompt: LocalizedString;
  /** Bilingual line shown after the action is recorded (confirmation), optional. */
  ack?: LocalizedString;
  /**
   * Per-game-night usage cap. undefined = every night.
   * e.g. Sniper { perGame: 1 }, Doctor self-save { ... } handled via effect rules.
   */
  uses?: { perGame?: number; perNight?: number };
  /** If true, this action only fires on the FIRST night (e.g. Cupid in werewolf variants). */
  firstNightOnly?: boolean;
}

export interface MafiaRole {
  id: RoleId;
  faction: Faction;
  /** Display name, bilingual. */
  name: LocalizedString;
  /** One-line tagline for setup cards & role builder. */
  tagline: LocalizedString;
  /** The private text the holder reads on RevealGate ("You are the Detective…"). */
  reveal: LocalizedString;
  /** Longer rules/ability text for the help sheet. */
  description: LocalizedString;
  /** Emoji/icon token used by RoleBadge UI (mapped to an inline SVG/emoji). */
  icon: string;
  /** Accent color token from the design system, e.g. "danger", "info", "success". */
  color: string;
  /** Night action, if any. Roles with no night action omit this (e.g. Citizen). */
  night?: NightActionSpec;
  /**
   * Faction shown publicly on death if "optionalReveal" is on. Some roles lie
   * (Godfather appears as Town to Detective) — that is handled by `appearsAs`.
   */
  appearsAs?: Faction;        // what Detective sees; defaults to `faction`.
  /**
   * Counts toward the MAFIA side for parity/win math. Default = (faction === "mafia").
   * Lets neutral roles opt into a side, or special roles (Godfather) stay mafia.
   */
  countsAsMafia?: boolean;
  /**
   * Counts toward the TOWN side for win math. Default = (faction === "town").
   */
  countsAsTown?: boolean;
  /** Min players recommended before this role is suggested in presets. */
  minPlayers?: number;
  /** Sort weight in the role builder list. */
  sort?: number;
}
```

### 3.2 `NightEffect` (data-driven night resolution)

Effects are declarative so resolution stays pure and table-driven (see §8.4):

```ts
export type NightEffect =
  | { kind: "kill" }                         // mark target for elimination (mafia)
  | { kind: "protect" }                      // negate one kill on target (doctor)
  | { kind: "investigate" }                  // narrator privately learns target's appearsAs
  | { kind: "vigKill" }                      // town-side kill (sniper); may misfire rules apply
  | { kind: "block" }                        // cancel target's night action (roleblocker)
  | { kind: "none" };                        // passive / no resolution
```

### 3.3 Shipped roles (initial set)

All ship in `src/games/mafia/roles/`. `order` governs night wake sequence.

| roleId | faction | night effect | order | targets | reveal-to-Detective | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `mafia` | mafia | kill | 10 | 1 (shared) | mafia | Standard. All mafia agree on ONE kill. |
| `godfather` | mafia | kill | 10 | 1 (shared) | **town** (`appearsAs:"town"`) | Leads mafia; Detective sees innocent. |
| `citizen` | town | none | — | — | town | No night action. The baseline town role. |
| `detective` | town | investigate | 20 | 1 | town | Learns target's `appearsAs`. |
| `doctor` | town | protect | 30 | 1 (self ok, self-save capped) | town | Negates one kill. |
| `sniper` | town | vigKill | 25 | 1 | town | `uses.perGame: 1`; skippable. |
| `roleblocker` | town | block | 5 | 1 | town | Optional advanced role. |
| `bodyguard` | town | protect | 30 | 1 (no self) | town | Variant of doctor; cannot self-protect. |

> Doctor self-save is governed by config (`MafiaConfig.allowDoctorSelfSave`, default once per game)
> rather than baked into the role, so the same role file serves multiple house rules.

Each role's `night.prompt`/`reveal`/`description` are authored as content (see §4). The role files
hold structural data; the long bilingual strings may either be inline `LocalizedString` literals or
imported from `content/roles.json` keyed by `roleId` (implementer's choice — both are validated by
a build-time check that every shipped role has complete EN+FA text).

---

## 4. Content schema

Content lives in `src/games/mafia/content/` as bilingual JSON, validated against the schema below.
There are three content files plus role text:

```
content/
  narrator.json     // scripted narrator lines (intro, night/day transitions, deaths, win)
  presets.json      // named role-composition presets keyed by player count
  roles.json        // (optional) externalized role reveal/prompt/description text
```

### 4.1 Types

```ts
export interface LocalizedString { en: string; fa: string }   // from architecture

export interface NarratorLine {
  id: string;                       // stable key, e.g. "night.open", "death.announce"
  text: LocalizedString;
  /** Optional audio asset keys for voiceover, resolved relative to assets/vo/. */
  vo?: { en?: string; fa?: string };
  /** Where this line is used by the phase machine. */
  slot:
    | "intro" | "night.open" | "night.role" | "night.close"
    | "day.open" | "day.discussion" | "day.nominate" | "day.vote"
    | "death.announce" | "death.silent" | "win.town" | "win.mafia" | "win.draw";
}

export interface NarratorContent {
  version: 1;
  lines: NarratorLine[];
}

export interface RolePreset {
  id: string;                       // "classic-7", "detective-doctor-9"
  name: LocalizedString;
  /** Inclusive player-count range this preset is valid for. */
  players: { min: number; max: number };
  /** Role composition as roleId -> count. Sum must equal a player count in range. */
  composition: Record<RoleId, number>;
  /** Optional sort/recommend weight. */
  sort?: number;
}

export interface PresetContent {
  version: 1;
  presets: RolePreset[];
}
```

### 4.2 Content validation rules (build-time + a vitest content test)

- Every `LocalizedString` has non-empty `en` AND `fa`.
- Every shipped `RoleId` referenced in `presets.json` exists in the role registry.
- For each preset, `sum(composition values)` falls within `[players.min, players.max]` and equals at
  least one integer in that range; mafia count `< ceil(total/2)` (otherwise mafia start at/over
  parity = instant win, which is rejected).
- Every narrator `slot` used by the phase machine has at least one line in BOTH `en` and `fa`.
- `vo` asset paths, if present, exist under `src/games/mafia/assets/vo/`.

### 4.3 Sample bilingual content — 14 real items

> These are production-quality EN + FA strings. They are split across narrator lines, role text, and
> presets to demonstrate every content type. Persian is natural, idiomatic, and RTL-safe.

**Narrator lines (`narrator.json`)**

```json
{
  "version": 1,
  "lines": [
    {
      "id": "intro.welcome",
      "slot": "intro",
      "text": {
        "en": "Welcome to the city. Pass the phone around — each of you will privately see your role, then hand it on.",
        "fa": "به شهر خوش آمدید. گوشی را دست‌به‌دست کنید؛ هر نفر نقش خود را پنهانی می‌بیند و سپس آن را به نفر بعد می‌دهد."
      }
    },
    {
      "id": "night.open",
      "slot": "night.open",
      "text": {
        "en": "Night falls. Everyone, close your eyes. The city sleeps.",
        "fa": "شب فرا می‌رسد. همه چشم‌ها را ببندید. شهر به خواب می‌رود."
      },
      "vo": { "en": "vo/night_open_en.mp3", "fa": "vo/night_open_fa.mp3" }
    },
    {
      "id": "night.mafia.wake",
      "slot": "night.role",
      "text": {
        "en": "Mafia, open your eyes and quietly agree on one person to eliminate. Tap their name.",
        "fa": "مافیا، چشم‌ها را باز کنید و بی‌صدا روی یک نفر برای حذف توافق کنید. روی نامش بزنید."
      }
    },
    {
      "id": "night.detective.wake",
      "slot": "night.role",
      "text": {
        "en": "Detective, wake up. Choose someone to investigate; the phone will tell you what you find.",
        "fa": "کارآگاه، بیدار شو. یک نفر را برای تحقیق انتخاب کن؛ گوشی نتیجه را به تو نشان می‌دهد."
      }
    },
    {
      "id": "night.doctor.wake",
      "slot": "night.role",
      "text": {
        "en": "Doctor, wake up. Choose one person to save tonight. Tap their name.",
        "fa": "دکتر، بیدار شو. یک نفر را برای نجات امشب انتخاب کن. روی نامش بزن."
      }
    },
    {
      "id": "day.open",
      "slot": "day.open",
      "text": {
        "en": "The sun rises. The city wakes up. Open your eyes, everyone.",
        "fa": "خورشید طلوع می‌کند. شهر بیدار می‌شود. همه چشم‌ها را باز کنید."
      }
    },
    {
      "id": "death.announce",
      "slot": "death.announce",
      "text": {
        "en": "Last night, {name} was killed. They were the {role}.",
        "fa": "دیشب، {name} کشته شد. او {role} بود."
      }
    },
    {
      "id": "death.silent",
      "slot": "death.silent",
      "text": {
        "en": "Last night, no one died. The city is uneasy.",
        "fa": "دیشب کسی کشته نشد. شهر آشفته است."
      }
    },
    {
      "id": "day.nominate",
      "slot": "day.nominate",
      "text": {
        "en": "Discuss, then nominate suspects by tapping their names. Two nominations are needed to bring someone to a vote.",
        "fa": "گفت‌وگو کنید، سپس مظنون‌ها را با زدن روی نامشان نامزد کنید. برای رأی‌گیری هر نفر به دو نامزدی نیاز دارد."
      }
    },
    {
      "id": "win.town",
      "slot": "win.town",
      "text": {
        "en": "All mafia have been eliminated. The city is safe — Town wins!",
        "fa": "تمام مافیا حذف شدند. شهر در امان است — مردم‌شهر برنده شدند!"
      }
    },
    {
      "id": "win.mafia",
      "slot": "win.mafia",
      "text": {
        "en": "The mafia now equal the town. The city has fallen — Mafia wins!",
        "fa": "تعداد مافیا با مردم برابر شد. شهر سقوط کرد — مافیا برنده شد!"
      }
    }
  ]
}
```

**Role text (`roles.json` excerpts — reveal + prompt for two roles)**

```json
{
  "detective": {
    "name": { "en": "Detective", "fa": "کارآگاه" },
    "reveal": {
      "en": "You are the Detective. Each night you may investigate one player to learn whether they are with the Mafia.",
      "fa": "تو کارآگاه هستی. هر شب می‌توانی یک بازیکن را بررسی کنی تا بفهمی با مافیا است یا نه."
    }
  },
  "godfather": {
    "name": { "en": "Godfather", "fa": "پدرخوانده" },
    "reveal": {
      "en": "You are the Godfather, leader of the Mafia. To the Detective you appear innocent.",
      "fa": "تو پدرخوانده‌ای، رهبر مافیا. در نگاه کارآگاه بی‌گناه به نظر می‌رسی."
    }
  }
}
```

**Presets (`presets.json` excerpt — two real presets)**

```json
{
  "version": 1,
  "presets": [
    {
      "id": "classic-7",
      "name": { "en": "Classic (7 players)", "fa": "کلاسیک (۷ بازیکن)" },
      "players": { "min": 7, "max": 7 },
      "composition": { "mafia": 2, "detective": 1, "doctor": 1, "citizen": 3 }
    },
    {
      "id": "advanced-10",
      "name": { "en": "Advanced (10 players)", "fa": "پیشرفته (۱۰ بازیکن)" },
      "players": { "min": 10, "max": 10 },
      "composition": { "godfather": 1, "mafia": 2, "detective": 1, "doctor": 1, "sniper": 1, "citizen": 4 }
    }
  ]
}
```

That is 10 narrator strings + 2 role-text strings (each with name+reveal) + 2 presets = **14
distinct bilingual content items**, each with real, complete EN and FA text.

---

## 5. `MafiaConfig` (setup options)

```ts
export interface MafiaConfig {
  /** Players dealt into the game (roster ids). Length 5..30. */
  playerIds: string[];
  /** Game pacing/narration mode. */
  mode: "device-narrator" | "dedicated-narrator" | "silent";
  /** Required iff mode === "dedicated-narrator"; this id is excluded from the dealt pool. */
  narratorPlayerId?: string;
  /** Final role composition: roleId -> count. Sum === number of dealt players. */
  composition: Record<RoleId, number>;
  /** Preset that seeded the composition, for display only. null if custom. */
  presetId: string | null;

  // House rules
  /** Reveal eliminated player's role publicly on death. Default true. */
  optionalReveal: boolean;
  /** Doctor may save self; "never" | "once" (default) | "always". */
  allowDoctorSelfSave: "never" | "once" | "always";
  /** Doctor may protect the SAME target on consecutive nights. Default false. */
  allowDoctorRepeat: boolean;
  /** Day discussion timer seconds (0 = untimed). Default 180. */
  discussionSeconds: number;
  /** Per-mafia-member night decision timer seconds (0 = untimed). Default 45. */
  nightActionSeconds: number;
  /** Voting style. */
  votingMode: "majority" | "plurality";
  /** Nominations required to put a player up for vote. Default 2 (1 for <6 players). */
  nominationsRequired: number;
  /** What happens on a tied elimination vote. */
  tieRule: "no-elimination" | "revote" | "random";
  /** First night is silent (no kill) — common house rule. Default false. */
  peacefulFirstNight: boolean;
  /** Reveal flipped role color/faction only (not exact role) on death. Default false. */
  revealFactionOnly: boolean;
  /** Whether SFX/VO narration is enabled (respects global mute too). Default true. */
  voiceover: boolean;
}
```

`createInitialState(cfg)` must reject (throw `MafiaConfigError`) if: dealt-player count < 5;
`sum(composition) !== dealtCount`; mafia-counted roles ≥ `ceil(dealtCount/2)` (mafia would start at
parity); `mode === "dedicated-narrator"` without a valid `narratorPlayerId` that is in `playerIds`;
any `roleId` in `composition` not present in the role registry. Screens guard against these before
dispatch, but the function is the source of truth.

### 5.1 Presets vs custom builder

SetupScreen offers preset chips (from `presets.json` filtered to the current dealt count) and a
**custom builder**: a stepper list of every registered role with +/- counters, a live "assigned
N / M players" meter, and a live faction-balance bar (town vs mafia vs neutral). The builder
enforces the same constraints as `createInitialState` and disables the Start button until valid.

---

## 6. State shape

```ts
export type MafiaPhase =
  | "deal"          // dealing roles via RevealGate, player by player
  | "night"         // running scripted night actions
  | "night-result"  // narrator announces deaths
  | "day"           // discussion timer
  | "nominate"      // tapping names to nominate
  | "vote"          // voting on the nominee(s)
  | "vote-result"   // elimination + optional reveal
  | "ended";        // win condition met

export interface MafiaPlayer {
  id: string;             // roster id
  roleId: RoleId;
  faction: Faction;
  alive: boolean;
  /** Turn order index in which they viewed their role (deal phase). */
  dealtAt: number;
  /** Round number they died, null if alive. */
  diedRound: number | null;
  /** How they died: "mafia" | "vig" | "vote" | null. */
  diedBy: "mafia" | "vig" | "vote" | null;
  /** Per-game action usage, keyed by NightActionSpec.key. */
  uses: Record<string, number>;
  /** Doctor's last protected target id (for allowDoctorRepeat enforcement). */
  lastProtected?: string | null;
}

/** A recorded night action (narrator taps it in). */
export interface NightActionRecord {
  actorId: string;        // who performed it
  roleId: RoleId;
  key: string;            // NightActionSpec.key
  targetId: string | null;// null when skipped
  skipped: boolean;
}

/** Result the narrator privately reads back (e.g. Detective result). */
export interface NightInfoResult {
  actorId: string;
  roleId: RoleId;
  targetId: string;
  /** For investigate: the faction the Detective sees (target.appearsAs). */
  seenFaction?: Faction;
}

export interface MafiaState {
  phase: MafiaPhase;
  round: number;                 // 0 during deal, 1+ once play starts
  players: MafiaPlayer[];
  config: MafiaConfig;

  // --- deal phase ---
  /** Index into deal order; -1 before dealing. */
  dealCursor: number;
  /** Deterministic deal order (player ids) computed from the shuffle seed. */
  dealOrder: string[];

  // --- night phase ---
  /** Queue of action steps for the current night, in wake order. */
  nightQueue: NightStep[];
  /** Index into nightQueue. */
  nightCursor: number;
  /** Actions recorded so far this night. */
  nightActions: NightActionRecord[];
  /** Info results to read back (Detective), surfaced privately to narrator. */
  nightInfo: NightInfoResult[];
  /** Computed deaths from the most recent resolved night (player ids). */
  lastNightDeaths: string[];

  // --- day / voting phase ---
  /** roleId-agnostic nomination tally: nomineeId -> count of nominators. */
  nominations: Record<string, number>;
  /** Players who have reached nominationsRequired this day, eligible for vote. */
  ballot: string[];
  /** votes: voterId -> nomineeId (for majority/plurality). */
  votes: Record<string, string>;
  /** Result of the latest vote resolution. */
  lastVoteEliminated: string | null;

  // --- end ---
  /** Winning faction once ended. */
  winner: Faction | "draw" | null;
  /** History log for ResultsScreen + stats. */
  log: MafiaLogEntry[];
}

/** One step the phase machine drives during night. */
export interface NightStep {
  roleId: RoleId;
  key: string;            // NightActionSpec.key
  /** Actor ids that share this step (mafia kill = all mafia together => one step). */
  actorIds: string[];
  order: number;
  targetCount: 0 | 1 | 2;
}

export type MafiaLogEntry =
  | { t: "deal"; round: 0 }
  | { t: "night-death"; round: number; playerId: string; by: "mafia" | "vig" }
  | { t: "night-quiet"; round: number }
  | { t: "vote-out"; round: number; playerId: string }
  | { t: "no-elim"; round: number }
  | { t: "win"; round: number; winner: Faction | "draw" };
```

---

## 7. Actions & reducer transitions

All actions are pure transitions. Randomness is supplied via `seed` in payloads. Time is supplied
via screen-provided values (e.g. timer expiry dispatches a normal action; the reducer never reads a
clock). Unknown actions return state unchanged (no throw).

| Action | Payload | Valid in phase | Effect / transition |
| --- | --- | --- | --- |
| `START` | `{ seed: number }` | (initial only) | From the state built by `createInitialState`: compute `dealOrder` by seeded Fisher–Yates of dealt `playerIds`; set `dealCursor = 0`, `phase = "deal"`, `round = 0`. Idempotent if already past deal. |
| `DEAL_NEXT` | `{}` | `deal` | Advance `dealCursor`. Player at previous cursor is considered "has seen role". When `dealCursor` reaches `dealOrder.length`, transition: build first `nightQueue`, set `nightCursor = 0`, `round = 1`, `phase = "night"` (or skip to `night-result` immediately if `peacefulFirstNight`). |
| `BUILD_NIGHT` | `{}` | internal (called by reducer) | Pure helper: collect alive actors with a `night` spec, group mafia kill into one step, sort by `order`, honor `uses`/`firstNightOnly`, produce `nightQueue`. Exposed as a pure fn `buildNightQueue(state)`; also dispatchable for tests. |
| `RECORD_NIGHT_ACTION` | `{ actorId: string; targetId: string | null; skipped?: boolean }` | `night` | Validate target legality against the current step's spec (alive, self/dead rules, repeat rules, uses cap). Push a `NightActionRecord`. For mafia step, the single shared step accepts one agreed target (re-recording overwrites). Increment `uses`. Does NOT advance cursor (so mafia can change their mind) — advancing is explicit. |
| `NIGHT_STEP_NEXT` | `{}` | `night` | Commit current step; advance `nightCursor`. If a required (non-skippable) step has no recorded action, no-op + return a `meta.error` flag (screen keeps user on step). When cursor passes the last step, dispatch internal `RESOLVE_NIGHT`. |
| `NIGHT_STEP_BACK` | `{}` | `night` | Move `nightCursor` back one (narrator correction); recorded actions for later steps are preserved but can be re-recorded. Cannot go below 0. |
| `RESOLVE_NIGHT` | `{}` | internal | Pure resolution (see §8.4): apply blocks → investigations (fill `nightInfo`) → kills vs protects → compute `lastNightDeaths`; mark those players `alive=false`, set `diedRound=round`, `diedBy`. Append log entries. Set `phase = "night-result"`. Then run win check (may jump to `ended`). |
| `ACK_NIGHT_RESULT` | `{}` | `night-result` | Narrator has read the death announcement. If not ended → `phase = "day"`, reset `nominations={}`, `ballot=[]`, `votes={}`. |
| `END_DISCUSSION` | `{}` | `day` | (Timer expiry or manual.) `phase = "nominate"`. |
| `NOMINATE` | `{ nomineeId: string; nominatorId?: string }` | `nominate` | Increment `nominations[nomineeId]`. When it reaches `config.nominationsRequired`, add to `ballot` (if not already, and nominee alive). `nominatorId` optional (used only if we later enforce one-nomination-per-player). |
| `UNNOMINATE` | `{ nomineeId: string }` | `nominate` | Decrement nomination; remove from `ballot` if below threshold. Floor at 0. |
| `OPEN_VOTE` | `{}` | `nominate` | Requires `ballot.length >= 1`. `phase = "vote"`, `votes = {}`. If `ballot` empty, no-op with `meta.error`. |
| `CAST_VOTE` | `{ voterId: string; nomineeId: string }` | `vote` | Validate voter alive, not the nominee in single-target self-vote rules (self-vote allowed by default), nominee on ballot. Set `votes[voterId] = nomineeId` (overwrite allowed). |
| `RETRACT_VOTE` | `{ voterId: string }` | `vote` | Delete `votes[voterId]`. |
| `RESOLVE_VOTE` | `{ seed: number }` | `vote` | Tally per §9. Determine eliminated (or none on tie per `tieRule`, using `seed` only when `tieRule==="random"`). Set `lastVoteEliminated`, mark eliminated `alive=false`, `diedBy="vote"`, `diedRound=round`. Append log. `phase="vote-result"`. Run win check. |
| `REVOTE` | `{}` | `vote-result` | Only valid when last resolution was a tie and `tieRule==="revote"`. Clears `votes`, narrows `ballot` to tied players, `phase="vote"`. Guarded: a second tie falls back to `no-elimination`. |
| `ACK_VOTE_RESULT` | `{}` | `vote-result` | If ended → stay/confirm `ended`. Else increment `round`, rebuild `nightQueue`, `nightCursor=0`, reset day fields, `phase="night"`. |
| `CHECK_WIN` | `{}` | any (internal) | Recompute winner per §10. If decided, set `winner`, append `win` log, `phase="ended"`. Pure & idempotent. Invoked by reducer after every death-producing action; also exposed for tests. |
| `ABORT_GAME` | `{ winner?: Faction | "draw" }` | any | Manual end (narrator quits). Set `phase="ended"`, `winner = payload.winner ?? null`. |
| `RESET` | `{}` | any | Return to the freshly built initial state (same config) so a group can replay with the same roster; new `START` reshuffles. |

> Mafia "shared kill" detail: the mafia kill is ONE `NightStep` whose `actorIds` is every alive
> mafia-faction member. `RECORD_NIGHT_ACTION` for that step stores a single record with the agreed
> `targetId` (the narrator records the group's choice). This keeps the model simple and matches
> physical play (mafia point together). Godfather is part of the same step.

### 7.1 `meta` channel

The reducer returns plain `MafiaState`. To surface non-fatal validation feedback (illegal target,
empty ballot) without throwing, the reducer attaches a transient field
`state._meta?: { error?: string; info?: string }` that screens read then clear on the next action.
`_meta` is excluded from persistence and never affects logic/win math. (Alternatively the
architecture's `reducer` may return `{ state, meta }`; this spec assumes the plain-state form and a
non-persisted `_meta`. Implementer must follow whichever the architecture's `reducer` signature
mandates — both are documented here so there is no ambiguity.)

---

## 8. Phase machine

### 8.1 Phase graph

```
deal ──(all dealt)──▶ night ──▶ night-result ──(ack)──▶ day ──▶ nominate ──(open vote)──▶ vote
                        ▲                                                                      │
                        │                                                                      ▼
                        └──────────────── ack-vote-result ◀── vote-result ◀──(resolve)────────┘
any phase that produces a death ──▶ CHECK_WIN ──(decided)──▶ ended
peacefulFirstNight: deal ──▶ night-result(no deaths) ──▶ day  (round 1 night skipped)
```

### 8.2 `PhaseMachine` config consumed from SDK

The game declares its phase machine to the SDK `phaseMachine` primitive as a static config; the SDK
provides transition guards, the back-stack for narrator corrections, and per-phase timer wiring.

```ts
export const mafiaPhaseMachine: PhaseMachineConfig<MafiaPhase, MafiaAction["type"]> = {
  initial: "deal",
  states: {
    deal:          { on: { DEAL_NEXT: "deal", /* auto */ } , final: false },
    night:         { on: { NIGHT_STEP_NEXT: "night", RESOLVE_NIGHT: "night-result" } },
    "night-result":{ on: { ACK_NIGHT_RESULT: "day" }, timer: null },
    day:           { on: { END_DISCUSSION: "nominate" }, timer: "discussion" },
    nominate:      { on: { OPEN_VOTE: "vote" } },
    vote:          { on: { RESOLVE_VOTE: "vote-result" }, timer: "vote" },
    "vote-result": { on: { ACK_VOTE_RESULT: "night", REVOTE: "vote" } },
    ended:         { final: true },
  },
  timers: {
    discussion: (cfg) => cfg.discussionSeconds,
    vote:       (cfg) => cfg.nightActionSeconds, // reuse a short timer for voting; configurable
  },
};
```

Timers come from the SDK `timer` primitive. The timer **does not** mutate state itself; on expiry
the screen dispatches the phase's "advance" action (`END_DISCUSSION`, etc.). Reducer stays pure.

### 8.3 Night queue construction (`buildNightQueue`)

Pure function:

1. Filter alive players with a `night` spec.
2. For roles with `firstNightOnly` and `round > 1`, drop.
3. For roles whose `uses.perGame` cap is exhausted (per actor), drop.
4. Group all alive `countsAsMafia` actors that share `key === "mafia.kill"`/`godfather.kill` into a
   single `NightStep` (one shared kill). If a godfather is present, the step is still one kill.
5. Sort remaining steps by `order` asc, then by `roleId` for determinism.
6. If `peacefulFirstNight && round === 1`, return `[]` (skip straight to a quiet night-result).

### 8.4 Night resolution (`resolveNight`) — table-driven, pure

Apply effects in this fixed precedence (so order of narrator entry is irrelevant):

1. **block**: any `block` action cancels the target actor's recorded action (mark it inert).
2. **investigate**: for each non-blocked investigate, push `NightInfoResult` with
   `seenFaction = target.appearsAs ?? target.faction`. (Godfather → `"town"`.)
3. **protect**: collect protected ids. Doctor self-save honored only if config allows and use-cap
   not exceeded; `allowDoctorRepeat` rejects repeating `lastProtected`.
4. **kills**: gather `kill` (mafia) and `vigKill` (sniper) targets (non-blocked). A target dies
   unless its id is in the protected set. Multiple kills on one target = still one death.
5. Build `lastNightDeaths`; set those players dead with `diedRound`, `diedBy` (`"mafia"` or `"vig"`).
6. If no deaths → log `night-quiet`, else log each `night-death`.

Resolution is a single pure function `resolveNight(state): { deaths, info, nextPlayers, log }` with
exhaustive unit tests (§17).

---

## 9. Voting model

- **Nomination** (`nominate` phase): tapping a name calls `NOMINATE`. When a nominee's count hits
  `config.nominationsRequired`, they join `ballot`. UnNominate reverses. For `< 6` players the
  default `nominationsRequired` is 1.
- **Voting** (`vote` phase): each alive player taps the nominee they accuse → `CAST_VOTE`. Re-tap
  overwrites; tapping their own current choice acts as confirm. `RETRACT_VOTE` clears.
- **Tally** (`RESOLVE_VOTE`):
  - `majority`: a nominee needs `> floor(aliveCount / 2)` votes to be eliminated; otherwise no
    elimination (unless `tieRule` produces one).
  - `plurality`: the nominee with the most votes is eliminated; ties handled by `tieRule`.
- **Ties** (`tieRule`):
  - `no-elimination`: nobody dies; log `no-elim`.
  - `revote`: `REVOTE` narrows ballot to the tied set; a second tie → `no-elimination`.
  - `random`: deterministic pick among tied using `RESOLVE_VOTE.seed` (seeded index). Logged as a
    normal `vote-out`.
- Abstentions are allowed (a player simply isn't in `votes`). Dead players cannot vote or be voted.

---

## 10. Win-condition checker & scoring

`checkWin(players, config): Faction | "draw" | null` — pure, called after every death.

Let, among **alive** players:
- `mafiaAlive` = count where `countsAsMafia ?? faction === "mafia"`.
- `townAlive` = count where `countsAsTown ?? faction === "town"`.
- `neutralAlive` = the remainder (alive neutrals not counted to either side).

Rules (evaluated in order):

1. **Town wins** if `mafiaAlive === 0`. (All mafia eliminated.) → `"town"`.
2. **Mafia wins** if `mafiaAlive >= townAlive` (parity or better) AND `mafiaAlive > 0`. → `"mafia"`.
   - Neutrals do NOT block parity by default; they are bystanders for win math unless a neutral role
     opts into a side via `countsAsMafia/Town`.
3. **Draw** if `mafiaAlive === 0 && townAlive === 0` (mutual wipe, e.g. simultaneous sniper + vote).
   → `"draw"`.
4. Otherwise `null` (game continues).

> Parity is checked AFTER all deaths of the current step are applied (night resolution applies all
> deaths first, then one `checkWin`). This avoids false early wins mid-resolution.

### 10.1 Scoring (via SDK `scoring` + `results`)

Mafia is fundamentally team-based, not points-based, but the app records per-game results for the
stats feature:

- Winning faction members → `+1 win`, losers → `+1 loss` (recorded through `scoring`).
- Optional "MVP" derived stat (not authoritative, shown on ResultsScreen): the alive winner with the
  most successful actions (mafia kills landed, doctor saves that prevented a death, detective correct
  reads). Computed by a pure helper `computeMvp(state)` from the log; ties → first by deal order.
- `results` primitive receives `{ winner, players: [{ id, roleId, faction, alive, won }], rounds:
  round, log }` for display and Supabase sync (signed-in only).

---

## 11. SDK primitives consumed

| SDK primitive | How Mafia uses it |
| --- | --- |
| `roster` | Source of players for SetupScreen (`playerIds`), names/avatars for all tappable lists. |
| `teams` | NOT used as fixed pre-set teams; factions are hidden roles, managed internally. (Mafia opts out of `teams`.) |
| `turnOrder` | Deal order during `deal` phase (seeded), and "pass to next player" indication. |
| `timer` | Day `discussion` timer and the per-night/vote timer. Expiry dispatches advance actions; never mutates state directly. |
| `deck` | The role "deck": shuffle+deal of `composition` into `playerIds` uses `deck.shuffle(seed)`/`deal`. Roles are deck cards; RevealGate flips each. |
| `scoring` | Records win/loss per player at game end. |
| `voting` | Backs nomination + elimination UI (tally helpers, ballot rendering). Mafia configures it for "tap a name → accuse" with majority/plurality. |
| `revealGate` | The secrecy gate during `deal` (and for any private info read-back, e.g. Detective result). See §13. |
| `phaseMachine` | Drives `deal → night → … → ended` per §8. |
| `results` | Final summary payload + Supabase sync. |

---

## 12. Screen-by-screen breakdown

All screens are composed from `sdk/ui` components and dispatch actions via `GameContext`. They hold
NO game rules. Screens receive `{ state, dispatch, ctx }` where `ctx: GameContext` exposes roster,
i18n `t`, sound/haptics, theme, and the SDK UI components. Player display names/avatars come from
`ctx.roster.get(id)`.

### 12.1 `SetupScreen.tsx`

Purpose: choose players, mode, and role composition; validate; START.

On screen:
- **Header**: game title (`RoleBadge`/`GameHeader`), short rules link → opens `Sheet` with how-to.
- **Player picker**: `PlayerMultiSelect` (SDK) bound to `roster`. Shows chips; min 5 enforced; for
  `dedicated-narrator`, a `Select` to pick `narratorPlayerId` (excluded from count).
- **Mode segmented control**: `SegmentedControl` (SDK) → sets `mode`.
- **Composition area**:
  - `PresetChips` (SDK `ChipGroup`) filtered to current dealt count; tap fills `composition`.
  - **Custom builder**: `Stepper` rows per registered role (icon, name, tagline, +/- counter), a
    sticky `BalanceMeter` (custom small component using SDK `ProgressBar` + `RoleBadge`) showing
    assigned/total and town/mafia/neutral split, live-validated.
- **House-rules accordion** (`Accordion` SDK): toggles/sliders for `optionalReveal`,
  `allowDoctorSelfSave`, `discussionSeconds`, `votingMode`, `tieRule`, `peacefulFirstNight`,
  `voiceover`, etc. (`Switch`, `Slider`, `Select` SDK components).
- **Start button** (`PrimaryButton`): disabled until config valid (mirrors `createInitialState`
  guards). On tap: build config, `ctx.newGame(config)` then `dispatch(START, { seed: ctx.rng.seed() })`.

Dispatches: none until START (config assembled locally), then `START`.

### 12.2 `PlayScreen.tsx`

A single screen that renders sub-views by `state.phase`. It owns the timer wiring (reads
`phaseMachine.timers`) and the narrator script surfacing.

**deal** sub-view (secrecy):
- Big `PassPrompt`: "Pass the phone to {currentName}". Avatar + name from roster via `turnOrder`.
- A `RevealGate` (SDK): a covered card the current player taps & holds (or taps "Reveal") to flip,
  showing `RoleBadge` + role `name` + `reveal` text + ability `description` in their language. A
  "Hide & pass" `PrimaryButton` re-covers and dispatches `DEAL_NEXT`.
- Progress: `Stepper`/`ProgressBar` "Dealt k / N".
- Last player's "Hide & pass" triggers the deal→night transition (reducer handles).

**night** sub-view (narrator-assisted):
- `NarratorBanner` shows the current line: `night.open` first, then per-step prompt from the role's
  `night.prompt`, voiced via `ctx.sound` if `voiceover` & not muted.
- For the active `NightStep`: `PlayerTapGrid` (SDK `TapList`) of alive legal targets; tapping records
  via `RECORD_NIGHT_ACTION`. `targetCount`/self/dead rules disable illegal tiles.
- For `targetCount === 0` (passive/info) just an acknowledge button.
- Controls: `Skip` (if `skippable`) → `RECORD_NIGHT_ACTION{skipped:true}`; `Back` →
  `NIGHT_STEP_BACK`; `Next` → `NIGHT_STEP_NEXT`. Optional per-step `Timer` ring.
- **Private info read-back** (Detective): after the investigate step is committed, a `RevealGate`
  shows the result privately to the narrator/detective ("{name} appears: Innocent/Mafia"), sourced
  from `nightInfo`. Hidden again before moving on.
- The last `Next` resolves the night (reducer → `night-result`).

**night-result** sub-view:
- `NarratorBanner`: `death.announce` (interpolating `{name}`,`{role}` — role only if
  `optionalReveal`) for each id in `lastNightDeaths`, or `death.silent` if none.
- `Tombstone` row for newly dead. `PrimaryButton` "Continue to day" → `ACK_NIGHT_RESULT`.

**day** sub-view:
- `NarratorBanner`: `day.open`. Large `Timer` (discussion) ring; `AliveRoster` grid (dead shown
  dimmed with role if revealed). `PrimaryButton` "End discussion / Start nominations" →
  `END_DISCUSSION` (also auto-fires on timer expiry).

**nominate** sub-view:
- `NarratorBanner`: `day.nominate`. `TapList` of alive players, each showing a nomination count
  badge; tap → `NOMINATE`, long-press/× → `UNNOMINATE`. Nominees crossing threshold get a "on
  ballot" pill. `PrimaryButton` "Go to vote" → `OPEN_VOTE` (disabled if ballot empty).

**vote** sub-view:
- `VotePanel` (SDK `voting` UI): ballot nominees as columns/rows; each alive voter taps the nominee
  they accuse → `CAST_VOTE` (the device can be passed, or done show-of-hands then narrator records
  totals — both supported because votes are keyed by voterId; a simplified "tap counts" mode lets
  narrator just increment tallies). Live tally bars (`ProgressBar`). `Timer` (vote). `PrimaryButton`
  "Resolve vote" → `RESOLVE_VOTE{seed}`.

**vote-result** sub-view:
- `NarratorBanner`: who was eliminated (+ role if revealed) or "no elimination". `Tombstone`.
  Buttons: `REVOTE` (only on tie+revote rule) and `PrimaryButton` "Next night" → `ACK_VOTE_RESULT`.

Global: a `GameMenu` (`Sheet`) with Mute toggle (global), "Show rules", "End game" → `ABORT_GAME`,
"Restart" → `RESET`. Mute, theme, and language come from global stores via `ctx`.

### 12.3 `ResultsScreen.tsx`

Rendered when `phase === "ended"`.

On screen:
- **Winner banner**: big `WinBanner` with faction color + `win.town`/`win.mafia`/`win.draw` line,
  confetti via framer-motion, victory SFX (if unmuted).
- **Role reveal grid**: every player as a `RoleRevealCard` (avatar, name, role icon+name, faction
  chip, alive/dead, "won" check). Dead show round/cause.
- **MVP card**: `computeMvp(state)` highlight (optional, derived).
- **Timeline**: `LogList` rendering `state.log` (night deaths, vote-outs, quiet nights) — bilingual.
- **Actions**: `PrimaryButton` "Play again (same players)" → `RESET` then back to SetupScreen with
  the same roster preselected; `SecondaryButton` "Change setup" → SetupScreen; "Home" → router.
- If signed-in, results are persisted via `results`→Supabase; otherwise stored locally only.

Dispatches: `RESET`; navigation via `ctx.router`.

---

## 13. Pass-and-play handoff & secrecy (RevealGate)

The whole game hinges on private viewing on a shared phone. Rules:

1. **Deal handoff loop.** During `deal`, the screen shows ONLY "Pass to {name}" until that player
   actively reveals. The `RevealGate` requires a deliberate action (tap-and-hold ~600ms or an
   explicit "I am {name} — reveal" button) so a glance can't expose the role. While covered, no role
   data is in the DOM in a readable position (render the role only after the gate opens).
2. **Re-cover before pass.** The only way to advance is "Hide & pass", which re-covers AND dispatches
   `DEAL_NEXT` in one step, so the next person never sees the previous role.
3. **No back-peek.** There is no "previous" during deal. If a misdeal happens, the narrator uses the
   global menu → `RESET` (full reshuffle). This is intentional: allowing re-view would leak roles.
4. **Night privacy.** Night prompts are public narration ("Mafia, wake up"), but Detective's *result*
   is private → wrapped in a `RevealGate` shown to the narrator/detective only, re-covered before
   `NIGHT_STEP_NEXT`.
5. **Secrecy of dead roles.** If `optionalReveal` is false, eliminated roles are NEVER shown until
   `ResultsScreen`. If `revealFactionOnly`, show only the faction color/word, not the exact role.
6. **Screenshot/lock resilience.** State persists via zustand persist + idb-keyval, so backgrounding
   the phone mid-deal resumes at the same `dealCursor` without re-revealing prior players. `_meta`
   and any transient reveal state are NOT persisted.
7. **RNG never on screen during deal.** Roles are pre-assigned at `START` (seeded); the gate only
   reveals already-decided data. No client could infer others' roles from what's rendered.

---

## 14. Narrator scripts & optional voiceover

- Narrator lines are content (§4) selected by the phase machine `slot`. `mode === "silent"` uses
  only the minimal slots (`night.role` prompts + targets), skipping flavor (`intro`, day flavor).
- Interpolation tokens `{name}`, `{role}`, `{count}` are filled by the screen using roster + role
  registry in the active language; `{role}` is omitted when reveal is off.
- **Optional voiceover**: if `config.voiceover && !globalMute`, each surfaced line plays its `vo`
  asset for the active language via `ctx.sound` (howler). Missing VO falls back to text-only.
  Voiceover is purely presentational; it never gates state transitions.
- Haptics: a short `navigator.vibrate` on phase transitions and on recording a kill/elimination
  (respecting global mute/haptics setting).

---

## 15. Edge cases

| # | Situation | Handling |
| --- | --- | --- |
| 1 | Fewer than 5 dealt players | `createInitialState` throws `MafiaConfigError`; Start disabled. |
| 2 | Composition sum ≠ dealt count | Rejected at setup + in `createInitialState`. |
| 3 | Mafia ≥ parity at start | Rejected (would be instant win). |
| 4 | `peacefulFirstNight` | Round-1 night queue empty → quiet `night-result` → day. |
| 5 | All mafia have no valid target (e.g. only mafia + 1 town, but that's already a win) | Win check fires before night; night never reached. |
| 6 | Doctor saves the mafia's target | No death that night → `death.silent`. |
| 7 | Doctor self-save against `allowDoctorSelfSave` rule | Tile disabled; `RECORD_NIGHT_ACTION` rejects with `_meta.error`. |
| 8 | Sniper shoots a town member | Town member dies, `diedBy:"vig"`; if it drops town to parity, mafia may win — surfaced normally. |
| 9 | Detective investigates Godfather | `seenFaction = "town"` (appearsAs). |
| 10 | Roleblocker blocks the only mafia killer | That kill is inert → quiet night. |
| 11 | Roleblocker blocks the doctor; mafia kill lands | Death occurs (protection cancelled). |
| 12 | Tie elimination vote, `tieRule:"revote"`, ties again | Falls back to no-elimination. |
| 13 | Everyone abstains / empty ballot at OPEN_VOTE | `OPEN_VOTE` no-op + `_meta.error`; stay in nominate. |
| 14 | Simultaneous wipe (last town voted out same round mafia also gone) | `checkWin` → `"draw"`. |
| 15 | Narrator misclicks a night target | `NIGHT_STEP_BACK` then re-record before `NEXT`. |
| 16 | App backgrounded mid-deal | Resume at same `dealCursor` from persisted state; no re-reveal. |
| 17 | Global mute on | No SFX/VO; haptics follow their own setting; everything else identical. |
| 18 | RTL (fa) | All layouts use logical utilities; tap grids, tallies, timeline mirror correctly. |
| 19 | Sniper used twice (perGame cap) | Second night the sniper step is dropped from `nightQueue`. |
| 20 | Player elimination causes round counter mismatch | `diedRound` always the round of death; log entries carry round; ResultsScreen reconstructs order. |
| 21 | Dedicated narrator with min roster | min roster = 6 so 5 still play; Start disabled if <6 in that mode. |
| 22 | Duplicate nominations from same person | Default ignores nominator identity; if `nominatorId` provided and one-per-player enforced (future flag), repeat is a no-op. |

---

## 16. File list & responsibilities

```
src/games/mafia/
  index.ts                 // default-exports the GameModule (manifest + screens + logic + content)
  manifest.ts              // GameManifest: id "mafia", names/desc (LocalizedString), icon, color,
                           //   minPlayers 5, maxPlayers 30, tags ["deduction","party"]
  logic.ts                 // PURE: createInitialState(cfg), reducer(state, action),
                           //   + pure helpers buildNightQueue, resolveNight, checkWin, tallyVotes,
                           //   computeMvp, seededShuffle. NO side effects.
  logic.test.ts            // vitest unit tests (see §17)
  types.ts                 // MafiaConfig, MafiaState, MafiaPlayer, MafiaAction, MafiaPhase,
                           //   NightStep, NightActionRecord, NightInfoResult, MafiaLogEntry,
                           //   MafiaRole, NightActionSpec, NightEffect, RoleId, Faction
  roles/
    index.ts               // import.meta.glob('./*.ts', {eager:true}) -> Record<RoleId, MafiaRole>
    mafia.ts               // MafiaRole
    godfather.ts
    citizen.ts
    detective.ts
    doctor.ts
    sniper.ts
    roleblocker.ts
    bodyguard.ts
  content/
    narrator.json          // NarratorContent
    presets.json           // PresetContent
    roles.json             // externalized role text (validated complete EN+FA)
  content.ts               // typed loaders + content validation (used by a content test)
  assets/
    vo/                    // optional voiceover mp3s (en/fa)
  screens/
    SetupScreen.tsx        // §12.1
    PlayScreen.tsx         // §12.2 (renders phase sub-views)
    ResultsScreen.tsx      // §12.3
    parts/                 // small presentational pieces composed from sdk/ui
      BalanceMeter.tsx
      NarratorBanner.tsx
      NightTargetGrid.tsx
      RoleRevealCard.tsx
      Tombstone.tsx
```

`index.ts` shape (conforming to `GameModule`):

```ts
import type { GameModule } from "@/sdk/types";
import { manifest } from "./manifest";
import { createInitialState, reducer } from "./logic";
import SetupScreen from "./screens/SetupScreen";
import PlayScreen from "./screens/PlayScreen";
import ResultsScreen from "./screens/ResultsScreen";

const mafia: GameModule = {
  manifest,
  createInitialState,
  reducer,
  screens: { Setup: SetupScreen, Play: PlayScreen, Results: ResultsScreen },
};
export default mafia;
```

`manifest.ts` shape (conforming to `GameManifest`):

```ts
import type { GameManifest } from "@/sdk/types";
export const manifest: GameManifest = {
  id: "mafia",
  name: { en: "Mafia / Werewolf", fa: "مافیا" },
  tagline: { en: "Hidden roles, night & day.", fa: "نقش‌های پنهان، شب و روز." },
  description: {
    en: "Town vs. Mafia social deduction. The phone deals roles secretly and narrates the night/day loop.",
    fa: "نبرد مردم‌شهر و مافیا. گوشی نقش‌ها را پنهانی پخش می‌کند و چرخهٔ شب و روز را روایت می‌کند.",
  },
  icon: "mask",
  color: "mafia",               // design-token accent
  minPlayers: 5,
  maxPlayers: 30,
  tags: ["deduction", "party", "teams"],
  estMinutes: { min: 15, max: 45 },
};
```

---

## 17. Unit-test cases for `logic.test.ts`

All against pure functions. Use fixed seeds. Build helper `mk(cfgOverrides)` and `deal(state, seed)`.

**createInitialState / config validation**
1. Valid 7-player classic config → returns state with `phase:"deal"`-ready, 7 players, composition
   counts match per role.
2. <5 players → throws `MafiaConfigError`.
3. composition sum ≠ player count → throws.
4. mafia count at parity (e.g. 3 mafia / 6 players where town=3) → throws (instant-win guard).
5. unknown roleId in composition → throws.
6. `dedicated-narrator` without `narratorPlayerId` in `playerIds` → throws; narrator excluded from
   dealt pool when valid.

**START / dealing (determinism)**
7. `START{seed}` produces a `dealOrder` that is a permutation of dealt ids; same seed → identical
   order; different seed → (statistically) different.
8. Role assignment honors composition exactly (count per role) regardless of seed.
9. `DEAL_NEXT` advances cursor; after N deals, transitions to `night` (round 1) with a built
   `nightQueue`; with `peacefulFirstNight` transitions to `night-result` with empty deaths.

**buildNightQueue**
10. Standard comp → steps sorted by `order`; mafia+godfather collapse into ONE shared kill step
    whose `actorIds` = all alive mafia.
11. Dead actors excluded; `firstNightOnly` excluded on round 2; sniper excluded after `perGame` use.
12. peacefulFirstNight round 1 → empty queue.

**RECORD_NIGHT_ACTION validation**
13. Targeting a dead player → rejected (state unchanged, `_meta.error`).
14. Doctor self-save when `allowDoctorSelfSave:"never"` → rejected; when `"once"` allowed first time,
    rejected second time.
15. `allowDoctorRepeat:false` repeating `lastProtected` → rejected.
16. Skippable action skip records `skipped:true`; non-skippable cannot advance without a target
    (`NIGHT_STEP_NEXT` no-op + error).

**resolveNight (precedence)**
17. Mafia kill with no doctor → target dies, `diedBy:"mafia"`, `lastNightDeaths=[id]`.
18. Doctor protects mafia's target → no death, `death.silent`, quiet log.
19. Roleblocker blocks the mafia killer → no death.
20. Roleblocker blocks the doctor; mafia kill lands → death occurs.
21. Detective investigates Godfather → `nightInfo.seenFaction === "town"`; investigates real mafia →
    `"mafia"`.
22. Sniper vigKill on town member → death `diedBy:"vig"`.
23. Two kills on same target (mafia + sniper) → exactly one death (no double).
24. Protect + investigate ordering irrelevant: same result regardless of record order.

**voting / tallyVotes**
25. Majority mode: nominee with `> floor(alive/2)` votes eliminated; below threshold → no
    elimination.
26. Plurality mode: highest vote count eliminated.
27. Tie + `no-elimination` → nobody dies, `no-elim` log.
28. Tie + `random{seed}` → deterministic pick for a given seed; different seed may differ.
29. Tie + `revote` → ballot narrows to tied set; second tie → no elimination.
30. NOMINATE reaching `nominationsRequired` adds to ballot; UNNOMINATE below threshold removes;
    `OPEN_VOTE` with empty ballot → no-op + error.
31. CAST_VOTE overwrite (re-vote) keeps one vote per voter; RETRACT_VOTE removes it; dead voter
    rejected.

**checkWin**
32. mafiaAlive 0 → `"town"`.
33. mafiaAlive ≥ townAlive (parity) and >0 → `"mafia"`.
34. both 0 → `"draw"`.
35. otherwise → `null`.
36. Neutral-only survivors don't flip parity unless `countsAs*` set.
37. After a `RESOLVE_VOTE` that creates a win → `phase:"ended"`, `winner` set, `win` log appended,
    further actions (except RESET) are no-ops.

**phase machine / flow integration (pure, dispatch sequences)**
38. Full happy-path sequence: deal → night (record mafia kill) → resolve → ack → day → end
    discussion → nominate (reach threshold) → open vote → cast majority → resolve → ack → next
    night, with `round` incrementing to 2.
39. `RESET` returns to initial config state; subsequent `START` reshuffles (new seed → new order).
40. `ABORT_GAME{winner:"draw"}` → ended with that winner.
41. Unknown action type → state unchanged.
42. Reducer purity: deep-freeze input state, dispatch any action, original not mutated (structural
    sharing only).

**content validation (in a separate `content.test.ts`, referenced here)**
43. Every shipped role + narrator line + preset has non-empty `en` AND `fa`.
44. Every preset composition references registered roles and respects the parity/range constraint.

---

## 18. Public type signatures (copy-ready)

```ts
// ---- discriminated action union ----
export type MafiaAction =
  | { type: "START"; seed: number }
  | { type: "DEAL_NEXT" }
  | { type: "BUILD_NIGHT" }
  | { type: "RECORD_NIGHT_ACTION"; actorId: string; targetId: string | null; skipped?: boolean }
  | { type: "NIGHT_STEP_NEXT" }
  | { type: "NIGHT_STEP_BACK" }
  | { type: "RESOLVE_NIGHT" }
  | { type: "ACK_NIGHT_RESULT" }
  | { type: "END_DISCUSSION" }
  | { type: "NOMINATE"; nomineeId: string; nominatorId?: string }
  | { type: "UNNOMINATE"; nomineeId: string }
  | { type: "OPEN_VOTE" }
  | { type: "CAST_VOTE"; voterId: string; nomineeId: string }
  | { type: "RETRACT_VOTE"; voterId: string }
  | { type: "RESOLVE_VOTE"; seed: number }
  | { type: "REVOTE" }
  | { type: "ACK_VOTE_RESULT" }
  | { type: "CHECK_WIN" }
  | { type: "ABORT_GAME"; winner?: Faction | "draw" }
  | { type: "RESET" };

// ---- pure logic surface (logic.ts) ----
export function createInitialState(cfg: MafiaConfig): MafiaState;       // throws MafiaConfigError
export function reducer(state: MafiaState, action: MafiaAction): MafiaState;

// internal pure helpers (exported for tests)
export function seededShuffle<T>(items: readonly T[], seed: number): T[];
export function buildNightQueue(state: MafiaState): NightStep[];
export function resolveNight(state: MafiaState): {
  deaths: string[];
  info: NightInfoResult[];
  players: MafiaPlayer[];
  log: MafiaLogEntry[];
};
export function tallyVotes(
  votes: Record<string, string>,
  ballot: string[],
  aliveCount: number,
  mode: "majority" | "plurality",
  tieRule: MafiaConfig["tieRule"],
  seed: number,
): { eliminated: string | null; tied: string[] };
export function checkWin(players: MafiaPlayer[], cfg: MafiaConfig): Faction | "draw" | null;
export function computeMvp(state: MafiaState): string | null;

export class MafiaConfigError extends Error {}
```

---

### Implementation order (suggested)

1. `types.ts` + `roles/` (interface + 8 role files) + `content/*.json` + `content.ts` validator.
2. `logic.ts` pure helpers (`seededShuffle`, `buildNightQueue`, `resolveNight`, `tallyVotes`,
   `checkWin`) → write `logic.test.ts` (§17) → green.
3. `reducer` + `createInitialState` wiring the helpers → finish §17 flow tests.
4. `manifest.ts` + `index.ts` (registry auto-discovers it — no shared edits).
5. Screens (`SetupScreen` → `PlayScreen` phase sub-views → `ResultsScreen`) composing `sdk/ui`.
6. Narrator VO assets (optional) + polish (animations, haptics, RTL pass).

This spec is self-contained: every type, action, transition, screen, primitive, edge case, and test
is specified. No further questions are required to implement `mafia`.
