package com.gamenight.party.game.minesweeper

import com.gamenight.party.engine.Rng
import com.gamenight.party.model.ColorToken
import kotlin.math.roundToInt

/**
 * Mine Hunt — PURE logic, a faithful Kotlin port of src/games/minesweeper/logic.ts. No clock / IO;
 * the only randomness is the mine-layout seed, which arrives inside the first [MinesweeperAction.Reveal]
 * so the reducer stays deterministic and side-effect free.
 *
 * "Reverse Minesweeper": the mines are the PRIZES. On your turn you tap a square —
 *   - a MINE  -> you found one (+1) and you get to tap again (reward),
 *   - a SAFE  -> it reveals a number clue (how many mines touch it) and your turn passes.
 * Nothing explodes; there are no lives. The game ends when every mine has been found; whoever found
 * the most wins.
 */

enum class MinePhase { PLAYING, GAME_OVER }

enum class WinReason { NONE, ALL_FOUND, SOLO_WIN }

enum class MineError { BAD_BOARD }

enum class FlashType { FOUND, SAFE, WIN }

data class Flash(val type: FlashType, val index: Int? = null)

data class Cell(
    val index: Int,
    val mine: Boolean,
    /** 1..8 neighbouring mines (every safe cell borders at least one). */
    val adjacent: Int,
    val revealed: Boolean,
    val revealedBy: String?, // seat id, for tint + score attribution
    /** A rare "burst" square: tapping it opens a small cluster of safe squares at once. */
    val burst: Boolean,
)

data class MineSeat(
    val id: String,
    val name: String,
    val color: ColorToken?,
    val score: Int, // mines personally found
)

data class MinesweeperState(
    val version: Int,
    val phase: MinePhase,
    val finished: Boolean,
    val options: MinesweeperOptions,
    val cols: Int,
    val rows: Int,
    val board: List<Cell>,
    val minesPlaced: Boolean, // false until the first reveal seeds the layout
    val seats: List<MineSeat>,
    val turnNo: Int, // active seat = turnNo modulo seat count
    val flash: Flash?,
    val winnerIds: List<String>,
    val winReason: WinReason,
    val errorCode: MineError?,
)

sealed interface MinesweeperAction {
    /** [seed] is only consumed on the first reveal (it seeds the mine layout). */
    data class Reveal(val index: Int, val seed: Int) : MinesweeperAction
    object ClearFlash : MinesweeperAction

    /** End the match early and show the results (winner-so-far by mines found). */
    object EndGame : MinesweeperAction
}

// Distinct, vivid colours so each player's turn (background) and found mines read as their own.
internal val SEAT_PALETTE: List<ColorToken> =
    listOf(ColorToken.ROSE, ColorToken.SKY, ColorToken.LIME, ColorToken.GRAPE)

/* ─────────────────────────  Pure board helpers  ───────────────────────── */

fun neighbors(index: Int, cols: Int, rows: Int): List<Int> {
    val r = index / cols
    val c = index % cols
    val out = ArrayList<Int>(8)
    for (dr in -1..1) for (dc in -1..1) {
        if (dr == 0 && dc == 0) continue
        val nr = r + dr
        val nc = c + dc
        if (nr in 0 until rows && nc in 0 until cols) out.add(nr * cols + nc)
    }
    return out
}

/**
 * Scatter `mines` mines anywhere on the board (a mine is a prize, so no first-click safety), then
 * GUARANTEE every safe square borders at least one mine — no 0-clue squares — by greedily adding a
 * few covering mines where needed. Pure & deterministic for a given seed (so the actual mine count
 * may end up a little above the requested one).
 */
private fun placeMines(board: List<Cell>, cols: Int, rows: Int, mines: Int, seed: Int): List<Cell> {
    val n = cols * rows
    val order = Rng(seed).shuffle((0 until n).toList())
    val mineSet = HashSet(order.take(maxOf(1, minOf(mines, n - 1))))
    fun covered(i: Int): Boolean =
        mineSet.contains(i) || neighbors(i, cols, rows).any { mineSet.contains(it) }
    for (i in order) {
        if (covered(i)) continue
        // Place a mine on the spot (self or a neighbour) that newly covers the most squares.
        val candidates = (listOf(i) + neighbors(i, cols, rows)).filter { !mineSet.contains(it) }
        var best = candidates[0]
        var bestGain = -1
        for (cand in candidates) {
            val gain = (listOf(cand) + neighbors(cand, cols, rows)).count { !covered(it) }
            if (gain > bestGain) {
                bestGain = gain
                best = cand
            }
        }
        mineSet.add(best)
    }
    // Pick a few (not many) safe squares to be "burst" tiles that open a cluster when tapped.
    val safe = order.filter { !mineSet.contains(it) }
    val burstCount = minOf(safe.size, maxOf(1, (n / 30.0).roundToInt()))
    val burstSet = HashSet(safe.take(burstCount))
    return board.map { cell ->
        val mine = mineSet.contains(cell.index)
        val adjacent = if (mine) 0 else neighbors(cell.index, cols, rows).count { mineSet.contains(it) }
        cell.copy(mine = mine, adjacent = adjacent, burst = !mine && burstSet.contains(cell.index))
    }
}

/**
 * Reveal a bounded cluster of safe squares around a burst tile (flood through safe cells, stopping
 * at mines, capped so it opens "a bunch" without clearing the whole board).
 */
private fun revealBurst(board: List<Cell>, start: Int, cols: Int, rows: Int, seatId: String): List<Cell> {
    val cap = 10
    val b = board.toMutableList()
    val queue = ArrayDeque<Int>()
    queue.add(start)
    val seen = HashSet<Int>()
    seen.add(start)
    var opened = 0
    while (queue.isNotEmpty() && opened < cap) {
        val i = queue.removeFirst()
        val cell = b[i]
        if (cell.mine || cell.revealed) continue
        b[i] = cell.copy(revealed = true, revealedBy = seatId)
        opened++
        for (j in neighbors(i, cols, rows)) {
            if (!seen.contains(j) && !b[j].mine && !b[j].revealed) {
                seen.add(j)
                queue.add(j)
            }
        }
    }
    return b
}

private fun activeSeatIndex(seats: List<MineSeat>, turnNo: Int): Int {
    val n = seats.size
    return ((turnNo % n) + n) % n
}

fun activeSeat(s: MinesweeperState): MineSeat = s.seats[activeSeatIndex(s.seats, s.turnNo)]

fun foundCount(board: List<Cell>): Int = board.count { it.mine && it.revealed }

private fun revealAll(board: List<Cell>): List<Cell> =
    board.map { if (it.revealed) it else it.copy(revealed = true) }

/* ─────────────────────────  Lifecycle  ───────────────────────── */

fun createInitialState(config: MinesweeperConfig, @Suppress("UNUSED_PARAMETER") seed: Int): MinesweeperState {
    val options = normalizeMineOptions(config.options)
    val cols = options.cols
    val rows = options.rows
    val mines = options.mines
    val n = cols * rows

    val seats: List<MineSeat> = config.players.mapIndexed { i, p ->
        MineSeat(
            id = p.id,
            name = p.name,
            color = p.color ?: SEAT_PALETTE[i % SEAT_PALETTE.size],
            score = 0,
        )
    }

    val board: List<Cell> = (0 until n).map { index ->
        Cell(index = index, mine = false, adjacent = 0, revealed = false, revealedBy = null, burst = false)
    }

    // Need at least one safe cell so there are clues to read.
    val errorCode: MineError? =
        if (seats.size < 1 || seats.size > 4 || n < 16 || mines >= n || mines < 1) MineError.BAD_BOARD else null

    return MinesweeperState(
        version = 2,
        phase = if (errorCode != null) MinePhase.GAME_OVER else MinePhase.PLAYING,
        finished = false,
        options = options,
        cols = cols,
        rows = rows,
        board = board,
        minesPlaced = false,
        seats = seats,
        turnNo = 0,
        flash = null,
        winnerIds = emptyList(),
        winReason = WinReason.NONE,
        errorCode = errorCode,
    )
}

private fun finish(s: MinesweeperState, reason: WinReason, winnerIds: List<String>): MinesweeperState =
    s.copy(
        phase = MinePhase.GAME_OVER,
        finished = true,
        winReason = reason,
        winnerIds = winnerIds,
        flash = Flash(FlashType.WIN),
        board = revealAll(s.board),
    )

/** Highest score (most mines found) wins; ties are shared. */
private fun winnersByScore(seats: List<MineSeat>): List<String> {
    val best = seats.maxOf { it.score }
    return seats.filter { it.score == best }.map { it.id }
}

// Actual mines may exceed the requested count (coverage fill), so count from the board once placed.
private fun minesLeftToFind(s: MinesweeperState): Int =
    (if (s.minesPlaced) s.board.count { it.mine } else s.options.mines) - foundCount(s.board)

/**
 * After a tap: end the game if every mine is found; otherwise a mine keeps the turn (reward) and a
 * safe square passes it. Solo always keeps going (no one to pass to).
 */
private fun afterPick(s: MinesweeperState, foundMine: Boolean): MinesweeperState {
    if (minesLeftToFind(s) == 0) {
        val solo = s.seats.size == 1
        return finish(
            s,
            if (solo) WinReason.SOLO_WIN else WinReason.ALL_FOUND,
            if (solo) listOf(s.seats[0].id) else winnersByScore(s.seats),
        )
    }
    if (s.seats.size == 1 || foundMine) return s // solo, or a found mine -> same player taps again
    return s.copy(turnNo = s.turnNo + 1) // a safe square passes the turn
}

/* ─────────────────────────  Reducer  ───────────────────────── */

fun reducer(state: MinesweeperState, action: MinesweeperAction): MinesweeperState {
    return when (action) {
        is MinesweeperAction.Reveal -> {
            if (state.phase != MinePhase.PLAYING) return state
            var board = state.board
            var base = state
            if (!state.minesPlaced) {
                board = placeMines(state.board, state.cols, state.rows, state.options.mines, action.seed)
                base = state.copy(board = board, minesPlaced = true)
            }
            val cell = board.getOrNull(action.index)
            if (cell == null || cell.revealed) return state // illegal -> no-op (original ref)
            val ai = activeSeatIndex(base.seats, base.turnNo)
            val seatId = base.seats[ai].id

            if (cell.mine) {
                val nextBoard = board.map { c ->
                    if (c.index == action.index) c.copy(revealed = true, revealedBy = seatId) else c
                }
                val seats = base.seats.mapIndexed { i, se -> if (i == ai) se.copy(score = se.score + 1) else se }
                afterPick(
                    base.copy(board = nextBoard, seats = seats, flash = Flash(FlashType.FOUND, action.index)),
                    true,
                )
            } else {
                // Safe square: a burst tile opens a cluster, an ordinary tile opens just itself.
                val nextBoard = if (cell.burst) {
                    revealBurst(board, action.index, base.cols, base.rows, seatId)
                } else {
                    board.map { c -> if (c.index == action.index) c.copy(revealed = true, revealedBy = seatId) else c }
                }
                afterPick(base.copy(board = nextBoard, flash = Flash(FlashType.SAFE, action.index)), false)
            }
        }

        MinesweeperAction.ClearFlash -> if (state.flash == null) state else state.copy(flash = null)

        // End the match early: finalise standings from the mines found so far and reveal the board.
        // Winner-so-far leads the score (ties shared); winReason stays NONE since it wasn't cleared.
        MinesweeperAction.EndGame ->
            if (state.phase != MinePhase.PLAYING) state
            else finish(state, WinReason.NONE, winnersByScore(state.seats))
    }
}

/* ─────────────────────────  Pure selectors  ───────────────────────── */

data class MineStanding(
    val id: String,
    val name: String,
    val color: ColorToken?,
    val score: Int,
    val rank: Int,
)

fun standings(s: MinesweeperState): List<MineStanding> {
    val order = s.seats.withIndex().associate { (i, se) -> se.id to i }
    val sorted = s.seats.sortedWith(
        compareByDescending<MineSeat> { it.score }.thenBy { order.getValue(it.id) },
    )
    var rank = 0
    var prev: Int? = null
    return sorted.mapIndexed { i, se ->
        if (se.score != prev) {
            rank = i + 1
            prev = se.score
        }
        MineStanding(id = se.id, name = se.name, color = se.color, score = se.score, rank = rank)
    }
}

fun minesLeft(s: MinesweeperState): Int = minesLeftToFind(s)

fun isSolo(s: MinesweeperState): Boolean = s.seats.size == 1

fun seatName(s: MinesweeperState, id: String): String = s.seats.firstOrNull { it.id == id }?.name ?: id
