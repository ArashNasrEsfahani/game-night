# Game Night · شب بازی

A mobile-first, **bilingual (English + Persian, full RTL)**, playful **PWA** for **pass-and-play**
party games on one shared phone. Everything works **100% offline and signed-out** — sign-in is
optional and additive only.

The visual identity is a **"Disco Persian"** theme: a neon disco night and a classic Persian
parchment day, gold/lapis accents, Persian emblems per game, synthesized sound effects, and
win confetti.

---

## Status

**Phase 1 (foundation + reference game) is complete, and all 10 games are shipped.**

- ✅ Frozen SDK contract (`src/sdk/types.ts` + `docs/specs/CONTRACT-FREEZE.md`)
- ✅ Engine primitives, services, stores, app shell, registry, host
- ✅ 10 games (see below), each with `Setup → Play → Results` screens
- ✅ Disco Persian theme — dual **light (Persian day)** + **dark (disco night)**; light is the default
- ✅ ~853-item bilingual content databases (generated via a multi-agent workflow)
- ✅ Synthesized Web-Audio SFX (no asset files) + confetti / winning animations
- ✅ 505 unit tests across 25 files; typecheck clean; production build + PWA succeed

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
```

## Docs

Specs live under `docs/specs/`. Read in this order:

1. `00-architecture.md` — the LOCKED SDK & plugin contract
2. `CONTRACT-FREEZE.md` — binding resolutions on top of 00 (read this, plus Dowr, as the real contract)
3. `01-design-system.md` — visual/motion/sound system (now realized as the Disco Persian theme)
4. `02-i18n-content.md`, `03-app-shell.md` — i18n/content and app shell
5. `99-review-and-build-order.md` — the original adversarial review + build order (historical)
6. `games/*.md` — per-game design sketches (predate the freeze; mirror Dowr + the freeze, not the sketches)
