# 01 — Design System Spec: Visual, Motion & Sound

> **Scope.** This document is the single source of truth for the *look, feel, motion, and sound* of the app. It defines Tailwind v4 `@theme` tokens, the light/dark strategy, typography (Latin + Persian/RTL), spacing/radius/shadow scales, the per‑game accent re‑theming mechanism, the core components (GameCard, Button, BottomSheet, Modal, RevealGate), the framer‑motion motion language, the SFX set with exact trigger points, and haptic patterns.
>
> **Audience.** Implementers building the SDK UI layer (`src/sdk/ui/*`) and the app shell. Game plugins consume these primitives only — they never redefine tokens or re‑implement components.
>
> **Status.** Implementation‑ready — and **implemented** as the **"Disco Persian"** theme. The token
> system, light/dark strategy, per‑game accent re‑theming, motion language, and SFX set described here
> are live. Notable realizations vs. this spec: (1) tokens + base layer live in `src/index.css` (not
> split into `src/styles/*`); (2) the theme is **dual light (Persian day / parchment) + dark (disco
> night / lapis)** toggled by a `.dark` class via `ThemeProvider`, with **light as the default**;
> (3) per‑game emblems are Persian SVGs in `src/sdk/ui/emblems.ts`; (4) SFX are **synthesized at
> runtime via the Web Audio API** in `src/services/sound.ts` (no Howler asset files); (5) win UX adds
> `Confetti` + `WinnerBanner`. Where a value is a *choice* rather than a constraint, it is marked
> `(tunable)`.

---

## 0. Conventions used in this doc

- **CSS-first Tailwind v4.** No `tailwind.config.js`. All tokens live in `@theme { … }` inside `src/styles/theme.css`. Utilities are generated from those tokens automatically (e.g. token `--color-brand-500` → utility `bg-brand-500`, `text-brand-500`, `border-brand-500`).
- **Logical properties only.** Never `ml-*/mr-*/left-*/right-*/text-left/text-right`. Always `ms-*/me-*/ps-*/pe-*/start-*/end-*/text-start/text-end`. RTL is achieved by `dir="rtl"` on `<html>`, not by mirroring class names.
- **Token naming** follows Tailwind v4 namespaces: `--color-*`, `--font-*`, `--text-*` (font-size), `--spacing` (base step), `--radius-*`, `--shadow-*`, `--ease-*`, `--animate-*`.
- `(tunable)` = safe to adjust during polish without breaking the contract.

---

## 1. File map & responsibilities

All design-system source lives under `src/styles/` and `src/sdk/ui/`. Games import **only** from `src/sdk/ui` and `@/sdk/motion`, `@/sdk/sound`, `@/sdk/haptics`.

```
src/
├─ styles/
│  ├─ theme.css            # @import "tailwindcss"; @theme tokens; custom @variant; base layer
│  ├─ tokens.ts            # TS mirror of design tokens (durations, springs, z-index, sound ids)
│  └─ fonts.css            # @font-face for Vazirmatn + display/body Latin faces (self-hosted)
├─ sdk/
│  ├─ motion/
│  │  ├─ variants.ts       # named framer-motion Variants (fade, popIn, sheet, stagger, cardFlip…)
│  │  ├─ transitions.ts    # spring/tween presets (springSnappy, springSoft, tweenFast…)
│  │  ├─ MotionConfig.tsx  # <ReducedMotionProvider> wrapper + useReducedMotionSafe()
│  │  └─ index.ts
│  ├─ sound/
│  │  ├─ SoundManager.ts   # Howler-based singleton; preload, play(id), setMuted, ducking
│  │  ├─ sounds.ts         # SoundId union + asset map + per-sound volume/throttle config
│  │  ├─ useSound.ts       # hook: const sfx = useSound(); sfx('correct')
│  │  └─ index.ts
│  ├─ haptics/
│  │  ├─ haptics.ts        # vibrate(pattern), HapticPattern map, respects global mute + support check
│  │  ├─ useHaptics.ts
│  │  └─ index.ts
│  └─ ui/
│     ├─ primitives/
│     │  ├─ Button.tsx        # variants: primary | secondary | ghost | danger; sizes sm|md|lg; iconButton
│     │  ├─ Card.tsx          # generic elevated surface (base for GameCard)
│     │  ├─ Sheet.tsx         # BottomSheet (drag-to-dismiss, snap points)
│     │  ├─ Modal.tsx         # centered dialog + Backdrop + focus trap
│     │  ├─ Backdrop.tsx      # shared scrim used by Sheet/Modal
│     │  ├─ Chip.tsx          # pill/tag (player names, tags)
│     │  ├─ Avatar.tsx        # player avatar (emoji/initial + color)
│     │  ├─ Spinner.tsx       # loading
│     │  └─ Confetti.tsx      # win celebration burst
│     ├─ GameCard.tsx         # home-grid card (consumes manifest)
│     ├─ RevealGate.tsx       # pass-and-play hand-off screen
│     ├─ AppHeader.tsx        # top bar (title + back + settings + mute toggle)
│     ├─ ThemeToggle.tsx      # light/dark/system control
│     ├─ ThemeProvider.tsx    # applies .light/.dark class + --game-accent
│     └─ index.ts             # barrel — the ONLY import surface for games
```

**Rule:** `src/sdk/ui/index.ts` re-exports every public component. A game does `import { Button, RevealGate, useSound } from '@/sdk/ui'`. Games never reach into `primitives/` paths directly, and never import from `src/styles/`.

---

## 2. Tailwind v4 setup

### 2.1 Vite plugin

`vite.config.ts` must register the Tailwind plugin and the `@` alias:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
```

### 2.2 Entry CSS

`src/main.tsx` imports exactly one stylesheet: `import '@/styles/theme.css'`. The legacy scaffold files `src/index.css` and `src/App.css` are **deleted** — `theme.css` replaces them entirely.

`theme.css` top:

```css
@import "tailwindcss";
@import "./fonts.css";

/* Manual dark mode: .dark on <html> wins; default follows OS via the @theme dark block below.
   We drive dark mode with a CLASS, not the media query, so the manual toggle always works.
   `prefers-color-scheme` is honored by ThemeProvider choosing the initial class in "system" mode. */
@custom-variant dark (&:where(.dark, .dark *));
```

> **Why class-based, not `@media`:** the product requires a manual light/dark toggle that overrides the OS. We therefore use a `.dark` class on `<html>` as the authority. `ThemeProvider` reads the persisted preference; in `"system"` mode it mirrors `prefers-color-scheme` onto the class and subscribes to changes. This gives one consistent selector (`.dark`) for all styling.

---

## 3. Color system

### 3.1 Palette philosophy

Playful & colorful = a **vivid multi-hue brand spectrum** (not a single brand color) plus **strong semantic colors**. Each hue ships a 50→950 ramp so games can pick an accent and the system can derive tints/shades. Light mode is bright on near-white; dark mode is saturated on a deep, slightly purple‑black (warmer than pure gray — feels friendlier).

Six “fun” hues drive game accents: **grape (purple), bubble (pink), tangerine (orange), lime (green), sky (blue), sunbeam (yellow)**. Plus neutral `ink` (text/surfaces). `brand` is an alias ramp = grape (the app’s default identity).

### 3.2 `@theme` color tokens

Put in `theme.css`. Only key stops shown with comments; ship the full 50–950 for every hue. Hex values are `(tunable)` but must keep these contrast guarantees: 500 stop ≥ 4.5:1 on white for text use is **not** required (500s are accent fills, paired with white text), but `*-600/700` must be ≥ 4.5:1 on white, and `*-300/400` ≥ 4.5:1 on the dark surface.

```css
@theme {
  /* ----- Neutral / ink (UI scaffolding) ----- */
  --color-ink-50:  #f7f6fb;
  --color-ink-100: #efedf5;
  --color-ink-200: #ddd9e8;
  --color-ink-300: #bdb6cf;
  --color-ink-400: #938aab;
  --color-ink-500: #6f6589;
  --color-ink-600: #564d6e;
  --color-ink-700: #423b56;
  --color-ink-800: #2a2538;  /* dark surface raised */
  --color-ink-900: #1b1726;  /* dark surface base   */
  --color-ink-950: #110e19;  /* dark app background */

  /* ----- Grape (brand default) ----- */
  --color-grape-50:#f6f0ff; --color-grape-100:#eb ddff; --color-grape-200:#d9bbff;
  --color-grape-300:#bf8cff; --color-grape-400:#a557ff; --color-grape-500:#8b2fef;
  --color-grape-600:#741fd1; --color-grape-700:#5d18a6; --color-grape-800:#451277;
  --color-grape-900:#2f0c52; --color-grape-950:#1d0735;

  /* ----- Bubble (pink) ----- */
  --color-bubble-300:#ff9ccf; --color-bubble-400:#ff63b0; --color-bubble-500:#f0319a;
  --color-bubble-600:#cf1e80; --color-bubble-700:#a01765; /* …full ramp */

  /* ----- Tangerine (orange) ----- */
  --color-tangerine-300:#ffc285; --color-tangerine-400:#ff9d3d; --color-tangerine-500:#f97b0a;
  --color-tangerine-600:#d36206; --color-tangerine-700:#a44e08; /* …full ramp */

  /* ----- Lime (green) ----- */
  --color-lime-300:#9bf08a; --color-lime-400:#5fdf48; --color-lime-500:#34c41f;
  --color-lime-600:#28a015; --color-lime-700:#1f7c13; /* …full ramp */

  /* ----- Sky (blue) ----- */
  --color-sky-300:#86c8ff; --color-sky-400:#3 da6ff; --color-sky-500:#0a86f9;
  --color-sky-600:#066bd3; --color-sky-700:#0853a4; /* …full ramp */

  /* ----- Sunbeam (yellow) ----- */
  --color-sunbeam-300:#ffe27a; --color-sunbeam-400:#ffd02e; --color-sunbeam-500:#f5b70a;
  --color-sunbeam-600:#d39406; --color-sunbeam-700:#a47208; /* …full ramp */

  /* ----- Semantic status ----- */
  --color-success-500:#22c55e; --color-success-600:#16a34a;
  --color-danger-500:#ef4444;  --color-danger-600:#dc2626;
  --color-warning-500:#f59e0b; --color-warning-600:#d97706;
  --color-info-500:#3b82f6;    --color-info-600:#2563eb;
}
```

> Note: a couple of hex literals above contain a deliberate space (`#eb ddff`, `#3 da6ff`) only to survive Markdown — **strip the spaces** when implementing.

### 3.3 Semantic tokens (the layer apps/games actually use)

Raw ramps are *primitives*. Components reference **semantic** tokens so light/dark and per-game accent “just work”. These are plain CSS custom properties under `:root` and `.dark`, **not** in `@theme` (they change at runtime; `@theme` is for static design constants). Expose them to Tailwind via the arbitrary-property bridge in §3.5.

```css
:root, .light {
  color-scheme: light;
  --bg:            var(--color-ink-50);   /* app background */
  --surface:       #ffffff;               /* cards, sheets  */
  --surface-2:     var(--color-ink-100);  /* raised/hover   */
  --surface-sunk:  var(--color-ink-100);  /* wells/inputs   */
  --text:          var(--color-ink-900);  /* primary text   */
  --text-muted:    var(--color-ink-500);
  --text-inverse:  #ffffff;
  --border:        var(--color-ink-200);
  --border-strong: var(--color-ink-300);
  --overlay:       rgb(27 23 38 / 0.45);  /* scrim */
  --ring:          var(--game-accent, var(--color-grape-500));

  /* Per-game accent: defaults to grape; ThemeProvider overrides on game routes. */
  --game-accent:        var(--color-grape-500);
  --game-accent-strong: var(--color-grape-600);
  --game-accent-soft:   color-mix(in oklab, var(--game-accent) 14%, transparent);
  --game-accent-on:     #ffffff;          /* text/icon ON an accent fill */
}

.dark {
  color-scheme: dark;
  --bg:            var(--color-ink-950);
  --surface:       var(--color-ink-900);
  --surface-2:     var(--color-ink-800);
  --surface-sunk:  #15111f;
  --text:          var(--color-ink-50);
  --text-muted:    var(--color-ink-300);
  --text-inverse:  var(--color-ink-950);
  --border:        var(--color-ink-800);
  --border-strong: var(--color-ink-700);
  --overlay:       rgb(0 0 0 / 0.6);
  --ring:          var(--game-accent, var(--color-grape-400));

  --game-accent:        var(--color-grape-400); /* lighter accent reads better on dark */
  --game-accent-strong: var(--color-grape-300);
  --game-accent-soft:   color-mix(in oklab, var(--game-accent) 22%, transparent);
  --game-accent-on:     var(--color-ink-950);
}
```

### 3.4 Per‑game accent re‑theming `--game-accent`

A game declares its accent in its manifest:

```ts
// GameManifest (subset relevant to theming)
export interface GameManifest {
  id: string
  accent: AccentName          // 'grape' | 'bubble' | 'tangerine' | 'lime' | 'sky' | 'sunbeam'
  // …name, icon, minPlayers, etc. defined in the architecture spec
}
export type AccentName = 'grape' | 'bubble' | 'tangerine' | 'lime' | 'sky' | 'sunbeam'
```

`ThemeProvider` maps `accent` → the matching ramp and sets the four `--game-accent*` vars on a wrapping element (the route container, **not** `<html>`, so the home screen keeps grape):

```ts
// accentVars(accent, isDark) → React.CSSProperties for the game route wrapper
const ACCENT_STOPS: Record<AccentName, { light: [string,string]; dark: [string,string] }> = {
  grape:     { light: ['--color-grape-500','--color-grape-600'],     dark: ['--color-grape-400','--color-grape-300'] },
  bubble:    { light: ['--color-bubble-500','--color-bubble-600'],   dark: ['--color-bubble-400','--color-bubble-300'] },
  tangerine: { light: ['--color-tangerine-500','--color-tangerine-600'], dark: ['--color-tangerine-400','--color-tangerine-300'] },
  lime:      { light: ['--color-lime-500','--color-lime-600'],       dark: ['--color-lime-400','--color-lime-300'] },
  sky:       { light: ['--color-sky-500','--color-sky-600'],         dark: ['--color-sky-400','--color-sky-300'] },
  sunbeam:   { light: ['--color-sunbeam-500','--color-sunbeam-600'], dark: ['--color-sunbeam-400','--color-sunbeam-300'] },
}

export function accentVars(accent: AccentName, isDark: boolean): React.CSSProperties {
  const [a, b] = isDark ? ACCENT_STOPS[accent].dark : ACCENT_STOPS[accent].light
  return {
    ['--game-accent' as string]: `var(${a})`,
    ['--game-accent-strong' as string]: `var(${b})`,
    // -soft and -on derive automatically from -accent via color-mix in :root rules,
    // but we re-declare -soft locally so color-mix re-evaluates against the new accent:
    ['--game-accent-soft' as string]: `color-mix(in oklab, var(${a}) ${isDark ? 22 : 14}%, transparent)`,
    ['--game-accent-on' as string]: isDark ? 'var(--color-ink-950)' : '#ffffff',
  }
}
```

Usage in a game screen wrapper:

```tsx
<div className="min-h-dvh bg-[var(--bg)]" style={accentVars(manifest.accent, isDark)}>
  …game screens — every accent utility now reflects this game…
</div>
```

### 3.5 Bridging semantic vars to utilities

Because semantic vars are runtime values (not `@theme`), reference them via Tailwind v4’s CSS-var utilities or thin component classes. Two sanctioned patterns:

1. **Arbitrary value:** `bg-[var(--surface)] text-[var(--text)] border-[var(--border)]`.
2. **Named utilities** registered once via `@utility` so JSX stays clean:

```css
@utility bg-app      { background-color: var(--bg); }
@utility bg-surface  { background-color: var(--surface); }
@utility bg-surface-2{ background-color: var(--surface-2); }
@utility text-default{ color: var(--text); }
@utility text-muted  { color: var(--text-muted); }
@utility border-default { border-color: var(--border); }
@utility bg-accent   { background-color: var(--game-accent); }
@utility text-accent { color: var(--game-accent); }
@utility ring-accent { --tw-ring-color: var(--ring); }
@utility text-on-accent { color: var(--game-accent-on); }
@utility bg-accent-soft { background-color: var(--game-accent-soft); }
```

> Prefer the named `@utility` set in components; arbitrary `var()` is fine for one-offs. The accent ramps (`bg-grape-500`, etc.) are available everywhere because they ARE in `@theme`.

---

## 4. Typography

### 4.1 Font pairing

| Role | Latin | Persian (fa) |
|---|---|---|
| Display (headings, GameCard titles, big numbers) | **Baloo 2** — rounded, friendly, playful | **Vazirmatn** (its display weights) |
| Body / UI | **Inter** — neutral, legible at small sizes | **Vazirmatn** |
| Numeric (timers, scores) | Inter `tabular-nums` (display weight for the big timer) | Vazirmatn `tabular-nums` |

Vazirmatn covers Persian for both display and body (it has a full weight range and excellent legibility); we do **not** mix a second Persian face. All fonts are **self-hosted** (woff2) under `public/fonts/` and declared in `fonts.css` — no Google Fonts CDN (offline requirement).

### 4.2 `@font-face` (fonts.css)

```css
@font-face { font-family:"Baloo 2"; src:url("/fonts/baloo2-var.woff2") format("woff2"); font-weight:400 800; font-display:swap; }
@font-face { font-family:"Inter";   src:url("/fonts/inter-var.woff2")   format("woff2"); font-weight:100 900; font-display:swap; font-named-instance:"Regular"; }
@font-face { font-family:"Vazirmatn"; src:url("/fonts/vazirmatn-var.woff2") format("woff2"); font-weight:100 900; font-display:swap; }
```

### 4.3 Font tokens & dir-aware fallback

The font *stacks* always list the Persian face too, so a mixed string (e.g. an English name inside a Persian sentence) never falls back to a system serif. Order differs by `dir` so the primary face matches the active language, but both are always present:

```css
@theme {
  --font-display: "Baloo 2", "Vazirmatn", ui-rounded, system-ui, sans-serif;
  --font-body:    "Inter", "Vazirmatn", system-ui, sans-serif;
  --font-fa-display: "Vazirmatn", "Baloo 2", system-ui, sans-serif;
  --font-fa-body:    "Vazirmatn", "Inter", system-ui, sans-serif;
}

/* Dir-driven swap: in RTL, Vazirmatn leads. */
:root            { --ff-display: var(--font-display); --ff-body: var(--font-body); }
[dir="rtl"]      { --ff-display: var(--font-fa-display); --ff-body: var(--font-fa-body); }

html { font-family: var(--ff-body); }
.font-display { font-family: var(--ff-display); }   /* @utility variant */
```

Add `@utility font-display { font-family: var(--ff-display); }` and `@utility font-body { font-family: var(--ff-body); }`.

### 4.4 Type scale (font-size tokens → `text-*` utilities)

Mobile-first; sizes in `rem`. `--text-*` token also carries default line-height per Tailwind v4.

```css
@theme {
  --text-2xs: 0.6875rem;  --text-2xs--line-height: 1rem;     /* 11px tiny labels */
  --text-xs:  0.75rem;    --text-xs--line-height: 1rem;
  --text-sm:  0.875rem;   --text-sm--line-height: 1.25rem;
  --text-base:1rem;       --text-base--line-height: 1.5rem;  /* body 16px */
  --text-lg:  1.125rem;   --text-lg--line-height: 1.6rem;
  --text-xl:  1.375rem;   --text-xl--line-height: 1.75rem;   /* card title */
  --text-2xl: 1.75rem;    --text-2xl--line-height: 2.1rem;   /* screen heading */
  --text-3xl: 2.25rem;    --text-3xl--line-height: 2.5rem;
  --text-4xl: 3rem;       --text-4xl--line-height: 1.05;     /* big timer/score */
  --text-5xl: 4rem;       --text-5xl--line-height: 1;        /* hero / RevealGate */
}
```

**Usage rules**
- Headings & GameCard titles: `font-display font-bold`.
- Body & buttons: `font-body`.
- Timers/scores: `font-display tabular-nums` (digits stay aligned as they tick).
- Persian display headings get slightly more line-height — handled automatically because Vazirmatn’s metrics are taller; do not hardcode per-language sizes.

---

## 5. Spacing, sizing, radius, shadow

### 5.1 Spacing

Tailwind v4 derives the whole spacing scale from one base step. We keep the 4px grid:

```css
@theme { --spacing: 0.25rem; }  /* p-1=4px, p-2=8px, … p-4=16px gutter, p-6=24px section */
```

Layout rules: screen horizontal gutter `px-4` (16px) on phones, `px-6` on ≥`sm`. Vertical rhythm between sections `space-y-6`. Touch targets ≥ **44px** (`min-h-11`); primary buttons are `h-13` (52px) `(tunable)`.

### 5.2 Radius

Playful = generous rounding.

```css
@theme {
  --radius-sm: 0.5rem;    /* 8  — chips, inputs */
  --radius-md: 0.875rem;  /* 14 — buttons */
  --radius-lg: 1.25rem;   /* 20 — cards */
  --radius-xl: 1.75rem;   /* 28 — bottom-sheet top, modal */
  --radius-2xl: 2.25rem;  /* 36 — hero/RevealGate panel */
  --radius-full: 9999px;  /* pills, avatars, icon buttons */
}
```

### 5.3 Shadow

Soft, slightly tinted toward the accent for the “colorful” feel. Two families: neutral elevation + an accent glow used on hover/active of accent surfaces.

```css
@theme {
  --shadow-xs:  0 1px 2px rgb(27 23 38 / 0.06);
  --shadow-sm:  0 2px 6px rgb(27 23 38 / 0.08);
  --shadow-md:  0 6px 16px rgb(27 23 38 / 0.10);
  --shadow-lg:  0 14px 32px rgb(27 23 38 / 0.14);
  --shadow-xl:  0 24px 56px rgb(27 23 38 / 0.20);
  /* accent glow — uses currentaccent; apply via @utility shadow-glow */
}
@utility shadow-glow {
  box-shadow: 0 8px 24px -6px color-mix(in oklab, var(--game-accent) 55%, transparent);
}
```

Dark mode: shadows are weaker (deep bg hides them); elevation is instead conveyed by `--surface` getting lighter (`ink-900` base → `ink-800` raised). Components add `dark:shadow-none` where a glow/border carries elevation.

### 5.4 Z-index scale (tokens.ts, mirrored as utilities)

```ts
export const Z = {
  base: 0, card: 10, header: 40, dropdown: 50,
  backdrop: 60, sheet: 70, modal: 80, toast: 90, confetti: 100,
} as const
```

`@theme` companion: `--z-header:40; --z-backdrop:60; --z-sheet:70; --z-modal:80; --z-toast:90;` for `z-*` utilities.

---

## 6. Light / dark strategy

### 6.1 Behavior contract

- Preference is one of `'light' | 'dark' | 'system'`, persisted by the settings store (`zustand` + persist).
- `'system'` follows `prefers-color-scheme` live (subscribe to the media query).
- The authority is the `.dark` / `.light` class on `<html>`. Exactly one is present. (`.light` is included so `:root, .light` rules win even if some ancestor toggles.)

### 6.2 ThemeProvider

```ts
type ThemePref = 'light' | 'dark' | 'system'

interface ThemeState {
  pref: ThemePref
  resolved: 'light' | 'dark'   // what's actually applied right now
  setPref(p: ThemePref): void
}
```

```tsx
// ThemeProvider.tsx (essentials)
function applyClass(resolved: 'light' | 'dark') {
  const el = document.documentElement
  el.classList.toggle('dark', resolved === 'dark')
  el.classList.toggle('light', resolved === 'light')
  el.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pref = useSettings(s => s.theme)            // from settings store
  const [resolved, setResolved] = useState<'light'|'dark'>(() => resolve(pref))
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const update = () => {
      const r = pref === 'system' ? (mq.matches ? 'dark' : 'light') : pref
      setResolved(r); applyClass(r)
    }
    update()
    if (pref === 'system') { mq.addEventListener('change', update); return () => mq.removeEventListener('change', update) }
  }, [pref])
  return <ThemeContext.Provider value={{ resolved }}>{children}</ThemeContext.Provider>
}
```

**FOUC guard:** an inline script in `index.html` `<head>` sets the initial class before React mounts:

```html
<script>
  (function () {
    try {
      var p = JSON.parse(localStorage.getItem('settings') || '{}')?.state?.theme || 'system'
      var d = p === 'dark' || (p !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
      var c = document.documentElement.classList
      c.add(d ? 'dark' : 'light')
      document.documentElement.style.colorScheme = d ? 'dark' : 'light'
    } catch (e) {}
  })()
</script>
```

`<meta name="theme-color">` is updated to `--bg` per mode by ThemeProvider so the PWA status bar matches.

---

## 7. Motion language (framer-motion v12)

### 7.1 Principles

- **Snappy, bouncy, never sluggish.** Enter/celebrate with spring overshoot; exit with fast tween. Default durations 120–320ms.
- **One vocabulary.** All motion comes from named `Variants` and shared transition presets in `src/sdk/motion`. Screens/components reference them, not inline magic numbers.
- **Reduced motion is first-class.** Honor `prefers-reduced-motion`; replace transforms with opacity-only and disable spring overshoot.

### 7.2 Transition presets (transitions.ts)

```ts
import type { Transition } from 'framer-motion'

export const springSnappy: Transition = { type: 'spring', stiffness: 520, damping: 30, mass: 0.9 } // buttons, pops
export const springSoft:   Transition = { type: 'spring', stiffness: 260, damping: 26, mass: 1 }   // sheets, cards
export const springBouncy: Transition = { type: 'spring', stiffness: 420, damping: 14, mass: 0.8 } // celebration, reveal
export const tweenFast:    Transition = { type: 'tween', duration: 0.14, ease: [0.22, 1, 0.36, 1] } // exits
export const tweenBase:    Transition = { type: 'tween', duration: 0.24, ease: [0.4, 0, 0.2, 1] }
```

Mirror the durations/eases in `tokens.ts` so CSS keyframes (confetti, idle wiggle) stay in sync.

### 7.3 Named variants (variants.ts)

```ts
import type { Variants } from 'framer-motion'

export const fade: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: tweenBase },
  exit:   { opacity: 0, transition: tweenFast },
}

export const popIn: Variants = {                 // buttons appearing, chips, badges
  hidden: { opacity: 0, scale: 0.86 },
  show:   { opacity: 1, scale: 1, transition: springSnappy },
  exit:   { opacity: 0, scale: 0.9, transition: tweenFast },
}

export const riseIn: Variants = {                // list items, screen content
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: springSoft },
  exit:   { opacity: 0, y: 8, transition: tweenFast },
}

export const sheet: Variants = {                 // bottom-sheet panel
  hidden: { y: '100%' },
  show:   { y: 0, transition: springSoft },
  exit:   { y: '100%', transition: tweenBase },
}

export const modal: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 8 },
  show:   { opacity: 1, scale: 1, y: 0, transition: springSnappy },
  exit:   { opacity: 0, scale: 0.96, y: 4, transition: tweenFast },
}

export const backdrop: Variants = {
  hidden: { opacity: 0 }, show: { opacity: 1, transition: tweenBase }, exit: { opacity: 0, transition: tweenFast },
}

export const stagger: Variants = {               // parent of a grid/list
  hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } }, exit: {},
}

export const cardFlip: Variants = {              // RevealGate reveal
  hidden: { rotateY: 90, opacity: 0 },
  show:   { rotateY: 0, opacity: 1, transition: springBouncy },
  exit:   { rotateY: -90, opacity: 0, transition: tweenFast },
}

export const celebrate: Variants = {             // win headline
  hidden: { scale: 0.6, opacity: 0 },
  show:   { scale: 1, opacity: 1, transition: springBouncy },
}
```

**Route transitions:** wrap routed screens in `<AnimatePresence mode="wait">`; each screen root uses `fade` (or `riseIn` for forward nav). `mode="wait"` avoids overlap on the single passed-around phone.

### 7.4 Reduced motion handling

`MotionConfig.tsx` wraps the app in framer-motion’s `<MotionConfig reducedMotion="user">` (auto-strips transforms when the user prefers reduced motion) **and** provides a hook for our own logic (e.g. skipping the card-flip, suppressing confetti):

```ts
export function useReducedMotionSafe(): boolean {
  const prefers = useReducedMotion()          // framer-motion hook
  return prefers ?? false
}
```

Rules when reduced:
- Replace `cardFlip` with `fade` (no 3D rotate).
- Confetti renders a single static accent flourish instead of an animated burst (or nothing).
- Idle “wiggle” loops on GameCards are disabled.
- Springs degrade to `tweenBase`. (MotionConfig handles transform-stripping automatically; we only special-case the items above.)

### 7.5 Ambient/idle motion `(tunable)`

GameCards gently breathe on the home grid: a subtle `whileInView`-triggered `scale` 1→1.015 loop at low amplitude, staggered, disabled under reduced motion and when the grid isn’t visible. Defined as `@theme --animate-breathe` keyframes for CSS-driven cards or a framer `animate` loop — pick CSS to keep it off the main thread.

```css
@theme { --animate-breathe: breathe 4s ease-in-out infinite; }
@keyframes breathe { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-2px) } }
@media (prefers-reduced-motion: reduce) { @theme { --animate-breathe: none; } }
```

---

## 8. Core components

Every component: forwards `ref`, accepts `className` (merged via `clsx`), supports `dir` implicitly through logical utilities, is keyboard accessible, and respects reduced motion.

### 8.1 Button

```ts
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant          // default 'primary'
  size?: ButtonSize                // default 'md'
  fullWidth?: boolean
  loading?: boolean                // shows Spinner, disables, keeps width
  iconStart?: React.ReactNode      // logical start (auto-flips in RTL)
  iconEnd?: React.ReactNode
  sound?: SoundId | false          // click SFX, default 'tap' (false to silence)
  haptic?: HapticPattern | false   // default 'light'
}
```

Anatomy & styling:
- **primary:** `bg-accent text-on-accent shadow-glow` — the accent fill, white/dark text, accent glow.
- **secondary:** `bg-surface-2 text-default border border-default`.
- **ghost:** transparent, `text-accent`, hover `bg-accent-soft`.
- **danger:** `bg-danger-500 text-white`.
- Shape: `rounded-md font-body font-semibold`. Sizes: `sm h-9 px-3 text-sm`, `md h-11 px-4 text-base`, `lg h-13 px-6 text-lg`.
- Min hit area 44px even at `sm` (use `min-h-11` wrapper or padding).
- Motion: `whileTap={{ scale: 0.96 }}` with `springSnappy`; `whileHover={{ y: -1 }}` on pointer-fine devices only.
- On click (not disabled/loading): play `sound` then fire `haptic` (see §9, §10). Order: visual tap → sound → haptic, all synchronous in the handler.

```tsx
<motion.button
  whileTap={reduced ? undefined : { scale: 0.96 }}
  transition={springSnappy}
  className={clsx(base, byVariant[variant], bySize[size], fullWidth && 'w-full', className)}
  onClick={(e) => { if (disabled || loading) return; sound && sfx(sound); haptic && vibe(haptic); onClick?.(e) }}
>
  {iconStart && <span className="me-2 inline-flex">{iconStart}</span>}
  {loading ? <Spinner size={size} /> : children}
  {iconEnd && <span className="ms-2 inline-flex">{iconEnd}</span>}
</motion.button>
```

`IconButton` = square variant (`aspect-square`, `rounded-full`, `min-h-11 min-w-11`) for header actions (back, settings, mute).

### 8.2 GameCard

Used on the home grid. Driven entirely by a `GameManifest`. It is the most “branded” surface — large rounded card, accent gradient header band, big icon, title in `font-display`, a player-count badge, and a tap that navigates to the game.

```ts
interface GameCardProps {
  manifest: GameManifest          // id, name (LocalizedString), tagline?, icon, accent, minPlayers, maxPlayers
  onPlay(id: string): void
  index?: number                  // for stagger delay
}
```

Anatomy (top→bottom):
1. **Accent band / icon well:** a rounded-top region filled with a soft accent gradient `linear-gradient(135deg, var(--game-accent), var(--game-accent-strong))`; centered large game icon (SVG/emoji) in `text-on-accent`. The card sets `--game-accent` locally via `accentVars(manifest.accent, isDark)` so each card shows its own hue regardless of route.
2. **Body:** title (`font-display font-bold text-xl text-default`), optional tagline (`text-sm text-muted`, 1–2 lines clamped).
3. **Footer:** player-range chip (e.g. “3–10”) with a small avatars/people glyph; uses `bg-accent-soft text-accent`.

```tsx
<motion.button
  variants={popIn}
  style={accentVars(manifest.accent, isDark)}
  whileTap={{ scale: 0.97 }} transition={springSnappy}
  onClick={() => { sfx('tap'); vibe('light'); onPlay(manifest.id) }}
  className="group relative flex flex-col overflow-hidden rounded-lg bg-surface
             shadow-md text-start focus-visible:outline-none focus-visible:ring-4 ring-accent"
>
  <div className="flex h-28 items-center justify-center
                  bg-[linear-gradient(135deg,var(--game-accent),var(--game-accent-strong))]">
    <GameIcon name={manifest.icon} className="size-14 text-on-accent" />
  </div>
  <div className="flex flex-1 flex-col gap-1 p-4">
    <h3 className="font-display text-xl font-bold text-default">{t(manifest.name)}</h3>
    {manifest.tagline && <p className="line-clamp-2 text-sm text-muted">{t(manifest.tagline)}</p>}
    <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full
                     bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
      <PeopleIcon className="size-3.5" /> {manifest.minPlayers}–{manifest.maxPlayers}
    </span>
  </div>
</motion.button>
```

Grid: parent uses `stagger` variants; `grid grid-cols-2 gap-4 sm:grid-cols-3`. `t(localized)` resolves `LocalizedString` to the active language. Card titles in Persian automatically pick Vazirmatn via the dir-aware `font-display`.

### 8.3 Card (generic surface)

Base for non-game panels (settings rows, roster cards). `rounded-lg bg-surface border border-default shadow-sm p-4`, dark mode swaps to `bg-surface` (already lighter) + `shadow-none`.

### 8.4 BottomSheet (Sheet.tsx)

Primary modal surface on mobile (settings, “add player”, game options). Drag-to-dismiss, optional snap points.

```ts
interface SheetProps {
  open: boolean
  onClose(): void
  title?: React.ReactNode
  snapPoints?: number[]            // fractions of viewport height, e.g. [0.5, 0.92]; default single auto-height
  dismissible?: boolean            // drag/backdrop close, default true
  children: React.ReactNode
}
```

Behavior:
- Renders into a portal (`#overlay-root`). `Backdrop` uses `backdrop` variants + `overlay` color; clicking it closes (if dismissible).
- Panel: pinned to bottom, `rounded-t-xl bg-surface`, max-width `max-w-md mx-auto`, top **grab handle** (a 36×4 `bg-border-strong rounded-full`). Padding `p-5`, content scrolls (`overflow-y-auto`), respects `pb-[env(safe-area-inset-bottom)]`.
- Motion: `sheet` variants (`springSoft` in, `tweenBase` out) inside `<AnimatePresence>`.
- **Drag:** framer `drag="y"`, `dragConstraints={{ top: 0 }}`, `dragElastic={0.12}`. On drag end, if `offset.y > 120 || velocity.y > 500` → `onClose()` and play `'transition'` SFX (down-swish) + `'light'` haptic; else spring back.
- A11y: `role="dialog" aria-modal="true"`, focus trap, `Esc` closes, scroll-lock on body while open, restore focus on close.

### 8.5 Modal (Modal.tsx)

Centered dialog for confirmations and short prompts (e.g. “End game?”). Same backdrop/portal/focus-trap as Sheet; panel uses `modal` variants, `rounded-xl bg-surface p-6 max-w-sm`, with title (`font-display text-2xl`), body, and an action row (`Button`s, `justify-end`, gap-2). On mobile, prefer Sheet for inputs; reserve Modal for terse confirms.

### 8.6 RevealGate (the hand-off screen)

The signature pass-and-play screen: between turns, the phone is handed to the next player and **must not reveal secret info until that player confirms they’re holding it**. Two-step gate: (1) “Pass to **{name}**” cover, (2) press-and-hold or tap to reveal private content, then a “Got it / Hide” to pass on.

```ts
interface RevealGateProps {
  forPlayer: Player                 // whose turn — name + avatar color
  prompt?: LocalizedString          // e.g. "You are the spy"
  children: React.ReactNode         // the secret content shown after reveal
  revealMode?: 'tap' | 'hold'       // default 'hold' (prevents accidental peeks)
  onRevealed?(): void
  onHidden?(): void                 // user finished — advance turn
}

type RevealPhase = 'cover' | 'revealing' | 'revealed'
```

Flow & motion:
1. **Cover phase:** full-bleed `bg-accent` panel, big lock/eye icon, `font-display text-3xl` “Pass to {name}”, instruction (“Hold to reveal” / “Tap to reveal”). Enter with `riseIn`. Plays nothing yet.
2. **Reveal action:**
   - `hold`: pointer-down starts a 600ms `(tunable)` radial progress ring (framer `pathLength` 0→1, `tweenBase`→linear). The `'tick'` SFX plays softly during hold; haptic `'light'` at start. Completing the hold → fire `'reveal'` SFX + `'reveal'` haptic, set phase `revealed`. Releasing early cancels (ring springs back, no reveal).
   - `tap`: single tap → immediate reveal (`'reveal'` SFX + haptic).
3. **Reveal phase:** secret content (`children`) appears with `cardFlip` (or `fade` under reduced motion). Accent recedes to `bg-surface` so content is readable. A **Hide & Pass** `Button` at bottom; pressing it runs `cardFlip` exit, plays `'transition'` SFX, calls `onHidden()` to advance the turn, and the next player’s cover slides in.

```tsx
<AnimatePresence mode="wait">
  {phase === 'cover' && (
    <motion.div key="cover" variants={riseIn} initial="hidden" animate="show" exit="exit"
      className="grid min-h-dvh place-items-center bg-accent text-on-accent p-8 text-center select-none"
      onPointerDown={startReveal} onPointerUp={cancelHold} onPointerLeave={cancelHold}>
      <Avatar player={forPlayer} size="xl" />
      <h2 className="font-display text-3xl mt-4">{t('reveal.passTo', { name: forPlayer.name })}</h2>
      <p className="mt-2 opacity-80">{t(revealMode === 'hold' ? 'reveal.hold' : 'reveal.tap')}</p>
      <ProgressRing progress={holdProgress} className="mt-8 size-20" />
    </motion.div>
  )}
  {phase === 'revealed' && (
    <motion.div key="secret" variants={cardFlip} initial="hidden" animate="show" exit="exit"
      className="grid min-h-dvh place-items-center bg-surface p-8 text-center [transform-style:preserve-3d]">
      {prompt && <p className="text-muted">{t(prompt)}</p>}
      <div className="my-6">{children}</div>
      <Button variant="primary" onClick={hideAndPass}>{t('reveal.gotIt')}</Button>
    </motion.div>
  )}
</AnimatePresence>
```

A11y/safety: the cover never renders `children` into the DOM until `revealed` (so no peeking via inspector); `aria-live="polite"` announces phase; reduced-motion uses `fade`.

### 8.7 Supporting primitives

- **Backdrop:** `fixed inset-0 z-backdrop bg-[var(--overlay)]`, `backdrop` variants, click→close.
- **Chip:** pill `rounded-full px-2.5 py-1 text-xs font-semibold`; tones `accent | neutral | success | danger` via bg-soft/text.
- **Avatar:** circle, sizes `sm 28 / md 36 / lg 48 / xl 80`; shows player emoji or first grapheme; `bg` = player’s assigned color (from a fixed playful palette set in roster), `text-on-accent`-style contrast.
- **Spinner:** rotating accent arc (CSS `--animate-*` or framer rotate loop), respects reduced motion (pulsing dot instead).
- **Confetti:** burst on win; renders accent-tinted particles. Disabled/replaced under reduced motion. Triggered by ResultsScreen, paired with `'win'` SFX + `'success'` haptic.

---

## 9. Sound design (Howler)

### 9.1 Sound set

Self-hosted under `public/sfx/` as short `.webm` (with `.mp3` fallback). Keep each < 25KB, normalized loudness, no long tails.

| `SoundId` | When it plays | Character |
|---|---|---|
| `tap` | Any primary/interactive press (Button default, GameCard) | tiny soft click |
| `tick` | Timer countdown each second in the final N seconds; RevealGate hold progress | short blip; rises slightly in final 3s |
| `correct` | A correct/positive answer or scoring event (game-dispatched) | bright two-note up |
| `wrong` | A wrong/negative answer or penalty | soft buzz/down-note (never harsh) |
| `reveal` | RevealGate secret revealed | magical shimmer/whoosh |
| `transition` | Screen/phase change, sheet open/close, “Hide & Pass” | gentle swish |
| `win` | ResultsScreen winner shown | celebratory fanfare (short) |

> Exactly these seven IDs. Games trigger `correct/wrong/win` via the SDK (e.g. scoring/results primitives) — they don’t invent new sounds. `tap/tick/reveal/transition` are fired by the components themselves.

### 9.2 SoundManager

```ts
export type SoundId = 'tap' | 'tick' | 'correct' | 'wrong' | 'reveal' | 'transition' | 'win'

interface SoundConfig {
  src: string[]        // [webm, mp3]
  volume: number       // 0..1 baseline per sound
  throttleMs?: number  // min gap between repeats (tap/tick)
}

interface SoundManager {
  preload(): Promise<void>
  play(id: SoundId): void
  setMuted(muted: boolean): void
  isMuted(): boolean
  setMasterVolume(v: number): void
}
```

```ts
// sounds.ts
export const SOUNDS: Record<SoundId, SoundConfig> = {
  tap:        { src: ['/sfx/tap.webm','/sfx/tap.mp3'], volume: 0.35, throttleMs: 40 },
  tick:       { src: ['/sfx/tick.webm','/sfx/tick.mp3'], volume: 0.4, throttleMs: 120 },
  correct:    { src: ['/sfx/correct.webm','/sfx/correct.mp3'], volume: 0.7 },
  wrong:      { src: ['/sfx/wrong.webm','/sfx/wrong.mp3'], volume: 0.6 },
  reveal:     { src: ['/sfx/reveal.webm','/sfx/reveal.mp3'], volume: 0.7 },
  transition: { src: ['/sfx/transition.webm','/sfx/transition.mp3'], volume: 0.4 },
  win:        { src: ['/sfx/win.webm','/sfx/win.mp3'], volume: 0.85 },
}
```

Implementation notes:
- One `Howl` per sound, preloaded after first user gesture (autoplay policy). `preload()` is called on the first `pointerdown` anywhere (one-time listener in the app shell).
- **Global mute** is read from the settings store (`muted`). `setMuted` toggles `Howler.mute(true/false)`; `play()` early-returns if muted (saves work). Mute also gates haptics? No — haptics have their own toggle, but both default to the single “Sound & Haptics” mute in v1 `(tunable)`: one master mute controls both.
- **Throttle:** `tap`/`tick` ignore replays within `throttleMs` to avoid machine-gun artifacts.
- **Ducking (optional, tunable):** when `win` plays, lower other sounds; simplest v1 = no ducking.

### 9.3 useSound hook

```ts
export function useSound() {
  const muted = useSettings(s => s.muted)
  return useCallback((id: SoundId) => { if (!muted) soundManager.play(id) }, [muted])
}
// usage: const sfx = useSound(); sfx('correct')
```

### 9.4 Exact trigger matrix

| Trigger source | Event | Sound | Haptic |
|---|---|---|---|
| `Button` (default) | onClick | `tap` | `light` |
| `GameCard` | onClick | `tap` | `light` |
| Sheet/Modal | open | `transition` | — |
| Sheet | drag-dismiss / close | `transition` | `light` |
| Timer primitive | each of final N sec | `tick` | — |
| Timer primitive | reaches 0 | `transition` (or game-chosen) | `medium` |
| RevealGate | hold in progress | `tick` (soft) | `light` at start |
| RevealGate | revealed | `reveal` | `reveal` pattern |
| RevealGate | Hide & Pass | `transition` | `light` |
| Scoring (SDK) | correct answer | `correct` | `success` |
| Scoring (SDK) | wrong answer | `wrong` | `warning` |
| Results | winner shown | `win` | `success` (long) |

Games dispatch correct/wrong/win through SDK scoring/results primitives, which own these calls — game code does not call `sfx('win')` directly.

---

## 10. Haptics

`navigator.vibrate` now; swap to Capacitor Haptics later behind the same `vibrate()` API.

```ts
export type HapticPattern =
  | 'light' | 'medium' | 'heavy'
  | 'success' | 'warning' | 'error'
  | 'reveal' | 'select'

// vibration patterns in ms (number = single buzz; array = on/off/on…)
const PATTERNS: Record<HapticPattern, number | number[]> = {
  light:   10,
  medium:  20,
  heavy:   35,
  select:  8,
  success: [0, 18, 60, 28],     // double tap, rising
  warning: [0, 30, 40, 30],
  error:   [0, 40, 60, 40, 60, 40],
  reveal:  [0, 12, 30, 22],     // soft then firmer — “ta-da”
}

export function vibrate(p: HapticPattern): void {
  if (useSettings.getState().muted) return            // master mute gates haptics in v1
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try { navigator.vibrate(PATTERNS[p]) } catch {}
}
```

Rules:
- Gated by the same master mute as sound in v1 (`(tunable)` to split later).
- Feature-detected: silently no-op where unsupported (most iOS Safari) — never throw.
- `useHaptics()` hook returns a memoized `vibe(pattern)` that reads the live mute state.
- Patterns are intentionally subtle; nothing longer than ~250ms total. Avoid continuous vibration.

---

## 11. RTL & directionality

- `<html dir>` is set by the i18n layer (`rtl` for `fa`, `ltr` for `en`); design tokens are dir-agnostic.
- **Never** use physical-direction utilities. Lint guard: ESLint rule / code review rejects `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right` in `src/**`.
- Use `rtl:`/`ltr:` variants only for genuinely directional glyphs (e.g. a back chevron): `<ChevronStart className="rtl:-scale-x-100" />`.
- framer-motion x-axis: prefer `y` and `scale` for shared components so motion doesn’t need mirroring. Where x is required (slide-in navigation), compute direction from `dir` (`const sign = dir === 'rtl' ? -1 : 1`).
- Numerals: keep Western digits in timers/scores in both languages for clarity `(tunable)`; if Persian digits are desired later, format at the i18n layer, not in components.

---

## 12. Accessibility baseline

- Color contrast: body text ≥ 4.5:1, large/UI ≥ 3:1, in **both** modes. Accent fills always pair with `--game-accent-on`.
- Focus visible: every interactive element shows `focus-visible:ring-4 ring-accent ring-offset-2 ring-offset-[var(--bg)]`.
- Touch targets ≥ 44×44.
- Motion: full `prefers-reduced-motion` support (§7.4).
- Dialogs (Sheet/Modal/RevealGate): `role`, `aria-modal`, focus trap, `Esc`, scroll-lock, focus restore.
- All SFX have a meaningful non-audio counterpart (visual state change); sound is never the only signal.

---

## 13. tokens.ts (TS mirror)

Single import surface for non-CSS consumers (motion, JS-driven animation, tests).

```ts
export const DURATION = { fast: 0.14, base: 0.24, slow: 0.32 } as const
export const EASE = { standard: [0.4,0,0.2,1], emphasized: [0.22,1,0.36,1] } as const
export const SPRING = {
  snappy: { type:'spring', stiffness:520, damping:30, mass:0.9 },
  soft:   { type:'spring', stiffness:260, damping:26, mass:1 },
  bouncy: { type:'spring', stiffness:420, damping:14, mass:0.8 },
} as const
export const Z = { base:0, card:10, header:40, dropdown:50, backdrop:60, sheet:70, modal:80, toast:90, confetti:100 } as const
export const HOLD_REVEAL_MS = 600
export const TIMER_TICK_FROM = 5    // start ticking at T-5s
export const ACCENTS = ['grape','bubble','tangerine','lime','sky','sunbeam'] as const
export type AccentName = typeof ACCENTS[number]
```

Keep `tokens.ts` and `theme.css` numerically in sync; a small `tokens.test.ts` may assert the durations match the CSS comments.

---

## 14. Implementation checklist (maps to project tasks)

1. Add `@tailwindcss/vite` + `@` alias to `vite.config.ts`; delete `src/index.css` & `src/App.css`.
2. Create `src/styles/{theme.css, fonts.css, tokens.ts}`; import `theme.css` in `main.tsx`.
3. Self-host fonts in `public/fonts/`; declare `@font-face`; wire dir-aware `--ff-*`.
4. Add FOUC inline script + `<meta theme-color>` to `index.html`; build `ThemeProvider` + `ThemeToggle`.
5. Build `sdk/motion` (variants, transitions, MotionConfig); wrap app in `<MotionConfig reducedMotion="user">`.
6. Build `sdk/sound` (SoundManager, sounds, useSound) + add the seven SFX assets; gesture-gated preload.
7. Build `sdk/haptics`.
8. Build `sdk/ui` primitives → GameCard → RevealGate → AppHeader; export via `index.ts`.
9. Verify both light/dark, both en/fa(RTL), reduced-motion, and master-mute paths.

---

## 15. Open/tunable items (non-blocking)

- Exact hex polish on ramps after a contrast audit (must keep §3.2 guarantees).
- Whether to split sound vs haptic mute into two toggles (v1 = one master).
- Confetti library vs hand-rolled particles (hand-rolled keeps bundle small).
- Persian-digit formatting option (default Western digits).
- Idle “breathe” amplitude on GameCards.
