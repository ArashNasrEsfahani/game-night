import { useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { HomePage } from './pages/HomePage';
import { PlayersPage } from './pages/PlayersPage';
import { SettingsPage } from './pages/SettingsPage';
import { GameHostPage } from './pages/GameHostPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { routeShell } from '../sdk/motion';
import { useUiSound } from '../lib/uiSound';

function AnimatedRoutes() {
  const location = useLocation();

  // Navigation audio/haptic cue, mirroring the native MainActivity: opening a game reveals
  // (select), returning home passes back, other moves tap — each with a light haptic. The first
  // emission (initial mount / reload) is skipped so launch is silent.
  const ui = useUiSound();
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const firstNav = useRef(true);
  useEffect(() => {
    if (firstNav.current) {
      firstNav.current = false;
      return;
    }
    const p = location.pathname;
    uiRef.current(p.startsWith('/g/') ? 'select' : p === '/' ? 'pass' : 'tap');
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={routeShell}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/g/:gameId" element={<GameHostPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export function AppRouter() {
  return (
    <HashRouter>
      <AnimatedRoutes />
    </HashRouter>
  );
}
