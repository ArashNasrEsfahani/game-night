// src/games/truth-or-dare/logic.ts — PURE logic. No clock/RNG/IO; seeds via createInitialState / action payloads.
import type { ColorToken, GameConfig, GameStateBase } from '../../sdk/types';
import type { DeckState } from '../../engine/deck';
import type { ScoreState } from '../../engine/scoring';
import type { RevealGateState } from '../../engine/revealGate';
import * as deck from '../../engine/deck';
import * as scoring from '../../engine/scoring';
import * as revealGate from '../../engine/revealGate';
import { pick, deriveSeed } from '../../engine/rng';
import { asPlayerId } from '../../engine/ids';
import { PROMPT_BY_ID, getPool } from './content';
import type { Intensity, PromptItem, PromptKind } from './content';
import { readOptions } from './config';
import type { EndType, ToDOptions } from './config';

export type ToDPhase = 'idle' | 'choosing' | 'revealing' | 'resolving' | 'gameOver' | 'error';
export type Outcome = 'done' | 'skip';

export interface TurnRecord {
  turnIndex: number;
  playerId: string;
  kind: PromptKind;
  promptId: string;
  intensity: Intensity;
  outcome: Outcome;
  pointsDelta: number;
}

export interface ToDState extends GameStateBase {
  phase: ToDPhase;
  options: ToDOptions;
  playerIds: string[];
  playerNames: Record<string, string>;
  playerColors: Record<string, ColorToken | undefined>;
  activePlayerId: string | null;
  lastPlayerId: string | null;
  cursor: number; // sequential rotation pointer
  currentKind: PromptKind | null;
  currentPromptId: string | null;
  truthDeck: DeckState<string>;
  dareDeck: DeckState<string>;
  scores: ScoreState;
  reveal: RevealGateState | null;
  turnIndex: number;
  roundIndex: number;
  spinSerial: number;
  history: TurnRecord[];
  endReason: EndType | null;
  errorCode: 'EMPTY_POOL' | 'NOT_ENOUGH_PLAYERS' | null;
}

export type ToDAction =
  | { type: 'SPIN'; seed: number }
  | { type: 'NEXT_PLAYER' }
  | { type: 'CHOOSE'; kind: PromptKind; seed: number }
  | { type: 'REVEAL' }
  | { type: 'RESOLVE'; outcome: Outcome }
  | { type: 'REDRAW'; seed: number }
  | { type: 'END_GAME' };

export function pickSpinTarget(
  playerIds: string[],
  lastPlayerId: string | null,
  avoid: boolean,
  seed: number,
): string {
  let candidates = playerIds;
  if (avoid && playerIds.length > 1 && lastPlayerId) {
    const filtered = playerIds.filter((id) => id !== lastPlayerId);
    if (filtered.length > 0) candidates = filtered;
  }
  return pick(candidates, seed);
}

function shouldGate(options: ToDOptions, prompt: PromptItem): boolean {
  if (options.privateReveal === 'always') return true;
  if (options.privateReveal === 'spicyOnly') return prompt.intensity === 'spicy';
  return false;
}

function computeDelta(options: ToDOptions, kind: PromptKind, outcome: Outcome): number {
  if (options.scoringMode !== 'points') return 0;
  if (outcome === 'skip') return options.pointsForSkip;
  return kind === 'dare' ? options.pointsForDare : options.pointsForTruth;
}

function evalEnd(options: ToDOptions, scores: ScoreState, roundIndex: number): EndType | null {
  if (options.endType === 'rounds') return roundIndex >= options.endValue ? 'rounds' : null;
  if (options.endType === 'target') {
    if (options.scoringMode !== 'points') return null;
    const max = Math.max(0, ...Object.values(scores.totals));
    return max >= options.endValue ? 'target' : null;
  }
  return null;
}

function drawPrompt(
  d: DeckState<string>,
  seed: number,
): { promptId: string | null; deck: DeckState<string> } {
  const r = deck.draw(d, 1, seed);
  const promptId = r.drawn[0] ?? null;
  const next = promptId !== null ? deck.discard(r.deck, promptId) : r.deck;
  return { promptId, deck: next };
}

export function createInitialState(config: GameConfig, seed: number): ToDState {
  const options = readOptions(config);
  const playerIds = config.players.map((p) => p.id as string);
  const playerNames: Record<string, string> = {};
  const playerColors: Record<string, ColorToken | undefined> = {};
  config.players.forEach((p) => {
    playerNames[p.id] = p.name;
    playerColors[p.id] = p.color;
  });

  const pc = Math.max(2, playerIds.length);
  const truthPool = getPool({ kind: 'truth', intensities: options.intensities, playerCount: pc });
  const darePool = getPool({ kind: 'dare', intensities: options.intensities, playerCount: pc });

  const errorCode: ToDState['errorCode'] =
    playerIds.length < 2
      ? 'NOT_ENOUGH_PLAYERS'
      : truthPool.length === 0 || darePool.length === 0
        ? 'EMPTY_POOL'
        : null;

  return {
    v: 1,
    phase: errorCode ? 'error' : 'idle',
    finished: false,
    options,
    playerIds,
    playerNames,
    playerColors,
    activePlayerId: null,
    lastPlayerId: null,
    cursor: -1,
    currentKind: null,
    currentPromptId: null,
    truthDeck: deck.create(truthPool.map((p) => p.id), seed),
    dareDeck: deck.create(darePool.map((p) => p.id), deriveSeed(seed, 1)),
    scores: scoring.create(playerIds),
    reveal: null,
    turnIndex: 0,
    roundIndex: 0,
    spinSerial: 0,
    history: [],
    endReason: null,
    errorCode,
  };
}

function startTurn(s: ToDState, target: string): ToDState {
  return {
    ...s,
    phase: 'choosing',
    lastPlayerId: s.activePlayerId,
    activePlayerId: target,
    currentKind: null,
    currentPromptId: null,
    reveal: null,
    spinSerial: s.spinSerial + 1,
  };
}

function drawInto(s: ToDState, kind: PromptKind, seed: number): ToDState {
  const deckKey = kind === 'truth' ? 'truthDeck' : 'dareDeck';
  const { promptId, deck: nextDeck } = drawPrompt(s[deckKey], seed);
  if (promptId === null) return s;
  const prompt = PROMPT_BY_ID[promptId];
  const gate = shouldGate(s.options, prompt);
  return {
    ...s,
    currentKind: kind,
    currentPromptId: promptId,
    [deckKey]: nextDeck,
    reveal: gate ? revealGate.init([asPlayerId(s.activePlayerId ?? '')]) : null,
    phase: gate ? 'revealing' : 'resolving',
  };
}

export function reducer(state: ToDState, action: ToDAction): ToDState {
  const s = state;
  switch (action.type) {
    case 'SPIN': {
      if (s.phase !== 'idle' || s.options.selectionMode !== 'spinner') return s;
      const target = pickSpinTarget(
        s.playerIds,
        s.lastPlayerId,
        s.options.avoidImmediateRepeat,
        action.seed,
      );
      return startTurn(s, target);
    }
    case 'NEXT_PLAYER': {
      if (s.phase !== 'idle' || s.options.selectionMode !== 'sequential') return s;
      const cursor = (s.cursor + 1) % s.playerIds.length;
      return { ...startTurn(s, s.playerIds[cursor]), cursor };
    }
    case 'CHOOSE': {
      if (s.phase !== 'choosing' || !s.activePlayerId) return s;
      return drawInto(s, action.kind, action.seed);
    }
    case 'REVEAL': {
      if (s.phase !== 'revealing' || !s.reveal) return s;
      return { ...s, reveal: revealGate.reveal(s.reveal), phase: 'resolving' };
    }
    case 'REDRAW': {
      if ((s.phase !== 'revealing' && s.phase !== 'resolving') || !s.currentKind) return s;
      return drawInto(s, s.currentKind, action.seed);
    }
    case 'RESOLVE': {
      const okPhase =
        s.phase === 'resolving' || (s.phase === 'revealing' && action.outcome === 'skip');
      if (!okPhase || !s.activePlayerId || !s.currentKind || !s.currentPromptId) return s;
      const prompt = PROMPT_BY_ID[s.currentPromptId];
      const delta = computeDelta(s.options, s.currentKind, action.outcome);
      const scores = scoring.add(s.scores, s.activePlayerId, delta, action.outcome, 0);
      const record: TurnRecord = {
        turnIndex: s.turnIndex,
        playerId: s.activePlayerId,
        kind: s.currentKind,
        promptId: s.currentPromptId,
        intensity: prompt.intensity,
        outcome: action.outcome,
        pointsDelta: delta,
      };
      const turnIndex = s.turnIndex + 1;
      const roundIndex =
        turnIndex % s.playerIds.length === 0 ? s.roundIndex + 1 : s.roundIndex;
      const endReason = evalEnd(s.options, scores, roundIndex);
      return {
        ...s,
        scores,
        history: [...s.history, record],
        turnIndex,
        roundIndex,
        currentKind: null,
        currentPromptId: null,
        reveal: null,
        phase: endReason ? 'gameOver' : 'idle',
        endReason,
        finished: !!endReason,
      };
    }
    case 'END_GAME': {
      if (s.phase === 'gameOver') return s;
      return { ...s, phase: 'gameOver', endReason: 'endless', finished: true };
    }
    default:
      return s;
  }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

export interface ToDStanding {
  id: string;
  score: number;
  rank: number;
}

export function standings(s: ToDState): ToDStanding[] {
  const order = new Map(s.playerIds.map((id, i) => [id, i]));
  const sorted = [...s.playerIds].sort(
    (a, b) =>
      scoring.total(s.scores, b) - scoring.total(s.scores, a) ||
      (order.get(a)! - order.get(b)!),
  );
  let rank = 0;
  let prev = NaN;
  return sorted.map((id, i) => {
    const sc = scoring.total(s.scores, id);
    if (sc !== prev) {
      rank = i + 1;
      prev = sc;
    }
    return { id, score: sc, rank };
  });
}

export function computeWinners(s: ToDState): string[] {
  if (s.options.scoringMode !== 'points') return [];
  return standings(s)
    .filter((r) => r.rank === 1)
    .map((r) => r.id);
}

export const nextSequentialId = (s: ToDState): string =>
  s.playerIds[(s.cursor + 1) % s.playerIds.length] ?? '';
export const promptRevealed = (s: ToDState): boolean =>
  s.phase === 'resolving' || (!!s.reveal && revealGate.holder(s.reveal) === undefined);
