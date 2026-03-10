// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { RuntimeLoop } from '../RuntimeLoop';
import type { RuntimeDriver } from '../types';
import type { RuntimeLoopClock, RuntimeLoopFrameHandle } from '../RuntimeLoop';

const makeDriver = (): RuntimeDriver & { ticks: number } => ({
  ticks: 0,
  assetsReady: false,
  setAssetsReady() {},
  setSceneTrack() {},
  tick() { this.ticks += 1; },
  collectRenderContributions() { return {}; },
  getCurrentTick() { return null; },
  getWallTimeSeconds() { return 0; },
  dispose() {},
});

describe('RuntimeLoop', () => {
  it('runs step and calls driver.tick with delta seconds', () => {
    const driver = makeDriver();
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0.5,
      fixedDeltaSeconds: 0.1,
      clock: {
        now: () => 0,
        requestFrame: () => 0,
        cancelFrame: () => {},
      },
    });
    loop.step(1000);
    expect(driver.ticks).toBe(1);
  });

  it('respects fpsCap by skipping frames until interval', () => {
    const driver = makeDriver();
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0,
      fpsCap: 10,
      clock: {
        now: () => 0,
        requestFrame: () => 0,
        cancelFrame: () => {},
      },
    });
    loop.step(0);
    loop.step(50);
    expect(driver.ticks).toBe(0);
    loop.step(120);
    expect(driver.ticks).toBe(1);
  });

  it('honors wallTimeOverride and onAfterTick with deltaSeconds and globalProgress', () => {
    const driver = makeDriver();
    let afterTickDelta = 0;
    let afterTickProgress = 0;
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0.2,
      onAfterTick: (opts) => {
        afterTickDelta = opts.deltaSeconds;
        afterTickProgress = opts.globalProgress;
      },
      fixedDeltaSeconds: 0.016,
      clock: {
        now: () => 0,
        requestFrame: () => 0,
        cancelFrame: () => {},
      },
    });
    loop.setWallTimeOverride(42);
    loop.stepImmediate(1000);
    expect(afterTickDelta).toBeCloseTo(0.016, 10);
    expect(afterTickProgress).toBeCloseTo(0.2, 10);
  });

  it('start/stop manage the scheduled frame', () => {
    const driver = makeDriver();
    let requested = false;
    let cancelled = false;
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0,
      clock: {
        now: () => 0,
        requestFrame: (_cb) => { requested = true; return 123; },
        cancelFrame: (id) => { if (id === 123) cancelled = true; },
      },
    });
    loop.start();
    loop.stop();
    expect(requested).toBe(true);
    expect(cancelled).toBe(true);
  });

  it('handles driver errors without throwing', () => {
    const driver: RuntimeDriver = {
      assetsReady: false,
      setAssetsReady() {},
      setSceneTrack() {},
      tick() { throw new Error('boom'); },
      collectRenderContributions() { return {}; },
      getCurrentTick() { return null; },
      getWallTimeSeconds() { return 0; },
      dispose() {},
    };
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0,
      clock: {
        now: () => 0,
        requestFrame: () => 0,
        cancelFrame: () => {},
      },
    });
    expect(() => loop.stepImmediate(0)).not.toThrow();
  });

  it('records perf samples when perf debug is enabled', () => {
    const driver = makeDriver();
    // @ts-expect-error test flag
    window.__robotRuntimeDebug = { perf: true };
    const loop = new RuntimeLoop({
      driver,
      getGlobalProgress: () => 0.1,
      clock: {
        now: () => 100,
        requestFrame: () => 0,
        cancelFrame: () => {},
      },
    });
    expect(() => loop.stepImmediate(100)).not.toThrow();
    // Cleanup
    // @ts-expect-error cleanup
    delete window.__robotRuntimeDebug;
  });
});

/** Controllable clock: stores the last requestFrame callback and tracks cancel calls. */
const makeControllableClock = () => {
  let nextId = 1;
  let pendingCb: ((ms: number) => void) | null = null;
  const cancelledIds: RuntimeLoopFrameHandle[] = [];
  const requestCount = { value: 0 };

  const clock: RuntimeLoopClock = {
    now: () => 0,
    requestFrame: (cb) => {
      requestCount.value++;
      pendingCb = cb;
      return nextId++;
    },
    cancelFrame: (id) => {
      cancelledIds.push(id);
    },
  };

  return {
    clock,
    getPendingCb: () => pendingCb,
    getCancelledIds: () => cancelledIds,
    getRequestCount: () => requestCount.value,
  };
};

describe('RuntimeLoop.pause()/resume()', () => {
  it('pause() cancels the pending RAF and sets isPaused', () => {
    const driver = makeDriver();
    const { clock, getPendingCb, getCancelledIds } = makeControllableClock();
    const loop = new RuntimeLoop({ driver, getGlobalProgress: () => 0, clock });

    loop.start();
    // RAF should have been requested once (id=1)
    expect(getCancelledIds()).toHaveLength(0);

    loop.pause();
    // cancelFrame should have been called with the id from start()
    expect(getCancelledIds()).toHaveLength(1);

    // Manually invoke the stored step closure — driver.tick should NOT be called
    // because isPaused=true causes the closure to bail out early.
    const cb = getPendingCb();
    // After pause(), the rafId was set to null, so the old closure is stale.
    // Invoking it manually simulates a "late" RAF fire — it should be a no-op.
    if (cb) cb(100);
    expect(driver.ticks).toBe(0);
  });

  it('pause() is idempotent — calling twice does not double-cancel', () => {
    const driver = makeDriver();
    const { clock, getCancelledIds } = makeControllableClock();
    const loop = new RuntimeLoop({ driver, getGlobalProgress: () => 0, clock });

    loop.start();
    loop.pause();
    loop.pause(); // second call should be a no-op

    expect(getCancelledIds()).toHaveLength(1); // cancelFrame called exactly once
  });

  it('resume() restarts the RAF loop when running and paused', () => {
    const driver = makeDriver();
    const { clock, getRequestCount, getPendingCb } = makeControllableClock();
    const loop = new RuntimeLoop({ driver, getGlobalProgress: () => 0, fixedDeltaSeconds: 0.016, clock });

    loop.start();
    const countAfterStart = getRequestCount(); // 1

    loop.pause();
    loop.resume();

    // resume() should have called requestFrame again
    expect(getRequestCount()).toBeGreaterThan(countAfterStart);

    // Invoke the new pending callback — driver.tick should be called
    const cb = getPendingCb();
    if (cb) cb(100);
    expect(driver.ticks).toBeGreaterThan(0);
  });

  it('resume() is a no-op when not paused', () => {
    const driver = makeDriver();
    const { clock, getRequestCount } = makeControllableClock();
    const loop = new RuntimeLoop({ driver, getGlobalProgress: () => 0, clock });

    loop.start();
    const countAfterStart = getRequestCount();

    loop.resume(); // no-op: not paused

    expect(getRequestCount()).toBe(countAfterStart);
  });

  it('resume() is a no-op when not running', () => {
    const driver = makeDriver();
    const { clock, getRequestCount } = makeControllableClock();
    const loop = new RuntimeLoop({ driver, getGlobalProgress: () => 0, clock });

    // Never started — just pause+resume to ensure nothing is queued
    loop.pause(); // no-op: isPaused already false initially (nothing to cancel)
    loop.resume(); // no-op: not running

    expect(getRequestCount()).toBe(0);
  });

  it('stop() clears isPaused state so a subsequent start() runs normally', () => {
    const driver = makeDriver();
    const { clock, getPendingCb } = makeControllableClock();
    const loop = new RuntimeLoop({ driver, getGlobalProgress: () => 0, fixedDeltaSeconds: 0.016, clock });

    loop.start();
    loop.pause();
    loop.stop();
    loop.start(); // should run normally — isPaused was cleared by stop()

    // Invoke the newly registered step closure
    const cb = getPendingCb();
    if (cb) cb(100);
    expect(driver.ticks).toBe(1);
  });
});

describe('RuntimeLoop.setCanvas()', () => {
  it('registers webglcontextlost listener that calls pause()', () => {
    const driver = makeDriver();
    const { clock, getCancelledIds } = makeControllableClock();
    const loop = new RuntimeLoop({ driver, getGlobalProgress: () => 0, clock });
    const canvas = document.createElement('canvas');

    loop.start();
    loop.setCanvas(canvas);

    const event = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(event);

    // e.preventDefault() should have been called (spec requirement)
    expect(event.defaultPrevented).toBe(true);
    // Loop should now be paused — cancelFrame was called
    expect(getCancelledIds()).toHaveLength(1);
  });

  it('registers webglcontextrestored listener that calls resume()', () => {
    const driver = makeDriver();
    const { clock, getRequestCount } = makeControllableClock();
    const loop = new RuntimeLoop({ driver, getGlobalProgress: () => 0, clock });
    const canvas = document.createElement('canvas');

    loop.start();
    loop.setCanvas(canvas);

    const countAfterStart = getRequestCount();

    // Lose context (pauses loop)
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    // Restore context (resumes loop)
    canvas.dispatchEvent(new Event('webglcontextrestored'));

    // resume() should have called requestFrame again
    expect(getRequestCount()).toBeGreaterThan(countAfterStart);
  });

  it('setCanvas(null) removes event listeners — contextlost no longer pauses loop', () => {
    const driver = makeDriver();
    const { clock, getCancelledIds } = makeControllableClock();
    const loop = new RuntimeLoop({ driver, getGlobalProgress: () => 0, clock });
    const canvas = document.createElement('canvas');

    loop.start();
    loop.setCanvas(canvas);
    loop.setCanvas(null); // remove listeners

    // Dispatch webglcontextlost — loop should NOT pause (no listener)
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));

    // cancelFrame was never called (stop() wasn't called, only setCanvas(null))
    expect(getCancelledIds()).toHaveLength(0);
  });

  it('setCanvas() with a new canvas removes old listeners first', () => {
    const driver = makeDriver();
    const { clock, getCancelledIds } = makeControllableClock();
    const loop = new RuntimeLoop({ driver, getGlobalProgress: () => 0, clock });
    const canvas1 = document.createElement('canvas');
    const canvas2 = document.createElement('canvas');

    loop.start();
    loop.setCanvas(canvas1);
    loop.setCanvas(canvas2); // switches — canvas1 listeners removed

    // Dispatch on canvas1 — no effect (listener removed)
    canvas1.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(getCancelledIds()).toHaveLength(0); // loop still running

    // Dispatch on canvas2 — pauses
    canvas2.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(getCancelledIds()).toHaveLength(1); // cancelled once
  });
});
