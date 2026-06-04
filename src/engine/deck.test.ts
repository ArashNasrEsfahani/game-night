import { describe, it, expect } from 'vitest';
import {
  create,
  draw,
  discard,
  setCurrent,
  remaining,
  isExhausted,
  reshuffle,
  type DeckState,
} from './deck';

const items = ['a', 'b', 'c', 'd', 'e'];

describe('create', () => {
  it('shuffles all items into the draw pile with an empty discard', () => {
    const d = create(items, 42);
    expect([...d.drawPile].sort()).toEqual([...items].sort());
    expect(d.discardPile).toEqual([]);
    expect(d.current).toBeUndefined();
  });
  it('is deterministic for the same seed', () => {
    expect(create(items, 7)).toEqual(create(items, 7));
  });
  it('different seeds usually differ', () => {
    expect(create(items, 1)).not.toEqual(create(items, 2));
  });
  it('handles empty input', () => {
    const d = create<string>([], 1);
    expect(d.drawPile).toEqual([]);
    expect(d.discardPile).toEqual([]);
  });
  it('does not mutate the input array', () => {
    const src = [1, 2, 3, 4, 5];
    create(src, 3);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('draw', () => {
  it('draws from the top (end) of the draw pile without reshuffle', () => {
    const d: DeckState<string> = { drawPile: ['x', 'y', 'z'], discardPile: [] };
    const r = draw(d, 2, 1);
    expect(r.drawn).toEqual(['z', 'y']);
    expect(r.deck.drawPile).toEqual(['x']);
    expect(r.reshuffled).toBe(false);
  });
  it('is deterministic for the same seed', () => {
    const d = create(items, 9);
    expect(draw(d, 3, 5)).toEqual(draw(d, 3, 5));
  });
  it('does not mutate the input deck', () => {
    const d: DeckState<string> = { drawPile: ['x', 'y', 'z'], discardPile: ['q'] };
    const before = JSON.stringify(d);
    draw(d, 2, 1);
    expect(JSON.stringify(d)).toEqual(before);
  });
  it('non-positive n is a no-op returning the same deck', () => {
    const d = create(items, 1);
    const r0 = draw(d, 0, 2);
    expect(r0.drawn).toEqual([]);
    expect(r0.reshuffled).toBe(false);
    expect(r0.deck).toBe(d);
    const rNeg = draw(d, -3, 2);
    expect(rNeg.drawn).toEqual([]);
    expect(rNeg.deck).toBe(d);
  });
  it('floors a fractional n', () => {
    const d: DeckState<string> = { drawPile: ['x', 'y', 'z'], discardPile: [] };
    const r = draw(d, 2.9, 1);
    expect(r.drawn.length).toBe(2);
  });
  it('auto-reshuffles the discard pile when the draw pile empties', () => {
    const d: DeckState<string> = { drawPile: ['a'], discardPile: ['b', 'c', 'd'] };
    const r = draw(d, 2, 11);
    expect(r.reshuffled).toBe(true);
    expect(r.drawn.length).toBe(2);
    expect(r.drawn[0]).toBe('a'); // first draw comes from the existing draw pile
    // every drawn card is one of the originals; no duplicates
    expect(new Set(r.drawn).size).toBe(2);
    // total cards conserved
    const total = r.deck.drawPile.length + r.deck.discardPile.length + r.drawn.length;
    expect(total).toBe(4);
    expect(r.deck.discardPile).toEqual([]);
  });
  it('reshuffle on draw is seeded/deterministic', () => {
    const d: DeckState<string> = { drawPile: [], discardPile: ['b', 'c', 'd', 'e'] };
    expect(draw(d, 3, 77)).toEqual(draw(d, 3, 77));
  });
  it('drawing exactly all available cards from both piles works', () => {
    const d: DeckState<string> = { drawPile: ['a', 'b'], discardPile: ['c', 'd'] };
    const r = draw(d, 4, 3);
    expect(r.drawn.length).toBe(4);
    expect(new Set(r.drawn).size).toBe(4);
    expect(isExhausted(r.deck)).toBe(true);
    expect(r.reshuffled).toBe(true);
  });
  it('drawing more than available draws everything and stops (no infinite loop)', () => {
    const d: DeckState<string> = { drawPile: ['a', 'b'], discardPile: ['c'] };
    const r = draw(d, 99, 3);
    expect(r.drawn.length).toBe(3);
    expect(isExhausted(r.deck)).toBe(true);
  });
  it('drawing from a fully empty deck is a no-op draw', () => {
    const d: DeckState<string> = { drawPile: [], discardPile: [] };
    const r = draw(d, 5, 1);
    expect(r.drawn).toEqual([]);
    expect(r.reshuffled).toBe(false);
    expect(isExhausted(r.deck)).toBe(true);
  });
  it('preserves current through a draw', () => {
    const d: DeckState<string> = { drawPile: ['x', 'y'], discardPile: [], current: 'C' };
    const r = draw(d, 1, 1);
    expect(r.deck.current).toBe('C');
  });
  it('does not add a current key when the source had none', () => {
    const d: DeckState<string> = { drawPile: ['x', 'y'], discardPile: [] };
    const r = draw(d, 1, 1);
    expect('current' in r.deck).toBe(false);
  });
});

describe('discard', () => {
  it('appends to the top of the discard pile, new object', () => {
    const d: DeckState<string> = { drawPile: ['x'], discardPile: ['a'] };
    const out = discard(d, 'b');
    expect(out.discardPile).toEqual(['a', 'b']);
    expect(out.drawPile).toEqual(['x']);
    expect(out).not.toBe(d);
  });
  it('does not mutate the input', () => {
    const d: DeckState<string> = { drawPile: ['x'], discardPile: ['a'] };
    discard(d, 'b');
    expect(d.discardPile).toEqual(['a']);
  });
  it('preserves current', () => {
    const d: DeckState<string> = { drawPile: [], discardPile: [], current: 'C' };
    expect(discard(d, 'b').current).toBe('C');
  });
});

describe('setCurrent', () => {
  it('sets current and leaves piles untouched', () => {
    const d: DeckState<string> = { drawPile: ['x'], discardPile: ['y'] };
    const out = setCurrent(d, 'Z');
    expect(out.current).toBe('Z');
    expect(out.drawPile).toEqual(['x']);
    expect(out.discardPile).toEqual(['y']);
    expect(out).not.toBe(d);
  });
  it('replaces an existing current', () => {
    const d: DeckState<string> = { drawPile: [], discardPile: [], current: 'old' };
    expect(setCurrent(d, 'new').current).toBe('new');
  });
  it('does not mutate the input', () => {
    const d: DeckState<string> = { drawPile: [], discardPile: [], current: 'old' };
    setCurrent(d, 'new');
    expect(d.current).toBe('old');
  });
});

describe('remaining', () => {
  it('returns the draw pile length', () => {
    expect(remaining({ drawPile: ['a', 'b', 'c'], discardPile: ['z'] })).toBe(3);
    expect(remaining({ drawPile: [], discardPile: ['z'] })).toBe(0);
  });
});

describe('isExhausted', () => {
  it('is true only when both piles are empty', () => {
    expect(isExhausted({ drawPile: [], discardPile: [] })).toBe(true);
    expect(isExhausted({ drawPile: ['a'], discardPile: [] })).toBe(false);
    expect(isExhausted({ drawPile: [], discardPile: ['a'] })).toBe(false);
    expect(isExhausted({ drawPile: ['a'], discardPile: ['b'] })).toBe(false);
  });
});

describe('reshuffle', () => {
  it('merges both piles into a shuffled draw pile with empty discard', () => {
    const d: DeckState<string> = { drawPile: ['a', 'b'], discardPile: ['c', 'd'] };
    const out = reshuffle(d, 5);
    expect([...out.drawPile].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(out.discardPile).toEqual([]);
  });
  it('is deterministic for the same seed', () => {
    const d: DeckState<string> = { drawPile: ['a', 'b'], discardPile: ['c', 'd', 'e'] };
    expect(reshuffle(d, 13)).toEqual(reshuffle(d, 13));
  });
  it('does not mutate the input', () => {
    const d: DeckState<string> = { drawPile: ['a', 'b'], discardPile: ['c'] };
    const before = JSON.stringify(d);
    reshuffle(d, 1);
    expect(JSON.stringify(d)).toEqual(before);
  });
  it('preserves current', () => {
    const d: DeckState<string> = { drawPile: ['a'], discardPile: ['b'], current: 'C' };
    expect(reshuffle(d, 2).current).toBe('C');
  });
  it('handles an already-empty deck', () => {
    const out = reshuffle<string>({ drawPile: [], discardPile: [] }, 1);
    expect(out.drawPile).toEqual([]);
    expect(out.discardPile).toEqual([]);
  });
  it('reshuffle is idempotent in content (same multiset) regardless of seed', () => {
    const d: DeckState<string> = { drawPile: ['a', 'b', 'c'], discardPile: ['d', 'e'] };
    const once = reshuffle(d, 9);
    const twice = reshuffle(once, 9);
    expect([...twice.drawPile].sort()).toEqual([...once.drawPile].sort());
  });
});
