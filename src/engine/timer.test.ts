import { describe, it, expect } from 'vitest';
import {
  create,
  start,
  pause,
  reset,
  tick,
  elapsedMs,
  remainingMs,
  isExpired,
  type TimerState,
} from './timer';

describe('create', () => {
  it('builds a stopped countdown timer', () => {
    const t = create('countdown', 5000);
    expect(t).toEqual({
      mode: 'countdown',
      durationMs: 5000,
      accumulatedMs: 0,
      startedAt: null,
      running: false,
    });
  });

  it('builds a stopped stopwatch', () => {
    const t = create('stopwatch', 0);
    expect(t.mode).toBe('stopwatch');
    expect(t.running).toBe(false);
    expect(t.startedAt).toBeNull();
    expect(t.accumulatedMs).toBe(0);
  });

  it('clamps a negative duration to 0', () => {
    expect(create('countdown', -1000).durationMs).toBe(0);
  });

  it('produces JSON-serializable plain state', () => {
    const t = create('countdown', 1234);
    expect(JSON.parse(JSON.stringify(t))).toEqual(t);
  });
});

describe('start', () => {
  it('sets startedAt and running', () => {
    const t = start(create('countdown', 1000), 100);
    expect(t.startedAt).toBe(100);
    expect(t.running).toBe(true);
  });

  it('is a no-op when already running (returns same reference)', () => {
    const running = start(create('stopwatch', 0), 100);
    const again = start(running, 500);
    expect(again).toBe(running);
    expect(again.startedAt).toBe(100);
  });

  it('does not mutate the input', () => {
    const base = create('countdown', 1000);
    start(base, 50);
    expect(base.startedAt).toBeNull();
    expect(base.running).toBe(false);
  });
});

describe('pause', () => {
  it('folds the running segment into accumulatedMs', () => {
    const t = pause(start(create('countdown', 10000), 1000), 4000);
    expect(t.accumulatedMs).toBe(3000);
    expect(t.startedAt).toBeNull();
    expect(t.running).toBe(false);
  });

  it('accumulates across multiple start/pause cycles', () => {
    let t = create('stopwatch', 0);
    t = start(t, 0);
    t = pause(t, 1000); // +1000
    t = start(t, 2000);
    t = pause(t, 2500); // +500
    expect(t.accumulatedMs).toBe(1500);
  });

  it('is a no-op when not running (returns same reference)', () => {
    const paused = create('countdown', 1000);
    expect(pause(paused, 999)).toBe(paused);
  });

  it('treats a backwards clock as a zero-length segment (never negative)', () => {
    const t = pause(start(create('stopwatch', 0), 5000), 4000);
    expect(t.accumulatedMs).toBe(0);
  });

  it('does not mutate the input', () => {
    const running = start(create('stopwatch', 0), 1000);
    pause(running, 2000);
    expect(running.running).toBe(true);
    expect(running.accumulatedMs).toBe(0);
  });
});

describe('reset', () => {
  it('zeroes accumulated time and stops the timer', () => {
    const ran = pause(start(create('countdown', 10000), 0), 3000);
    const t = reset(ran, 9999);
    expect(t.accumulatedMs).toBe(0);
    expect(t.startedAt).toBeNull();
    expect(t.running).toBe(false);
  });

  it('preserves mode and duration', () => {
    const t = reset(create('countdown', 7777), 0);
    expect(t.mode).toBe('countdown');
    expect(t.durationMs).toBe(7777);
  });

  it('does not mutate the input', () => {
    const running = start(create('stopwatch', 0), 100);
    reset(running, 500);
    expect(running.running).toBe(true);
    expect(running.startedAt).toBe(100);
  });
});

describe('tick', () => {
  it('is a no-op returning the same reference (idempotent, no drift)', () => {
    const t = start(create('countdown', 5000), 1000);
    const a = tick(t, 2000);
    const b = tick(a, 3000);
    expect(a).toBe(t);
    expect(b).toBe(t);
  });

  it('does not change measured elapsed across many frames', () => {
    let t = start(create('stopwatch', 0), 0);
    const before = elapsedMs(t, 5000);
    for (let now = 0; now <= 5000; now += 16) t = tick(t, now);
    expect(elapsedMs(t, 5000)).toBe(before);
  });
});

describe('elapsedMs', () => {
  it('returns 0 for a freshly created timer', () => {
    expect(elapsedMs(create('countdown', 1000), 12345)).toBe(0);
  });

  it('counts the in-flight segment while running', () => {
    const t = start(create('stopwatch', 0), 1000);
    expect(elapsedMs(t, 3500)).toBe(2500);
  });

  it('does not advance while paused', () => {
    const t = pause(start(create('stopwatch', 0), 0), 2000);
    expect(elapsedMs(t, 9999)).toBe(2000);
  });

  it('sums accumulated and the live segment', () => {
    let t = create('stopwatch', 0);
    t = pause(start(t, 0), 1000); // accumulated 1000
    t = start(t, 5000); // running again
    expect(elapsedMs(t, 5500)).toBe(1500);
  });

  it('never returns negative for a backwards clock', () => {
    const t = start(create('stopwatch', 0), 5000);
    expect(elapsedMs(t, 4000)).toBe(0);
  });

  it('guards against running with a null startedAt', () => {
    const weird: TimerState = {
      mode: 'stopwatch',
      durationMs: 0,
      accumulatedMs: 100,
      startedAt: null,
      running: true,
    };
    expect(elapsedMs(weird, 1000)).toBe(100);
  });
});

describe('remainingMs', () => {
  it('counts down from the duration', () => {
    const t = start(create('countdown', 10000), 0);
    expect(remainingMs(t, 3000)).toBe(7000);
  });

  it('clamps to 0 once elapsed exceeds duration', () => {
    const t = start(create('countdown', 1000), 0);
    expect(remainingMs(t, 5000)).toBe(0);
  });

  it('equals duration before starting', () => {
    expect(remainingMs(create('countdown', 4242), 999)).toBe(4242);
  });

  it('is exactly 0 at the boundary', () => {
    const t = start(create('countdown', 2000), 0);
    expect(remainingMs(t, 2000)).toBe(0);
  });

  it('returns 0 for a stopwatch (countdown-only)', () => {
    const t = start(create('stopwatch', 0), 0);
    expect(remainingMs(t, 5000)).toBe(0);
  });
});

describe('isExpired', () => {
  it('is false before the duration elapses', () => {
    const t = start(create('countdown', 1000), 0);
    expect(isExpired(t, 999)).toBe(false);
  });

  it('is true exactly at the boundary', () => {
    const t = start(create('countdown', 1000), 0);
    expect(isExpired(t, 1000)).toBe(true);
  });

  it('is true after the boundary', () => {
    const t = start(create('countdown', 1000), 0);
    expect(isExpired(t, 5000)).toBe(true);
  });

  it('is false for a fresh, unstarted countdown', () => {
    expect(isExpired(create('countdown', 1000), 12345)).toBe(false);
  });

  it('expires once accumulated time alone reaches the duration', () => {
    const t = pause(start(create('countdown', 1000), 0), 1500);
    expect(isExpired(t, 1500)).toBe(true);
  });

  it('a zero-duration countdown is expired immediately', () => {
    expect(isExpired(create('countdown', 0), 0)).toBe(true);
  });

  it('a stopwatch never expires', () => {
    const t = start(create('stopwatch', 0), 0);
    expect(isExpired(t, 1_000_000)).toBe(false);
  });
});

describe('determinism', () => {
  it('produces identical results for identical inputs', () => {
    const make = () => pause(start(create('countdown', 10000), 1000), 4000);
    const a = make();
    const b = make();
    expect(a).toEqual(b);
    expect(elapsedMs(a, 0)).toBe(elapsedMs(b, 0));
    expect(remainingMs(a, 0)).toBe(remainingMs(b, 0));
    expect(isExpired(a, 0)).toBe(isExpired(b, 0));
  });
});
