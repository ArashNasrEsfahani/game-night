package com.gamenight.party.game.minesweeper

import com.gamenight.party.model.Lang
import com.gamenight.party.model.LocalizedString
import com.gamenight.party.model.PlayerSeat

/**
 * Mine Hunt setup options — a 1:1 port of src/games/minesweeper/config.ts.
 *
 * Minesweeper has NO shared JSON content (the board is generated, not authored), so this file holds
 * the presets + normalization that the web `config.ts` provides instead of a ContentStore loader.
 */

enum class MineDifficulty { EASY, MEDIUM, HARD, CUSTOM }

data class MinesweeperOptions(
    val cols: Int,
    val rows: Int,
    /** Number of mines hidden on the board — these are the prizes players hunt for. */
    val mines: Int,
    val difficulty: MineDifficulty,
)

/** Board geometry for each non-custom difficulty (mirrors PRESETS in config.ts). */
data class MinePreset(val cols: Int, val rows: Int, val mines: Int)

val MINE_PRESETS: Map<MineDifficulty, MinePreset> = mapOf(
    MineDifficulty.EASY to MinePreset(cols = 8, rows = 8, mines = 12),
    MineDifficulty.MEDIUM to MinePreset(cols = 10, rows = 12, mines = 28),
    MineDifficulty.HARD to MinePreset(cols = 12, rows = 16, mines = 50),
)

val DEFAULT_MINE_OPTIONS: MinesweeperOptions = MINE_PRESETS.getValue(MineDifficulty.MEDIUM).let {
    MinesweeperOptions(cols = it.cols, rows = it.rows, mines = it.mines, difficulty = MineDifficulty.MEDIUM)
}

/**
 * Clamp a custom board into legal bounds; snap a preset board to its fixed geometry. Mirrors
 * `normalizeOptions` in config.ts.
 */
fun normalizeMineOptions(o: MinesweeperOptions): MinesweeperOptions {
    if (o.difficulty == MineDifficulty.CUSTOM) {
        val cols = o.cols.coerceIn(6, 14)
        val rows = o.rows.coerceIn(6, 18)
        val mines = o.mines.coerceIn(1, cols * rows - 9)
        return MinesweeperOptions(cols = cols, rows = rows, mines = mines, difficulty = MineDifficulty.CUSTOM)
    }
    val p = MINE_PRESETS.getValue(o.difficulty)
    return MinesweeperOptions(cols = p.cols, rows = p.rows, mines = p.mines, difficulty = o.difficulty)
}

/**
 * The full match config handed from Setup into a match — the minesweeper-specific analogue of the
 * web `GameConfig`.
 */
data class MinesweeperConfig(
    val players: List<PlayerSeat>,
    val options: MinesweeperOptions,
    val lang: Lang = Lang.EN,
)

/** Validation errors (bilingual), or null when the config is legal. Mirrors `validateConfig`. */
fun validateMineConfig(players: List<PlayerSeat>, options: MinesweeperOptions): List<LocalizedString>? {
    val o = normalizeMineOptions(options)
    val errors = mutableListOf<LocalizedString>()
    val n = players.size
    if (n < 1) errors.add(LocalizedString("Add at least 1 player", "حداقل ۱ بازیکن اضافه کن"))
    if (n > 4) errors.add(LocalizedString("At most 4 players", "حداکثر ۴ بازیکن"))
    if (o.cols * o.rows < 16) errors.add(LocalizedString("Board is too small", "صفحه خیلی کوچک است"))
    if (o.mines > o.cols * o.rows - 9)
        errors.add(LocalizedString("Too many mines for this board", "برای این صفحه مین زیادی است"))
    if (o.mines < 1) errors.add(LocalizedString("Need at least 1 mine", "حداقل به ۱ مین نیاز است"))
    return errors.ifEmpty { null }
}
