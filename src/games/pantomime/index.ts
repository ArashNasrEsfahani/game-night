import type { GameModule } from '../../sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer } from './logic';
import type { PantomimeAction, PantomimeState } from './logic';
import { defaultConfig, validateConfig } from './config';
import { SetupScreen } from './screens/SetupScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ResultsScreen } from './screens/ResultsScreen';

const mod: GameModule<PantomimeState, PantomimeAction> = {
  manifest,
  logic: { createInitialState, reducer },
  screens: { Setup: SetupScreen, Play: PlayScreen, Results: ResultsScreen },
  defaultConfig,
  validateConfig,
  getOutcome: (s, c) => ({
    mode: 'team',
    winnerIds: s.teams.filter((t) => s.winnerTeamIds.includes(t.teamId)).flatMap((t) => t.playerIds),
    participantIds: c.players.map((p) => p.id),
  }),
};

export default mod;
