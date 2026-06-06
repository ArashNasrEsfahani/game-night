import type { GameModule } from '../../sdk/types';
import { manifest } from './manifest';
import { createInitialState, reducer, computeWinners } from './logic';
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
  getOutcome: (s, c) => {
    const winners = computeWinners(s);
    const participantIds = c.players.map((p) => p.id);
    if (s.mode === 'teams') {
      return {
        mode: 'team',
        winnerIds: s.participants.filter((p) => winners.includes(p.id)).flatMap((p) => p.memberIds),
        participantIds,
      };
    }
    return { mode: 'individual', winnerIds: winners, participantIds };
  },
};

export default mod;
