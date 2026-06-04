// src/services/sound.ts — howler wrapper. Mute is handled by the host swapping in noopSound.
import { Howl } from 'howler';
import type { SoundId, SoundService } from '../sdk/types';

const cache: Partial<Record<SoundId, Howl>> = {};

function load(id: SoundId): Howl | undefined {
  if (cache[id]) return cache[id];
  try {
    const h = new Howl({
      src: [`/sfx/${id}.webm`, `/sfx/${id}.mp3`],
      preload: false,
      volume: 0.6,
    });
    cache[id] = h;
    return h;
  } catch {
    return undefined;
  }
}

export const soundService: SoundService = {
  play: (id) => {
    try {
      load(id)?.play();
    } catch {
      /* assets may not exist yet — fail silently */
    }
  },
  preload: (ids) => {
    ids.forEach((id) => {
      try {
        load(id)?.load();
      } catch {
        /* ignore */
      }
    });
  },
  stop: (id) => {
    if (id) cache[id]?.stop();
    else Object.values(cache).forEach((h) => h?.stop());
  },
};

export const noopSound: SoundService = {
  play: () => {},
  preload: () => {},
  stop: () => {},
};
