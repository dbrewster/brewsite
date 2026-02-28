// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { ActionInputController } from '../ActionInputController';
import type { SceneInputControllerSpec } from '../types';

const makeSpec = (): SceneInputControllerSpec => ({
  id: 'main',
  scope: 'canvas',
  actions: [],
});

describe('ActionInputController', () => {
  it('dispatches diagram-canvas.reset from key mapping', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'reset-canvas',
      type: 'diagram-canvas.reset',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'key', key: '1', modifiers: ['ctrl'] }],
    });

    const onDiagramCanvasReset = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      {
        getSceneCount: () => 2,
        onSceneStep: () => {},
        onCameraOrbit: () => {},
        onCameraDolly: () => {},
        onCameraReset: () => {},
        onDiagramCanvasMove: () => {},
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset,
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onDiagramCanvasReset).toHaveBeenCalledTimes(1);
    expect(onDiagramCanvasReset).toHaveBeenCalledWith('llm-canvas');
  });

  it('fires multiple actions bound to the same key combo', () => {
    const spec = makeSpec();
    spec.actions.push(
      {
        id: 'reset-camera',
        type: 'camera.reset',
        cameraId: 'camera',
        maps: [{ kind: 'key', key: '1', modifiers: ['meta'] }],
      },
      {
        id: 'reset-canvas',
        type: 'diagram-canvas.reset',
        canvasId: 'llm-canvas',
        maps: [{ kind: 'key', key: '1', modifiers: ['meta'] }],
      },
    );

    const onCameraReset = vi.fn();
    const onDiagramCanvasReset = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      {
        getSceneCount: () => 2,
        onSceneStep: () => {},
        onCameraOrbit: () => {},
        onCameraDolly: () => {},
        onCameraReset,
        onDiagramCanvasMove: () => {},
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset,
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: '1', metaKey: true, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onCameraReset).toHaveBeenCalledTimes(1);
    expect(onCameraReset).toHaveBeenCalledWith('camera');
    expect(onDiagramCanvasReset).toHaveBeenCalledTimes(1);
    expect(onDiagramCanvasReset).toHaveBeenCalledWith('llm-canvas');
  });

  it('dispatches diagram-canvas.focus from cmd+click mapping', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'focus-canvas',
      type: 'diagram-canvas.focus',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'pointer', event: 'click', button: 'left', modifiers: ['meta'] }],
    });

    const onDiagramCanvasFocus = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      {
        getSceneCount: () => 2,
        onSceneStep: () => {},
        onCameraOrbit: () => {},
        onCameraDolly: () => {},
        onCameraReset: () => {},
        onDiagramCanvasMove: () => {},
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus,
      },
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new MouseEvent('click', { button: 0, metaKey: true, clientX: 320, clientY: 180, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onDiagramCanvasFocus).toHaveBeenCalledTimes(1);
    expect(onDiagramCanvasFocus).toHaveBeenCalledWith('llm-canvas', 320, 180, undefined);
  });

  it('passes action focusCenter to diagram-canvas.focus handler', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'focus-canvas',
      type: 'diagram-canvas.focus',
      canvasId: 'llm-canvas',
      focusCenter: [10, 20, 30],
      maps: [{ kind: 'pointer', event: 'click', button: 'left', modifiers: ['meta'] }],
    });

    const onDiagramCanvasFocus = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      {
        getSceneCount: () => 2,
        onSceneStep: () => {},
        onCameraOrbit: () => {},
        onCameraDolly: () => {},
        onCameraReset: () => {},
        onDiagramCanvasMove: () => {},
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus,
      },
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new MouseEvent('click', { button: 0, metaKey: true, clientX: 1, clientY: 2, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onDiagramCanvasFocus).toHaveBeenCalledTimes(1);
    expect(onDiagramCanvasFocus).toHaveBeenCalledWith('llm-canvas', 1, 2, [10, 20, 30]);
  });
});
