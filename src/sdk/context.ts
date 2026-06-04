// src/sdk/context.ts — React context carrying the impure GameContext (see types.ts)
import { createContext, useContext } from 'react';
import type { GameContext } from './types';

export const GameContextObject = createContext<GameContext | null>(null);
export const GameContextProvider = GameContextObject.Provider;

export function useGameContext(): GameContext {
  const v = useContext(GameContextObject);
  if (!v) throw new Error('useGameContext must be used within GameContextProvider');
  return v;
}
