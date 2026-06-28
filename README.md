# Game Night · شب بازی

A mobile-first, **bilingual (English + Persian, full RTL)**, playful **PWA** for **pass-and-play**
party games on one shared phone. Everything works **100% offline and signed-out** — sign-in is
optional and additive only.

The visual identity is a **"Disco Persian"** theme: a neon disco night and a classic Persian
parchment day, gold/lapis accents, Persian emblems per game, synthesized sound effects, and
win confetti.

---

## Status

**Phase 1 (foundation + reference game) is complete, and all 11 games are shipped.**

- ✅ Frozen SDK contract (`src/sdk/types.ts` + `docs/specs/CONTRACT-FREEZE.md`)
- ✅ Engine primitives, services, stores, app shell, registry, host
- ✅ 11 games (see below), each with `Setup → Play → Results` screens
- ✅ Disco Persian theme — dual **light (Persian day)** + **dark (disco night)**; light is the default
- ✅ Large bilingual content databases (~8,000+ items, generated via multi-agent workflows): Heads Up ~2,800 cards (Easy/Medium/Hard), Pantomime ~920, Codenames ~910, Dowr ~800, Truth/Dare ~750, NHIE ~750, Most-Likely-To ~580, Would-You-Rather ~550, Spyfall ~160 locations
- ✅ Synthesized Web-Audio SFX (no asset files) + confetti / winning animations
- ✅ 524 unit tests across 27 files; typecheck clean; production build + PWA succeed

## Games

| Game | id | Category | Players | Accent |
|------|----|----------|---------|--------|
| Dowr — *Describe it, don't say it* | `dowr` | word | 2–10 | violet |
| Pantomime — *Act it out* | `pantomime` | party | 4–16 | grape |
| Never Have I Ever | `never-have-i-ever` | party | 3–16 | rose |
| Most Likely To | `most-likely-to` | voting | 3–20 | tangerine |
| Would You Rather | `would-you-rather` | voting | 2–20 | teal |
| Truth or Dare | `truth-or-dare` | party | 2–16 | gold |
| Heads Up! | `heads-up` | party | 2–16 | sky |
| Spyfall | `spyfall` | deduction | 3–12 | violet |
| Codenames (Spy Grid) | `codenames` | word | 4–16 | lime |
| Mafia | `mafia` | deduction | 5–20 | rose |
| Minesweeper | `minesweeper` | deduction | 1–4 | tangerine |

Recent additions:
- **Content Studio** — a **standalone editor website** (own dev server + build) for every game's datasets (words, prompts, dilemmas, locations, role text). Run `npm run studio`. **Save writes straight to the source JSON on disk** (debounced autosave), so edits land in `git diff` instantly — no download/drop. A **virtualized table** (smooth through the ~2,000-item packs) with CSV round-trip, a **`Ctrl+K` search across every dataset**, a card view for nested data (Spyfall roles), and **auto-flagging** of weird/broken/duplicate items. Loads none of the game screens, so it's light. See `docs/CONTENT-STUDIO.md`.
- **More categories** — Heads Up (Sports, Music, Brands), Codenames (Nature pack), Spyfall (Modern Places pack), Would You Rather (Travel), Most Likely To (At Work), Pantomime (Sports, Jobs).
- **Android (Capacitor)** — the PWA is wrapped into a native Android app (`android/` project, `npm run android:*` scripts). See `docs/ANDROID.md`.
- **Truth or Dare** — a **bottle-rolling** picker (players in a ring, an animated bottle spins to the chosen player) alongside the spinner/in-order modes.
- **Heads Up** — **Easy / Medium / Hard** difficulty tiers per category (Hard favors compound words like *Gray Fox*, *Komodo Dragon*); Setup picks which tiers to include.
- **Codenames** — a pre-game **orientation** step: the first team rotates the randomly-generated key (0/90/180/270°) before play.
- **Minesweeper** — new pass-and-play game, solo (classic) or 2–4 player turn-based competitive sweep.
- **Pantomime** — new **Persian Proverbs** (ضرب‌المثل‌ها) category for proverb charades.
- **Overall leaderboard** — every finished match records winners; Home shows a per-player wins chart (solo + group), powered by an optional `getOutcome` on each `GameModule` + a persisted `leaderboardStore`.
- **In-game player management** — a shared `PlayerPicker` lets you add/remove/select players right inside each game's Setup (no detour to the Players page).
- **Step-by-step guidance** — a 💡 toggle surfaces contextual help boxes on Home and at each in-game step (Setup → Play → Results).
- **Copy pass** — game descriptions rewritten casually with em-dashes removed.

## Tech stack

React 19 · Vite 8 · TypeScript (strict) · Tailwind v4 (CSS-first `@theme`) · zustand
(+ `idb-keyval` persistence) · framer-motion · i18next / react-i18next · react-router-dom
(`HashRouter`) · vite-plugin-pwa · Web Audio (synthesized SFX) · Vitest.

## Architecture in one paragraph

Each game is a self-contained plugin under `src/games/<id>/` exporting a `GameModule`
(`{ manifest, logic: { createInitialState, reducer }, screens: { Setup, Play, Results },
defaultConfig, validateConfig }`). Reducers are **pure** — no `Date.now`/`Math.random`; seeds
and clock values arrive in action payloads, and resolved content ids enter via `config.options`.
Games are auto-discovered by `src/games/registry.ts` (`import.meta.glob('./*/index.ts')`) and
hosted by the generic `GameHostPage` Setup → Play → Results shell. Engine primitives in
`src/engine/*` are pure libs imported in `logic.ts`; impure services (clock, random, sound,
haptics) are reached through a thin `GameContext`. See `docs/specs/00-architecture.md` and the
binding `docs/specs/CONTRACT-FREEZE.md`.

## Develop

```bash
npm install
npm run dev        # Vite dev server on :5173
npm test           # Vitest (run once: npx vitest run)
npm run build      # typecheck + production build + PWA
npm run lint       # ESLint

# Android (Capacitor) — see docs/ANDROID.md
npm run android:sync   # build + copy web assets into android/
npm run android:open   # open android/ in Android Studio
```

## Docs

Specs live under `docs/specs/`. Read in this order:

1. `00-architecture.md` — the LOCKED SDK & plugin contract
2. `CONTRACT-FREEZE.md` — binding resolutions on top of 00 (read this, plus Dowr, as the real contract)
3. `01-design-system.md` — visual/motion/sound system (now realized as the Disco Persian theme)
4. `02-i18n-content.md`, `03-app-shell.md` — i18n/content and app shell
5. `99-review-and-build-order.md` — the original adversarial review + build order (historical)
6. `games/*.md` — per-game design sketches (predate the freeze; mirror Dowr + the freeze, not the sketches)
