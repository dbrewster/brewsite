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
  /**
   * Pre-tick callbacks registered via `addPreTickCallback`. Run synchronously
   * inside the engine's RAF loop, BEFORE `getGlobalProgress` and `driver.tick()`.
   * Used by InputCoordinator to run inertia in the same frame as the render,
   * eliminating the dual-RAF ordering issue that causes ghosting/double-images.
   */
  private readonly preTickCallbacks = new Set<() => void>();
  private readonly perfBuffer: Array<{ tickMs: number; afterTickMs: number; renderMs: number; totalMs: number }> = [];
  private perfIndex = 0;

  /** Always-on lightweight frame timing for RendererStats.
   * Rolling window of the last 60 frames' tick/render/total times. */
  _frameTiming = {
    tickMs: 0,
    renderMs: 0,
    totalMs: 0,
    /** Max frame-to-frame interval delta (jitter) over last 60 frames. */
    jitterMs: 0,
    /** Current engine progress [0..1]. */
    progress: 0,
    /** Progress delta from the previous frame. Large values = camera jump. */
    progressDelta: 0,
    _lastFrameMs: 0,
    _lastProgress: 0,
    _intervalBuf: new Float32Array(60),
    _intervalIdx: 0,
  };

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
   * Register a callback to run BEFORE each tick, inside the engine's RAF loop.
   * Used by InputCoordinator for inertia — ensures progress updates happen in
   * the same frame as the render, eliminating dual-RAF ghosting.
   */
  addPreTickCallback(cb: () => void): void {
    this.preTickCallbacks.add(cb);
  }

  /** Remove a previously registered pre-tick callback. */
  removePreTickCallback(cb: () => void): void {
    this.preTickCallbacks.delete(cb);
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

    // Run pre-tick callbacks (inertia, etc.) before reading progress.
    // This ensures inertia-driven progress updates are applied in the same
    // RAF frame as the render — no dual-RAF ordering jitter.
    for (const cb of this.preTickCallbacks) cb();

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
      const t0 = performance.now();

      this.driver.tick({ deltaSeconds, globalProgress, deltaProgress, wallTimeSeconds: this.wallTimeSeconds });

      const t1 = performance.now();
      if (this.onAfterTick) {
        this.onAfterTick({ deltaSeconds, globalProgress });
      }

      const t2 = performance.now();
      if (this.render) this.render();
      const t3 = performance.now();

      // Always-on lightweight timing for RendererStats.
      // Exposed on globalThis for the devtools stats panel to read.
      const ft = this._frameTiming;
      ft.progress = globalProgress;
      ft.progressDelta = Math.abs(globalProgress - ft._lastProgress);
      ft._lastProgress = globalProgress;
      (globalThis as Record<string, unknown>).__brewsite_frame_timing = ft;
      ft.tickMs = t1 - t0;
      ft.renderMs = t3 - t2;
      ft.totalMs = t3 - t0;
      // Frame interval jitter: track how evenly spaced frames are
      if (ft._lastFrameMs > 0) {
        const interval = t0 - ft._lastFrameMs;
        ft._intervalBuf[ft._intervalIdx] = interval;
        ft._intervalIdx = (ft._intervalIdx + 1) % ft._intervalBuf.length;
        // Jitter = max - min interval over the rolling window
        let min = Infinity, max = 0;
        for (let j = 0; j < ft._intervalBuf.length; j++) {
          const v = ft._intervalBuf[j]!;
          if (v > 0) { if (v < min) min = v; if (v > max) max = v; }
        }
        ft.jitterMs = max - min;
      }
      ft._lastFrameMs = t0;

      if (perfEnabled) {
        const tickMs = t1 - t0;
        const afterTickMs = t2 - t1;
        const renderMs = t3 - t2;
        this.perfBuffer[this.perfIndex] = { tickMs, afterTickMs, renderMs, totalMs: t3 - t0 };
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
