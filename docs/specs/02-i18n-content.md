# Spec 02 — i18n, RTL & Bilingual Content / Deck Model

> **Status:** Implementation-ready. No open questions.
> **Scope:** Everything related to language (English + Persian), right-to-left layout, locale-aware formatting, and the bilingual **content** model (word decks, prompt decks, locations + roles, mafia roles), the **custom-deck** (user-created) model, and the **Supabase** table shapes for later cloud sync of content / stats / saved groups.
> **Out of scope (other specs):** The SDK engine primitives, the game registry, individual game logic. This spec defines the *data and language layer* those depend on.
>
> **Locked stack (relevant subset):** React 19, TypeScript 6 (strict), Vite 8, Tailwind v4 (CSS-first, no config file), `i18next@26` + `react-i18next@17`, `zustand@5` (+ persist), `idb-keyval@6`, `@supabase/supabase-js@2`. HashRouter (Capacitor-friendly).

---

## 0. Terminology & Two Translation Domains

There are **two completely separate** kinds of "translatable text", and they MUST NOT be mixed:

| Domain | What it is | Where it lives | Mechanism |
|---|---|---|---|
| **UI strings** | Buttons, labels, settings, error toasts, menu items, screen chrome. | `src/i18n/locales/<lng>/*.json` catalogs. | `i18next` key lookup → `t('common.next')`. |
| **Game CONTENT** | The actual playable material: words, prompts, location names, role names + descriptions, mafia roles. | `src/games/<id>/content/*.json` **and** user-created decks in IndexedDB / Supabase. | Plain bilingual data objects shaped as `LocalizedString`, resolved by the active language via a `useLocalized()` helper. **Never** goes through `i18next`. |

**Rule of thumb:** if a translator could change it without touching code → if it's *chrome*, it's a UI string in a catalog; if it's *game material*, it's content data. Content is data the game engine consumes, can be authored by users, and can be synced to Supabase. Catalogs ship with the app bundle and are never user-editable.

The shared primitive shared by both domains for the content side:

```ts
// src/sdk/types/localized.ts  (re-exported from the architecture spec's shared types)
export interface LocalizedString {
  en: string;
  fa: string;
}
export type Lang = 'en' | 'fa';
```

---

## 1. Languages, Defaults & Detection

- **Supported languages:** `en` (English, LTR) and `fa` (Persian/Farsi, RTL). These are the only two. The type `Lang = 'en' | 'fa'` is the single source of truth; never use a bare `string` for a language.
- **Fallback language:** `en`.
- **Default on first run:** detect from `navigator.language` — if it starts with `fa`, use `fa`; otherwise `en`. After first run, the user's explicit choice always wins and is persisted.
- **Persistence:** the chosen language is stored by the **settings store** (zustand + persist, key `sgw:settings`, IndexedDB via idb-keyval). i18next is *driven by* that store — the store is the source of truth, not i18next's own detector/localStorage. See §3.4.
- **No per-game language.** Language is global. A game's content always renders in the globally active language with fallback to the other language if a content field is empty (see §6.4).

---

## 2. File & Folder Layout

```
src/
  i18n/
    index.ts                 # i18next init + typed t(); exports `i18n` instance
    config.ts                # constants: SUPPORTED_LANGS, DEFAULT_LANG, FALLBACK_LANG, namespaces
    detect.ts                # detectInitialLang(): reads store, else navigator.language
    dir.ts                   # applyDocumentDir(lang): sets <html dir/lang>; dirFor(lang)
    format.ts                # locale-aware number/date/list/duration formatters
    resources.ts             # eager import.meta.glob of all catalog JSON -> i18next resources
    react-i18next.d.ts       # module augmentation -> typed keys + typed `t`
    locales/
      en/
        common.json          # shared chrome: actions, generic words, units
        settings.json        # settings screen
        home.json            # home grid / cards chrome
        roster.json          # players / groups setup
        errors.json          # error + toast messages
        games.json           # per-game DISPLAY chrome that is generic (see note §5.4)
      fa/
        common.json
        settings.json
        home.json
        roster.json
        errors.json
        games.json
  sdk/
    content/
      localized.ts           # useLocalized(), resolveLocalized(), pickLang()
      deckTypes.ts           # ALL content interfaces (this spec, §6–§9)
      deckSchema.ts          # runtime validators + version constants
      customDecks.ts         # custom-deck store hooks + idb-keyval persistence
    types/
      localized.ts           # LocalizedString, Lang (shared primitive)
  games/
    <id>/
      content/*.json         # ships with the game; conforms to deckTypes
```

**Responsibilities:**

| File | Responsibility |
|---|---|
| `i18n/index.ts` | Create & init the i18next instance once; export it; wire `initReactI18next`. |
| `i18n/config.ts` | Pure constants + the `Namespace` union. No runtime logic. |
| `i18n/detect.ts` | `detectInitialLang()` pure-ish helper used at boot before the store hydrates. |
| `i18n/dir.ts` | DOM side-effects to flip direction; `dirFor(lang)` pure mapping. |
| `i18n/format.ts` | All `Intl`-based formatting wrappers. The **only** place `Intl` is constructed. |
| `i18n/resources.ts` | Glob-load every `locales/**/**.json` into the i18next `resources` object so adding a namespace/locale file needs no registration edit. |
| `i18n/react-i18next.d.ts` | TS module augmentation giving autocomplete + compile errors on bad keys. |
| `sdk/content/localized.ts` | Resolve a `LocalizedString`/localized object to the active language with fallback. |
| `sdk/content/deckTypes.ts` | The content interfaces every game and the deck editor share. |
| `sdk/content/deckSchema.ts` | Lightweight runtime validation + migration version constants. |
| `sdk/content/customDecks.ts` | CRUD + persistence for user-created decks. |

---

## 3. i18next + react-i18next Setup

### 3.1 Namespaces

Catalogs are split into **namespaces** (one JSON file each) for lazy-friendliness and to keep keys short:

```ts
// src/i18n/config.ts
import type { Lang } from '../sdk/types/localized';

export const SUPPORTED_LANGS = ['en', 'fa'] as const;
export const DEFAULT_LANG: Lang = 'en';
export const FALLBACK_LANG: Lang = 'en';

export const NAMESPACES = [
  'common',
  'settings',
  'home',
  'roster',
  'errors',
  'games',
] as const;
export type Namespace = (typeof NAMESPACES)[number];
export const DEFAULT_NS: Namespace = 'common';

export const RTL_LANGS = new Set<Lang>(['fa']);
```

### 3.2 Resource auto-loading (no per-file registration)

```ts
// src/i18n/resources.ts
import type { Resource } from 'i18next';

// Vite eager glob: every locale JSON is bundled and keyed by path.
const modules = import.meta.glob('./locales/*/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>;

// Build i18next `resources`: { en: { common: {...}, settings: {...} }, fa: {...} }
export const resources: Resource = Object.entries(modules).reduce((acc, [path, mod]) => {
  // path like './locales/en/common.json'
  const m = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
  if (!m) return acc;
  const [, lng, ns] = m;
  (acc[lng] ??= {})[ns] = mod.default;
  return acc;
}, {} as Resource);
```

> **Adding a namespace = drop a new JSON file in every locale folder + add its name to `NAMESPACES`.** No edits to `index.ts`. (Two touch-points by design: the glob picks up the file, the `NAMESPACES` union keeps it type-safe.)

### 3.3 Init

```ts
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';
import { DEFAULT_NS, FALLBACK_LANG, NAMESPACES } from './config';
import { detectInitialLang } from './detect';

void i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLang(),
  fallbackLng: FALLBACK_LANG,
  ns: NAMESPACES as unknown as string[],
  defaultNS: DEFAULT_NS,
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,                     // missing -> key string, never null
  react: { useSuspense: false },         // we hydrate synchronously from bundle
});

export default i18n;
```

`main.tsx` imports the instance for its side-effect **before** rendering:

```ts
// src/main.tsx (addition)
import './i18n';            // initialises i18next
import { applyDocumentDir } from './i18n/dir';
import i18n from './i18n';
applyDocumentDir(i18n.language as Lang); // set <html dir/lang> on boot
```

### 3.4 Single source of truth: settings store ↔ i18next

The settings store owns `lang`. Changing language is one action that updates the store, i18next, and the DOM together:

```ts
// inside the settings store (spec 0x defines the store; this is the language slice)
setLang: (lang: Lang) => {
  set({ lang });
  void i18n.changeLanguage(lang);   // re-renders all useTranslation consumers
  applyDocumentDir(lang);           // flips <html dir> + lang
}
```

On store **rehydration** (persist `onRehydrateStorage`), call `setLang(persisted.lang)` once so i18next + DOM match the restored value. `detectInitialLang()` (below) gives a correct value for the very first paint before the async store hydrates, preventing a flash of English for Persian users.

```ts
// src/i18n/detect.ts
import { SUPPORTED_LANGS, DEFAULT_LANG } from './config';
import type { Lang } from '../sdk/types/localized';

export function detectInitialLang(): Lang {
  // Synchronous best-effort for first paint. The persisted store, once
  // hydrated, overrides this via setLang().
  try {
    const raw = localStorage.getItem('sgw:lang-hint'); // tiny synchronous hint mirror
    if (raw && (SUPPORTED_LANGS as readonly string[]).includes(raw)) return raw as Lang;
  } catch { /* ignore */ }
  const nav = navigator.language?.toLowerCase() ?? '';
  return nav.startsWith('fa') ? 'fa' : DEFAULT_LANG;
}
```

> `sgw:lang-hint` is a **synchronous mirror** of the chosen language written by `setLang` (one `localStorage.setItem`). It exists only to avoid the first-paint flash, because idb-keyval (IndexedDB) is async. The authoritative copy stays in the zustand persisted store.

### 3.5 Typed keys (compile-time safety)

```ts
// src/i18n/react-i18next.d.ts
import 'react-i18next';
import type common from './locales/en/common.json';
import type settings from './locales/en/settings.json';
import type home from './locales/en/home.json';
import type roster from './locales/en/roster.json';
import type errors from './locales/en/errors.json';
import type games from './locales/en/games.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      settings: typeof settings;
      home: typeof home;
      roster: typeof roster;
      errors: typeof errors;
      games: typeof games;
    };
  }
}
```

This makes `t('common.next')` autocomplete and `t('common.nope')` a **type error**. `en` is used as the canonical key shape; `fa` must mirror it (enforced by the lint check in §11).

---

## 4. Catalog Key Naming Conventions

- **Namespace = file.** Inside a file, **nested objects** group by feature, never flat dotted keys in the JSON itself. i18next addresses them with dots: `t('settings.theme.dark')`.
- **camelCase** segment names. No spaces, no kebab.
- **Leaf values only** are strings. Reuse generic verbs from `common` (e.g. `common.actions.next`) instead of duplicating "Next" per screen.
- **Interpolation** uses `{{name}}` double-braces. Document each variable in a comment-free convention: variable names are camelCase and stable across locales.
- **Pluralization** uses i18next's suffix rules. English has `_one`/`_other`; **Persian uses only `_other`** (Persian has no grammatical plural agreement of this kind — a single form is correct). i18next picks the right key via `Intl.PluralRules`.

Example `common.json` (English):

```json
{
  "appName": "Party Games",
  "actions": {
    "next": "Next",
    "back": "Back",
    "start": "Start",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "confirm": "Confirm",
    "passPhone": "Pass the phone",
    "iAmReady": "I'm ready",
    "reveal": "Reveal",
    "hide": "Hide"
  },
  "units": {
    "seconds_one": "{{count}} second",
    "seconds_other": "{{count}} seconds",
    "players_one": "{{count}} player",
    "players_other": "{{count}} players"
  },
  "language": { "en": "English", "fa": "فارسی" }
}
```

Same file in Persian (`fa/common.json`) — note plural keys collapse to `_other`:

```json
{
  "appName": "بازی‌های مهمونی",
  "actions": {
    "next": "بعدی",
    "back": "قبلی",
    "start": "شروع",
    "cancel": "لغو",
    "save": "ذخیره",
    "delete": "حذف",
    "confirm": "تأیید",
    "passPhone": "گوشی رو رد کن",
    "iAmReady": "آماده‌ام",
    "reveal": "نمایش",
    "hide": "پنهان کن"
  },
  "units": {
    "seconds_other": "{{count}} ثانیه",
    "players_other": "{{count}} بازیکن"
  },
  "language": { "en": "English", "fa": "فارسی" }
}
```

Usage:

```tsx
const { t } = useTranslation(); // defaultNS = 'common'
t('actions.next');
t('units.players', { count: n });          // auto plural
const { t: ts } = useTranslation('settings');
ts('theme.title');
```

---

## 5. RTL: Direction Flipping & Rules

### 5.1 Document direction

Direction is driven by language, set on `<html>`:

```ts
// src/i18n/dir.ts
import { RTL_LANGS } from './config';
import type { Lang } from '../sdk/types/localized';

export const dirFor = (lang: Lang): 'rtl' | 'ltr' => (RTL_LANGS.has(lang) ? 'rtl' : 'ltr');

export function applyDocumentDir(lang: Lang): void {
  const el = document.documentElement;
  el.setAttribute('lang', lang);
  el.setAttribute('dir', dirFor(lang));
}
```

Called from `setLang` and once at boot. **Never** set `dir` on inner containers except for the rare mixed-direction island (§5.5). Tailwind v4's `rtl:`/`ltr:` variants and logical utilities key off the inherited `dir`.

### 5.2 Tailwind v4: logical utilities are mandatory

This project has **no `tailwind.config.js`**; tokens are declared with `@theme` in CSS and RTL is handled purely with logical utilities + variants. **Hard rules:**

| Forbidden (physical) | Use instead (logical) |
|---|---|
| `ml-* / mr-*` | `ms-* / me-*` |
| `pl-* / pr-*` | `ps-* / pe-*` |
| `left-* / right-*` | `start-* / end-*` |
| `text-left / text-right` | `text-start / text-end` |
| `rounded-l-* / rounded-r-*` | `rounded-s-* / rounded-e-*` |
| `border-l-* / border-r-*` | `border-s-* / border-e-*` |
| `float-left / float-right` | `float-start / float-end` |
| `inset-l/r`, `scroll-ml/mr` | `inset-s/e`, `scroll-ms/me` |

Where a genuine **physical** direction is needed (rare — e.g. a drop shadow that should always fall the same way), it is allowed but must be commented `/* physical: intentional, not direction-aware */`.

For the handful of cases that truly differ by direction, use the variants:

```tsx
// a chevron that points "forward" in reading order
<Chevron className="rtl:-scale-x-100" />
```

### 5.3 Icon & glyph mirroring

Mirror only icons that encode **reading/temporal direction**; never mirror icons with intrinsic meaning.

**Mirror in RTL** (apply `rtl:-scale-x-100`): back/forward arrows, chevrons, next/previous, undo/redo, list-indent, send/share arrow, progress bars, sliders, carets, "skip" arrows, reply.

**Do NOT mirror:** logos, brand marks, media play ▶ (play always points the same way), checkmarks, clocks, magnifier (search), most emoji, dice, numbers, phone/camera, volume, anything photographic.

Provide a tiny helper class in `index.css`:

```css
/* src/index.css */
@layer utilities {
  /* attach to directional glyphs; mirrors automatically under [dir=rtl] */
  .icon-directional:where([dir='rtl'] *) { transform: scaleX(-1); }
}
```

…or just use the Tailwind `rtl:-scale-x-100` variant inline — both are acceptable; prefer the variant for one-offs and the class for shared icon components.

### 5.4 Numbers, dates, durations & digit shaping

All formatting goes through `i18n/format.ts`. **Persian uses Persian (Eastern Arabic-Indic) digits** by default via the `fa` locale's `Intl` output. Timers, scores, counts, and dates must use these helpers — never string-concatenate raw numbers into Persian UI.

```ts
// src/i18n/format.ts
import type { Lang } from '../sdk/types/localized';

const LOCALE: Record<Lang, string> = { en: 'en-US', fa: 'fa-IR' };

export const fmtNumber = (n: number, lang: Lang) =>
  new Intl.NumberFormat(LOCALE[lang]).format(n);

// mm:ss timer — build parts as numbers then localize digits, keep ASCII colon.
export function fmtClock(totalSeconds: number, lang: Lang): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const mm = fmtNumber(m, lang);
  const ss = new Intl.NumberFormat(LOCALE[lang], {
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(s);
  return `${mm}:${ss}`;
}

export const fmtDate = (d: Date | number, lang: Lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], { dateStyle: 'medium' }).format(d);

export const fmtList = (items: string[], lang: Lang) =>
  new Intl.ListFormat(LOCALE[lang], { style: 'long', type: 'conjunction' }).format(items);
```

> **`fa-IR` Intl notes:** dates render in the **Persian (Jalali) calendar** automatically — good, that's expected. Digits come out as ۰۱۲۳۴۵۶۷۸۹. If a specific surface needs Latin digits in Persian mode (e.g. a phone number), pass `'fa-IR-u-nu-latn'` explicitly — document it at the call site. Keep the `:` separator ASCII in clocks; do not localize the separator.

A convenience hook binds the active language so components don't pass `lang` everywhere:

```ts
// inside sdk/content/localized.ts
import { useTranslation } from 'react-i18next';
import * as fmt from '../../i18n/format';
export function useFormat() {
  const lang = useTranslation().i18n.language as Lang;
  return {
    number: (n: number) => fmt.fmtNumber(n, lang),
    clock: (s: number) => fmt.fmtClock(s, lang),
    date: (d: Date | number) => fmt.fmtDate(d, lang),
    list: (xs: string[]) => fmt.fmtList(xs, lang),
  };
}
```

### 5.5 Mixed-direction islands (bidi)

When Persian UI must embed an LTR token (a brand name, a code, an English word in a custom deck), wrap it so the surrounding RTL doesn't reorder it:

```tsx
<bdi>{value}</bdi>                 // isolates neutral/strong-LTR runs
// or, for a forced direction container:
<span dir="ltr" className="inline-block">{latinToken}</span>
```

Use `<bdi>` for user-generated content of unknown direction (custom deck cards, player names). This prevents the classic "punctuation jumps to the wrong end" bug.

### 5.6 RTL pitfalls checklist (must be verified per screen)

1. **No physical margin/padding/position utilities** (§5.2). Lint rule in §11.
2. **Flex/grid order**: visual order follows `dir` automatically; do **not** hard-code `flex-row-reverse` to "fix" RTL — that double-flips. Only use `*-reverse` when the order should differ from reading order in *both* directions.
3. **Transforms/translate animations** (framer-motion): a slide-in-from-right must become slide-in-from-left in RTL. Derive the sign from `dirFor(lang)`:
   ```tsx
   const sign = dirFor(lang) === 'rtl' ? -1 : 1;
   <motion.div initial={{ x: 24 * sign }} animate={{ x: 0 }} />
   ```
   Physical `x` in framer-motion is **not** direction-aware — this is the #1 animation pitfall.
4. **Shadows/gradients** that imply light direction: usually keep physical (comment them).
5. **Input carets & placeholders**: rely on inherited `dir`; for numeric inputs that should stay LTR even in Persian, set `dir="ltr"` + `text-end`.
6. **Icons**: mirror only directional ones (§5.3).
7. **Scroll & swipe**: horizontal carousels invert; framer-motion drag constraints must swap sign in RTL.
8. **`<bdi>` around user/content tokens** (§5.5).
9. **Numbers** via `fmt.*` only (§5.4).
10. **Truncation/ellipsis** works with logical props; verify `text-overflow` containers use `text-start`.

---

## 6. Content Model — Shared Primitives

### 6.1 `LocalizedString` and localized resolution

```ts
// src/sdk/content/localized.ts
import { useTranslation } from 'react-i18next';
import type { Lang, LocalizedString } from '../types/localized';

/** Pick a single language's text, falling back to the other if empty. */
export function resolveLocalized(ls: LocalizedString, lang: Lang): string {
  const primary = ls[lang]?.trim();
  if (primary) return primary;
  const other: Lang = lang === 'en' ? 'fa' : 'en';
  return ls[other] ?? '';
}

/** React hook bound to the active language. */
export function useLocalized() {
  const lang = useTranslation().i18n.language as Lang;
  return (ls: LocalizedString) => resolveLocalized(ls, lang);
}
```

> Content rendering uses `useLocalized()`, **never** `t()`. This is the firewall between the two domains (§0).

### 6.2 Shared content enums & metadata

Every deck and every item carries bilingual metadata so they can be filtered, color-coded on cards, and balanced by the engine.

```ts
// src/sdk/content/deckTypes.ts
import type { LocalizedString } from '../types/localized';

/** Difficulty for word/guessing-style content. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Intensity for prompt/party content (how spicy / personal). */
export type Intensity = 'chill' | 'medium' | 'wild';

/** Stable category id; label is bilingual & lives in the deck's `categories`. */
export type CategoryId = string; // slug, e.g. "movies", "deep", "couples"

/** A bilingual category definition referenced by item.categoryId. */
export interface Category {
  id: CategoryId;
  label: LocalizedString;
  /** Optional emoji/color for colorful cards. */
  emoji?: string;
  color?: string; // token name or hex; used by Home card theming
}

/** Common envelope every shipped/custom deck shares. */
export interface DeckMeta {
  /** Globally unique. Shipped decks: "<gameId>:<slug>". Custom: "custom:<uuid>". */
  id: string;
  /** Which game type the deck feeds (matches a GameManifest.id). */
  gameId: string;
  /** Deck content kind — discriminates the union (§6.3). */
  kind: DeckKind;
  /** Schema version for migrations (§10). */
  schemaVersion: number;
  title: LocalizedString;
  description?: LocalizedString;
  /** Bilingual categories available within this deck. */
  categories: Category[];
  /** Language coverage flags — true if that language is fully authored. */
  coverage: { en: boolean; fa: boolean };
  /** Custom decks only. */
  source: 'builtin' | 'custom';
  author?: string;       // display name or supabase user id for custom
  createdAt?: string;    // ISO 8601, custom only
  updatedAt?: string;    // ISO 8601, custom only
}

export type DeckKind =
  | 'wordDeck'
  | 'promptDeck'
  | 'locationsDeck'
  | 'mafiaRolesDeck';
```

### 6.3 The Deck discriminated union

```ts
export type Deck =
  | WordDeck
  | PromptDeck
  | LocationsDeck
  | MafiaRolesDeck;

export interface WordDeck extends DeckMeta {
  kind: 'wordDeck';
  items: WordItem[];
}
export interface PromptDeck extends DeckMeta {
  kind: 'promptDeck';
  items: PromptItem[];
}
export interface LocationsDeck extends DeckMeta {
  kind: 'locationsDeck';
  items: LocationItem[];
}
export interface MafiaRolesDeck extends DeckMeta {
  kind: 'mafiaRolesDeck';
  items: MafiaRoleItem[];
}
```

### 6.4 Fallback & coverage rules

- An item field that is empty (`""`) in the active language falls back to the other language via `resolveLocalized` (§6.1).
- `DeckMeta.coverage` is computed at author/import time: `fa: items.every(i => i.text.fa.trim() !== '')` (analogous per kind). Decks with incomplete coverage are still usable (fallback) but can be visually flagged and filtered ("Persian-ready only").
- The engine should **prefer** items where the active language is non-empty when a deck is mixed, but must never crash on a missing field.

---

## 7. Word Decks (e.g. charades / "Dowr"-style guessing)

A word item is a single guessable term plus optional taboo/hint metadata.

```ts
export interface WordItem {
  id: string;                 // unique within deck (slug or uuid)
  text: LocalizedString;      // the word to guess
  categoryId: CategoryId;
  difficulty: Difficulty;
  /** Optional forbidden words (taboo-style); each bilingual. */
  taboo?: LocalizedString[];
  /** Optional hint shown after a skip / for accessibility. */
  hint?: LocalizedString;
}
```

Example shipped file `src/games/charades/content/movies.en-fa.json`:

```json
{
  "id": "charades:movies",
  "gameId": "charades",
  "kind": "wordDeck",
  "schemaVersion": 1,
  "source": "builtin",
  "coverage": { "en": true, "fa": true },
  "title": { "en": "Movies", "fa": "فیلم‌ها" },
  "description": { "en": "Famous films", "fa": "فیلم‌های معروف" },
  "categories": [
    { "id": "classics", "label": { "en": "Classics", "fa": "کلاسیک" }, "emoji": "🎬" },
    { "id": "animation", "label": { "en": "Animation", "fa": "انیمیشن" }, "emoji": "🧸" }
  ],
  "items": [
    {
      "id": "titanic",
      "text": { "en": "Titanic", "fa": "تایتانیک" },
      "categoryId": "classics",
      "difficulty": "easy"
    },
    {
      "id": "the-lion-king",
      "text": { "en": "The Lion King", "fa": "شیرشاه" },
      "categoryId": "animation",
      "difficulty": "medium",
      "taboo": [
        { "en": "Simba", "fa": "سیمبا" },
        { "en": "Disney", "fa": "دیزنی" }
      ],
      "hint": { "en": "An African savanna", "fa": "ساوانای آفریقا" }
    }
  ]
}
```

> **File-name convention** for shipped content: `<slug>.en-fa.json` (or just `<slug>.json`) under the game's `content/`. The deck registry uses `import.meta.glob('./content/*.json', { eager: true })` inside the game's `index.ts` — adding a deck = drop a JSON file, no code edit (mirrors the game registry convention).

---

## 8. Prompt Decks (e.g. "Never Have I Ever", "Truth or Dare", "Most Likely To")

A prompt is a sentence/question, optionally with a `type` (e.g. truth/dare) and an `intensity`.

```ts
export type PromptType = 'statement' | 'question' | 'truth' | 'dare' | 'task' | 'vote';

export interface PromptItem {
  id: string;
  text: LocalizedString;          // the prompt itself
  type: PromptType;
  categoryId: CategoryId;
  intensity: Intensity;
  /** Optional: minimum players for which this prompt makes sense. */
  minPlayers?: number;
  /** Optional template vars resolved by engine, e.g. "{{player}}". */
  vars?: Array<'player' | 'otherPlayer' | 'group'>;
}
```

Example `src/games/nhie/content/party.en-fa.json`:

```json
{
  "id": "nhie:party",
  "gameId": "nhie",
  "kind": "promptDeck",
  "schemaVersion": 1,
  "source": "builtin",
  "coverage": { "en": true, "fa": true },
  "title": { "en": "Party", "fa": "مهمونی" },
  "categories": [
    { "id": "general", "label": { "en": "General", "fa": "عمومی" }, "emoji": "🎉" },
    { "id": "deep", "label": { "en": "Deep", "fa": "عمیق" }, "emoji": "💭" }
  ],
  "items": [
    {
      "id": "nhie-overslept",
      "text": { "en": "Never have I ever overslept and missed a flight.",
                "fa": "هیچ‌وقت اونقد نخوابیدم که پروازمو از دست بدم." },
      "type": "statement",
      "categoryId": "general",
      "intensity": "chill"
    },
    {
      "id": "nhie-texted-ex",
      "text": { "en": "Never have I ever texted {{player}} by mistake.",
                "fa": "هیچ‌وقت اشتباهی به {{player}} پیام ندادم." },
      "type": "statement",
      "categoryId": "deep",
      "intensity": "medium",
      "vars": ["player"]
    }
  ]
}
```

> `{{player}}`-style vars in **content** are resolved by the **engine** (it substitutes a roster name as a `<bdi>`-wrapped token), NOT by i18next interpolation. This keeps content data engine-agnostic and reusable.

---

## 9. Locations + Roles (Spyfall-style) and Mafia Roles

### 9.1 Locations deck

Each location has a name, a set of roles, and a category/intensity. One player is the spy (no location); others get a role at that location.

```ts
export interface LocationRole {
  id: string;
  name: LocalizedString;          // e.g. "Pilot"
  description?: LocalizedString;   // optional flavor / hint
}

export interface LocationItem {
  id: string;
  name: LocalizedString;          // the location, e.g. "Airport"
  categoryId: CategoryId;
  intensity?: Intensity;          // optional (some location sets are "spicy")
  roles: LocationRole[];          // 3..N roles; engine deals one per non-spy
}
```

Example `src/games/spyfall/content/places.en-fa.json`:

```json
{
  "id": "spyfall:places",
  "gameId": "spyfall",
  "kind": "locationsDeck",
  "schemaVersion": 1,
  "source": "builtin",
  "coverage": { "en": true, "fa": true },
  "title": { "en": "Everyday Places", "fa": "مکان‌های روزمره" },
  "categories": [
    { "id": "public", "label": { "en": "Public", "fa": "عمومی" }, "emoji": "🏙️" }
  ],
  "items": [
    {
      "id": "airport",
      "name": { "en": "Airport", "fa": "فرودگاه" },
      "categoryId": "public",
      "roles": [
        { "id": "pilot",   "name": { "en": "Pilot",   "fa": "خلبان" } },
        { "id": "steward", "name": { "en": "Flight Attendant", "fa": "مهماندار" } },
        { "id": "security","name": { "en": "Security Officer",  "fa": "مأمور امنیتی" } },
        { "id": "traveler","name": { "en": "Traveler", "fa": "مسافر" } }
      ]
    }
  ]
}
```

### 9.2 Mafia roles deck

Mafia roles are a deck of role cards with a faction/alignment, an action, and balancing hints. The engine composes a *role set* from these based on player count.

```ts
export type Alignment = 'town' | 'mafia' | 'neutral';

export interface MafiaRoleItem {
  id: string;
  name: LocalizedString;          // "Detective"
  alignment: Alignment;
  /** Short explanation shown on the secret reveal card. */
  description: LocalizedString;
  /** One-line night/day ability summary. */
  ability?: LocalizedString;
  categoryId: CategoryId;         // e.g. "core", "advanced"
  intensity?: Intensity;          // chaos level
  /** Balancing hints for the engine's role-set builder. */
  unique?: boolean;               // at most one in a game (default true for power roles)
  minPlayers?: number;            // only include at/above this count
  weight?: number;                // relative likelihood when filling slots
}
```

Example `src/games/mafia/content/roles.core.en-fa.json`:

```json
{
  "id": "mafia:core",
  "gameId": "mafia",
  "kind": "mafiaRolesDeck",
  "schemaVersion": 1,
  "source": "builtin",
  "coverage": { "en": true, "fa": true },
  "title": { "en": "Core Roles", "fa": "نقش‌های اصلی" },
  "categories": [
    { "id": "core", "label": { "en": "Core", "fa": "اصلی" }, "emoji": "🔪" }
  ],
  "items": [
    {
      "id": "godfather",
      "name": { "en": "Godfather", "fa": "پدرخوانده" },
      "alignment": "mafia",
      "description": { "en": "Leads the mafia. Appears innocent to the Detective.",
                       "fa": "رهبر مافیا. برای کارآگاه بی‌گناه به‌نظر می‌رسد." },
      "ability": { "en": "Choose the night kill.", "fa": "انتخاب قربانی شب." },
      "categoryId": "core",
      "intensity": "medium",
      "unique": true,
      "minPlayers": 6,
      "weight": 1
    },
    {
      "id": "detective",
      "name": { "en": "Detective", "fa": "کارآگاه" },
      "alignment": "town",
      "description": { "en": "Each night, investigate one player's alignment.",
                       "fa": "هر شب وابستگی یک بازیکن را بررسی می‌کند." },
      "categoryId": "core",
      "unique": true,
      "weight": 1
    },
    {
      "id": "citizen",
      "name": { "en": "Citizen", "fa": "شهروند" },
      "alignment": "town",
      "description": { "en": "No special ability. Find the mafia by reasoning.",
                       "fa": "بدون توانایی ویژه. با استدلال مافیا را پیدا کن." },
      "categoryId": "core",
      "unique": false,
      "weight": 5
    }
  ]
}
```

---

## 10. Custom (User-Created) Decks

Users can author their own decks for any game/kind, fully offline, and (when signed in) sync them. Custom decks are **structurally identical** to shipped decks (same `Deck` union) with `source: 'custom'`, a `custom:<uuid>` id, author + timestamps.

### 10.1 Storage

- **Local-first:** stored in IndexedDB via `idb-keyval` under a single key `sgw:customDecks` holding `Record<deckId, Deck>` (plus an index for ordering). Also surfaced through a zustand store for reactivity.
- **No edits to shared files** when a custom deck is added — it's pure data.
- Custom decks merge into the deck list a game sees: `[...builtinDecks(gameId), ...customDecks(gameId)]`.

### 10.2 Store & API

```ts
// src/sdk/content/customDecks.ts
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { Deck, DeckKind } from './deckTypes';

const KEY = 'sgw:customDecks';

export interface CustomDeckState {
  decks: Record<string, Deck>;          // id -> deck
  order: string[];                      // display order
  load: () => Promise<void>;
  upsert: (deck: Deck) => Promise<void>;
  remove: (id: string) => Promise<void>;
  forGame: (gameId: string, kind?: DeckKind) => Deck[];
  duplicate: (id: string) => Promise<string>; // returns new id
}

// Validation (see §10.4) runs inside upsert; invalid decks are rejected.
```

A new custom deck is created by the **deck editor screen** (separate UI spec) which builds a `Deck` object and calls `upsert`. The editor enforces: at least one item, each item has at least one non-empty language for required text fields, valid `categoryId` references, and a chosen `kind` + `gameId`.

### 10.3 ID & integrity rules

- `id = "custom:" + crypto.randomUUID()`.
- `schemaVersion` set to the current `DECK_SCHEMA_VERSION` constant.
- `coverage` recomputed on every `upsert`.
- `updatedAt` bumped on every `upsert`; `createdAt` set once.
- Importing a shipped deck "to customize" = duplicate → new `custom:` id, `source:'custom'`, copy items.

### 10.4 Runtime validation & migration

```ts
// src/sdk/content/deckSchema.ts
import type { Deck } from './deckTypes';

export const DECK_SCHEMA_VERSION = 1;

export interface ValidationResult { ok: boolean; errors: string[] }

/** Structural validation used on import / custom upsert / sync-pull. */
export function validateDeck(input: unknown): ValidationResult { /* … */ return { ok: true, errors: [] }; }

/** Forward-migrate older decks to DECK_SCHEMA_VERSION. */
export function migrateDeck(deck: Deck): Deck { /* switch on deck.schemaVersion */ return deck; }
```

Validation is lightweight hand-written checks (no heavy schema lib) verifying: required envelope fields, `kind` matches item shape, every `item.categoryId` exists in `categories`, ids unique within the deck, and at least one language present per required localized field. Shipped decks are validated in tests (CI), custom/imported decks at runtime.

---

## 11. Lint, Tests & Tooling

- **ESLint rule** (`no-restricted-syntax` / a small custom rule) forbids physical Tailwind utilities in `className` strings: `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `rounded-l-`, `rounded-r-`, `border-l-`, `border-r-`, `float-left`, `float-right`. Exception: lines annotated `/* physical: ... */`.
- **Catalog parity test (vitest):** assert `keysOf(en/<ns>.json)` deep-equals `keysOf(fa/<ns>.json)` for every namespace (ignoring leaf values), and that Persian has no `_one` keys that English lacks. Fails CI on drift.
- **Content schema test (vitest):** glob all `src/games/*/content/*.json`, run `validateDeck`; assert `coverage` flags are accurate; assert no duplicate deck ids globally.
- **RTL smoke test:** render a representative screen with `dir=rtl`, assert no element has computed `margin-left/right` from a static class (best-effort) and that the `<html dir>` flips when `setLang('fa')` is dispatched.
- **Format tests:** `fmtClock(65,'fa')` → `'۱:۰۵'`; `fmtClock(65,'en')` → `'1:05'`; `fmtNumber(1000,'fa')` uses Persian digits + grouping.

---

## 12. Supabase Table Shapes (for later cloud sync)

Sign-in is **optional**; the app is fully functional offline/signed-out. These tables back the eventual sync of **custom content**, **stats**, and **saved groups**. All localized text is stored as `jsonb` `{ "en": "...", "fa": "..." }`. RLS: every row keyed by `user_id = auth.uid()`.

### 12.1 `profiles`
```sql
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  pref_lang    text check (pref_lang in ('en','fa')) default 'en',
  created_at   timestamptz default now()
);
```

### 12.2 `custom_decks`  (mirrors the `Deck` envelope; items in a child table or inline jsonb)
```sql
create table custom_decks (
  id             text primary key,           -- "custom:<uuid>" (matches local id)
  user_id        uuid not null references auth.users(id) on delete cascade,
  game_id        text not null,
  kind           text not null check (kind in
                   ('wordDeck','promptDeck','locationsDeck','mafiaRolesDeck')),
  schema_version int  not null default 1,
  title          jsonb not null,             -- LocalizedString
  description    jsonb,
  categories     jsonb not null default '[]',-- Category[]
  items          jsonb not null default '[]',-- WordItem[] | PromptItem[] | ...
  coverage       jsonb not null default '{"en":false,"fa":false}',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
-- RLS: user can CRUD only own rows.
create index on custom_decks (user_id, game_id, kind);
```
> `items` stored inline as `jsonb` (decks are small, < few KB). Sync = last-write-wins on `updated_at`; the local `Deck` ↔ row mapping is 1:1 by `id`.

### 12.3 `saved_groups`  (reused player rosters / favorite groups)
```sql
create table saved_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,                 -- plain text (user's own words)
  players     jsonb not null default '[]',   -- [{ id, name, emoji?, color? }]
  is_favorite boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index on saved_groups (user_id, is_favorite);
```
> Player `name` is free text (not `LocalizedString`) — it's whatever the user typed; rendered inside `<bdi>` (§5.5) so mixed-script names lay out correctly.

### 12.4 `game_stats`  (per-user aggregate stats)
```sql
create table game_stats (
  user_id     uuid not null references auth.users(id) on delete cascade,
  game_id     text not null,
  plays       int  not null default 0,
  last_played timestamptz,
  -- flexible per-game metrics: { "wins": n, "fastestSeconds": n, ... }
  metrics     jsonb not null default '{}',
  updated_at  timestamptz default now(),
  primary key (user_id, game_id)
);
```

### 12.5 Sync semantics
- **Pull on sign-in**, **push on change** (debounced). Conflict resolution: **last-write-wins** by `updated_at` per row.
- Pulled `custom_decks` are run through `validateDeck` + `migrateDeck` before entering the local store (§10.4) — never trust remote shape.
- `game_stats.metrics` and `saved_groups.players` are intentionally schemaless `jsonb` so individual games can record their own numbers without a schema migration (mirrors the modularity principle: adding a game never edits shared infra).
- Local IDs and Supabase IDs are identical for decks (`custom:<uuid>`) so a deck synced from another device de-dupes naturally.

---

## 13. Implementation Checklist (this spec)

1. Create `src/sdk/types/localized.ts` (`LocalizedString`, `Lang`) — or re-export from architecture spec's shared types.
2. Create `src/i18n/{config,resources,detect,dir,format,index}.ts` and `react-i18next.d.ts`.
3. Create `src/i18n/locales/{en,fa}/{common,settings,home,roster,errors,games}.json` with mirrored keys.
4. Import `./i18n` + call `applyDocumentDir` in `main.tsx`.
5. Wire `setLang` into the settings store (store is source of truth; write `sgw:lang-hint` mirror).
6. Create `src/sdk/content/{localized,deckTypes,deckSchema,customDecks}.ts`.
7. Add the per-game `content/*.json` glob loader in the game registry / each game's `index.ts`.
8. Add ESLint physical-utility rule + the parity/content/format vitest suites.
9. (Later) Provision Supabase tables §12 + RLS; implement debounced push / sign-in pull through `validateDeck`.

**Done when:** switching language flips `<html dir>`, all chrome translates, Persian shows Persian digits/Jalali dates, every shipped deck passes `validateDeck`, catalog parity test is green, and a user can create + reuse a custom deck offline.
