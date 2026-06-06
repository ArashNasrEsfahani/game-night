import type { GameModule } from '../../sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer } from './logic';
import type { MafiaAction, MafiaState } from './logic';
import { defaultConfig, validateConfig } from './config';
import { SetupScreen } from './screens/SetupScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ResultsScreen } from './screens/ResultsScreen';

const mod: GameModule<MafiaState, MafiaAction> = {
  manifest,
  logic: { createInitialState, reducer },
  screens: { Setup: SetupScreen, Play: PlayScreen, Results: ResultsScreen },
  defaultConfig,
  validateConfig,
  getOutcome: (s, c) => ({
    mode: 'team',
    winnerIds:
      s.winner && s.winner !== 'draw'
        ? s.players.filter((p) => p.faction === s.winner).map((p) => p.id)
        : [],
    participantIds: c.players.map((p) => p.id),
  }),
};

export default mod;
