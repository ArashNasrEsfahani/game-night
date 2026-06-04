import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import { SetupScreen } from './SetupScreen';
import type { GameContext, GameNav } from '../../../sdk/types';
import dowr from '../index';

const ctx = {
  lang: 'en',
  t: (k: string) => k,
  localize: (ls: { en: string }) => ls.en,
  setLang: () => {},
  clock: { now: () => 0, onFrame: () => () => {}, interval: () => () => {} },
  random: { seed: () => 1 },
  sound: { play: () => {}, preload: () => {}, stop: () => {} },
  haptics: {
    light: () => {},
    medium: () => {},
    heavy: () => {},
    success: () => {},
    warning: () => {},
    error: () => {},
  },
  prefersDark: false,
  muted: true,
  reducedMotion: false,
  isOnline: true,
} as unknown as GameContext;

const nav = {
  toSetup: () => {},
  toPlay: () => {},
  toResults: () => {},
  exit: () => {},
  startMatch: () => {},
  playAgain: () => {},
} as GameNav;

describe('Dowr SetupScreen', () => {
  it('renders the setup controls without throwing', () => {
    const config = dowr.defaultConfig({ players: [], lang: 'en' });
    const state = dowr.logic.createInitialState(config, 0);
    render(
      <MemoryRouter>
        <SetupScreen
          state={state}
          config={config}
          dispatch={() => {}}
          ctx={ctx}
          nav={nav}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Dowr' })).toBeInTheDocument();
    // Mode segmented control labels present
    expect(screen.getByRole('radio', { name: 'Teams' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Solo' })).toBeInTheDocument();
    // Start is present but disabled (no players in roster)
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
  });
});
