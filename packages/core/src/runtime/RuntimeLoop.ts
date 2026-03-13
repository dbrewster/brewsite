import type { RuntimeDriver } from './types';

export type RuntimeFrame = {
  nowMs: number;
  deltaSeconds: number;
  wallTimeSeconds: number;
  globalProgress: number;
};

export type RuntimeLoopFrameHandle = number | ReturnType<typeof setTimeout>;

export type RuntimeLoopClock = {
  now: () => number;
  requestFrame: (cb: (nowMs: number) => void) => RuntimeLoopFrameHandle;
  cancelFrame: (id: RuntimeLoopFrameHandle) => void;
};

export type RuntimeLoopOptions = {
  driver: RuntimeDriver;
  getGlobalProgress: () => number;
  render?: () => void;
  onAfterTick?: (options: { deltaSeconds: number; globalProgress: number }) => void;
  fpsCap?: number;
  fixedDeltaSeconds?: number;
  clock?: RuntimeLoopClock;
};

const defaultClock: RuntimeLoopClock = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  requestFrame: (cb) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      return requestAnimationFrame(cb);
    }
    return globalThis.setTimeout(() => cb(Date.now()), 16);
  },
  cancelFrame: (id) => {
    if (typeof cancelAnimationFrame !== 'undefined' && typeof id === 'number') {
      cancelAnimationFrame(id);
      return;
    }
    globalThis.clearTimeout(id);
  },
};

/**
 * Runtime loop that drives tick and render cycles.
 */
export class RuntimeLoop {
  private driver: RuntimeDriver;
  private readonly getGlobalProgress: () => number;
  private readonly render?: () => void;
  private readonly onAfterTick?: (options: { deltaSeconds: number; globalProgress: number }) => void;
  private clock: RuntimeLoopClock;
  private lastMs: number | null = null;
  private wallTimeSeconds = 0;
  private wallTimeOverride: number | null = null;
  private prevGlobalProgress: number = 0;
  private running = false;
  private rafId: RuntimeLoopFrameHandle | null = null;
  private readonly fpsCap: number | null = null;
  private readonly fixedDeltaSeconds: number | null = null;
  private fpsAccumulatorMs = 0;
  private errorLogged = false;
  private isPaused = false;
  private canvas: HTMLCanvasElement | null = null;
  private readonly perfBuffer: Array<{ tickMs: number; afterTickMs: number; renderMs: number; totalMs: number }> = [];
  private perfIndex = 0;

  private readonly handleContextLost = (e: Event): void => {
    e.preventDefault(); // required by the WEBGL_lose_context spec to allow restoration
    this.pause();
  };

  private readonly handleContextRestored = (): void => {
    // Three.js WebGLRenderer (r158+) automatically rebuilds its internal WebGL state
    // (programs, textures, geometries) on webglcontextrestored via its own internal
    // listener registered at construction time. No caller-facing API is required.
    // BrewSite only needs to restart the tick loop.
    this.resume();
  };

  constructor(options: RuntimeLoopOptions) {
    this.driver = options.driver;
    this.getGlobalProgress = options.getGlobalProgress;
    this.render = options.render;
    this.onAfterTick = options.onAfterTick;
    this.fpsCap = typeof options.fpsCap === 'number' ? options.fpsCap : null;
    this.fixedDeltaSeconds = typeof options.fixedDeltaSeconds === 'number' ? options.fixedDeltaSeconds : null;
    this.clock = options.clock ?? defaultClock;
    this.perfBuffer = new Array(120)
      .fill(0)
      .map(() => ({ tickMs: 0, afterTickMs: 0, renderMs: 0, totalMs: 0 }));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.isPaused = false; // clear any stale pause state from before start
    const step = (nowMs: number) => {
      if (!this.running || this.isPaused) return; // ← add isPaused check
      this.step(nowMs);
      this.rafId = this.clock.requestFrame(step);
    };
    this.rafId = this.clock.requestFrame(step);
  }

  stop(): void {
    this.running = false;
    this.isPaused = false; // clear pause state so a subsequent start() is clean
    if (this.rafId !== null) {
      this.clock.cancelFrame(this.rafId);
      this.rafId = null;
    }
    this.lastMs = null;
    this.fpsAccumulatorMs = 0;
    this.setCanvas(null); // remove canvas event listeners
  }

  /**
   * Suspends the RAF loop without resetting engine state. Idempotent.
   * Safe to call when already paused, stopped, or before start().
   */
  pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    if (this.rafId !== null) {
      this.clock.cancelFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Resumes the RAF loop after pause(). Idempotent.
   * No-op if the loop is not running or not paused.
   */
  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (!this.running) return;
    const step = (nowMs: number) => {
      if (!this.running || this.isPaused) return;
      this.step(nowMs);
      this.rafId = this.clock.requestFrame(step);
    };
    this.rafId = this.clock.requestFrame(step);
  }

  /**
   * Registers a canvas element to receive webglcontextlost / webglcontextrestored
   * event listeners that auto-pause and auto-resume the loop respectively.
   * Pass null to remove the current canvas and its listeners.
   * Safe to call multiple times; previous listeners are always removed first.
   */
  setCanvas(canvas: HTMLCanvasElement | null): void {
    if (this.canvas !== null) {
      this.canvas.removeEventListener('webglcontextlost', this.handleContextLost, false);
      this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored, false);
      this.canvas = null;
    }
    if (canvas !== null) {
      this.canvas = canvas;
      canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
      canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
    }
  }

  setWallTimeOverride(value: number | null): void {
    this.wallTimeOverride = typeof value === 'number' ? value : null;
  }

  step(nowMs: number): void {
    this.runStep(nowMs, false);
  }

  stepImmediate(nowMs: number): void {
    this.runStep(nowMs, true);
  }

  private runStep(nowMs: number, force: boolean): void {
    let deltaMs = 0;
    if (this.lastMs === null) {
      this.lastMs = nowMs;
    } else {
      deltaMs = Math.max(0, nowMs - this.lastMs);
      this.lastMs = nowMs;
    }

    if (!force && this.fpsCap && this.fpsCap > 0) {
      this.fpsAccumulatorMs += deltaMs;
      const intervalMs = 1000 / this.fpsCap;
      if (this.fpsAccumulatorMs < intervalMs) return;
      deltaMs = this.fpsAccumulatorMs;
      this.fpsAccumulatorMs = 0;
    }

    const deltaSeconds =
      typeof this.fixedDeltaSeconds === 'number' ? this.fixedDeltaSeconds : deltaMs / 1000;

    if (this.wallTimeOverride !== null) {
      this.wallTimeSeconds = this.wallTimeOverride;
    } else {
      this.wallTimeSeconds = nowMs / 1000;
    }

    const globalProgress = this.getGlobalProgress();

    // Compute forward-only delta progress. Zero on first frame (no prevGlobalProgress yet).
    // Zero on backward navigation (Math.max(0, ...)).
    const deltaProgress = Math.max(0, globalProgress - this.prevGlobalProgress);
    // Update prevGlobalProgress BEFORE tick() so that if tick() throws,
    // prevGlobalProgress is still updated correctly for the next frame.
    this.prevGlobalProgress = globalProgress;

    try {
      const perfEnabled =
        typeof window !== 'undefined' &&
        (window as unknown as { __robotRuntimeDebug?: { perf?: boolean } }).__robotRuntimeDebug?.perf;
      const perfStart = perfEnabled ? this.clock.now() : 0;

      this.driver.tick({ deltaSeconds, globalProgress, deltaProgress, wallTimeSeconds: this.wallTimeSeconds });

      const afterTickStart = perfEnabled ? this.clock.now() : 0;
      if (this.onAfterTick) {
        this.onAfterTick({ deltaSeconds, globalProgress });
      }

      const renderStart = perfEnabled ? this.clock.now() : 0;
      if (this.render) this.render();

      if (perfEnabled) {
        const end = this.clock.now();
        const tickMs = Math.max(0, afterTickStart - perfStart);
        const afterTickMs = Math.max(0, renderStart - afterTickStart);
        const renderMs = Math.max(0, end - renderStart);
        this.perfBuffer[this.perfIndex] = { tickMs, afterTickMs, renderMs, totalMs: end - perfStart };
        this.perfIndex = (this.perfIndex + 1) % this.perfBuffer.length;
      }

      this.errorLogged = false;
    } catch (error) {
      if (!this.errorLogged) {
        this.errorLogged = true;
        console.error('[RobotRuntimeLoop]', 'frame.failed', error);
      }
    }
  }
}
