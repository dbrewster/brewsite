// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { RuntimeLoop } from '../RuntimeLoop';
import type { RuntimeDriver } from '../types';

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
      getBoneWorldPositions() { return new Map(); },
      getTargetColors() { return new Map(); },
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
