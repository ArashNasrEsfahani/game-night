import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getGame } from '../../games/registry';
import { useSessionStore } from '../../store/sessionStore';
import type { HostScreen } from '../../store/sessionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { GameContextProvider } from '../../sdk/context';
import type {
  GameActionBase,
  GameConfig,
  GameContext,
  GameNav,
  Lang,
} from '../../sdk/types';
import { clockService } from '../../services/clock';
import { randomService } from '../../services/random';
import { soundService, noopSound } from '../../services/sound';
import { hapticsService, noopHaptics } from '../../services/haptics';
import { useLocalize } from '../../lib/localize';
import { NotFoundPage } from './NotFoundPage';

export function GameHostPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const localize = useLocalize();

  const mod = gameId ? getGame(gameId) : undefined;

  const session = useSessionStore((s) => (gameId ? s.sessions[gameId] : undefined));
  const startStore = useSessionStore((s) => s.start);
  const updateStore = useSessionStore((s) => s.update);
  const clearStore = useSessionStore((s) => s.clear);

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

  const nav: GameNav = {
    toSetup: () => updateStore(gameId, { screen: 'setup' }),
    toPlay: () => updateStore(gameId, { screen: 'play' }),
    toResults: () => updateStore(gameId, { screen: 'results' }),
    exit: () => navigate('/'),
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
    },
    playAgain: () => clearStore(gameId),
  };

  const dispatch = (action: GameActionBase) => {
    if (!session) return;
    const next = mod.logic.reducer(session.state, action);
    const screen: HostScreen = next.finished ? 'results' : session.screen;
    updateStore(gameId, { state: next, screen, updatedAt: clockService.now() });
  };

  const accentStyle = {
    '--game-accent': `var(--color-game-${mod.manifest.color})`,
    '--game-accent-strong': `var(--color-game-${mod.manifest.color}-strong)`,
    '--game-accent-glow': `color-mix(in oklab, var(--color-game-${mod.manifest.color}) 60%, transparent)`,
    '--game-accent-soft': `color-mix(in oklab, var(--color-game-${mod.manifest.color}) 16%, transparent)`,
  } as CSSProperties;

  const ScreenComp =
    !session || session.screen === 'setup'
      ? mod.screens.Setup
      : session.screen === 'results' || session.state.finished
        ? mod.screens.Results
        : mod.screens.Play;

  const screenState = session?.state ?? setupState!;
  const screenConfig = session?.config ?? mod.defaultConfig({ players: [], lang });

  return (
    <GameContextProvider value={ctx}>
      <div style={accentStyle} className="contents">
        <ScreenComp
          state={screenState}
          config={screenConfig}
          dispatch={dispatch}
          ctx={ctx}
          nav={nav}
        />
      </div>
    </GameContextProvider>
  );
}
