import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { screenFade } from '../../sdk/motion';
import { Sheet, Button, Screen, AppBar, Medallion } from '../../sdk/ui';
import { GameChromeContext } from '../../sdk/ui/AppBar';
import { gameEmblem } from '../../sdk/ui/emblems';
import type { GameManifest } from '../../sdk/types';
import { getGame } from '../../games/registry';
import { useSessionStore } from '../../store/sessionStore';
import type { HostScreen } from '../../store/sessionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useLeaderboardStore } from '../../store/leaderboardStore';
import { GameContextProvider } from '../../sdk/context';
import type {
  GameActionBase,
  GameConfig,
  GameContext,
  GameNav,
  GameStateBase,
  Lang,
  LocalizedString,
} from '../../sdk/types';
import { clockService } from '../../services/clock';
import { randomService } from '../../services/random';
import { soundService, noopSound } from '../../services/sound';
import { hapticsService, noopHaptics } from '../../services/haptics';
import { useLocalize } from '../../lib/localize';
import { GuideBanner } from '../components/Guide';
import { NotFoundPage } from './NotFoundPage';

/**
 * Floating top-right chrome shared by every in-game screen: a Close (✕) that leaves the game
 * (routed through the host's exit-confirm) and a "?" that opens the how-to-play sheet. The two
 * buttons sit side by side in a single justify-end cluster so they never overlap each other or
 * the AppBar back arrow on the left.
 */
function HostTopBar({
  description,
  howToPlay,
  title,
  onExit,
  showClose,
}: {
  description?: LocalizedString;
  howToPlay?: LocalizedString;
  title: string;
  onExit: () => void;
  showClose: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const localize = useLocalize();
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto flex max-w-md items-center justify-end gap-2 px-4 pt-3">
        {showClose && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onExit}
            aria-label={t('common.leave')}
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-lg font-bold text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border-glow)]"
          >
            ✕
          </motion.button>
        )}
        {(howToPlay || description) && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setOpen(true)}
            aria-label={t('common.howToPlay')}
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-lg font-bold text-[var(--game-accent-strong)] shadow-[inset_0_0_0_1px_var(--border-glow)]"
          >
            ?
          </motion.button>
        )}
      </div>
      {(howToPlay || description) && (
        <Sheet open={open} onClose={() => setOpen(false)} title={title}>
          {description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text)]">
              {localize(description)}
            </p>
          )}
          {howToPlay && (
            <>
              {description && (
                <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--game-accent-strong)]">
                  {t('common.howToPlay')}
                </p>
              )}
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-muted)]">
                {localize(howToPlay)}
              </p>
            </>
          )}
          <Button fullWidth className="mt-5" onClick={() => setOpen(false)}>
            {t('common.close')}
          </Button>
        </Sheet>
      )}
    </>
  );
}

/** Shown when re-entering a game that already has a saved match: resume it, or start fresh. */
function ResumeGate({
  manifest,
  title,
  finished,
  onResume,
  onNew,
  onExit,
}: {
  manifest: GameManifest;
  title: string;
  finished: boolean;
  onResume: () => void;
  onNew: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const emblem = gameEmblem(manifest.id);
  return (
    <Screen>
      <AppBar title={title} onBack={onExit} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <Medallion size={132}>
          {emblem ? (
            <span dangerouslySetInnerHTML={{ __html: emblem }} />
          ) : (
            <span className="text-5xl">{manifest.icon}</span>
          )}
        </Medallion>
        <div>
          <h1 className="dp-title font-display text-2xl font-extrabold">
            {finished ? t('results.title') : t('host.resumeTitle')}
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-[var(--text-muted)]">
            {t('host.resumeBody')}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button size="lg" fullWidth onClick={onResume}>
            {t('host.resume')}
          </Button>
          <Button variant="secondary" fullWidth onClick={onNew}>
            {t('host.startOver')}
          </Button>
        </div>
      </div>
    </Screen>
  );
}

export function GameHostPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const localize = useLocalize();

  const mod = gameId ? getGame(gameId) : undefined;

  const rawSession = useSessionStore((s) => (gameId ? s.sessions[gameId] : undefined));
  const startStore = useSessionStore((s) => s.start);
  const updateStore = useSessionStore((s) => s.update);
  const clearStore = useSessionStore((s) => s.clear);

  // Ignore a saved match whose schema predates the current game version (it would crash the
  // new reducer/screens). Drop it so the player just gets a clean Setup.
  const session =
    rawSession && mod && rawSession.stateVersion === mod.manifest.stateVersion
      ? rawSession
      : undefined;
  useEffect(() => {
    if (gameId && rawSession && mod && rawSession.stateVersion !== mod.manifest.stateVersion) {
      clearStore(gameId);
    }
  }, [gameId, rawSession, mod, clearStore]);

  // Per-mount: once the player chooses (or starts a match), don't show the resume gate again.
  const [resumed, setResumed] = useState(false);

  // Are-you-sure gate before leaving the game (driven by nav.exit + the floating Close button).
  const [confirmExit, setConfirmExit] = useState(false);
  // Are-you-sure gate before ending the match (driven by nav.endGame from each game's "End game").
  const [confirmEndGame, setConfirmEndGame] = useState(false);

  const muted = useSettingsStore((s) => s.muted);
  const hapticsOn = useSettingsStore((s) => s.haptics);
  const reduced = useSettingsStore((s) => s.reducedMotion);
  const lang: Lang = i18n.language && i18n.language.startsWith('fa') ? 'fa' : 'en';

  const ctx: GameContext = useMemo(
    () => ({
      lang,
      t,
      localize,
      setLang: (l: Lang) => void i18n.changeLanguage(l),
      clock: clockService,
      random: randomService,
      sound: muted ? noopSound : soundService,
      haptics: muted || !hapticsOn ? noopHaptics : hapticsService,
      prefersDark: document.documentElement.classList.contains('dark'),
      muted,
      reducedMotion: reduced === 'on',
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    }),
    [lang, t, localize, muted, hapticsOn, reduced, i18n],
  );

  // Provisional state so the Setup screen (which doesn't read state) satisfies the prop type.
  const setupState = useMemo(
    () =>
      mod ? mod.logic.createInitialState(mod.defaultConfig({ players: [], lang }), 0) : null,
    [mod, lang],
  );

  if (!mod || !gameId) return <NotFoundPage />;

  // Record a finished match into the overall leaderboard (once per match, deduped by start time).
  const recordOutcome = (cfg: GameConfig, finishedState: GameStateBase, startedAt: number) => {
    const outcome = mod.getOutcome?.(finishedState, cfg);
    if (!outcome) return;
    const names = Object.fromEntries(cfg.players.map((p) => [p.id as string, p.name]));
    useLeaderboardStore.getState().record(`${gameId}:${startedAt}`, outcome, names);
  };

  const nav: GameNav = {
    toSetup: () => updateStore(gameId, { screen: 'setup' }),
    toPlay: () => updateStore(gameId, { screen: 'play' }),
    toResults: () => updateStore(gameId, { screen: 'results' }),
    // Don't leave straight away — open the are-you-sure gate first (back arrows, the Results
    // "Home" button and the floating Close all route through here).
    exit: () => setConfirmExit(true),
    // Ending the match records a leaderboard result, so gate it behind an are-you-sure too.
    endGame: () => setConfirmEndGame(true),
    startMatch: (config: GameConfig) => {
      const seed = randomService.seed();
      const state = mod.logic.createInitialState(config, seed);
      startStore(gameId, {
        config,
        state,
        screen: state.finished ? 'results' : 'play',
        stateVersion: mod.manifest.stateVersion,
        updatedAt: clockService.now(),
      });
      setResumed(true); // we just started this match — don't gate it behind resume
      if (state.finished) {
        const sess = useSessionStore.getState().getSession(gameId);
        recordOutcome(config, state, sess?.startedAt ?? clockService.now());
      }
    },
    playAgain: () => clearStore(gameId),
  };

  const dispatch = (action: GameActionBase) => {
    // Read the LATEST session from the store (not the render-closure `session`): a single handler
    // may fire several dispatches in a row (e.g. ANSWER then PASS_TO_NEXT), and each must build on
    // the previous one's result. Closing over `session.state` would make the second dispatch
    // overwrite the first. zustand updates synchronously, so getState() reflects the prior dispatch.
    const current = useSessionStore.getState().getSession(gameId);
    if (!current) return;
    const next = mod.logic.reducer(current.state, action);
    const screen: HostScreen = next.finished ? 'results' : current.screen;
    updateStore(gameId, { state: next, screen, updatedAt: clockService.now() });
    if (!current.state.finished && next.finished) recordOutcome(current.config, next, current.startedAt);
  };

  const accentStyle = {
    '--game-accent': `var(--color-game-${mod.manifest.color})`,
    '--game-accent-strong': `var(--color-game-${mod.manifest.color}-strong)`,
    '--game-accent-glow': `color-mix(in oklab, var(--color-game-${mod.manifest.color}) 60%, transparent)`,
    '--game-accent-soft': `color-mix(in oklab, var(--color-game-${mod.manifest.color}) 16%, transparent)`,
    '--game-on-accent': `var(--on-${mod.manifest.color})`,
  } as CSSProperties;

  const shownScreen: HostScreen =
    !session || session.screen === 'setup'
      ? 'setup'
      : session.screen === 'results' || session.state.finished
        ? 'results'
        : 'play';
  const ScreenComp =
    shownScreen === 'setup'
      ? mod.screens.Setup
      : shownScreen === 'results'
        ? mod.screens.Results
        : mod.screens.Play;

  const screenState = session?.state ?? setupState!;
  const screenConfig = session?.config ?? mod.defaultConfig({ players: [], lang });

  // A saved, started match is waiting — offer Resume vs New before dropping into it.
  const showGate =
    !resumed && !!session && (session.screen === 'play' || session.screen === 'results');

  // Step-appropriate guidance text (shown as a floating cloud when the 💡 toggle is on).
  const guideText = showGate
    ? ''
    : shownScreen === 'setup'
      ? t('guide.setup')
      : shownScreen === 'results'
        ? t('guide.results')
        : t('guide.play');

  return (
    <GameContextProvider value={ctx}>
      <GameChromeContext.Provider value={{ name: localize(mod.manifest.name) }}>
      <div style={accentStyle} className="contents">
        <HostTopBar
          description={mod.manifest.description}
          howToPlay={mod.manifest.howToPlay}
          title={localize(mod.manifest.name)}
          onExit={() => setConfirmExit(true)}
          showClose={!showGate}
        />
        <AnimatePresence mode="wait" initial={false}>
          {showGate ? (
            <motion.div
              key="resume-gate"
              variants={screenFade}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ResumeGate
                manifest={mod.manifest}
                title={localize(mod.manifest.name)}
                finished={!!session?.state.finished}
                onResume={() => setResumed(true)}
                onNew={() => {
                  clearStore(gameId);
                  setResumed(true);
                }}
                onExit={() => navigate('/')}
              />
            </motion.div>
          ) : (
            <motion.div
              key={shownScreen}
              variants={screenFade}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ScreenComp
                state={screenState}
                config={screenConfig}
                dispatch={dispatch}
                ctx={ctx}
                nav={nav}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <GuideBanner text={guideText} />
        <Sheet
          open={confirmExit}
          onClose={() => setConfirmExit(false)}
          title={t('common.leave')}
        >
          <p className="text-sm leading-relaxed text-[var(--text-muted)]">
            {t('common.leaveConfirm')}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              fullWidth
              onClick={() => {
                setConfirmExit(false);
                navigate('/');
              }}
            >
              {t('common.leave')}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setConfirmExit(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </Sheet>
        <Sheet
          open={confirmEndGame}
          onClose={() => setConfirmEndGame(false)}
          title={t('common.endGame')}
        >
          <p className="text-sm leading-relaxed text-[var(--text-muted)]">
            {t('common.endGameConfirm')}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              fullWidth
              onClick={() => {
                setConfirmEndGame(false);
                dispatch({ type: 'END_GAME' } as GameActionBase);
              }}
            >
              {t('common.endGame')}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setConfirmEndGame(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </Sheet>
      </div>
      </GameChromeContext.Provider>
    </GameContextProvider>
  );
}
