// src/sdk/types.ts — THE CONTRACT (canonical; see docs/specs/00-architecture.md + CONTRACT-FREEZE.md)
// Pure type vocabulary: no runtime code. With verbatimModuleSyntax on, always import with `import type`.
import type { ComponentType } from 'react';
import type { TFunction } from 'i18next';

/* ─────────────────────────  Localization  ───────────────────────── */

export type Lang = 'en' | 'fa';

/** Every piece of game CONTENT text is bilingual. UI chrome uses i18next keys instead. */
export interface LocalizedString {
  en: string;
  fa: string;
}

/* ─────────────────────────  Branded IDs  ───────────────────────── */
/** Branded primitives prevent accidentally mixing id kinds. Values are plain strings. */
export type PlayerId = string & { readonly __brand: 'PlayerId' };
export type TeamId = string & { readonly __brand: 'TeamId' };
export type GameId = string; // matches the folder name in src/games/<GameId>

/* ─────────────────────────  Catalog metadata  ───────────────────────── */

export type GameCategory =
  | 'party'
  | 'word'
  | 'deduction'
  | 'drawing'
  | 'trivia'
  | 'reaction'
  | 'cards'
  | 'social'
  | 'voting';

/** Tailwind token name used to color a game card (maps to --color-game-* in the theme). */
export type ColorToken =
  | 'grape'
  | 'tangerine'
  | 'lime'
  | 'sky'
  | 'rose'
  | 'gold'
  | 'teal'
  | 'violet';

/** Feature flags the host uses to decide which setup affordances to show. */
export interface GameCapabilities {
  usesTeams: boolean;
  usesTimer: boolean;
  usesDeck: boolean;
  usesVoting: boolean;
  usesRevealGate: boolean; // pass-the-phone curtain
  passAndPlay: boolean; // virtually always true for this product
}

/**
 * Static, content-free description of a game. Read at startup to build the home grid.
 * MUST be cheap to evaluate (no heavy imports) — keep manifest.ts dependency-light.
 */
export interface GameManifest {
  id: GameId; // unique; equals folder name; stable forever
  name: LocalizedString; // card title
  tagline: LocalizedString; // one-line hook under the title
  description: LocalizedString; // longer text on the detail / setup
  icon: string; // emoji or icon-name token rendered on the card
  color: ColorToken; // card accent color
  category: GameCategory;
  minPlayers: number; // inclusive
  maxPlayers: number; // inclusive
  estimatedMinutes: [min: number, max: number];
  tags?: LocalizedString[]; // optional chips ("loud", "no-writing")
  capabilities: GameCapabilities;
  /** Schema version of this game's persisted state; bump on breaking logic changes. */
  stateVersion: number;
  /** Optional rules summary shown in a "How to play" sheet. */
  howToPlay?: LocalizedString;
  /** Whether the game exposes a custom-content editor (decks/prompts). */
  supportsCustomContent?: boolean;
  /** If true, hidden from the grid unless an unlock/experimental flag is set. */
  experimental?: boolean;
}

/* ─────────────────────────  Config / State / Action  ───────────────────────── */

export interface PlayerSeat {
  id: PlayerId;
  name: string; // denormalized snapshot (roster may change later)
  emoji?: string;
  color?: ColorToken;
}

export interface TeamSetup {
  mode: 'manual' | 'auto';
  teams: { id: TeamId; name: LocalizedString | string; memberIds: PlayerId[] }[];
}

/** Per-match options chosen in Setup (round count, timer length, resolved deck ids, …). */
export interface GameConfig {
  /** Players participating this match, in seat order (subset of the roster). */
  players: PlayerSeat[];
  /** Optional team assignment when capabilities.usesTeams. */
  teams?: TeamSetup;
  /** Game-specific options bag; each game narrows this via its own type. Resolved content
   *  ids/pools live here so createInitialState(config, seed) is self-sufficient and pure. */
  options: Record<string, unknown>;
  /** Locale captured at match start (content is localized at render with current lang). */
  lang: Lang;
}

/** Marker base every concrete GameState extends. Must be JSON-serializable. */
export interface GameStateBase {
  /** Mirrors manifest.stateVersion at creation; used for migration on load. */
  v: number;
  /** Current phase id from the game's phaseMachine. */
  phase: string;
  /** True once a win-condition fired and Results should be shown. */
  finished: boolean;
}

/** Marker base every concrete GameAction extends (a discriminated union per game). */
export interface GameActionBase {
  type: string;
}

/* ─────────────────────────  The plugin entry types  ───────────────────────── */

/**
 * Pure logic of a game. NO side effects: no Date.now, no Math.random, no I/O.
 * Randomness/clock arrive via the action payload (seed / now fields) or the seed arg.
 */
export interface GameLogic<S extends GameStateBase, A extends GameActionBase> {
  /** Build the starting state from config; `seed` is supplied by the host (impure source). */
  createInitialState: (config: GameConfig, seed: number) => S;
  /** Pure transition. Must return a NEW state object (no mutation). */
  reducer: (state: S, action: A) => S;
  /** Optional migrator invoked when a persisted state's `v` < manifest.stateVersion. */
  migrate?: (oldState: unknown, fromVersion: number) => S;
}

export interface DefaultConfigInput {
  players: PlayerSeat[];
  lang: Lang;
}

export interface GameNav {
  toSetup: () => void;
  toPlay: () => void;
  toResults: () => void;
  exit: () => void; // back to Home, after confirm
  /** Begin a brand-new match from a Setup-built config (host seeds + persists + routes to Play). */
  startMatch: (config: GameConfig) => void;
  /** Start over the same game (clears session, returns to Setup). */
  playAgain: () => void;
}

/** Props the host passes to every game screen. Generic over the game's state/action. */
export interface GameScreenProps<S extends GameStateBase, A extends GameActionBase> {
  state: S;
  config: GameConfig;
  /** Dispatch a pure action through the game's reducer (host handles persistence). */
  dispatch: (action: A) => void;
  /** The injected impure services (see GameContext). */
  ctx: GameContext;
  /** Navigate the host shell. */
  nav: GameNav;
}

/** The three screens a game must provide; composed from sdk/ui. */
export interface GameScreens<S extends GameStateBase, A extends GameActionBase> {
  Setup: ComponentType<GameScreenProps<S, A>>;
  Play: ComponentType<GameScreenProps<S, A>>;
  Results: ComponentType<GameScreenProps<S, A>>;
}

/** The default export of src/games/<id>/index.ts. */
export interface GameModule<
  S extends GameStateBase = GameStateBase,
  A extends GameActionBase = GameActionBase,
> {
  manifest: GameManifest;
  logic: GameLogic<S, A>;
  screens: GameScreens<S, A>;
  /** Produce the default config given the chosen players/lang (pre-fills Setup). */
  defaultConfig: (input: DefaultConfigInput) => GameConfig;
  /** Validate a config before starting; return localized errors or null. */
  validateConfig?: (config: GameConfig) => LocalizedString[] | null;
}

/** Type-erased module the registry stores. */
export type AnyGameModule = GameModule<GameStateBase, GameActionBase>;

/* ─────────────────────────  GameContext (impure services)  ───────────────────────── */

export type SoundId =
  | 'tap'
  | 'correct'
  | 'wrong'
  | 'tick'
  | 'timeUp'
  | 'reveal'
  | 'win'
  | 'lose'
  | 'shuffle'
  | 'pass';

export interface ClockService {
  now: () => number; // Date.now wrapper
  /** Subscribe to animation frames; returns an unsubscribe fn. Used to drive TICK. */
  onFrame: (cb: (now: number) => void) => () => void;
  /** Fixed-interval ticker (ms); returns unsubscribe. */
  interval: (ms: number, cb: (now: number) => void) => () => void;
}

export interface RandomService {
  /** A fresh 32-bit seed (crypto-backed) to embed in an action payload or pass to startMatch. */
  seed: () => number;
}

export interface SoundService {
  play: (id: SoundId) => void;
  preload: (ids: SoundId[]) => void;
  stop: (id?: SoundId) => void;
}

export interface HapticsService {
  light: () => void;
  medium: () => void;
  heavy: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
}

/**
 * The impure counterpart to the pure engine. Screens receive it via the `ctx` prop and the
 * useGameContext() hook. Reducers NEVER touch it. Screens use it to get a real now/seed to put
 * into actions, to trigger feedback, and to localize content.
 */
export interface GameContext {
  /* localization */
  lang: Lang;
  /** Translate a UI catalog key (chrome). */
  t: TFunction;
  /** Resolve a LocalizedString (game content) to the current language. */
  localize: (ls: LocalizedString) => string;
  setLang: (lang: Lang) => void;

  /* impure sources for action payloads (the ONLY sanctioned entropy/clock in games) */
  clock: ClockService;
  random: RandomService;

  /* feedback (respect global mute in settings) */
  sound: SoundService;
  haptics: HapticsService;

  /* environment */
  prefersDark: boolean;
  muted: boolean;
  reducedMotion: boolean;
  isOnline: boolean;
}
