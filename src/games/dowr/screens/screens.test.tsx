import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import type { GameConfig, GameContext, GameNav, PlayerSeat } from '../../../sdk/types';
import { asPlayerId } from '../../../engine/ids';
import dowr from '../index';
import { PlayScreen } from './PlayScreen';
import { ResultsScreen } from './ResultsScreen';
import type { DowrState } from '../logic';

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

const seat = (i: number): PlayerSeat => ({ id: asPlayerId(`p${i}`), name: `P${i}` });
const soloConfig = (n: number, rounds = 1): GameConfig => ({
  players: Array.from({ length: n }, (_, i) => seat(i)),
  lang: 'en',
  options: { mode: 'solo', categories: ['food'], difficulty: 'random', rounds, timerSeconds: 60, skipPenalty: false } as unknown as Record<string, unknown>,
});

const renderScreen = (Comp: typeof PlayScreen, state: DowrState, config: GameConfig) =>
  render(
    <MemoryRouter>
      <Comp state={state} config={config} dispatch={() => {}} ctx={ctx} nav={nav} />
    </MemoryRouter>,
  );

describe('Dowr PlayScreen', () => {
  it('renders the describing phase with the word and controls', () => {
    const config = soloConfig(2);
    let s = dowr.logic.createInitialState(config, 1) as DowrState;
    s = dowr.logic.reducer(s, { type: 'BEGIN_TURN' }) as DowrState;
    s = dowr.logic.reducer(s, { type: 'START_DESCRIBE', now: 1000 }) as DowrState;
    expect(s.phase).toBe('describing');
    renderScreen(PlayScreen, s, config);
    expect(screen.getByRole('button', { name: /Correct/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Skip/ })).toBeInTheDocument();
  });
});

describe('Dowr ResultsScreen', () => {
  it('renders the winner banner and replay after a finished game', () => {
    const config = soloConfig(2, 1);
    let s = dowr.logic.createInitialState(config, 1) as DowrState;
    for (let turn = 0; turn < 2; turn++) {
      s = dowr.logic.reducer(s, { type: 'BEGIN_TURN' }) as DowrState;
      s = dowr.logic.reducer(s, { type: 'START_DESCRIBE', now: 0 }) as DowrState;
      s = dowr.logic.reducer(s, { type: 'END_TURN_EARLY', now: 1 }) as DowrState;
      s = dowr.logic.reducer(s, { type: 'NEXT_TURN', seed: 1 }) as DowrState;
    }
    expect(s.finished).toBe(true);
    renderScreen(ResultsScreen, s, config);
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  });
});
