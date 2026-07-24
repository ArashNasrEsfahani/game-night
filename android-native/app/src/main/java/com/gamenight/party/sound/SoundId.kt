package com.gamenight.party.sound

/**
 * The native mirror of the web's `SoundId` set (see `src/services/sound.ts` / `src/sdk/types.ts`).
 *
 * Every entry is synthesized at runtime by [SoundEngine] — there are no audio asset files. The
 * character of each clip (pitch, decay, blip-vs-sweep, chord) tracks the Web Audio recipe used on
 * the web so the two apps feel identical:
 *
 * - [TAP] short square blip — generic press feedback.
 * - [SELECT] one crisp santur pluck — a card / choice landing.
 * - [CORRECT] santur pluck with a quick grace-bend up + an octave shimmer.
 * - [WRONG] a falling sawtooth buzz.
 * - [FORGIVE] a comedic "phew, near miss" wobble (dips, then lifts).
 * - [TICK] a tiny high triangle tick — countdown.
 * - [TIME_UP] three square blasts — the clock running out.
 * - [REVEAL] a rising whoosh + sine sweep with a santur flourish.
 * - [DRUM] a tombak/dombak hand-drum hit (low membrane + noise slap).
 * - [BOING] a springy two-stage bounce.
 * - [WIN] a drum kick + ascending pentatonic santur run + shimmering cap.
 * - [SPARKLE] glittery upward pings + airy shimmer (confetti accent).
 * - [LOSE] a descending sawtooth lament.
 * - [EXPLOSION] a sub-bass thump + broadband blast falling into a rumble.
 * - [SHUFFLE] a filtered noise sweep — cards shuffling.
 * - [PASS] a short filtered noise blip — handing the device on.
 */
enum class SoundId {
    TAP,
    CORRECT,
    WRONG,
    TICK,
    TIME_UP,
    REVEAL,
    WIN,
    LOSE,
    SHUFFLE,
    PASS,
    EXPLOSION,
    SPARKLE,
    BOING,
    DRUM,
    SELECT,
    FORGIVE,
}
