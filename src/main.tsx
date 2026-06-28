import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App.tsx';
import { loadAllOverrides } from './content/overrides';

// Apply any saved Content Studio edits BEFORE the first render, so the very first screen
// already reflects the user's datasets. App's static import graph has registered every
// game's rebuilder by now; loadAllOverrides() reads IndexedDB and rebuilds them all.
const root = createRoot(document.getElementById('root')!);
const render = () =>
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

loadAllOverrides().then(render, render);
