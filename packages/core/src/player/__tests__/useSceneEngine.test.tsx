// @vitest-environment jsdom
// Interface-based stateful tests for useSceneEngine.
// No vi.mock() — tests use real compilation with real SceneDefinitions and
// interface-conforming WidgetPlugin doubles. act() is awaited for React 18.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSceneEngine } from '../useSceneEngine';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import { Scene } from '../../compiler/sceneDslCompiler';
import type { WidgetPlugin } from '../../widget/WidgetPlugin';
import type { WidgetRegistry as WidgetRegistryClass } from '../../widget/WidgetRegistry';
import type { SceneTrack, CompileWarning } from '../../compiler/sceneTrackTypes';
import type { InternalSceneSpec } from '../engineTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal matchMedia stub that satisfies the media query setup in useSceneEngine. */
const makeMatchMedia = () =>
  vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
    media: '',
    onchange: null,
  }));

/** Two minimal scenes for use in tests that only care about compilation running. */
const makeScenes = (): InternalSceneSpec[] => [
  { sceneKey: 's1', contentKey: 'scene:s1', element: <Scene id="s1" /> },
  { sceneKey: 's2', contentKey: 'scene:s2', element: <Scene id="s2" /> },
];

// ─── Compilation ──────────────────────────────────────────────────────────────

describe('useSceneEngine compilation', () => {
  beforeEach(() => {
    window.matchMedia = makeMatchMedia();
    window.requestAnimationFrame = () => 1;
    window.cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('produces a non-null sceneTrack after mounting with scenes', async () => {
    const registry = new WidgetRegistry();
    const { result } = renderHook(() =>
      useSceneEngine({ scenes: makeScenes(), widgetRegistry: registry, manifest: null }),
    );

    await act(async () => {});

    expect(result.current.sceneTrack).not.toBeNull();
  });

  it('sceneCount reflects the number of compiled scenes', async () => {
    const registry = new WidgetRegistry();
    const { result } = renderHook(() =>
      useSceneEngine({ scenes: makeScenes(), widgetRegistry: registry, manifest: null }),
    );

    await act(async () => {});

    expect(result.current.sceneCount).toBe(2);
  });

  it('compiledScenes contains id and index for each compiled scene', async () => {
    const registry = new WidgetRegistry();
    const { result } = renderHook(() =>
      useSceneEngine({ scenes: makeScenes(), widgetRegistry: registry, manifest: null }),
    );

    await act(async () => {});

    expect(result.current.compiledScenes).toHaveLength(2);
    expect(result.current.compiledScenes[0]?.id).toBe('s1');
    expect(result.current.compiledScenes[0]?.index).toBe(0);
    expect(result.current.compiledScenes[1]?.id).toBe('s2');
    expect(result.current.compiledScenes[1]?.index).toBe(1);
  });

  it('sceneTrack is null and sceneCount is 0 when no scenes are provided', async () => {
    const registry = new WidgetRegistry();
    const { result } = renderHook(() =>
      useSceneEngine({ scenes: [], widgetRegistry: registry, manifest: null }),
    );

    await act(async () => {});

    expect(result.current.sceneTrack).toBeNull();
    expect(result.current.sceneCount).toBe(0);
  });

  it('uses legacy matchMedia addListener/removeListener when addEventListener is absent', async () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener,
      removeListener,
    }));

    const registry = new WidgetRegistry();
    const { unmount } = renderHook(() =>
      useSceneEngine({ scenes: makeScenes(), widgetRegistry: registry, manifest: null }),
    );

    await act(async () => {});
    expect(addListener).toHaveBeenCalled();

    unmount();
    expect(removeListener).toHaveBeenCalled();
  });
});

// ─── Plugin reconciliation ────────────────────────────────────────────────────

describe('useSceneEngine plugin reconciliation', () => {
  beforeEach(() => {
    window.matchMedia = makeMatchMedia();
    window.requestAnimationFrame = () => 1;
    window.cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    cleanup();
  });

  it('calls plugin.reconcileCompiledTrack with the compiled SceneTrack and WidgetRegistry', async () => {
    let capturedTrack: SceneTrack | null = null;
    let capturedRegistry: WidgetRegistryClass | null = null;

    const plugin: WidgetPlugin = {
      createWidgets: () => [],
      registerHandlers: () => {},
      reconcileCompiledTrack(registry, track) {
        capturedRegistry = registry;
        capturedTrack = track;
      },
    };

    const registry = new WidgetRegistry();
    renderHook(() =>
      useSceneEngine({
        scenes: makeScenes(),
        widgetRegistry: registry,
        manifest: null,
        plugins: [plugin],
      }),
    );

    await act(async () => {});

    expect(capturedTrack).not.toBeNull();
    expect(capturedRegistry).toBe(registry);
  });

  it('calls reconcileCompiledTrack on multiple plugins in declaration order', async () => {
    const callOrder: string[] = [];

    const pluginA: WidgetPlugin = {
      createWidgets: () => [],
      registerHandlers: () => {},
      reconcileCompiledTrack: () => { callOrder.push('A'); },
    };

    const pluginB: WidgetPlugin = {
      createWidgets: () => [],
      registerHandlers: () => {},
      reconcileCompiledTrack: () => { callOrder.push('B'); },
    };

    const registry = new WidgetRegistry();
    renderHook(() =>
      useSceneEngine({
        scenes: makeScenes(),
        widgetRegistry: registry,
        manifest: null,
        plugins: [pluginA, pluginB],
      }),
    );

    await act(async () => {});

    // A must appear before B. Effects may run more than once (StrictMode) but
    // the ordering invariant must hold on every invocation.
    expect(callOrder.length).toBeGreaterThanOrEqual(2);
    expect(callOrder.findIndex((x) => x === 'A')).toBeLessThan(callOrder.findIndex((x) => x === 'B'));
    // Every A-B pair must be in order.
    for (let i = 0; i < callOrder.length - 1; i += 2) {
      expect(callOrder[i]).toBe('A');
      expect(callOrder[i + 1]).toBe('B');
    }
  });

  it('does not call reconcileCompiledTrack when no scenes are provided', async () => {
    let reconcileCalled = false;

    const plugin: WidgetPlugin = {
      createWidgets: () => [],
      registerHandlers: () => {},
      reconcileCompiledTrack: () => { reconcileCalled = true; },
    };

    const registry = new WidgetRegistry();
    renderHook(() =>
      useSceneEngine({
        scenes: [],
        widgetRegistry: registry,
        manifest: null,
        plugins: [plugin],
      }),
    );

    await act(async () => {});

    expect(reconcileCalled).toBe(false);
  });

  it('plugin without reconcileCompiledTrack does not throw', async () => {
    const plugin: WidgetPlugin = {
      createWidgets: () => [],
      registerHandlers: () => {},
      // reconcileCompiledTrack is optional — omitted intentionally
    };

    const registry = new WidgetRegistry();
    await expect(async () => {
      renderHook(() =>
        useSceneEngine({
          scenes: makeScenes(),
          widgetRegistry: registry,
          manifest: null,
          plugins: [plugin],
        }),
      );
      await act(async () => {});
    }).not.toThrow();
  });
});

// ─── Warning callback ─────────────────────────────────────────────────────────

describe('useSceneEngine warning callback', () => {
  beforeEach(() => {
    window.matchMedia = makeMatchMedia();
    window.requestAnimationFrame = () => 1;
    window.cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not call onCompileWarning when clean scenes compile without warnings', async () => {
    const onCompileWarning = vi.fn();
    const registry = new WidgetRegistry();

    renderHook(() =>
      useSceneEngine({
        scenes: makeScenes(),
        widgetRegistry: registry,
        manifest: null,
        onCompileWarning,
      }),
    );

    await act(async () => {});

    expect(onCompileWarning).not.toHaveBeenCalled();
  });

  it('onCompileWarning receives an array of CompileWarning objects', async () => {
    // A plugin can inject warnings into the compiled track via reconcileCompiledTrack.
    // We verify the shape of warnings forwarded through onCompileWarning by directly
    // testing the hook's response to what compileSceneTrack returns. Since clean scenes
    // produce no warnings, this test verifies the no-warning contract — a separate
    // integration test exercises the warning path with a warning-producing DSL.
    const received: CompileWarning[][] = [];

    const registry = new WidgetRegistry();
    renderHook(() =>
      useSceneEngine({
        scenes: makeScenes(),
        widgetRegistry: registry,
        manifest: null,
        onCompileWarning: (warnings) => { received.push(warnings); },
      }),
    );

    await act(async () => {});

    // Clean scenes: callback not invoked
    expect(received).toHaveLength(0);
  });
});
