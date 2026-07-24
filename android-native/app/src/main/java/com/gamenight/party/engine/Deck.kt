package com.gamenight.party.engine

/**
 * Port of src/engine/deck.ts — a pure, seeded draw/discard deck primitive.
 *
 * No clock, no Math.random: all randomness is derived from a numeric [seed] via [Rng.shuffle]
 * (a fresh [Rng] per call, exactly like the web `shuffle(items, seed)`). Operations never mutate
 * their input — they return new immutable state.
 */

/**
 * A draw/discard deck. [current] is the most recently activated item (the card "in play");
 * `null` means "none set" (the web's absent `current` key).
 */
data class DeckState<T>(
    val drawPile: List<T>,
    val discardPile: List<T>,
    val current: T? = null,
)

/** Result of a [draw]: the new [deck], the items [drawn], and whether a reshuffle happened. */
data class DrawResult<T>(
    val deck: DeckState<T>,
    val drawn: List<T>,
    val reshuffled: Boolean,
)

/** Build a fresh deck: items shuffled into the draw pile (seeded), empty discard. */
fun <T> create(items: List<T>, seed: Int): DeckState<T> =
    DeckState(drawPile = Rng(seed).shuffle(items), discardPile = emptyList())

/**
 * Draw up to [n] items from the top of the draw pile (the end of the list). When the draw pile is
 * empty but the discard pile still has cards, the discard pile is reshuffled (seeded) into the draw
 * pile and [DrawResult.reshuffled] is true.
 *
 * Total: non-positive [n] is a no-op (returns the input deck unchanged with an empty `drawn`).
 * [n] larger than the total available cards draws everything. Never mutates the input.
 */
fun <T> draw(s: DeckState<T>, n: Int, seed: Int): DrawResult<T> {
    if (n <= 0) return DrawResult(s, emptyList(), false)

    var drawPile = s.drawPile.toMutableList()
    var discardPile = s.discardPile.toMutableList()
    var reshuffled = false
    val drawn = ArrayList<T>()

    for (i in 0 until n) {
        if (drawPile.isEmpty()) {
            if (discardPile.isEmpty()) break // truly exhausted
            // Reshuffle the discard pile back into the draw pile.
            drawPile = Rng(seed).shuffle(discardPile).toMutableList()
            discardPile = ArrayList()
            reshuffled = true
        }
        drawn.add(drawPile.removeAt(drawPile.size - 1))
    }

    val deck = DeckState(drawPile.toList(), discardPile.toList(), s.current)
    return DrawResult(deck, drawn, reshuffled)
}

/** Push an item onto the top of the discard pile. Returns a new deck. */
fun <T> discard(s: DeckState<T>, item: T): DeckState<T> =
    DeckState(s.drawPile, s.discardPile + item, s.current)

/** Set the [DeckState.current] item. Returns a new deck (piles untouched). */
fun <T> setCurrent(s: DeckState<T>, item: T): DeckState<T> =
    DeckState(s.drawPile, s.discardPile, item)

/** Number of cards left to draw. */
fun <T> remaining(s: DeckState<T>): Int = s.drawPile.size

/** True when neither pile has any cards left. */
fun <T> isExhausted(s: DeckState<T>): Boolean =
    s.drawPile.isEmpty() && s.discardPile.isEmpty()

/**
 * Merge both piles and shuffle (seeded) into the draw pile; discard becomes empty.
 * Preserves [DeckState.current]. Returns a new deck.
 */
fun <T> reshuffle(s: DeckState<T>, seed: Int): DeckState<T> =
    DeckState(
        drawPile = Rng(seed).shuffle(s.drawPile + s.discardPile),
        discardPile = emptyList(),
        current = s.current,
    )
