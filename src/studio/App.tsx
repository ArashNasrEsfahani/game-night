// src/studio/App.tsx — the Content Studio shell: sidebar + routed editor + Ctrl/Cmd+K palette.
import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { CommandSearch } from './components/CommandSearch';
import { DashboardPage } from './pages/DashboardPage';
import { DatasetPage } from './pages/DatasetPage';

function Shell() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onOpenSearch={() => setSearchOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/:gameId/:datasetId" element={<DatasetPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </main>
      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export function StudioApp() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
