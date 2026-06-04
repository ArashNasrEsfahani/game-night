// src/services/clock.ts — the real clock (impure; host-side only). Games read it via ctx.clock.
import type { ClockService } from '../sdk/types';

export const clockService: ClockService = {
  now: () => Date.now(),
  onFrame: (cb) => {
    let raf = 0;
    let active = true;
    const loop = () => {
      if (!active) return;
      cb(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
    };
  },
  interval: (ms, cb) => {
    const id = setInterval(() => cb(Date.now()), ms);
    return () => clearInterval(id);
  },
};
