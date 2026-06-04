# Spec 03 — App Shell & Cross-Game UX

Status: Implementable (no open questions)
Owner area: app shell, routing, providers, global screens, Game Host
Depends on: `01-architecture` (SDK types & registry), `02-sdk-engine-ui` (engine primitives + UI kit). Where this spec references a type "as defined in the architecture spec," the canonical definition is restated inline here so the shell can be built without cross-reading.
Consumed by: every `src/games/<id>/` module.

This document specifies everything between the browser and a `GameModule`: the router, the provider tree, the global Zustand stores, the Home grid, the Roster/Groups screens, the Settings screen, the optional Supabase sign-in, and the generic **Game Host** that drives `Setup -> Play -> Results` with shared chrome.

---

## 1. Scope & Non-Goals

In scope:
- Routing map (HashRouter for Capacitor).
- Provider tree (theme, i18n, stores hydration gate, error boundary, toaster, sound/haptics).
- Global stores: `settings`, `roster`, `groups`, `auth`, `session` (active game run).
- Home grid reading the auto-discovery registry; filter/sort by tags & player count.
- Roster screen (CRUD players) and saved Groups screen (save/load groups).
- Settings (theme, language, mute, reduced-motion, sign-in toggle).
- Optional Supabase sign-in (guest-first), with offline-first fallback.
- Game Host route: load a `GameModule`, build a `GameContext`, render Setup/Play/Results with shared chrome (back, pause, scoreboard, restart, exit).

Non-goals (owned by other specs):
- Individual game logic/content (`src/games/*`).
- The SDK engine primitives (`roster`, `teams`, `turnOrder`, `timer`, `deck`, `scoring`, `voting`, `revealGate`, `phaseMachine`, `results`) — implemented in `02-sdk-engine-ui`; the shell only wires them into `GameContext`.
- Tailwind token definitions and the i18n catalog file format — owned by their setup specs; this spec lists the keys it consumes.

---

## 2. Shared Types (canonical restatement)

These come from the architecture spec; restated here so the shell is buildable standalone. Defined in `src/sdk/types.ts` (do not redefine in the shell — import them).

```ts
// src/sdk/types.ts
export type Locale = 'en' | 'fa';
export interface LocalizedString { en: string; fa: string }

export type GameTag =
  | 'party' | 'word' | 'deduction' | 'drawing' | 'trivia'
  | 'team' | 'quick' | 'bluffing' | 'kids' | 'adult';

export interface PlayerCountRange { min: number; max: number; recommended?: number }

export interface GameManifest {
  id: string;                       // stable folder id, e.g. "dowr"
  name: LocalizedString;
  tagline: LocalizedString;         // one-line card subtitle
  description: LocalizedString;     // longer, shown on Setup
  /** Theme color pair used to paint the card + game chrome. */
  accent: { from: string; to: string }; // CSS color tokens or hex
  icon: string;                     // emoji or asset key for the card
  tags: GameTag[];
  players: PlayerCountRange;
  estMinutes?: number;              // for sort/badge
  version: number;                  // logic/state schema version
  /** If true, Host hides the global scoreboard chrome button. */
  hidesScoreboard?: boolean;
  /** If false, Host omits ResultsScreen and treats Play end as exit. */
  hasResults?: boolean;             // default true
}

/** Per-run configuration the Host hands to the game's pure logic. */
export interface GameConfig {
  players: Player[];                // ordered, the active roster for this run
  teams?: Team[];                   // present when game uses teams
  locale: Locale;
  options: Record<string, unknown>; // game-specific options from SetupScreen
  seed: number;                     // master RNG seed for the whole run
}

export type GamePhase = 'setup' | 'play' | 'results';

/** What a game folder default-exports. Pure logic + screens. */
export interface GameModule<S = unknown, A = unknown> {
  manifest: GameManifest;
  logic: {
    createInitialState(cfg: GameConfig): S;        // PURE
    reducer(state: S, action: A): S;               // PURE (randomness via action payload seed)
    /** Optional: derive a generic scoreboard for shared chrome. */
    selectScoreboard?(state: S, cfg: GameConfig): ScoreboardModel | null;
    /** Optional: tell the Host whether Play has finished. */
    isComplete?(state: S): boolean;
    schemaVersion: number;
  };
  screens: {
    Setup: React.ComponentType<GameScreenProps<S, A>>;
    Play: React.ComponentType<GameScreenProps<S, A>>;
    Results?: React.ComponentType<GameScreenProps<S, A>>;
  };
}

export interface ScoreboardModel {
  /** Rows already sorted for display (highest first unless ascending). */
  rows: Array<{ id: string; label: string; score: number; color?: string; emoji?: string }>;
  ascending?: boolean;
  unitLabel?: LocalizedString;
}
```

The `GameContext` and `GameScreenProps` (the runtime SDK handed to screens) are defined in §9.

---

## 3. Auto-Discovery Registry (contract the shell consumes)

The shell never imports a game directly. It imports the registry from the SDK.

```ts
// src/sdk/registry.ts  (owned by architecture/SDK spec; contract restated)
import type { GameModule } from './types';

const modules = import.meta.glob('../games/*/index.ts', { eager: true }) as
  Record<string, { default: GameModule }>;

export const GAMES: GameModule[] = Object.values(modules)
  .map(m => m.default)
  .filter(Boolean)
  .sort((a, b) => a.manifest.name.en.localeCompare(b.manifest.name.en));

export function getGame(id: string): GameModule | undefined {
  return GAMES.find(g => g.manifest.id === id);
}
```

Shell rule: **adding a game = adding a folder.** Home and Game Host both read from `GAMES`/`getGame`. No shared file is edited to add a game.

---

## 4. File List & Responsibilities

All paths under `src/`. Shell-owned files only (SDK files listed for reference are marked `[SDK]`).

```
src/
  main.tsx                         # createRoot + <Providers><RouterProvider/></Providers>
  app/
    Providers.tsx                  # composes all providers + HydrationGate + ErrorBoundary
    router.tsx                     # createHashRouter route tree (see §5)
    RootLayout.tsx                 # <Outlet/> + global Toaster + skip-link + dir wiring
    ErrorBoundary.tsx              # crash UI with "reload"/"go home"
    HydrationGate.tsx              # blocks render until persisted stores rehydrate
    NotFound.tsx                   # 404 route element
  providers/
    ThemeProvider.tsx              # applies theme class + dir to <html>; watches system
    I18nProvider.tsx               # i18next instance + dir sync; re-exports useT
    SoundProvider.tsx              # Howler init + mute wiring; exposes useSfx()
    HapticsProvider.tsx            # navigator.vibrate wrapper honoring mute/RM
  stores/
    settingsStore.ts               # theme, language, muted, reducedMotion, hasOnboarded
    rosterStore.ts                 # players CRUD
    groupsStore.ts                 # saved groups CRUD
    authStore.ts                   # guest/auth state, supabase session mirror
    sessionStore.ts                # the active game run (Host-owned ephemeral state)
    persist.ts                     # idb-keyval storage adapter for zustand/persist
  screens/
    home/
      HomeScreen.tsx               # grid + filter/sort toolbar
      GameCard.tsx                 # one colorful card
      HomeFilters.tsx             # tag chips, player-count, sort control
      useHomeFilters.ts            # derives filtered/sorted list from GAMES + filter state
    roster/
      RosterScreen.tsx             # list + add/edit players
      PlayerEditor.tsx             # modal/sheet: name, color, emoji/avatar
      PlayerChip.tsx               # reusable colored player pill
      avatarPalette.ts             # preset colors + emoji set
    groups/
      GroupsScreen.tsx             # saved groups list, save current / load
      GroupEditor.tsx              # name a group + pick members from roster
    settings/
      SettingsScreen.tsx           # theme/lang/mute/RM toggles + account section
      AccountSection.tsx           # guest banner / sign-in / sign-out
      SignInDialog.tsx             # email magic-link (Supabase) form
  host/
    GameHostScreen.tsx             # the generic Game Host route element (§8)
    GameChrome.tsx                 # top bar: back/exit, pause, scoreboard, title
    PauseSheet.tsx                 # resume / restart / how-to / exit
    ScoreboardSheet.tsx            # renders ScoreboardModel
    ConfirmExitDialog.tsx          # guards mid-game exit
    useGameRun.ts                  # builds GameContext, manages reducer state + phase
  lib/
    supabase.ts                    # lazy client factory (null if no env)
    sync.ts                        # push/pull roster+groups when authed (best-effort)
    nav.ts                         # typed route builders (routes.home(), routes.game(id))
    ids.ts                         # createId() (crypto.randomUUID)
    rng.ts                         # seed helpers (mulberry32) for Host-generated seeds
    cn.ts                          # clsx wrapper
  ui/                              # [SDK] shared UI kit (Button, Sheet, Toggle, etc.)
```

---

## 5. Routing Map

`react-router-dom` v7 with **HashRouter** (`createHashRouter`) for Capacitor `file://` compatibility. Tree defined in `src/app/router.tsx`.

| Path | Element | Purpose |
|---|---|---|
| `/` | `HomeScreen` | Game grid (default landing). |
| `/roster` | `RosterScreen` | Manage the reusable player roster. |
| `/groups` | `GroupsScreen` | Saved groups (save/load). |
| `/settings` | `SettingsScreen` | Theme/lang/mute/RM + account. |
| `/play/:gameId` | `GameHostScreen` | Generic Game Host (Setup→Play→Results). |
| `*` | `NotFound` | 404 → link back home. |

All five non-host routes are children of `RootLayout` (persistent chrome: bottom tab bar on small screens, app header). `/play/:gameId` is **also** a child of `RootLayout` but renders **full-bleed**: it hides the global bottom tab bar (immersive game mode) — `RootLayout` detects host route via `useMatch('/play/:gameId')` and suppresses the tab bar.

```ts
// src/app/router.tsx
import { createHashRouter } from 'react-router-dom';
import { RootLayout } from './RootLayout';
import { NotFound } from './NotFound';
import { HomeScreen } from '../screens/home/HomeScreen';
import { RosterScreen } from '../screens/roster/RosterScreen';
import { GroupsScreen } from '../screens/groups/GroupsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { GameHostScreen } from '../host/GameHostScreen';

export const router = createHashRouter([
  {
    element: <RootLayout />,
    errorElement: <NotFound />,        // route-level fallback
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'roster', element: <RosterScreen /> },
      { path: 'groups', element: <GroupsScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: 'play/:gameId', element: <GameHostScreen />, handle: { immersive: true } },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
```

Typed nav helpers (so screens never hand-build strings):

```ts
// src/lib/nav.ts
export const routes = {
  home: () => '/',
  roster: () => '/roster',
  groups: () => '/groups',
  settings: () => '/settings',
  game: (id: string) => `/play/${id}`,
} as const;
```

`RootLayout` reads `matches` to decide immersive mode:

```tsx
// RootLayout.tsx (sketch)
const immersive = useMatches().some(m => (m.handle as any)?.immersive);
return (
  <div dir={dir} className="min-h-dvh bg-surface text-on-surface">
    <a href="#main" className="sr-only focus:not-sr-only">{t('a11y.skipToContent')}</a>
    {!immersive && <AppHeader />}
    <main id="main" className="mx-auto w-full max-w-screen-sm">
      <Outlet />
    </main>
    {!immersive && <BottomTabBar />}
    <Toaster />
  </div>
);
```

`BottomTabBar` items: Home, Roster, Groups, Settings (uses `NavLink` with `aria-current`, logical-property spacing `ps-/pe-`, and `rtl:` mirroring of order is automatic because flex follows `dir`).

---

## 6. Provider Tree

`main.tsx` mounts providers around the router. Order matters: stores hydrate first (gate), then theme/i18n read store values.

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Providers } from './app/Providers';
import { router } from './app/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
```

```tsx
// src/app/Providers.tsx
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <HydrationGate>            {/* waits for persisted stores */}
        <I18nProvider>          {/* i18next ready + dir */}
          <ThemeProvider>       {/* html class + color-scheme */}
            <SoundProvider>     {/* Howler, honors muted */}
              <HapticsProvider>{children}</HapticsProvider>
            </SoundProvider>
          </ThemeProvider>
        </I18nProvider>
      </HydrationGate>
    </ErrorBoundary>
  );
}
```

### 6.1 HydrationGate

Zustand `persist` rehydration is async (idb-keyval). Render a splash until all persisted stores report hydrated, so the first paint already reflects saved theme/language (no flash).

```tsx
// src/app/HydrationGate.tsx
const HYDRATABLE = [settingsStore, rosterStore, groupsStore, authStore];
export function HydrationGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(() =>
    HYDRATABLE.every(s => s.persist.hasHydrated()));
  useEffect(() => {
    if (ready) return;
    const unsubs = HYDRATABLE.map(s =>
      s.persist.onFinishHydration(() => {
        if (HYDRATABLE.every(x => x.persist.hasHydrated())) setReady(true);
      }));
    // safety: also re-check immediately
    if (HYDRATABLE.every(s => s.persist.hasHydrated())) setReady(true);
    return () => unsubs.forEach(u => u());
  }, [ready]);
  return ready ? <>{children}</> : <SplashScreen />;
}
```

To avoid a theme flash before React mounts, also inline a tiny pre-paint script in `index.html` that reads the persisted theme key from IndexedDB is overkill; instead set a sensible default class server-agnostically: `index.html` ships `<html class="" data-theme-pending>` and `ThemeProvider` resolves on first effect (the splash covers the gap). Acceptable because the splash is shown until hydration.

### 6.2 ThemeProvider

Applies `light`/`dark` to `<html>` and `dir` to `<html>`. Theme source is `settingsStore.theme: 'system' | 'light' | 'dark'`.

```tsx
// src/providers/ThemeProvider.tsx
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettings(s => s.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      const root = document.documentElement;
      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light'; // native form controls
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  return <>{children}</>;
}
```

Tailwind v4 dark mode is configured (in the tokens CSS, owned by setup spec) as `@custom-variant dark (&:where(.dark, .dark *));` so the `.dark` class on `<html>` drives `dark:` utilities. This spec only requires the class be toggled as above.

### 6.3 I18nProvider

Wraps `react-i18next`'s provider, configures i18next with `en`/`fa` catalogs, and keeps `<html lang>` + `dir` in sync with `settingsStore.language`.

```tsx
// src/providers/I18nProvider.tsx
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import en from '../i18n/en.json';   // UI catalogs (owned by i18n setup spec)
import fa from '../i18n/fa.json';

let initialized = false;
function ensureInit(lng: Locale) {
  if (initialized) return;
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, fa: { translation: fa } },
    lng, fallbackLng: 'en', interpolation: { escapeValue: false },
    returnNull: false,
  });
  initialized = true;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSettings(s => s.language);
  ensureInit(language);
  useEffect(() => { void i18n.changeLanguage(language); }, [language]);
  useEffect(() => {
    const dir: 'rtl' | 'ltr' = language === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    document.documentElement.dir = dir;          // drives rtl:/ltr: variants
  }, [language]);
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
```

Helper to localize bilingual content (game `LocalizedString`s) using the current language:

```ts
// src/providers/I18nProvider.tsx (export)
export function useLocale(): Locale { return useSettings(s => s.language); }
export function useLocalize() {
  const lng = useLocale();
  return useCallback((ls: LocalizedString) => ls[lng] ?? ls.en, [lng]);
}
```

### 6.4 SoundProvider & HapticsProvider

```ts
// src/providers/SoundProvider.tsx
type SfxName = 'tap' | 'success' | 'fail' | 'reveal' | 'turn' | 'win' | 'tick';
interface SoundApi { play(name: SfxName): void; }
const SoundCtx = createContext<SoundApi>({ play: () => {} });
export const useSfx = () => useContext(SoundCtx);
```
- Lazily creates `Howl` instances on first `play`. Honors `settingsStore.muted` (early-return if muted) and respects browser autoplay rules (sounds only fire from user gestures, which the app's interactions are).
- `Howler.mute(muted)` is also called on `muted` changes as a global hard-mute.

```ts
// src/providers/HapticsProvider.tsx
type Pattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning';
const MAP: Record<Pattern, number | number[]> = {
  light: 10, medium: 20, heavy: 40, success: [10, 40, 20], warning: [30, 30, 30],
};
export function useHaptics() {
  const muted = useSettings(s => s.muted);
  const rm = useSettings(s => s.reducedMotion);
  return useCallback((p: Pattern) => {
    if (muted || rm) return;                 // global mute also gates haptics
    if ('vibrate' in navigator) navigator.vibrate(MAP[p]);
  }, [muted, rm]);
}
```
(Capacitor Haptics is a later swap; this API surface stays.)

---

## 7. Global Stores (Zustand v5 + persist)

Shared persistence adapter wrapping idb-keyval as a `StateStorage`:

```ts
// src/stores/persist.ts
import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';
export const idbStorage: StateStorage = {
  getItem: (name) => get(name).then(v => v ?? null),
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name),
};
```

Common types used by stores:

```ts
// src/stores/types.ts
export interface Player {
  id: string;
  name: string;
  color: string;        // hex from avatarPalette
  emoji: string;        // single emoji avatar
  createdAt: number;
}
export interface Team { id: string; name: string; color: string; memberIds: string[] }
export interface SavedGroup {
  id: string;
  name: string;
  memberIds: string[];  // references roster Player.id
  createdAt: number;
  updatedAt: number;
}
```

### 7.1 settingsStore

```ts
// src/stores/settingsStore.ts
export type ThemeMode = 'system' | 'light' | 'dark';
interface SettingsState {
  theme: ThemeMode;
  language: Locale;            // 'en' | 'fa'
  muted: boolean;             // gates SFX + haptics
  reducedMotion: boolean;     // 'system' resolved into boolean at set-time; default false
  followSystemMotion: boolean;// if true, reducedMotion mirrors prefers-reduced-motion
  hasOnboarded: boolean;
  setTheme(t: ThemeMode): void;
  setLanguage(l: Locale): void;
  toggleMuted(): void;
  setMuted(v: boolean): void;
  setReducedMotion(v: boolean): void;
  setFollowSystemMotion(v: boolean): void;
  markOnboarded(): void;
}
export const settingsStore = createStore(...);   // vanilla store (for HydrationGate)
export const useSettings = <T,>(sel: (s: SettingsState) => T) => useStore(settingsStore, sel);
```
- Persisted under key `sg.settings`, `version: 1`.
- Default `language`: detect from `navigator.language` (`startsWith('fa') ? 'fa' : 'en'`) on first run only.
- Default `theme: 'system'`, `muted: false`, `followSystemMotion: true`.
- When `followSystemMotion` is true, a small effect in `Providers` syncs `reducedMotion` from the `(prefers-reduced-motion: reduce)` media query; framer-motion reads `reducedMotion` via a `MotionConfig` (see §11).

Pattern (applies to all stores): create a **vanilla** store with `createStore` + `persist`, then a `useX` hook via `useStore`. This lets `HydrationGate` access `.persist` and lets non-React code (Host RNG seeding, sync) read state.

### 7.2 rosterStore

```ts
interface RosterState {
  players: Player[];                        // ordered
  addPlayer(input: Pick<Player,'name'|'color'|'emoji'>): Player;
  updatePlayer(id: string, patch: Partial<Omit<Player,'id'|'createdAt'>>): void;
  removePlayer(id: string): void;           // also strips id from groups (see note)
  reorder(fromIndex: number, toIndex: number): void;
  getById(id: string): Player | undefined;
}
```
- Persist key `sg.roster`. `addPlayer` assigns `id = createId()`, `createdAt = Date.now()`.
- On `removePlayer`, call `groupsStore.getState().pruneMember(id)` to keep groups consistent.

### 7.3 groupsStore

```ts
interface GroupsState {
  groups: SavedGroup[];
  saveGroup(name: string, memberIds: string[]): SavedGroup;   // upsert by name optional; default create
  renameGroup(id: string, name: string): void;
  updateMembers(id: string, memberIds: string[]): void;
  removeGroup(id: string): void;
  pruneMember(playerId: string): void;       // remove a deleted player from all groups
}
```
- Persist key `sg.groups`.

### 7.4 authStore

```ts
type AuthStatus = 'guest' | 'authed' | 'loading';
interface AuthState {
  status: AuthStatus;
  userEmail: string | null;
  userId: string | null;
  enabled: boolean;          // false when no Supabase env -> sign-in UI hidden
  signInWithEmail(email: string): Promise<{ ok: boolean; error?: string }>; // magic link
  signOut(): Promise<void>;
  hydrateSession(): Promise<void>; // pull existing supabase session on boot
}
```
- Persist key `sg.auth` but persist ONLY `{ userEmail }` (a hint for prefilling the sign-in form). The real session lives in Supabase's own storage; `hydrateSession` reconciles.
- `enabled` is computed at boot: `enabled = !!getSupabase()` (see §10). When disabled, Settings shows nothing or a "sign-in unavailable" note; app is fully usable as guest.
- Guest-first: the app never blocks on auth. Sign-in only unlocks cloud sync of roster/groups/stats.

### 7.5 sessionStore (active game run — ephemeral, NOT persisted)

Holds the in-progress run so a Host remount (e.g., orientation route re-render) doesn't lose state, but it is intentionally **not** persisted (a refresh resets the run; matches pass-and-play expectations). Owned/driven by `useGameRun`.

```ts
interface SessionState {
  gameId: string | null;
  phase: GamePhase;             // 'setup' | 'play' | 'results'
  config: GameConfig | null;
  state: unknown | null;        // current game logic state
  startedAt: number | null;
  paused: boolean;
  start(gameId: string, config: GameConfig, initialState: unknown): void;
  setPhase(p: GamePhase): void;
  setState(next: unknown): void;
  setPaused(v: boolean): void;
  reset(): void;
}
```
- In-memory `createStore` without `persist`.

---

## 8. Game Host (the generic engine driver)

Route `/play/:gameId` → `GameHostScreen`. Responsibilities:
1. Resolve the module: `const game = getGame(gameId)`. If missing → `NotFound`.
2. Provide shared chrome via `GameChrome` (back/exit, pause, scoreboard, title painted with `manifest.accent`).
3. Drive the phase machine `setup -> play -> results` using `sessionStore` via `useGameRun`.
4. Construct the `GameContext` (SDK runtime) and pass it through `GameScreenProps` to the active screen.

### 8.1 GameHostScreen flow

```tsx
// src/host/GameHostScreen.tsx (sketch)
export function GameHostScreen() {
  const { gameId } = useParams();
  const game = getGame(gameId!);
  if (!game) return <NotFound />;

  const run = useGameRun(game);   // builds context + manages phase/state (§8.3)

  return (
    <div className="flex min-h-dvh flex-col"
         style={accentVars(game.manifest.accent)}>
      <GameChrome game={game} run={run} />
      <div className="flex-1">
        {run.phase === 'setup'   && <game.screens.Setup {...run.screenProps} />}
        {run.phase === 'play'    && <game.screens.Play  {...run.screenProps} />}
        {run.phase === 'results' && game.screens.Results
            && <game.screens.Results {...run.screenProps} />}
      </div>
      <PauseSheet game={game} run={run} />
      <ScoreboardSheet game={game} run={run} />
      <ConfirmExitDialog run={run} />
    </div>
  );
}
```

`accentVars` writes the manifest accent into CSS custom properties (`--accent-from`, `--accent-to`) consumed by Tailwind arbitrary utilities (e.g. `bg-[linear-gradient(...)]` or token-based gradient classes) so the chrome and game share the game's color identity.

### 8.2 Shared chrome (`GameChrome`, `PauseSheet`, `ScoreboardSheet`)

`GameChrome` top bar (logical layout, RTL-safe):
- Start side: Back/Exit button. Behavior: in `setup` → leaves to Home immediately; in `play`/`results` → opens `ConfirmExitDialog`.
- Center: game name (localized) + small phase/turn indicator slot the game can fill via context.
- End side: Pause button (play only) and Scoreboard button (hidden if `manifest.hidesScoreboard` or `selectScoreboard` returns null).

`PauseSheet` (framer-motion bottom sheet): Resume, Restart (re-run `createInitialState` with a fresh seed → phase `play` or back to `setup` per game preference; default: back to `setup` keeping config), How to play (shows `manifest.description`), Exit.

`ScoreboardSheet`: renders `ScoreboardModel` from `game.logic.selectScoreboard?.(state, config)`. Rows show color/emoji + label + score; sorted per `ascending`.

`ConfirmExitDialog`: "Leave game? Progress will be lost." Confirm → `run.exit()` (resets session, navigates Home). Cancel → dismiss.

### 8.3 `useGameRun` — wiring the SDK into a run

This hook turns a `GameModule` + chosen players into a live run and produces the `GameScreenProps` each screen receives. It owns the reducer dispatch loop and bridges to `sessionStore`.

```ts
// src/host/useGameRun.ts
export interface GameRun<S = unknown, A = unknown> {
  phase: GamePhase;
  config: GameConfig | null;       // null during setup until startPlay
  state: S | null;
  scoreboard: ScoreboardModel | null;
  paused: boolean;
  screenProps: GameScreenProps<S, A>;
  // transitions:
  startPlay(cfg: Omit<GameConfig,'seed'>): void; // Setup -> Play (Host injects seed)
  dispatch(action: A): void;                     // pure reducer step
  toResults(): void;                             // Play -> Results
  restart(): void;
  setPaused(v: boolean): void;
  requestExit(): void;                           // opens confirm
  exit(): void;                                  // hard exit -> Home
}
```

Behavior:
- On mount with a fresh `gameId`, phase starts at `setup`; if `sessionStore.gameId === gameId` and a run is in progress, resume it (phase/state from session).
- `startPlay(cfg)`: Host generates `seed = makeSeed()` (from `lib/rng.ts`, the ONE place randomness enters — reducers stay pure), builds full `GameConfig`, calls `game.logic.createInitialState(config)`, writes to `sessionStore.start(...)`, sets phase `play`. Plays `useSfx().play('turn')` and `useHaptics()('medium')`.
- `dispatch(action)`: `next = game.logic.reducer(state, action)`; `sessionStore.setState(next)`. If `game.logic.isComplete?.(next)` → auto-advance to `results` (when `manifest.hasResults !== false`, else `exit()`).
- Reducers must remain pure: any per-action randomness is generated by the screen/Host and passed in the action payload (e.g., `{ type: 'draw', seed }`). The Host derives sub-seeds deterministically from the run `seed` via `lib/rng.ts` if the game needs reproducibility; otherwise screens may pass `makeSeed()`.
- `scoreboard` is recomputed via `selectScoreboard` on each state change (memoized).

### 8.4 `GameContext` & `GameScreenProps` (runtime SDK handed to screens)

The Host builds a `GameContext` from engine primitives (implemented in the SDK spec) plus run controls, and passes it inside `GameScreenProps`. Screens consume ONLY this; they never import stores or the Host directly.

```ts
// src/sdk/context.ts  ([SDK] type; Host provides the implementation)
export interface GameContext {
  // identity & config
  manifest: GameManifest;
  config: GameConfig;            // valid in play/results
  locale: Locale;
  localize(ls: LocalizedString): string;

  // engine primitives (from 02-sdk-engine-ui) — selectors + actions:
  roster: RosterApi;             // active players for the run
  teams: TeamsApi;
  turnOrder: TurnOrderApi;       // current player, next(), order
  timer: TimerApi;               // start/pause/reset, remaining
  deck: DeckApi;                 // draw/shuffle (seeded)
  scoring: ScoringApi;           // add/subtract, totals
  voting: VotingApi;
  revealGate: RevealGateApi;     // "pass the phone" privacy gate
  phase: PhaseMachineApi;        // game-internal sub-phases
  results: ResultsApi;

  // feedback
  sfx: { play(name: SfxName): void };
  haptics: (pattern: HapticPattern) => void;

  // run controls a screen may invoke
  startPlay(cfg: Omit<GameConfig,'seed'>): void;  // Setup screens call this
  endPlay(): void;                                 // Play screens call to go to Results
  restart(): void;
  exit(): void;
  makeSeed(): number;                              // for action payloads (keeps reducers pure)
}

export interface GameScreenProps<S = unknown, A = unknown> {
  ctx: GameContext;
  state: S;                       // current game logic state (in play/results)
  dispatch: (action: A) => void;  // routed through Host -> pure reducer
}
```

Notes:
- The engine `*Api` shapes are owned by `02-sdk-engine-ui`; the Host instantiates them (most are thin wrappers over the game's reducer state and the chosen players/seed). The shell's contract is only: "Host populates these on `GameContext` and keeps them consistent with `state`."
- During `setup`, `state`/`dispatch` for the game reducer are not yet meaningful; Setup screens primarily call `ctx.startPlay(...)` after collecting players/options. The Host passes `state` as the result of a lazily-created `createInitialState` preview only if the game opts in; default Setup gets `state: null`-safe props (typed via generic default `unknown`).

### 8.5 Player selection at Setup

Setup screens need players. The shell provides a reusable SDK component `<PlayerPicker/>` (in `ui/`, consumed via context-agnostic props) that reads `rosterStore` + `groupsStore` and lets the user:
- Pick from existing roster (multi-select, respecting `manifest.players.min/max`).
- Quick-load a saved Group.
- Jump to `/roster` to add a player (returns via back).

`PlayerPicker` returns ordered `Player[]`; the Setup screen passes them into `ctx.startPlay({ players, teams?, options, locale })`. This is the single bridge between global roster and a run; games never read the store themselves.

---

## 9. Home Screen (grid of colorful game cards)

`HomeScreen` reads `GAMES` from the registry and renders `GameCard`s in a responsive grid (`grid grid-cols-2 gap-3 sm:grid-cols-2`), mobile-first, with a sticky filter toolbar.

### 9.1 Filtering & sorting

```ts
// src/screens/home/useHomeFilters.ts
export interface HomeFilterState {
  query: string;                 // matches localized name/tagline
  tags: GameTag[];               // AND/OR? -> OR within selected tags (any match)
  playerCount: number | null;    // show games whose range includes this count
  sort: 'name' | 'players' | 'duration';
}
export function useHomeFilters(games: GameModule[]): {
  filtered: GameModule[];
  state: HomeFilterState;
  set: <K extends keyof HomeFilterState>(k: K, v: HomeFilterState[K]) => void;
  reset(): void;
};
```
Filter logic:
- `query`: case-insensitive substring on `localize(name)` + `localize(tagline)`.
- `tags`: keep game if it has at least one selected tag (empty selection = all).
- `playerCount`: keep game if `players.min <= count <= players.max` (null = all). Default `playerCount` can be pre-seeded from the current roster size for instant relevance.
- `sort`: `name` by localized name; `players` by `players.recommended ?? players.min`; `duration` by `estMinutes ?? Infinity`.

Filter state is component-local (`useState`/`useReducer`), not persisted (cheap to re-derive). `HomeFilters` renders tag chips (toggle), a player-count stepper, a sort dropdown, and a clear button. All controls are RTL-safe (logical spacing, `text-start`).

### 9.2 GameCard

```tsx
// props
interface GameCardProps { game: GameModule }
```
- Big rounded card, gradient background from `manifest.accent.from/to` (via CSS vars/arbitrary gradient), large `manifest.icon` emoji, localized name + tagline.
- Badges: player range (`min–max`), `estMinutes` (if present), top tag.
- Whole card is a `Link` to `routes.game(game.manifest.id)` (keyboard focusable, `aria-label` = localized name + players).
- Framer-motion: subtle `whileTap={{ scale: 0.97 }}` entrance stagger; disabled when `reducedMotion`.
- Empty state: if `GAMES` is empty, show an illustrated "No games yet" panel (defensive; should not happen once a game folder exists).

### 9.3 Header on Home
`AppHeader` shows app title/logo, a quick roster-size pill (links to `/roster`), and a settings gear (links to `/settings`). On Home only, optionally a one-time onboarding hint if `!settings.hasOnboarded`.

---

## 10. Roster & Groups Screens

### 10.1 RosterScreen
- Lists `rosterStore.players` as `PlayerChip`s with edit/delete actions; an "Add player" FAB opens `PlayerEditor`.
- Drag-to-reorder (or up/down buttons as accessible fallback) → `rosterStore.reorder`.
- Empty state encourages adding the first player.

`PlayerEditor` (bottom sheet / modal):
- Fields: `name` (text, required, trimmed, max 20), `color` (swatch grid from `avatarPalette`), `emoji` (emoji grid from `avatarPalette`; default random).
- Save → `addPlayer` or `updatePlayer`. Validation: non-empty name; duplicate names allowed but warned.

```ts
// src/screens/roster/avatarPalette.ts
export const PLAYER_COLORS = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#A66CFF','#FF8FB1','#22D3EE','#F59E0B'];
export const PLAYER_EMOJIS = ['🦊','🐼','🐸','🦄','🐯','🐧','🐙','🦁','🐵','🐶','🐱','🐨'];
export const pickRandomAvatar = () => ({
  color: PLAYER_COLORS[(Math.random()*PLAYER_COLORS.length)|0],
  emoji: PLAYER_EMOJIS[(Math.random()*PLAYER_EMOJIS.length)|0],
});
```

### 10.2 GroupsScreen
- Lists `groupsStore.groups` (name + member avatars). Actions: Load, Rename, Edit members, Delete.
- "Save current selection as group": opens `GroupEditor` prefilled with a working member set (e.g., from last Setup or all roster); user names it → `saveGroup`.
- "Load" simply navigates the user to Home (or back to a pending Setup) with the group remembered; since groups are consumed at Setup via `PlayerPicker`, "Load" sets a transient `lastUsedGroupId` (in `groupsStore`, non-persisted field or simple state) that `PlayerPicker` reads to preselect. Minimal contract: `GroupsScreen` is primarily management; selection happens in `PlayerPicker`.

`GroupEditor`:
- Name field + multi-select of roster players (checkbox list of `PlayerChip`s).
- Save → `saveGroup(name, memberIds)` or `updateMembers`.

Cross-game reuse guarantee: players and groups live ONLY in `rosterStore`/`groupsStore`; every game's Setup consumes them through `PlayerPicker`. Deleting a player prunes it from all groups (§7.2).

---

## 11. Settings Screen

`SettingsScreen` sections (each a labeled group; all controls are SDK `Toggle`/`SegmentedControl`):

1. Appearance
   - Theme: SegmentedControl `System | Light | Dark` → `settings.setTheme`.
   - Language: SegmentedControl `English | فارسی` → `settings.setLanguage` (immediately flips dir).
2. Feedback
   - Sound & Haptics (global mute): Toggle → `settings.toggleMuted` (single switch gates SFX + haptics per §6.4).
   - Reduced motion: Toggle. When on, `setFollowSystemMotion(false)` + `setReducedMotion(true)`. A "Follow system" sub-toggle controls `followSystemMotion`.
3. Account (only when `authStore.enabled`)
   - `AccountSection`: if guest → "Playing as guest" + "Sign in to sync" button → `SignInDialog`. If authed → email + "Sign out" + last-sync hint.
4. About: version, links, "Reset all data" (clears idb keys after confirm).

Reduced motion is also fed to framer-motion globally via `MotionConfig` placed in `Providers` (inside HapticsProvider or RootLayout):

```tsx
<MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
  {children}
</MotionConfig>
```
(`reducedMotion` boolean derived from `settingsStore`, kept in sync with the media query when `followSystemMotion`.)

---

## 12. Optional Supabase Sign-In (guest-first)

```ts
// src/lib/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient | null | undefined;
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  }) : null;
  return client;
}
```

- If env vars are absent, `getSupabase()` returns `null`, `authStore.enabled = false`, and the entire account UI is hidden. The app is 100% functional offline/guest.
- `SignInDialog`: email field → `authStore.signInWithEmail(email)` → `supabase.auth.signInWithOtp({ email })` (magic link). Success shows "Check your email." No password flow.
- `hydrateSession` on boot: `supabase.auth.getSession()` → set `status/userId/userEmail`. Subscribe to `onAuthStateChange` to keep `authStore` in sync.
- On `SIGNED_IN`, kick a best-effort `sync.pull()` then `sync.push()` (merge roster/groups). On `SIGNED_OUT`, keep local data (guest data persists).

```ts
// src/lib/sync.ts (best-effort, non-blocking)
export async function pull(): Promise<void>;  // fetch remote roster/groups, merge by id (newer updatedAt wins)
export async function push(): Promise<void>;  // upsert local roster/groups to user's rows
```
Sync is fire-and-forget with try/catch; failures never block UI. Conflict resolution: last-write-wins on `updatedAt`; roster players merged by `id`.

---

## 13. i18n Keys Consumed by the Shell

The shell expects these catalog namespaces/keys (catalog files owned by the i18n setup spec). Listed so implementers add them:

```
nav.home, nav.roster, nav.groups, nav.settings
home.title, home.filter.tags, home.filter.players, home.filter.sort,
home.sort.name, home.sort.players, home.sort.duration, home.empty, home.search
card.players (e.g. "{{min}}–{{max}} players"), card.minutes (e.g. "~{{n}} min")
roster.title, roster.add, roster.empty, roster.name, roster.color, roster.emoji,
roster.delete.confirm
groups.title, groups.save, groups.load, groups.rename, groups.editMembers,
groups.delete.confirm, groups.empty, groups.namePlaceholder
settings.title, settings.appearance, settings.theme, settings.theme.system,
settings.theme.light, settings.theme.dark, settings.language, settings.feedback,
settings.mute, settings.reducedMotion, settings.followSystem, settings.account,
settings.about, settings.version, settings.resetData, settings.resetConfirm
account.guest, account.signIn, account.signOut, account.checkEmail,
account.signInUnavailable, account.syncedAt
host.back, host.exit, host.pause, host.resume, host.restart, host.scoreboard,
host.howToPlay, host.exitConfirm.title, host.exitConfirm.body, host.notFound
a11y.skipToContent, a11y.menu, common.cancel, common.save, common.confirm, common.close
```

Bilingual game CONTENT (names/taglines/decks) is NOT in these catalogs — it lives in each game's `LocalizedString`/`content/*.json` and is rendered via `useLocalize()`.

---

## 14. Accessibility, RTL & Motion Rules (shell-wide)

- `dir` is set on `<html>` by `I18nProvider`; all shell layout uses logical utilities (`ms-/me-/ps-/pe-/start-*/end-*/text-start/text-end`) and `rtl:`/`ltr:` variants only for true directional glyphs (e.g., back chevron flips).
- Every interactive element is a real button/link with visible focus ring (`focus-visible:`), `aria-label` where icon-only, and min 44×44px touch target.
- `BottomTabBar` uses `aria-current="page"` via `NavLink`.
- Sheets/dialogs (`PauseSheet`, `ScoreboardSheet`, `PlayerEditor`, `SignInDialog`, `ConfirmExitDialog`) trap focus, close on Esc/backdrop, and restore focus on close (use the SDK `Sheet`/`Dialog` from `ui/`).
- Animations gate on `reducedMotion` (via `MotionConfig` + per-component checks); SFX/haptics gate on `muted`.

---

## 15. Acceptance Criteria

1. App boots to Home grid; persisted theme/language/mute are applied before first interactive paint (splash covers hydration; no flash).
2. Adding a new `src/games/<id>/` folder makes a card appear on Home with NO edits to any shell file.
3. Home filter/sort by tag, player count, and search work and are RTL-correct.
4. Roster CRUD persists across reloads (IndexedDB); deleting a player removes it from all saved groups.
5. Groups can be saved, renamed, member-edited, deleted, and preselected at Setup via `PlayerPicker`.
6. Settings toggles for theme/language/mute/reduced-motion take effect immediately and persist; language flips `dir` live.
7. `/play/:gameId` resolves a `GameModule`, runs Setup→Play→Results with shared chrome (back/exit with mid-game confirm, pause sheet, scoreboard sheet honoring `selectScoreboard`/`hidesScoreboard`).
8. Reducers receive all randomness via action/seed payloads (Host is the only randomness source); no clock/RNG inside reducers — verifiable by the game's `logic.test.ts`.
9. With no Supabase env, account UI is hidden and the app is fully usable offline as guest. With env present, magic-link sign-in works and triggers best-effort sync.
10. Unknown `/play/:badId` and unknown routes render `NotFound` with a path back home.

---

## 16. Implementation Order (suggested)

1. `lib/` (cn, ids, nav, rng) + `stores/persist.ts`.
2. Stores: `settings`, `roster`, `groups`, `auth`, `session` (+ vanilla store pattern).
3. Providers: I18n, Theme, Sound, Haptics; `HydrationGate`, `ErrorBoundary`, `Providers`.
4. `router.tsx`, `RootLayout`, `AppHeader`, `BottomTabBar`, `NotFound`, splash.
5. Home: `useHomeFilters`, `GameCard`, `HomeFilters`, `HomeScreen`.
6. Roster + Groups screens (+ `avatarPalette`, `PlayerChip`, editors).
7. Settings + Account + SignInDialog; `lib/supabase`, `lib/sync`.
8. Host: `useGameRun`, `GameHostScreen`, `GameChrome`, sheets, dialogs; `PlayerPicker` (ui/) wiring.
9. Wire a reference game (from game spec) to validate the full Setup→Play→Results loop.
```
