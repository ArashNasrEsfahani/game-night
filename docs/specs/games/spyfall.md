# Spyfall — find the spy, hide the location

> Game implementation spec. Conforms to the SDK contract in `docs/specs/00-architecture.md`.
> Game id: `spyfall`. Folder: `src/games/spyfall/`.
> Status: ready to implement (no open questions).

---

## 1. Overview

Spyfall is a social deduction party game played **pass-and-play on one phone**. At
the start of a round one secret **location** (e.g. *Airport*, *Hospital*) is chosen.
Every non-spy player is shown that location plus a **role** at it (e.g. *Pilot*,
*Surgeon*). One or more players are secretly the **Spy**, who is shown only
"You are the Spy" — the spy does **not** know the location.

During a timed **Q&A** phase players take turns asking each other pointed questions
to expose the spy *without* naming the location outright (which would help the spy
guess it). Non-spies try to identify the spy; the spy tries to blend in and
quietly deduce the location.

The round ends on **timer expiry** or an **early accusation**. Then players **vote**
to out a suspect. The spy may **guess the location** to steal the win. Points
accumulate across multiple rounds.

This game is a thin consumer of the SDK: it reuses `roster`, `turnOrder`, `timer`,
`deck`, `voting`, `revealGate`, `phaseMachine`, `scoring`, and `results`. The only
game-specific logic is **secret-role assignment** and **win arbitration**.

---

## 2. Player range & modes

| Property | Value |
| --- | --- |
| Min players | **3** |
| Max players | **12** |
| Recommended | 4–8 |
| Spies (configurable) | 1 (default) up to `floor(playerCount / 3)`, hard cap 3 |
| Teams? | No (hidden roles, not fixed teams) — `manifest.usesTeams = false` |
| Turn order | Yes — used to seed the "first asker" and suggested Q&A order |
| Timer | Yes — single round countdown (default 8 min) |

**Spy-count guardrails** (enforced in `createInitialState` and surfaced in Setup):

- `spyCount` must satisfy `1 ≤ spyCount ≤ maxSpies`, where
  `maxSpies = clamp(floor(playerCount / 3), 1, 3)`.
- At least 2 non-spies must remain (`playerCount - spyCount ≥ 2`), otherwise deduction is impossible.
- If a saved config violates the current roster size, clamp on load and emit `CONFIG_CLAMPED` (non-fatal; Setup shows a toast).

There is a single mode (classic pass-and-play). No online/real-time mode in this PWA.

---

## 3. Content schema

Game **content** (locations, roles) lives as bilingual JSON in
`src/games/spyfall/content/*.json` and is **data**, not UI strings (per the i18n
convention: UI strings → i18next catalogs; game content → bilingual JSON).

```ts
// src/games/spyfall/content/types.ts
import type { LocalizedString } from '@/sdk/types'; // { en: string; fa: string }

/** A single role available at a location. */
export interface SpyfallRole {
  /** Stable, unique-within-location slug. Never localized; used as a key. */
  id: string;
  name: LocalizedString;
}

/** A location card with its role list. */
export interface SpyfallLocation {
  /** Stable global slug, unique across all packs. Used as deck card id + scoring key. */
  id: string;
  name: LocalizedString;
  /** Optional emoji/icon token rendered on the card (purely cosmetic). */
  icon?: string;
  /**
   * Roles at this location. MUST contain at least `maxPlayers - minSpies`
   * (= 11) entries so every non-spy in a 12-player game gets a distinct role.
   * If a location has fewer roles than non-spies, roles are recycled (see
   * assignment algorithm) — but packs SHOULD ship 11+ to avoid duplicates.
   */
  roles: SpyfallRole[];
}

/** A shippable content pack (one JSON file = one pack). */
export interface SpyfallPack {
  /** Stable pack id, e.g. "core", "iran", "nsfw". */
  id: string;
  name: LocalizedString;
  /** Locales fully covered; both must be present for this app. */
  locales: ['en', 'fa'];
  /** Schema version for migration. Current = 1. */
  version: 1;
  locations: SpyfallLocation[];
}
```

### 3.1 Content validation rules

Validated by `validatePack(pack): string[]` (returns list of human-readable
problems; empty = valid). Called once at registry load in dev, and in
`content/pack.test.ts`.

1. `pack.id`, every `location.id`, every `role.id` non-empty and unique within scope.
2. Every `name.en` and `name.fa` non-empty (no missing translations).
3. Each location has `roles.length ≥ 1` (warn if `< 3`).
4. No duplicate location `id` across the merged catalog (registry merges all packs).
5. `version === 1`.

### 3.2 Content loading

```ts
// src/games/spyfall/content/index.ts
// Eager glob so packs are bundled & available offline.
const modules = import.meta.glob('./packs/*.json', { eager: true, import: 'default' });
export const packs: SpyfallPack[] = Object.values(modules) as SpyfallPack[];

/** Flat catalog of all enabled locations, keyed by id. */
export function buildCatalog(enabledPackIds: string[]): SpyfallLocation[] { /* ... */ }
```

Custom user packs (Supabase sync / local import) are appended to `packs` at runtime
by the SDK content layer and follow the same schema.

### 3.3 Sample content (12 bilingual locations — pack `core`)

> File: `src/games/spyfall/content/packs/core.json`. Roles abbreviated to 4–6 each
> here for the spec; ship 11+ per location in the real file. All `fa` strings are
> real Persian.

```json
{
  "id": "core",
  "name": { "en": "Classic Locations", "fa": "مکان‌های کلاسیک" },
  "locales": ["en", "fa"],
  "version": 1,
  "locations": [
    {
      "id": "airport",
      "icon": "✈️",
      "name": { "en": "Airport", "fa": "فرودگاه" },
      "roles": [
        { "id": "pilot", "name": { "en": "Pilot", "fa": "خلبان" } },
        { "id": "flight_attendant", "name": { "en": "Flight Attendant", "fa": "مهماندار" } },
        { "id": "passenger", "name": { "en": "Passenger", "fa": "مسافر" } },
        { "id": "security", "name": { "en": "Security Officer", "fa": "مأمور امنیتی" } },
        { "id": "ticket_agent", "name": { "en": "Ticket Agent", "fa": "متصدی بلیت" } }
      ]
    },
    {
      "id": "hospital",
      "icon": "🏥",
      "name": { "en": "Hospital", "fa": "بیمارستان" },
      "roles": [
        { "id": "surgeon", "name": { "en": "Surgeon", "fa": "جراح" } },
        { "id": "nurse", "name": { "en": "Nurse", "fa": "پرستار" } },
        { "id": "patient", "name": { "en": "Patient", "fa": "بیمار" } },
        { "id": "anesthetist", "name": { "en": "Anesthetist", "fa": "متخصص بیهوشی" } },
        { "id": "intern", "name": { "en": "Intern", "fa": "کارورز" } }
      ]
    },
    {
      "id": "restaurant",
      "icon": "🍽️",
      "name": { "en": "Restaurant", "fa": "رستوران" },
      "roles": [
        { "id": "chef", "name": { "en": "Chef", "fa": "سرآشپز" } },
        { "id": "waiter", "name": { "en": "Waiter", "fa": "پیشخدمت" } },
        { "id": "customer", "name": { "en": "Customer", "fa": "مشتری" } },
        { "id": "cashier", "name": { "en": "Cashier", "fa": "صندوق‌دار" } },
        { "id": "dishwasher", "name": { "en": "Dishwasher", "fa": "ظرف‌شور" } }
      ]
    },
    {
      "id": "school",
      "icon": "🏫",
      "name": { "en": "School", "fa": "مدرسه" },
      "roles": [
        { "id": "teacher", "name": { "en": "Teacher", "fa": "معلم" } },
        { "id": "student", "name": { "en": "Student", "fa": "دانش‌آموز" } },
        { "id": "principal", "name": { "en": "Principal", "fa": "مدیر" } },
        { "id": "janitor", "name": { "en": "Janitor", "fa": "سرایدار" } },
        { "id": "gym_teacher", "name": { "en": "Gym Teacher", "fa": "معلم ورزش" } }
      ]
    },
    {
      "id": "bank",
      "icon": "🏦",
      "name": { "en": "Bank", "fa": "بانک" },
      "roles": [
        { "id": "teller", "name": { "en": "Teller", "fa": "متصدی باجه" } },
        { "id": "manager", "name": { "en": "Manager", "fa": "مدیر شعبه" } },
        { "id": "customer", "name": { "en": "Customer", "fa": "مشتری" } },
        { "id": "guard", "name": { "en": "Security Guard", "fa": "نگهبان" } },
        { "id": "robber", "name": { "en": "Robber", "fa": "سارق" } }
      ]
    },
    {
      "id": "beach",
      "icon": "🏖️",
      "name": { "en": "Beach", "fa": "ساحل" },
      "roles": [
        { "id": "lifeguard", "name": { "en": "Lifeguard", "fa": "نجات‌غریق" } },
        { "id": "swimmer", "name": { "en": "Swimmer", "fa": "شناگر" } },
        { "id": "vendor", "name": { "en": "Ice-cream Vendor", "fa": "بستنی‌فروش" } },
        { "id": "surfer", "name": { "en": "Surfer", "fa": "موج‌سوار" } },
        { "id": "photographer", "name": { "en": "Photographer", "fa": "عکاس" } }
      ]
    },
    {
      "id": "movie_set",
      "icon": "🎬",
      "name": { "en": "Movie Set", "fa": "صحنه فیلم‌برداری" },
      "roles": [
        { "id": "director", "name": { "en": "Director", "fa": "کارگردان" } },
        { "id": "actor", "name": { "en": "Actor", "fa": "بازیگر" } },
        { "id": "cameraman", "name": { "en": "Cameraman", "fa": "فیلم‌بردار" } },
        { "id": "makeup", "name": { "en": "Makeup Artist", "fa": "گریمور" } },
        { "id": "stuntman", "name": { "en": "Stunt Double", "fa": "بدلکار" } }
      ]
    },
    {
      "id": "spaceship",
      "icon": "🚀",
      "name": { "en": "Spaceship", "fa": "سفینه فضایی" },
      "roles": [
        { "id": "captain", "name": { "en": "Captain", "fa": "فرمانده" } },
        { "id": "engineer", "name": { "en": "Engineer", "fa": "مهندس" } },
        { "id": "scientist", "name": { "en": "Scientist", "fa": "دانشمند" } },
        { "id": "medic", "name": { "en": "Medic", "fa": "پزشک سفینه" } },
        { "id": "navigator", "name": { "en": "Navigator", "fa": "ناوبر" } }
      ]
    },
    {
      "id": "casino",
      "icon": "🎰",
      "name": { "en": "Casino", "fa": "کازینو" },
      "roles": [
        { "id": "dealer", "name": { "en": "Dealer", "fa": "گرداننده میز" } },
        { "id": "gambler", "name": { "en": "Gambler", "fa": "قمارباز" } },
        { "id": "bartender", "name": { "en": "Bartender", "fa": "متصدی بار" } },
        { "id": "bouncer", "name": { "en": "Bouncer", "fa": "نگهبان در" } },
        { "id": "vip", "name": { "en": "VIP Guest", "fa": "مهمان ویژه" } }
      ]
    },
    {
      "id": "train",
      "icon": "🚆",
      "name": { "en": "Passenger Train", "fa": "قطار مسافربری" },
      "roles": [
        { "id": "conductor", "name": { "en": "Conductor", "fa": "مهماندار قطار" } },
        { "id": "driver", "name": { "en": "Driver", "fa": "راننده قطار" } },
        { "id": "passenger", "name": { "en": "Passenger", "fa": "مسافر" } },
        { "id": "ticket_inspector", "name": { "en": "Ticket Inspector", "fa": "بازرس بلیت" } },
        { "id": "snack_seller", "name": { "en": "Snack Seller", "fa": "فروشنده تنقلات" } }
      ]
    },
    {
      "id": "bazaar",
      "icon": "🛍️",
      "name": { "en": "Grand Bazaar", "fa": "بازار بزرگ" },
      "roles": [
        { "id": "carpet_seller", "name": { "en": "Carpet Seller", "fa": "فرش‌فروش" } },
        { "id": "spice_merchant", "name": { "en": "Spice Merchant", "fa": "عطار" } },
        { "id": "shopper", "name": { "en": "Shopper", "fa": "خریدار" } },
        { "id": "porter", "name": { "en": "Porter", "fa": "باربر" } },
        { "id": "goldsmith", "name": { "en": "Goldsmith", "fa": "زرگر" } }
      ]
    },
    {
      "id": "soccer_stadium",
      "icon": "⚽",
      "name": { "en": "Soccer Stadium", "fa": "ورزشگاه فوتبال" },
      "roles": [
        { "id": "player", "name": { "en": "Player", "fa": "بازیکن" } },
        { "id": "referee", "name": { "en": "Referee", "fa": "داور" } },
        { "id": "coach", "name": { "en": "Coach", "fa": "مربی" } },
        { "id": "fan", "name": { "en": "Fan", "fa": "هوادار" } },
        { "id": "commentator", "name": { "en": "Commentator", "fa": "گزارشگر" } }
      ]
    }
  ]
}
```

> Optional second pack idea (not required for v1): `iran.json` with culturally local
> locations (e.g. *قهوه‌خانه / Teahouse*, *حرم / Shrine*, *پاساژ / Shopping Arcade*).

---

## 4. GameConfig (setup options)

```ts
// src/games/spyfall/logic.ts
export interface SpyfallConfig {
  /** Ordered roster of players for this match (from the shared roster SDK). */
  players: PlayerId[];               // length 3..12 ; PlayerId = string

  /** Number of spies this round. Clamped to [1, maxSpies(players.length)]. */
  spyCount: number;                  // default 1

  /** Round Q&A duration in seconds. */
  roundSeconds: number;              // default 480 (8 min); UI presets 5/6/8/10 min

  /** Which content packs are enabled (location pool). At least one. */
  enabledPackIds: string[];          // default ['core']

  /**
   * Total rounds to play in this match before final results.
   * Each round draws a fresh location (no immediate repeat — see deck primitive).
   */
  totalRounds: number;               // default 1 ; range 1..10

  /**
   * If true, after a spy is voted out (or survives), allow the spy a single
   * location guess before the round resolves. Standard Spyfall = true.
   */
  allowSpyGuess: boolean;            // default true

  /**
   * If true the timer counts down automatically; if false the round is purely
   * accusation-driven and the timer is a stopwatch hint only.
   */
  useTimer: boolean;                 // default true

  /** Reveal-order policy passed to the revealGate primitive. */
  revealOrder: 'roster' | 'turnOrder'; // default 'turnOrder'
}

export const DEFAULT_CONFIG: Omit<SpyfallConfig, 'players'> = {
  spyCount: 1,
  roundSeconds: 480,
  enabledPackIds: ['core'],
  totalRounds: 1,
  allowSpyGuess: true,
  useTimer: true,
  revealOrder: 'turnOrder',
};

export const maxSpies = (n: number) => Math.max(1, Math.min(3, Math.floor(n / 3)));
```

---

## 5. State shape

The reducer is **pure**: no `Date.now()`, no `Math.random()` inside. All
randomness enters via action payloads as **seeds** (a deterministic PRNG seeded by
an integer); all wall-clock state is owned by the SDK `timer` primitive and read
from `ctx`, not from the reducer.

```ts
// src/games/spyfall/logic.ts
export type PlayerId = string;

export type SpyfallPhase =
  | 'reveal'    // each player privately views their secret card (RevealGate)
  | 'qa'        // timed question & answer round
  | 'accusation'// someone called a vote OR timer expired; collecting/locking nominee
  | 'voting'    // players vote to out a suspect (SDK voting primitive)
  | 'spyGuess'  // spy(ies) pick a location to attempt a steal
  | 'roundEnd'  // this round resolved; show round result, await next/finish
  | 'matchEnd'; // all rounds done; final leaderboard (results primitive)

export type RoundOutcome =
  | 'spyCaught'        // a spy was voted out
  | 'spySurvived'      // vote outed a non-spy (or no majority) and no successful guess
  | 'spyGuessedRight'  // spy correctly guessed the location
  | 'spyGuessedWrong'; // spy guessed and was wrong (resolves like spyCaught/survived)

export interface SecretCard {
  player: PlayerId;
  isSpy: boolean;
  /** undefined for spies. */
  roleId?: string;
  /** Convenience denormalization for the reveal screen; locationId is round-global. */
  locationId: string;
}

export interface RoundState {
  index: number;                 // 0-based round number
  locationId: string;            // the secret location for this round
  spyIds: PlayerId[];            // who the spies are
  /** Per-player secret card; spies have isSpy=true & no roleId. */
  cards: Record<PlayerId, SecretCard>;
  /** Suggested first asker (from turnOrder). */
  firstAskerId: PlayerId;

  /** Accusation phase bookkeeping. */
  nomineeId: PlayerId | null;    // the player put up for the vote
  accuserId: PlayerId | null;    // who triggered the vote (null if timer-triggered)

  /** Voting results (mirror of SDK voting tally, snapshotted on lock). */
  votes: Record<PlayerId, PlayerId | null>; // voter -> target (null = abstain)
  votedOutId: PlayerId | null;   // resolved majority target, or null if no majority

  /** Spy guess bookkeeping. */
  spyGuessLocationId: string | null;
  spyGuessById: PlayerId | null; // which spy made the guess (multi-spy: first to lock)

  outcome: RoundOutcome | null;
  /** Points awarded THIS round, by player. */
  roundScores: Record<PlayerId, number>;
}

export interface SpyfallState {
  schema: 1;
  phase: SpyfallPhase;
  config: SpyfallConfig;

  /** Cumulative match scores across rounds. */
  totals: Record<PlayerId, number>;

  round: RoundState;             // the current/most-recent round
  roundHistory: RoundState[];    // completed rounds (for ResultsScreen drilldown)

  /** Non-fatal flags surfaced as toasts (e.g. config clamp). Cleared by UI ack. */
  notices: SpyfallNotice[];
}

export type SpyfallNotice =
  | { kind: 'CONFIG_CLAMPED'; field: 'spyCount'; from: number; to: number }
  | { kind: 'NO_MAJORITY' };
```

### 5.1 Scoring constants

```ts
export const POINTS = {
  /** Each non-spy when the spy is caught by vote. */
  perNonSpyOnCatch: 1,
  /** Bonus to the accuser whose nominee was the spy. */
  accuserBonus: 1,
  /** Each spy when they survive the vote (non-spy outed or no majority). */
  perSpyOnSurvive: 2,
  /** Each spy when they correctly guess the location. */
  perSpyOnGuess: 2,
  /** Spy guessing right and surviving stacks (survive + guess). */
} as const;
```

---

## 6. Actions & reducer transitions

All actions are dispatched from screens; the reducer is
`reducer(state: SpyfallState, action: SpyfallAction): SpyfallState`. Randomness is
supplied as a `seed: number` in payloads where needed. Time is **not** read here.

```ts
export type SpyfallAction =
  | { type: 'START_ROUND'; seed: number }            // build a fresh round (assign location/roles/spies)
  | { type: 'REVEAL_COMPLETE' }                       // all players viewed their cards
  | { type: 'CALL_VOTE'; accuserId: PlayerId; nomineeId: PlayerId }
  | { type: 'TIMER_EXPIRED' }                         // SDK timer fired
  | { type: 'CANCEL_VOTE' }                           // back out of accusation -> resume qa
  | { type: 'CAST_VOTE'; voterId: PlayerId; targetId: PlayerId | null }
  | { type: 'LOCK_VOTES' }                            // tally votes -> resolve nominee
  | { type: 'SPY_GUESS'; spyId: PlayerId; locationId: string }
  | { type: 'SKIP_SPY_GUESS' }                        // spy declines to guess
  | { type: 'RESOLVE_ROUND' }                         // compute outcome + scores -> roundEnd
  | { type: 'NEXT_ROUND'; seed: number }              // advance index or go matchEnd
  | { type: 'ACK_NOTICE'; index: number }             // dismiss a notice
  | { type: 'RESET_MATCH' };                          // back to round 0 fresh
```

### 6.1 Transition table

| Action | Valid in phase | Effect | Next phase |
| --- | --- | --- | --- |
| `START_ROUND` | (initial / after `NEXT_ROUND` sets up) | Use seeded PRNG to: pick `locationId` from enabled catalog via deck primitive seed; pick `spyIds` (sample `spyCount` players); assign each non-spy a `roleId` (see §6.2); build `cards`; set `firstAskerId` from turnOrder seed. Clear nominee/votes/guess/outcome. | `reveal` |
| `REVEAL_COMPLETE` | `reveal` | No state change beyond phase; SDK revealGate has confirmed all players viewed. Starts the timer (timer is SDK-side; reducer just flips phase). | `qa` |
| `CALL_VOTE` | `qa` | Set `accuserId`, `nomineeId`. Pause timer (SDK side). | `accusation` |
| `TIMER_EXPIRED` | `qa` | `accuserId = null`, `nomineeId = null` (open accusation: any player may be nominated in voting, or a free vote). | `accusation` |
| `CANCEL_VOTE` | `accusation` | Clear `accuserId`/`nomineeId`. Resume timer if `useTimer`. | `qa` |
| `CAST_VOTE` | `voting` (entered from `accusation` once voting opens) | Record `votes[voterId] = targetId`. Idempotent per voter (last write wins). | `voting` |
| `LOCK_VOTES` | `voting` | Tally via SDK voting → `votedOutId` = strict-majority target or `null`. If `null`, push `NO_MAJORITY` notice. | If `config.allowSpyGuess` **and** at least one spy still "in play" → `spyGuess`; else `roundEnd` precursor via auto `RESOLVE_ROUND` (see note). |
| `SPY_GUESS` | `spyGuess` | Set `spyGuessLocationId`, `spyGuessById`. (First spy to lock wins the attempt; further guesses ignored.) | `roundEnd` precursor → emit `RESOLVE_ROUND`. |
| `SKIP_SPY_GUESS` | `spyGuess` | Leave guess fields `null`. | → `RESOLVE_ROUND`. |
| `RESOLVE_ROUND` | `spyGuess` \| `voting` (when no guess allowed) | Compute `outcome` + `roundScores`; add to `totals`; snapshot `round` into `roundHistory`. | `roundEnd` |
| `NEXT_ROUND` | `roundEnd` | If `round.index + 1 < totalRounds`: build next `RoundState` skeleton (index++), then expect `START_ROUND`-equivalent assignment using `seed` (this action both advances and assigns, so it folds START_ROUND logic). Else → `matchEnd`. | `reveal` or `matchEnd` |
| `ACK_NOTICE` | any | Remove `notices[index]`. | unchanged |
| `RESET_MATCH` | any | Re-run `createInitialState(config)`; clears totals/history. | `reveal` (round 0, unassigned until START_ROUND) |

> **Note on the transition between voting and round end:** to keep transitions
> atomic and testable, `LOCK_VOTES` only moves to `spyGuess` (if guesses allowed
> and meaningful) or directly produces the resolution by leaving the phase at
> `voting` and letting the screen immediately dispatch `RESOLVE_ROUND`. The
> screen orchestrates the two-step; the reducer keeps each step pure. (See
> PlayScreen §9.2 for the dispatch sequence.)

### 6.2 Round assignment algorithm (pure, seed-driven)

`START_ROUND` / `NEXT_ROUND` use a small deterministic PRNG `mulberry32(seed)` (lives
in `@/sdk/rng`, re-exported; the reducer imports only the pure function):

```ts
function assignRound(config: SpyfallConfig, index: number, seed: number, catalog: SpyfallLocation[]): RoundState {
  const rng = mulberry32(seed);
  // 1. Location: avoid immediate repeat with previous round's location.
  const location = pickLocation(catalog, rng, /* avoidId */ prevLocationId);
  // 2. Spies: Fisher–Yates shuffle of players, take first spyCount.
  const shuffled = shuffle(config.players, rng);
  const spyIds = shuffled.slice(0, config.spyCount);
  const nonSpies = shuffled.slice(config.spyCount);
  // 3. Roles: shuffle the location's role pool; assign round-robin to non-spies.
  //    If fewer roles than non-spies, recycle (duplicates allowed as last resort).
  const rolePool = shuffle(location.roles, rng);
  const cards: Record<PlayerId, SecretCard> = {};
  spyIds.forEach((p) => { cards[p] = { player: p, isSpy: true, locationId: location.id }; });
  nonSpies.forEach((p, i) => {
    cards[p] = { player: p, isSpy: false, roleId: rolePool[i % rolePool.length].id, locationId: location.id };
  });
  // 4. First asker: deterministic from turnOrder (rng pick among players).
  const firstAskerId = shuffled[0]; // or turnOrder primitive's seeded head
  return { index, locationId: location.id, spyIds, cards, firstAskerId, /* nulls... */ };
}
```

> `pickLocation` and `shuffle` are pure helpers (in `logic.ts`); they take `rng`.
> The catalog is passed in by the screen from `buildCatalog(config.enabledPackIds)`
> so the reducer stays content-agnostic and testable (tests pass a fixture catalog).

### 6.3 Outcome & scoring resolution (inside `RESOLVE_ROUND`)

```
let outcome: RoundOutcome;
const votedSpy = votedOutId != null && spyIds.includes(votedOutId);
const guessRight = spyGuessLocationId != null && spyGuessLocationId === locationId;

if (guessRight)            outcome = 'spyGuessedRight';
else if (spyGuessLocationId != null) outcome = 'spyGuessedWrong';
else if (votedSpy)         outcome = 'spyCaught';
else                       outcome = 'spySurvived';   // wrong vote or no majority, no guess

// Scoring (additive into roundScores, then totals):
roundScores = zeroForAll();
if (votedSpy) {
  for (const p of nonSpies) roundScores[p] += POINTS.perNonSpyOnCatch;        // +1 each
  if (accuserId && nomineeId === votedOutId) roundScores[accuserId] += POINTS.accuserBonus; // +1
}
if (!votedSpy) {
  for (const s of spyIds) roundScores[s] += POINTS.perSpyOnSurvive;           // +2 each (survived vote)
}
if (guessRight) {
  for (const s of spyIds) roundScores[s] += POINTS.perSpyOnGuess;             // +2 each
}
// Wrong guess gives the spy nothing extra; non-spies already scored if they outed a spy.
```

Edge: with **multiple spies**, "spy caught" requires *the voted-out player to be a
spy*. Surviving spies still earn `perSpyOnSurvive` because the vote did not out
*them*. (A round can therefore have one spy caught and another surviving; both
clauses apply per spy where relevant — implementers: score per-spy, not globally.)
The reference implementation scores `perSpyOnSurvive` to every spy who was **not**
the `votedOutId`.

---

## 7. Win & scoring rules (player-facing summary)

- **Non-spies win the round** by voting out a spy (`spyCaught`). Each non-spy gets
  **+1**; the accuser who correctly nominated the spy gets an extra **+1**.
- **Spy wins the round** by:
  - **Surviving the vote** (a non-spy is outed, or no majority): **+2** to that spy; or
  - **Guessing the location correctly**: **+2** to the spy. These stack with
    surviving (max **+4** for a spy who survives *and* guesses right).
- A **wrong guess** ends the round with the spy earning nothing from the guess.
- After `totalRounds`, the **match winner** is the highest cumulative `totals`
  (ties shown as joint winners; `results` primitive ranks).

---

## 8. SDK primitives consumed

| Primitive | Usage in Spyfall |
| --- | --- |
| `roster` | Source of `players` (ids, names, avatar/color). Min 3 / max 12 enforced via manifest. |
| `turnOrder` | Seeds `firstAskerId` and renders the suggested Q&A asking order ring. |
| `timer` | Round countdown (`roundSeconds`); pause on `accusation`, resume on `CANCEL_VOTE`; fires `TIMER_EXPIRED` via `ctx.timer.onExpire`. Stopwatch mode when `useTimer=false`. |
| `deck` | Location selection with **no-immediate-repeat** draw; seeded so it's reproducible. Catalog built from enabled packs. |
| `revealGate` | The pass-and-play secrecy gate during `reveal` phase (see §10). |
| `voting` | Tally for `voting` phase: per-voter single target or abstain, strict-majority resolution, tie/no-majority reporting. |
| `phaseMachine` | Drives `SpyfallPhase` transitions (guards which actions are legal per phase; mirrors §6.1). |
| `scoring` | Helper to add `roundScores` into `totals` and to format deltas. |
| `results` | Final leaderboard ranking + share/replay actions on ResultsScreen. |

The game does **not** reimplement any of these; it consumes them through
`GameContext` (`ctx`).

---

## 9. Screens

All screens are composed from `@/sdk/ui` components, are fully RTL-aware (logical
utilities `ms-/me-/ps-/pe-/text-start/text-end`, `dir` from `<html>`), follow
light/dark tokens, and trigger SFX/haptics through `ctx.fx` (respecting global mute).

Files: `src/games/spyfall/screens/{SetupScreen,PlayScreen,ResultsScreen}.tsx`.

### 9.1 SetupScreen.tsx

Purpose: collect `SpyfallConfig` and start the match.

On screen:
- `<RosterPicker>` (SDK) — choose/confirm players from the shared roster; shows
  count and enforces 3–12; supports loading a saved favorite group.
- `<Stepper label="Spies">` — `spyCount`, min 1, max `maxSpies(playerCount)`;
  disabled increment beyond max; shows helper "Max N for this group".
- `<SegmentedControl label="Round time">` — presets 5 / 6 / 8 / 10 min → `roundSeconds`.
- `<Toggle label="Use timer">` → `useTimer`.
- `<Stepper label="Rounds">` — `totalRounds` 1–10.
- `<Toggle label="Allow spy to guess location">` → `allowSpyGuess`.
- `<PackPicker>` (SDK content selector) — choose enabled location packs;
  shows location count of the merged catalog; at least one pack required.
- `<PrimaryButton>` "Start game" → builds config, dispatches the **first**
  `START_ROUND` with a fresh seed (from `ctx.rng.nextSeed()`), navigates to Play.

Dispatched actions: none to the reducer until "Start" (config is local form state),
then `START_ROUND` (seed from SDK). Validation blocks "Start" until roster ≥ 3 and
≥ 1 pack. On clamp, a `<Toast>` renders the `CONFIG_CLAMPED` notice.

SDK UI used: `RosterPicker`, `Stepper`, `SegmentedControl`, `Toggle`, `PackPicker`,
`PrimaryButton`, `Toast`, `ScreenScaffold`.

### 9.2 PlayScreen.tsx

A phase-driven screen; renders a sub-view per `state.phase`.

**phase `reveal`** — pass-and-play secret reveal:
- `<RevealGate>` (SDK) iterating players in `config.revealOrder`. For each player:
  1. Handoff prompt: "Pass the phone to **{playerName}**" + `<TapToReveal>`.
  2. On tap → show the secret card via `<SecretCardView>`:
     - Non-spy: location name + icon + their role (e.g. "Hospital — Surgeon").
     - Spy: a distinct spy card "You are the Spy 🕵️" (no location).
  3. "Hide & pass" button re-blinds and advances `RevealGate`.
- When the gate completes, dispatch `REVEAL_COMPLETE` → `qa`. Haptic + SFX on reveal.

**phase `qa`** — timed discussion:
- `<RoundTimer>` (SDK timer) big countdown; pulses/changes color under 60s; on
  expire calls `dispatch({type:'TIMER_EXPIRED'})`.
- `<TurnOrderRing>` showing suggested asking order starting at `firstAskerId`.
- `<LocationChecklist>` (collapsible) — the full list of possible locations for
  reference (helps non-spies reason; helps spy too — that's the tension). Read-only.
- `<PrimaryButton>` "Call a vote" → opens `<AccusationSheet>`; on confirm dispatch
  `CALL_VOTE`. A `<SecondaryButton>` "Pause" uses SDK timer pause (no reducer action).

**phase `accusation`** — confirm/seed the vote:
- `<AccusationSheet>`: pick the `nomineeId` (if accuser-triggered, pre-filled). Two
  actions: "Start vote" → moves into `voting` (phaseMachine), "Cancel" → `CANCEL_VOTE`.
- If entered via `TIMER_EXPIRED`, header reads "Time's up — open vote".

**phase `voting`** — pass-and-play voting:
- `<VotePanel>` (SDK voting) iterating voters (pass-and-play, one at a time, each
  privately taps a target or "Abstain") → each tap dispatches `CAST_VOTE`.
- When all have voted, "Reveal result" → `LOCK_VOTES`. Shows tally via `<VoteTally>`.
- If `NO_MAJORITY`, a `<Toast>` explains and the spy-survives path proceeds.

**phase `spyGuess`** — spy's steal attempt (only if `allowSpyGuess`):
- Pass-and-play to the spy(ies): `<LocationGuessGrid>` of all catalog locations.
- Spy taps a location → `SPY_GUESS`; or `<SecondaryButton>` "Don't guess" →
  `SKIP_SPY_GUESS`. With multiple spies, the first to lock resolves it; remaining
  spies see "guess already made".
- After guess/skip the screen dispatches `RESOLVE_ROUND`.

**phase `roundEnd`** — round result:
- `<RoundResultCard>`: reveals the location, all roles, who the spy was, the
  outcome, and per-player point deltas (`roundScores`) via `<ScoreDeltaList>`.
- `<PrimaryButton>` "Next round" → `NEXT_ROUND` (fresh seed) if more rounds, else it
  reads "See results" and navigates to ResultsScreen (still `NEXT_ROUND` →
  `matchEnd`).

Dispatch summary (PlayScreen): `REVEAL_COMPLETE`, `CALL_VOTE`, `TIMER_EXPIRED`,
`CANCEL_VOTE`, `CAST_VOTE`, `LOCK_VOTES`, `SPY_GUESS`, `SKIP_SPY_GUESS`,
`RESOLVE_ROUND`, `NEXT_ROUND`, `ACK_NOTICE`.

SDK UI used: `ScreenScaffold`, `RevealGate`, `TapToReveal`, `SecretCardView`,
`RoundTimer`, `TurnOrderRing`, `LocationChecklist`, `AccusationSheet`, `VotePanel`,
`VoteTally`, `LocationGuessGrid`, `RoundResultCard`, `ScoreDeltaList`,
`PrimaryButton`, `SecondaryButton`, `Toast`.

### 9.3 ResultsScreen.tsx

Purpose: final match summary after `matchEnd`.

On screen:
- `<Leaderboard>` (SDK results) ranking `totals`, highlighting winner(s), with
  player avatars/colors; confetti on first place (framer-motion), SFX/haptic.
- `<RoundHistoryAccordion>` — per round: location, spy(s), outcome, deltas
  (from `roundHistory`).
- `<PrimaryButton>` "Play again (same group)" → `RESET_MATCH` + back to Setup
  pre-filled, or directly to a new round with same config (offers both).
- `<SecondaryButton>` "Change settings" → SetupScreen.
- `<ShareButton>` (SDK results) — share summary text (bilingual aware).
- Sign-in–gated: if `ctx.auth.signedIn`, "Save stats" persists totals to Supabase;
  otherwise a subtle "Sign in to save stats" hint (optional, non-blocking).

SDK UI used: `ScreenScaffold`, `Leaderboard`, `RoundHistoryAccordion`,
`PrimaryButton`, `SecondaryButton`, `ShareButton`.

---

## 10. Pass-and-play handoff & secrecy (RevealGate)

The core secrecy mechanic. Implemented entirely via the SDK `revealGate` primitive;
the game supplies the per-player card content.

Flow during `reveal` phase:

1. The phone is held by a facilitator. RevealGate presents players one at a time in
   `config.revealOrder` (`turnOrder` by default).
2. **Blind handoff screen:** large "Pass to {name}" with the screen content hidden
   behind a `<TapToReveal>` cover (no peeking by the previous holder). Only the named
   player should tap.
3. **Private reveal:** card shown only while the player holds a press *or* until they
   tap "Hide & pass" (configurable in the SDK; default tap-to-reveal then tap-to-hide).
   Auto-hide after `revealGate.autoHideMs` (SDK default ~15s) as a safety net.
4. **Re-blind & advance:** content is covered before the next player's name appears,
   so the handoff never exposes the prior card.
5. After the last player, RevealGate signals completion → `REVEAL_COMPLETE`.

Secrecy invariants:
- The reducer never exposes other players' cards to a screen rendering one player —
  the screen reads only `round.cards[currentRevealPlayerId]`.
- No card content is logged or put in URL/hash (HashRouter carries only route, not state).
- During `voting` and `spyGuess`, the same blind-handoff pattern is reused so a
  player's vote/guess isn't shoulder-surfed.
- The spy card is visually distinct but the **handoff prompt is identical** for spy
  and non-spy (no timing/length tell that could leak who's the spy).

---

## 11. Edge cases

1. **Minimum players (3) with spyCount 1:** valid (2 non-spies). spyCount 2 with 3
   players → clamp to 1 (need ≥2 non-spies), emit `CONFIG_CLAMPED`.
2. **spyCount equals max:** e.g. 12 players → max 3 spies. Increment disabled beyond.
3. **Roster shrinks between Setup and Play** (player removed in shared roster): Setup
   re-validates on focus; if already in a match, dropped players are excluded from the
   *next* round only (current round unaffected mid-flight). Document: roster edits
   during an active match apply at `NEXT_ROUND`.
4. **Location has fewer roles than non-spies:** roles recycle (round-robin modulo);
   duplicates allowed; covered by a unit test. Packs warned at validation.
5. **No majority in vote / tie:** `votedOutId = null` → spy-survives path; `NO_MAJORITY`
   notice; spies still get survive points (no one was outed).
6. **All non-spies vote for the same non-spy:** valid outage of an innocent → spy
   survives; spy may still guess for bonus.
7. **Timer expires during accusation sheet open:** ignore `TIMER_EXPIRED` if already
   in `accusation`/`voting` (phaseMachine guard); only valid from `qa`.
8. **`allowSpyGuess=false`:** `LOCK_VOTES` skips `spyGuess` and the screen dispatches
   `RESOLVE_ROUND` immediately. `spyGuessLocationId` stays null.
9. **Multiple spies, one caught one not:** outcome `spyCaught` (a spy was outed),
   non-spies score the catch, *surviving* spies still get survive points. See §6.3.
10. **Spy guesses right AND survives the vote:** both bonuses stack (+4 to that spy);
    outcome reported as `spyGuessedRight`.
11. **Same location twice in a row:** prevented by deck no-immediate-repeat; if the
    catalog has only one location (degenerate single-location pack), repeat is allowed
    (can't avoid) — guarded so we never infinite-loop in `pickLocation`.
12. **`totalRounds=1`:** `NEXT_ROUND` from the only round goes straight to `matchEnd`.
13. **App backgrounded / reload mid-round:** zustand `persist` rehydrates
    `SpyfallState`; the SDK timer reconciles elapsed time from a stored `endsAt`
    timestamp (timer state is SDK-owned, not in the pure reducer). If unrecoverable,
    fall back to `accusation`.
14. **Abstain-only vote:** all abstain → no majority → spy survives.
15. **Empty/disabled all packs:** Setup blocks Start; cannot reach Play with empty catalog.

---

## 12. File list & responsibilities

```
src/games/spyfall/
  index.ts                 // default-exports the GameModule (manifest + screens + logic refs)
  manifest.ts              // GameManifest: id, names, icon, color, min/max players, flags
  logic.ts                 // PURE: types, createInitialState, reducer, helpers, scoring, assignRound
  logic.test.ts            // vitest unit tests for logic.ts (see §13)
  content/
    types.ts               // SpyfallPack / SpyfallLocation / SpyfallRole interfaces
    index.ts               // eager glob loader + buildCatalog + validatePack
    pack.test.ts           // validates shipped packs against schema
    packs/
      core.json            // 12 locations (the bilingual content above; ship 11+ roles each)
      iran.json            // (optional) culturally-local pack
  screens/
    SetupScreen.tsx        // config form -> START_ROUND
    PlayScreen.tsx         // phase-driven play (reveal/qa/accusation/voting/spyGuess/roundEnd)
    ResultsScreen.tsx      // final leaderboard + history
  strings/
    en.json                // UI catalog namespace 'games.spyfall' (English)
    fa.json                // UI catalog namespace 'games.spyfall' (Persian)
```

### 12.1 `index.ts` and `manifest.ts` signatures

```ts
// manifest.ts
import type { GameManifest } from '@/sdk/types';
export const manifest: GameManifest = {
  id: 'spyfall',
  name: { en: 'Spyfall', fa: 'جاسوس' },
  tagline: { en: 'Find the spy, hide the location', fa: 'جاسوس را پیدا کن، مکان را پنهان کن' },
  icon: '🕵️',
  accent: 'violet',              // maps to a design-token palette
  minPlayers: 3,
  maxPlayers: 12,
  usesTeams: false,
  usesTimer: true,
  estMinutes: 10,
  categories: ['deduction', 'party'],
};
```

```ts
// index.ts
import type { GameModule } from '@/sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer } from './logic';
import SetupScreen from './screens/SetupScreen';
import PlayScreen from './screens/PlayScreen';
import ResultsScreen from './screens/ResultsScreen';

const module: GameModule<SpyfallState, SpyfallAction, SpyfallConfig> = {
  manifest,
  createInitialState,
  reducer,
  screens: { Setup: SetupScreen, Play: PlayScreen, Results: ResultsScreen },
};
export default module; // auto-discovered by registry import.meta.glob('./games/*/index.ts')
```

```ts
// logic.ts — entry signatures
export function createInitialState(config: SpyfallConfig): SpyfallState; // clamps config, phase='reveal', round skeleton, no assignment yet
export function reducer(state: SpyfallState, action: SpyfallAction): SpyfallState; // pure
```

> `createInitialState` clamps `spyCount` to `maxSpies(players.length)` and pushes a
> `CONFIG_CLAMPED` notice if it changed; it does **not** assign the round (that's
> `START_ROUND`, which carries the seed), keeping initial state seed-free and
> deterministic.

---

## 13. Unit tests for `logic.test.ts`

All tests are pure (no fakes for time/RNG beyond fixed seeds + a fixture catalog).
Use a small fixture catalog of 3 locations with known role lists.

**createInitialState**
1. Produces `phase='reveal'`, empty `totals` (0 per player), `roundHistory=[]`.
2. Clamps `spyCount` above max → clamped value + `CONFIG_CLAMPED` notice present.
3. With valid `spyCount`, no notice emitted.
4. `totals` initialized to 0 for every player id.

**START_ROUND assignment (seeded determinism)**
5. Same seed + same config + same catalog → identical `round` (deterministic).
6. Different seeds generally produce different locations/spy sets (sanity, not flaky:
   assert two specific seeds differ in spyIds or locationId).
7. Exactly `spyCount` players have `isSpy=true`; all others `isSpy=false`.
8. Every non-spy card has a `roleId` from the chosen location's role list.
9. Spy cards have no `roleId` and `locationId === round.locationId`.
10. All non-spy `roleId`s are distinct when `roles.length ≥ nonSpyCount`.
11. Roles recycle (duplicates appear) when `roles.length < nonSpyCount` (fixture with 2 roles, 4 non-spies).
12. `firstAskerId` is one of `config.players`.
13. No-immediate-repeat: round 2 location differs from round 1 (when catalog > 1).
14. Single-location catalog: round 2 repeats without error (no infinite loop).

**Phase transitions / guards**
15. `REVEAL_COMPLETE` from `reveal` → `qa`; ignored (no-op) from other phases.
16. `CALL_VOTE` from `qa` sets accuser/nominee → `accusation`.
17. `TIMER_EXPIRED` from `qa` → `accusation` with null accuser/nominee.
18. `TIMER_EXPIRED` ignored when not in `qa`.
19. `CANCEL_VOTE` from `accusation` → `qa`, clears accuser/nominee.

**Voting**
20. `CAST_VOTE` records target; re-casting overwrites (last write wins).
21. `CAST_VOTE` with `targetId=null` records an abstain.
22. `LOCK_VOTES` with strict majority for a spy → `votedOutId` = that spy.
23. `LOCK_VOTES` with no majority → `votedOutId=null` + `NO_MAJORITY` notice.
24. `LOCK_VOTES` with majority for a non-spy → `votedOutId` = that non-spy.
25. Tie between two players → no majority (`votedOutId=null`).

**Spy guess**
26. `SPY_GUESS` sets `spyGuessLocationId`/`spyGuessById`.
27. Second `SPY_GUESS` is ignored once one is locked (first-wins).
28. `SKIP_SPY_GUESS` leaves guess fields null.
29. When `allowSpyGuess=false`, flow never enters `spyGuess` (LOCK_VOTES → resolvable at voting).

**Outcome & scoring (RESOLVE_ROUND)**
30. Spy voted out, no guess → outcome `spyCaught`; each non-spy +1; correct accuser +1.
31. Non-spy voted out, no guess → outcome `spySurvived`; each spy +2.
32. No majority, no guess → `spySurvived`; each spy +2.
33. Spy guesses correctly → `spyGuessedRight`; each spy +2 (guess).
34. Spy guesses correctly AND survived vote → spy gets +2 (survive) +2 (guess) = +4.
35. Spy guesses wrong, non-spy outed → `spyGuessedWrong`; spy gets +2 survive, none for guess.
36. Spy guesses wrong, spy outed → `spyGuessedWrong`/`spyCaught` priority per §6.3; non-spies +1.
37. Multi-spy: one spy outed, other survives → non-spies +1; surviving spy +2; caught spy +0.
38. `roundScores` are added into `totals` exactly once; `round` snapshotted into `roundHistory`.

**Round progression**
39. `NEXT_ROUND` with `index+1 < totalRounds` → new round, `index` incremented, fresh assignment.
40. `NEXT_ROUND` on last round → `phase='matchEnd'`; `totals` preserved.
41. `RESET_MATCH` → totals zeroed, history cleared, phase back to `reveal`.

**Notices**
42. `ACK_NOTICE` removes the targeted notice and preserves others.

**Purity / invariants**
43. Reducer never mutates input state (assert deep-frozen input is unchanged; returns new object).
44. Reducer makes no calls to `Date`/`Math.random` (enforce by spying; or by determinism tests 5 & 13).

---

## 14. i18n keys (UI catalog namespace `games.spyfall`)

UI strings (not content) live in `strings/{en,fa}.json` under namespace
`games.spyfall`. Representative keys (both locales required):

```
setup.title, setup.spies, setup.spies.max, setup.roundTime, setup.useTimer,
setup.rounds, setup.allowGuess, setup.packs, setup.start, setup.clamped,
play.reveal.passTo, play.reveal.tapToReveal, play.reveal.hideAndPass,
play.reveal.youAreSpy, play.qa.callVote, play.qa.pause, play.qa.timeUp,
play.vote.pick, play.vote.abstain, play.vote.reveal, play.vote.noMajority,
play.guess.title, play.guess.skip, play.guess.alreadyMade,
play.round.location, play.round.spyWas, play.round.next, play.round.seeResults,
results.title, results.winner, results.playAgain, results.changeSettings,
results.share, results.saveStats, results.signInHint
```

Content names (locations/roles) are resolved from the bilingual JSON via the active
locale (`name[locale]`), never from these catalogs.

---

## 15. Animation / SFX / haptics hooks (via `ctx.fx`, global-mute aware)

- Reveal card flip: framer-motion flip; SFX `card_flip`; light haptic on reveal.
- Timer under 60s: color shift + pulse; SFX `tick` on last 10s (optional, mutable).
- Vote lock: drumroll SFX; reveal tally with stagger.
- Spy caught: success SFX + confetti; spy survives: sly "whoosh" SFX.
- Match winner: confetti + fanfare on ResultsScreen.

All effects are fire-and-forget through `ctx.fx.play(...)` / `ctx.fx.haptic(...)`,
which no-op under global mute; never invoked inside the reducer (side-effect-free).
