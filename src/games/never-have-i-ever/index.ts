import type { GameModule } from '../../sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer, computeWinners } from './logic';
import type { NhieAction, NhieState } from './logic';
import { defaultConfig, validateConfig } from './config';
import { SetupScreen } from './screens/SetupScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ResultsScreen } from './screens/ResultsScreen';

const mod: GameModule<NhieState, NhieAction> = {
  manifest,
  logic: { createInitialState, reducer },
  screens: { Setup: SetupScreen, Play: PlayScreen, Results: ResultsScreen },
  defaultConfig,
  validateConfig,
  getOutcome: (s, c) => ({
    mode: 'individual',
    winnerIds: computeWinners(s),
    participantIds: c.players.map((p) => p.id),
  }),
};

export default mod;
