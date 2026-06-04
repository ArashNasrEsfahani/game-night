import type { GameModule } from '../../sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer } from './logic';
import type { HeadsUpAction, HeadsUpState } from './logic';
import { defaultConfig, validateConfig } from './config';
import { SetupScreen } from './screens/SetupScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ResultsScreen } from './screens/ResultsScreen';

const mod: GameModule<HeadsUpState, HeadsUpAction> = {
  manifest,
  logic: { createInitialState, reducer },
  screens: { Setup: SetupScreen, Play: PlayScreen, Results: ResultsScreen },
  defaultConfig,
  validateConfig,
};

export default mod;
