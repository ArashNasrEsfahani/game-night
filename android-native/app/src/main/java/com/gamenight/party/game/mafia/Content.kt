package com.gamenight.party.game.mafia

import com.gamenight.party.model.LocalizedString
import kotlin.math.roundToInt

/**
 * Presets + composition helpers — a Kotlin port of the non-Studio parts of
 * src/games/mafia/content.ts. Mafia has NO shared JSON content database (its role text + structural
 * night specs live in [Roles.kt], exactly like the web keeps them in roles.ts), so there is no
 * ContentStore loader here: this file only provides the role presets and the composition math the
 * web `content.ts` exposes.
 */

data class RolePreset(
    val id: String,
    val name: LocalizedString,
    val minPlayers: Int,
    val maxPlayers: Int,
    val composition: Map<RoleId, Int>,
)

val PRESETS: List<RolePreset> = listOf(
    RolePreset(
        id = "classic-5",
        name = LocalizedString("Classic (5)", "کلاسیک (۵)"),
        minPlayers = 5,
        maxPlayers = 5,
        composition = linkedMapOf("mafia" to 1, "detective" to 1, "doctor" to 1, "citizen" to 2),
    ),
    RolePreset(
        id = "classic-7",
        name = LocalizedString("Classic (7)", "کلاسیک (۷)"),
        minPlayers = 7,
        maxPlayers = 7,
        composition = linkedMapOf("mafia" to 2, "detective" to 1, "doctor" to 1, "citizen" to 3),
    ),
    RolePreset(
        id = "advanced-10",
        name = LocalizedString("Advanced (10)", "پیشرفته (۱۰)"),
        minPlayers = 10,
        maxPlayers = 10,
        composition = linkedMapOf(
            "godfather" to 1, "mafia" to 2, "detective" to 1, "doctor" to 1, "sniper" to 1, "citizen" to 4,
        ),
    ),
    RolePreset(
        id = "chaos-12",
        name = LocalizedString("Chaos (12)", "آشوب (۱۲)"),
        minPlayers = 12,
        maxPlayers = 12,
        composition = linkedMapOf(
            "godfather" to 1,
            "framer" to 1,
            "mafia" to 1,
            "detective" to 1,
            "doctor" to 1,
            "bodyguard" to 1,
            "escort" to 1,
            "sniper" to 1,
            "jester" to 1,
            "citizen" to 3,
        ),
    ),
)

/** A sensible auto composition for any player count (used as the Setup default). */
fun autoComposition(n: Int): Map<RoleId, Int> {
    if (n < 5) return emptyMap()
    val mafia = maxOf(1, (n / 4.0).roundToInt())
    val detective = 1
    val doctor = 1
    val sniper = if (n >= 9) 1 else 0
    val citizen = maxOf(0, n - mafia - detective - doctor - sniper)
    val comp = linkedMapOf<RoleId, Int>(
        "mafia" to mafia,
        "detective" to detective,
        "doctor" to doctor,
        "citizen" to citizen,
    )
    if (sniper > 0) comp["sniper"] = sniper
    return comp
}

fun compositionTotal(c: Map<RoleId, Int>): Int = c.values.sum()

fun mafiaInComposition(c: Map<RoleId, Int>): Int =
    c.entries.sumOf { (id, count) ->
        val role = ROLES[id]
        if (role != null && countsAsMafia(role)) count else 0
    }
