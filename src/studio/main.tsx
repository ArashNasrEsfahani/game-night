import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './studio.css';
import { StudioApp } from './App';

// The Content Studio reads/writes the source JSON directly — it never touches the games' IDB
// override layer, so there is no loadAllOverrides() boot step here.
createRoot(document.getElementById('studio-root')!).render(
  <StrictMode>
    <StudioApp />
  </StrictMode>,
);
