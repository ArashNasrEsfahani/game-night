import type { GameModule } from '../../sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer } from './logic';
import type { MinesweeperAction, MinesweeperState } from './logic';
import { defaultConfig, validateConfig } from './config';
import { SetupScreen } from './screens/SetupScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ResultsScreen } from './screens/ResultsScreen';

const mod: GameModule<MinesweeperState, MinesweeperAction> = {
  manifest,
  logic: { createInitialState, reducer },
  screens: { Setup: SetupScreen, Play: PlayScreen, Results: ResultsScreen },
  defaultConfig,
  validateConfig,
  getOutcome: (s, c) => ({
    mode: 'individual',
    winnerIds: s.winnerIds,
    participantIds: c.players.map((p) => p.id),
  }),
};

export default mod;
