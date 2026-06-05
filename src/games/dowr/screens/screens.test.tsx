import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import type { GameConfig, GameContext, GameNav, PlayerSeat } from '../../../sdk/types';
import { asPlayerId, asTeamId } from '../../../engine/ids';
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
const teamsConfig = (n: number, rounds = 1): GameConfig => {
  const players = Array.from({ length: n }, (_, i) => seat(i));
  return {
    players,
    teams: {
      mode: 'manual',
      teams: Array.from({ length: n / 2 }, (_, i) => ({
        id: asTeamId(`t${i}`),
        name: `T${i}`,
        memberIds: [players[2 * i].id, players[2 * i + 1].id],
      })),
    },
    lang: 'en',
    options: {
      categories: ['food'],
      difficulty: 'random',
      rounds,
      fuseSeconds: 60,
      bombPenaltySeconds: 20,
      changePenaltySeconds: 5,
      surpriseBomb: false,
    } as unknown as Record<string, unknown>,
  };
};

const renderScreen = (Comp: typeof PlayScreen, state: DowrState, config: GameConfig) =>
  render(
    <MemoryRouter>
      <Comp state={state} config={config} dispatch={() => {}} ctx={ctx} nav={nav} />
    </MemoryRouter>,
  );

describe('Dowr PlayScreen', () => {
  it('renders the continuous play screen with the word and controls', () => {
    const config = teamsConfig(4);
    const s = dowr.logic.createInitialState(config, 1) as DowrState;
    expect(s.phase).toBe('playing');
    renderScreen(PlayScreen, s, config);
    expect(screen.getByRole('button', { name: /Got it/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change/ })).toBeInTheDocument();
  });
});

describe('Dowr ResultsScreen', () => {
  it('renders the winner banner and replay after a finished game', () => {
    const config = teamsConfig(4, 1);
    let s = dowr.logic.createInitialState(config, 1) as DowrState;
    s = dowr.logic.reducer(s, { type: 'ADVANCE', reason: 'guessed', segmentMs: 5000, seed: 1 }) as DowrState;
    s = dowr.logic.reducer(s, { type: 'ADVANCE', reason: 'guessed', segmentMs: 9000, seed: 1 }) as DowrState;
    expect(s.finished).toBe(true);
    renderScreen(ResultsScreen, s, config);
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  });
});
