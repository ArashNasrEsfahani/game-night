// src/services/sound.ts — Web-Audio synthesized SFX (no asset files; works offline).
// Mute is handled by the host swapping in noopSound. Every game already calls ctx.sound.play(id).
import type { SoundId, SoundService } from '../sdk/types';

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;

function audio(): Ctx | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A single enveloped oscillator note. */
function tone(
  c: Ctx,
  opts: {
    freq: number;
    to?: number; // glide target
    type?: OscillatorType;
    start?: number; // seconds from now
    dur?: number;
    gain?: number;
    attack?: number;
  },
) {
  const t0 = c.currentTime + (opts.start ?? 0);
  const dur = opts.dur ?? 0.18;
  const peak = opts.gain ?? 0.6;
  const attack = opts.attack ?? 0.008;
  const osc = c.createOscillator();
  osc.type = opts.type ?? 'triangle';
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master!);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Filtered white-noise burst (whooshes / shuffles). */
function noise(c: Ctx, opts: { start?: number; dur?: number; from?: number; to?: number; gain?: number }) {
  const t0 = c.currentTime + (opts.start ?? 0);
  const dur = opts.dur ?? 0.25;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.setValueAtTime(opts.from ?? 800, t0);
  filt.frequency.exponentialRampToValueAtTime(opts.to ?? 2600, t0 + dur);
  filt.Q.value = 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(opts.gain ?? 0.4, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(master!);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, G6: 1568 };

/** A bright plucked note with an octave shimmer on top — santur-flavored. */
function pluck(c: Ctx, freq: number, start = 0, gain = 0.42, dur = 0.18) {
  tone(c, { freq, type: 'triangle', start, dur, gain, attack: 0.004 });
  tone(c, { freq: freq * 2, type: 'sine', start, dur: dur * 0.6, gain: gain * 0.28, attack: 0.004 });
}

/** A tombak/dombak hand-drum hit: a low membrane "tom" plus a short noise "bak" slap. */
function drumHit(c: Ctx, start = 0, freq = 180, gain = 0.7) {
  tone(c, { freq, to: freq * 0.4, type: 'sine', start, dur: 0.18, gain });
  noise(c, { start, dur: 0.05, from: 520, to: 200, gain: gain * 0.3 });
}

function synth(id: SoundId, c: Ctx) {
  switch (id) {
    case 'tap':
      tone(c, { freq: 540, type: 'square', dur: 0.05, gain: 0.35 });
      break;
    case 'correct':
      // santur pluck with a quick Persian grace-bend up into the note + an octave shimmer
      tone(c, { freq: N.E5 * 0.84, to: N.E5, type: 'triangle', dur: 0.06, gain: 0.3 });
      pluck(c, N.E5, 0.05, 0.46, 0.12);
      pluck(c, N.A5, 0.12, 0.46, 0.16);
      break;
    case 'select':
      // one crisp santur pluck — a card/choice landing
      pluck(c, N.G5, 0, 0.5, 0.16);
      break;
    case 'wrong':
      tone(c, { freq: 200, to: 110, type: 'sawtooth', dur: 0.24, gain: 0.45 });
      break;
    case 'forgive':
      // comedic "phew, near miss" wobble — dips, then lifts back up
      tone(c, { freq: 520, to: 360, type: 'sine', dur: 0.12, gain: 0.4 });
      tone(c, { freq: 360, to: 560, type: 'sine', start: 0.1, dur: 0.18, gain: 0.4 });
      break;
    case 'tick':
      tone(c, { freq: 1100, type: 'triangle', dur: 0.03, gain: 0.3 });
      break;
    case 'timeUp':
      tone(c, { freq: N.A5, type: 'square', dur: 0.16, gain: 0.4 });
      tone(c, { freq: N.A5, type: 'square', start: 0.2, dur: 0.16, gain: 0.4 });
      tone(c, { freq: 660, type: 'square', start: 0.42, dur: 0.26, gain: 0.4 });
      break;
    case 'reveal':
      noise(c, { dur: 0.3, from: 500, to: 3200, gain: 0.32 });
      tone(c, { freq: N.C5, to: N.C6, type: 'sine', dur: 0.3, gain: 0.22 });
      // a quick santur tremolo flourish over the whoosh
      pluck(c, N.G5, 0.04, 0.18, 0.1);
      pluck(c, N.C6, 0.12, 0.18, 0.1);
      break;
    case 'drum':
      drumHit(c, 0);
      break;
    case 'boing':
      // a springy bounce
      tone(c, { freq: 680, to: 220, type: 'sawtooth', dur: 0.12, gain: 0.4 });
      tone(c, { freq: 220, to: 520, type: 'sine', start: 0.1, dur: 0.16, gain: 0.35 });
      break;
    case 'win': {
      // a tombak kick, then a triumphant ascending pentatonic santur run + shimmering cap
      drumHit(c, 0, 150, 0.6);
      const run = [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6];
      run.forEach((f, i) => pluck(c, f, 0.08 + i * 0.09, 0.5, 0.22));
      tone(c, { freq: N.G6, start: 0.66, dur: 0.5, gain: 0.4, type: 'sine' });
      tone(c, { freq: N.C6, start: 0.66, dur: 0.5, gain: 0.3, type: 'triangle' });
      noise(c, { start: 0.6, dur: 0.5, from: 4000, to: 9000, gain: 0.12 });
      break;
    }
    case 'sparkle': {
      // glittery upward pings + airy shimmer (confetti / celebration accent)
      [N.C6, N.E6, N.G6, 2093].forEach((f, i) =>
        tone(c, { freq: f, type: 'sine', start: i * 0.05, dur: 0.18, gain: 0.3 }),
      );
      noise(c, { dur: 0.3, from: 6000, to: 11000, gain: 0.1 });
      break;
    }
    case 'lose':
      [N.G5, N.E5, N.C5, 392].forEach((f, i) =>
        tone(c, { freq: f, start: i * 0.13, dur: 0.26, gain: 0.45, type: 'sawtooth' }),
      );
      break;
    case 'explosion': {
      // a real BOOM: a sub-bass thump + a broadband blast falling from bright to rumble + crackle
      tone(c, { freq: 120, to: 36, type: 'sine', dur: 0.6, gain: 0.95, attack: 0.005 });
      tone(c, { freq: 200, to: 48, type: 'sawtooth', dur: 0.45, gain: 0.6, attack: 0.005 });
      noise(c, { dur: 0.55, from: 1800, to: 60, gain: 0.7 });
      noise(c, { start: 0.04, dur: 0.3, from: 900, to: 120, gain: 0.4 });
      break;
    }
    case 'shuffle':
      noise(c, { dur: 0.32, from: 1200, to: 600, gain: 0.3 });
      break;
    case 'pass':
      noise(c, { dur: 0.14, from: 1800, to: 700, gain: 0.28 });
      break;
  }
}

export const soundService: SoundService = {
  play: (id) => {
    try {
      const c = audio();
      if (c) synth(id, c);
    } catch {
      /* ignore */
    }
  },
  preload: () => {
    /* synthesis is instant; nudge the context awake */
    try {
      audio();
    } catch {
      /* ignore */
    }
  },
  stop: () => {
    /* one-shots are short; nothing to stop */
  },
};

export const noopSound: SoundService = {
  play: () => {},
  preload: () => {},
  stop: () => {},
};
