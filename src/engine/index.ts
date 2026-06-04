// src/engine/index.ts — barrel of every pure primitive namespace (host-side convenience).
// Games import primitives directly from ../../engine/<name> in their logic.ts.
export * as roster from './roster';
export * as teams from './teams';
export * as turnOrder from './turnOrder';
export * as timer from './timer';
export * as deck from './deck';
export * as scoring from './scoring';
export * as voting from './voting';
export * as revealGate from './revealGate';
export * as phaseMachine from './phaseMachine';
export * as results from './results';
export * as rng from './rng';
export * as ids from './ids';
