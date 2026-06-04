// src/engine/deck.ts — a pure, seeded draw/discard deck primitive.
// No React, DOM, I/O, stores, or services. No wall clock, no Math.random, no crypto.
// All randomness is derived from a numeric `seed` argument via shuffle from ./rng.

import { shuffle } from './rng';

/**
 * A draw/discard deck. JSON-serializable: only arrays + optional plain value.
 * `current` is the most recently activated item (e.g. the card "in play"); omitted
 * when none is set.
 */
export interface DeckState<T = string> {
  drawPile: T[];
  discardPile: T[];
  current?: T;
}

/** Build a fresh deck: items shuffled into the draw pile (seeded), empty discard. */
export function create<T>(items: T[], seed: number): DeckState<T> {
  return {
    drawPile: shuffle(items, seed),
    discardPile: [],
  };
}

export interface DrawResult<T> {
  deck: DeckState<T>;
  drawn: T[];
  reshuffled: boolean;
}

/**
 * Draw up to `n` items from the top of the draw pile (the end of the array).
 * When the draw pile is empty but the discard pile still has cards, the discard
 * pile is reshuffled (seeded) into the draw pile and `reshuffled` is true.
 *
 * Total: non-positive `n` is a no-op (returns the input deck unchanged with an
 * empty `drawn`). `n` larger than the total available cards draws everything.
 * Never mutates the input.
 */
export function draw<T>(s: DeckState<T>, n: number, seed: number): DrawResult<T> {
  const count = Math.floor(n);
  if (count <= 0) {
    return { deck: s, drawn: [], reshuffled: false };
  }

  let drawPile = s.drawPile.slice();
  let discardPile = s.discardPile.slice();
  let reshuffled = false;
  const drawn: T[] = [];

  for (let i = 0; i < count; i++) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break; // truly exhausted
      // Reshuffle the discard pile back into the draw pile.
      drawPile = shuffle(discardPile, seed);
      discardPile = [];
      reshuffled = true;
    }
    drawn.push(drawPile.pop() as T);
  }

  const deck: DeckState<T> = { drawPile, discardPile };
  if ('current' in s) deck.current = s.current;

  return { deck, drawn, reshuffled };
}

/** Push an item onto the top of the discard pile. Returns a new deck. */
export function discard<T>(s: DeckState<T>, item: T): DeckState<T> {
  const deck: DeckState<T> = {
    drawPile: s.drawPile,
    discardPile: [...s.discardPile, item],
  };
  if ('current' in s) deck.current = s.current;
  return deck;
}

/** Set the `current` item. Returns a new deck (piles untouched). */
export function setCurrent<T>(s: DeckState<T>, item: T): DeckState<T> {
  return {
    drawPile: s.drawPile,
    discardPile: s.discardPile,
    current: item,
  };
}

/** Number of cards left to draw. */
export function remaining<T>(s: DeckState<T>): number {
  return s.drawPile.length;
}

/** True when neither pile has any cards left. */
export function isExhausted<T>(s: DeckState<T>): boolean {
  return s.drawPile.length === 0 && s.discardPile.length === 0;
}

/**
 * Merge both piles and shuffle (seeded) into the draw pile; discard becomes empty.
 * Preserves `current`. Returns a new deck.
 */
export function reshuffle<T>(s: DeckState<T>, seed: number): DeckState<T> {
  const deck: DeckState<T> = {
    drawPile: shuffle([...s.drawPile, ...s.discardPile], seed),
    discardPile: [],
  };
  if ('current' in s) deck.current = s.current;
  return deck;
}
