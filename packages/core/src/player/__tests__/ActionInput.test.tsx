// @vitest-environment jsdom
// Tests for ActionInput: lifecycle, spec reading, and handler dispatch.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { ActionInputController } from '../../input/ActionInputController';
import React from 'react';
import { cleanup, render, act } from '@testing-library/react';
import { ActionInput } from '../ActionInput';
import { EngineContext } from '../EngineContext';
import { ActionInputExtensionContext } from '../ActionInputExtensionContext';
import type { UseSceneEngineResult } from '../useSceneEngine';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { SceneInputControllerSpec } from '../../input/types';
import type { ActionInputExtension } from '../ActionInputExtensionContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeSpec = (): SceneInputControllerSpec => ({
  id: 'ctrl',
  scope: 'window',
  actions: [
    {
      id: 'next',
      type: 'scene.next',
      maps: [{ kind: 'key', key: 'ArrowRight' }],
    },
    {
      id: 'prev',
      type: 'scene.prev',
      maps: [{ kind: 'key', key: 'ArrowLeft' }],
    },
  ],
});

const makeTick = (spec: SceneInputControllerSpec | null): SceneTrackTick => ({
  index: 0,
  progress: 0,
  sceneId: 'scene-1',
  sceneIndex: 0,
  blockProgress: 0,
  sceneProgress: 0,
  state: {
    id: 'scene-1',
    scrollProgress: 0,
    widgets: spec ? { '__input_controller': spec } : {},
  },
  deltaForward: {},
  deltaBackward: {},
});

/**
 * Builds a minimal UseSceneEngineResult with only the fields ActionInput needs.
 * All dispatchable methods are vi.fn() so tests can assert on them.
 */
const makeEngine = (
  overrides: {
    tick?: SceneTrackTick | null;
    sceneCount?: number;
    canvasEl?: HTMLElement | null;
  } = {},
): UseSceneEngineResult => {
  const { tick = null, sceneCount = 3, canvasEl = null } = overrides;
  return {
    frameState: {
      tickIndex: tick?.index ?? -1,
      progress: 0,
      sceneId: 'scene-1',
      sceneIndex: 0,
      sceneProgress: 0,
      tick,
    },
    sceneCount,
    primaryCameraId: 'camera',
    primaryCanvasActionTargetId: '',
    canvasRef: { current: canvasEl },
    advanceProgress: vi.fn(),
    applyCameraOrbit: vi.fn(),
    applyCameraDolly: vi.fn(),
    applyCameraReset: vi.fn(),
    setCameraOverride: vi.fn(),
  } as unknown as UseSceneEngineResult;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ActionInput', () => {
  it('does not re-create controller when engine object reference changes (tick simulation)', async () => {
    // Verify that a new engine object (as produced by useSceneEngine on every tick)
    // does NOT cause the ActionInputController to detach and re-attach.
    const spec = makeSpec();
    const tick = makeTick(spec);
    const canvas = document.createElement('canvas');
    const engine1 = makeEngine({ tick, sceneCount: 3, canvasEl: canvas });

    const attachSpy = vi.spyOn(ActionInputController.prototype, 'attach');
    const detachSpy = vi.spyOn(ActionInputController.prototype, 'detach');

    let rerender!: ReturnType<typeof render>['rerender'];
    await act(async () => {
      const result = render(
        <EngineContext.Provider value={engine1}>
          <ActionInput target={canvas} />
        </EngineContext.Provider>,
      );
      rerender = result.rerender;
    });

    // attach called exactly once on initial mount.
    expect(attachSpy).toHaveBeenCalledTimes(1);
    expect(detachSpy).toHaveBeenCalledTimes(0);

    // Simulate a tick: produce a new engine object (same shape, new reference).
    const engine2 = makeEngine({ tick, sceneCount: 3, canvasEl: canvas });

    await act(async () => {
      rerender(
        <EngineContext.Provider value={engine2}>
          <ActionInput target={canvas} />
        </EngineContext.Provider>,
      );
    });

    // The controller must NOT have been torn down and re-created.
    expect(attachSpy).toHaveBeenCalledTimes(1);
    expect(detachSpy).toHaveBeenCalledTimes(0);
  });

  it('renders null — no DOM output', () => {
    const canvas = document.createElement('canvas');
    const engine = makeEngine({ canvasEl: canvas });

    const { container } = render(
      <EngineContext.Provider value={engine}>
        <ActionInput />
      </EngineContext.Provider>,
    );

    expect(container.childElementCount).toBe(0);
  });

  it('does not attach when no target element is available', () => {
    // canvasRef.current is null and no target prop provided.
    const engine = makeEngine({ canvasEl: null });

    // Should not throw; effect exits early without creating a controller.
    expect(() =>
      render(
        <EngineContext.Provider value={engine}>
          <ActionInput />
        </EngineContext.Provider>,
      ),
    ).not.toThrow();
  });

  it('dispatches scene.next on ArrowRight keydown when spec is present', async () => {
    const spec = makeSpec();
    const tick = makeTick(spec);
    const engine = makeEngine({ tick, sceneCount: 3 });
    const canvas = document.createElement('canvas');

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <ActionInput target={canvas} />
        </EngineContext.Provider>,
      );
    });

    // Simulate ArrowRight on document (default keyboard target).
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    document.dispatchEvent(event);

    expect(engine.advanceProgress).toHaveBeenCalledTimes(1);
    // sceneCount=3, so delta = 1 / (3-1) = 0.5
    expect(engine.advanceProgress).toHaveBeenCalledWith(0.5);
  });

  it('dispatches scene.prev on ArrowLeft keydown when spec is present', async () => {
    const spec = makeSpec();
    const tick = makeTick(spec);
    const engine = makeEngine({ tick, sceneCount: 3 });
    const canvas = document.createElement('canvas');

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <ActionInput target={canvas} />
        </EngineContext.Provider>,
      );
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
    document.dispatchEvent(event);

    expect(engine.advanceProgress).toHaveBeenCalledWith(-0.5);
  });

  it('does NOT dispatch when spec is null (tick has no __input_controller)', async () => {
    // Tick exists but has no __input_controller spec.
    const tick = makeTick(null);
    const engine = makeEngine({ tick, sceneCount: 3 });
    const canvas = document.createElement('canvas');

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <ActionInput target={canvas} />
        </EngineContext.Provider>,
      );
    });

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    document.dispatchEvent(event);

    expect(engine.advanceProgress).not.toHaveBeenCalled();
  });

  it('does NOT dispatch after unmount (controller is detached)', async () => {
    const spec = makeSpec();
    const tick = makeTick(spec);
    const engine = makeEngine({ tick, sceneCount: 3 });
    const canvas = document.createElement('canvas');

    const { unmount } = await act(async () =>
      render(
        <EngineContext.Provider value={engine}>
          <ActionInput target={canvas} />
        </EngineContext.Provider>,
      ),
    );

    // Confirm attach works: first keydown dispatches.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(engine.advanceProgress).toHaveBeenCalledTimes(1);

    // Unmount and verify no further dispatches.
    unmount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(engine.advanceProgress).toHaveBeenCalledTimes(1); // unchanged
  });

  it('reads __input_controller spec from tick state via getSpec() closure', async () => {
    // Engine starts with no tick (pre-first-frame).
    const engine = makeEngine({ tick: null, sceneCount: 3 });
    const canvas = document.createElement('canvas');

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <ActionInput target={canvas} />
        </EngineContext.Provider>,
      );
    });

    // No tick yet — keydown is a no-op.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(engine.advanceProgress).not.toHaveBeenCalled();

    // Update the tick on the engine object (simulates first frame arriving).
    const spec = makeSpec();
    (engine.frameState as { tick: SceneTrackTick | null }).tick = makeTick(spec);

    // getSpec() closure reads from engine.frameState.tick on each event — no re-mount needed.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(engine.advanceProgress).toHaveBeenCalledTimes(1);
  });

  it('passes onUnknownAction from ActionInputExtensionContext to the controller', async () => {
    const spec: SceneInputControllerSpec = {
      id: 'ctrl',
      scope: 'window',
      actions: [
        {
          id: 'custom',
          type: 'diagram-canvas.move',
          maps: [{ kind: 'key', key: 'ArrowRight' }],
        },
      ],
    };
    const tick = makeTick(spec);
    const engine = makeEngine({ tick, sceneCount: 3 });
    const canvas = document.createElement('canvas');
    const onUnknownAction = vi.fn() as ActionInputExtension;

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <ActionInputExtensionContext.Provider value={onUnknownAction}>
            <ActionInput target={canvas} />
          </ActionInputExtensionContext.Provider>
        </EngineContext.Provider>,
      );
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(onUnknownAction).toHaveBeenCalledOnce();
    expect(onUnknownAction).toHaveBeenCalledWith(
      'diagram-canvas.move',
      undefined,
      expect.any(KeyboardEvent),
      expect.any(Object),
    );
  });

  it('does NOT dispatch with single scene (sceneCount <= 1 guard)', async () => {
    const spec = makeSpec();
    const tick = makeTick(spec);
    const engine = makeEngine({ tick, sceneCount: 1 });
    const canvas = document.createElement('canvas');

    await act(async () => {
      render(
        <EngineContext.Provider value={engine}>
          <ActionInput target={canvas} />
        </EngineContext.Provider>,
      );
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    // sceneCount <= 1 → onSceneStep returns early without calling advanceProgress.
    expect(engine.advanceProgress).not.toHaveBeenCalled();
  });
});
