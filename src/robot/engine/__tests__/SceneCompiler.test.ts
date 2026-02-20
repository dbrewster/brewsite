/**
 * SceneCompiler lifecycle tests.
 *
 * SceneCompiler owns the compilation lifecycle:
 * - First compile (from idle state): SYNCHRONOUS — avoids null on first render.
 * - Quality/option upgrade (from ready state, different key): DEFERRED via
 *   requestIdleCallback / setTimeout(0) to avoid main-thread jank.
 * - Same cache key while ready: no-op.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SceneCompiler } from '../SceneCompiler';
import { testSceneGroup } from '../../runtime/__tests__/fixtures/testSceneFixtures';
import { createQualityTimeline } from '../../robotTimeline';

const BASE_OPTIONS = {
  scenes: testSceneGroup.scenes,
  timeline: testSceneGroup.timeline,
  assetsReady: true,
  availableClips: [],
  prefersReducedMotion: false,
};

const COMPILE_OPTIONS_3 = { ...BASE_OPTIONS, subTicks: 3 };
const COMPILE_OPTIONS_10 = {
  ...BASE_OPTIONS,
  subTicks: 10,
  timeline: createQualityTimeline(testSceneGroup.timeline, 10),
};

describe('SceneCompiler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts in idle state', () => {
      const compiler = new SceneCompiler();
      expect(compiler.getState().phase).toBe('idle');
      compiler.dispose();
    });
  });

  describe('first compile — synchronous', () => {
    it('transitions idle → ready synchronously', () => {
      const compiler = new SceneCompiler();
      compiler.compile(COMPILE_OPTIONS_3);

      // No timer needed — first compile is synchronous
      expect(compiler.getState().phase).toBe('ready');
      compiler.dispose();
    });

    it('ready state has track and sampler', () => {
      const compiler = new SceneCompiler();
      compiler.compile(COMPILE_OPTIONS_3);

      const state = compiler.getState();
      expect(state.phase).toBe('ready');
      if (state.phase === 'ready') {
        expect(state.track).toBeDefined();
        expect(state.track.ticks.length).toBeGreaterThan(0);
        expect(state.sampler).toBeDefined();
      }
      compiler.dispose();
    });

    it('subscribe listener fires once for idle → ready', () => {
      const compiler = new SceneCompiler();
      const listener = vi.fn();
      compiler.subscribe(listener);

      compiler.compile(COMPILE_OPTIONS_3);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ phase: 'ready' }));
      compiler.dispose();
    });
  });

  describe('cache hit — no-op', () => {
    it('returns same track reference on repeated compile() with same inputs', () => {
      const compiler = new SceneCompiler();

      compiler.compile(COMPILE_OPTIONS_3);
      const state1 = compiler.getState();
      expect(state1.phase).toBe('ready');
      if (state1.phase !== 'ready') return;
      const track1 = state1.track;

      const listener = vi.fn();
      compiler.subscribe(listener);

      // Second compile with same options — should be a no-op
      compiler.compile(COMPILE_OPTIONS_3);

      // No state change
      expect(listener).not.toHaveBeenCalled();

      const state2 = compiler.getState();
      if (state2.phase !== 'ready') return;

      // Same track reference (cache hit → same object)
      expect(state2.track).toBe(track1);
      compiler.dispose();
    });
  });

  describe('quality upgrade — deferred', () => {
    it('transitions ready → compiling → ready after async build', async () => {
      const compiler = new SceneCompiler();

      // Initial compile (synchronous)
      compiler.compile(COMPILE_OPTIONS_3);
      expect(compiler.getState().phase).toBe('ready');

      const states: string[] = [];
      compiler.subscribe((s) => states.push(s.phase));

      // Quality upgrade: different subtick count → deferred
      compiler.compile(COMPILE_OPTIONS_10);
      expect(compiler.getState().phase).toBe('compiling');

      await vi.runAllTimersAsync();
      expect(compiler.getState().phase).toBe('ready');
      expect(states).toContain('compiling');
      expect(states).toContain('ready');

      compiler.dispose();
    });

    it('cancels in-flight build when compile() is called again before completion', async () => {
      const compiler = new SceneCompiler();
      compiler.compile(COMPILE_OPTIONS_3);
      expect(compiler.getState().phase).toBe('ready');

      const stateChanges: string[] = [];
      compiler.subscribe((s) => stateChanges.push(s.phase));

      // Start first quality upgrade
      const optionsA = {
        ...BASE_OPTIONS,
        subTicks: 5,
        timeline: createQualityTimeline(testSceneGroup.timeline, 5),
      };
      const optionsB = {
        ...BASE_OPTIONS,
        subTicks: 7,
        timeline: createQualityTimeline(testSceneGroup.timeline, 7),
      };

      compiler.compile(optionsA);
      expect(compiler.getState().phase).toBe('compiling');

      // Immediately override — cancels optionsA build
      compiler.compile(optionsB);
      expect(compiler.getState().phase).toBe('compiling');

      // Run timers — only optionsB completes
      await vi.runAllTimersAsync();
      expect(compiler.getState().phase).toBe('ready');

      // Only one 'ready' transition (from optionsB only)
      const readyCount = stateChanges.filter((s) => s === 'ready').length;
      expect(readyCount).toBe(1);

      compiler.dispose();
    });
  });

  describe('subscribe', () => {
    it('unsubscribe removes the listener', async () => {
      const compiler = new SceneCompiler();

      // Initial compile (sync) — listener not yet attached
      compiler.compile(COMPILE_OPTIONS_3);

      const listener = vi.fn();
      const unsub = compiler.subscribe(listener);
      unsub();

      // Quality upgrade — should not fire listener
      compiler.compile(COMPILE_OPTIONS_10);
      await vi.runAllTimersAsync();

      expect(listener).not.toHaveBeenCalled();
      compiler.dispose();
    });
  });

  describe('dispose', () => {
    it('cancels in-flight deferred build and clears listeners', async () => {
      const compiler = new SceneCompiler();
      compiler.compile(COMPILE_OPTIONS_3); // initial sync
      expect(compiler.getState().phase).toBe('ready');

      const listener = vi.fn();
      compiler.subscribe(listener);

      // Start quality upgrade (deferred)
      compiler.compile(COMPILE_OPTIONS_10);
      listener.mockClear(); // ignore the compiling transition

      compiler.dispose();

      // Running timers after dispose should NOT fire listener
      await vi.runAllTimersAsync();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
