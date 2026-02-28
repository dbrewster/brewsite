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
  const makePointerEvent = (type: string, options: MouseEventInit & { pointerId?: number } = {}) => {
    const event = new MouseEvent(type, options) as PointerEvent;
    Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 });
    return event;
  };

  const makeTouchPointerEvent = (
    type: string,
    options: MouseEventInit & { pointerId?: number } = {},
  ) => {
    const event = makePointerEvent(type, options);
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
    return event;
  };

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

  it('locks drag to first dominant axis when lockAxis is sticky', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'move-canvas',
      type: 'diagram-canvas.move',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'pointer', event: 'drag', button: 'left', modifiers: ['shift'], axis: 'xy', lockAxis: 'sticky' }],
    });

    const onDiagramCanvasMove = vi.fn();
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
        onDiagramCanvasMove,
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    target.dispatchEvent(makePointerEvent('pointerdown', { button: 0, shiftKey: true, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointermove', { button: 0, shiftKey: true, clientX: 8, clientY: 1, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointermove', { button: 0, shiftKey: true, clientX: 10, clientY: 7, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointerup', { button: 0, shiftKey: true, clientX: 10, clientY: 7, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onDiagramCanvasMove).toHaveBeenCalledTimes(2);
    expect(onDiagramCanvasMove).toHaveBeenNthCalledWith(1, 'llm-canvas', 8, 0, 1);
    expect(onDiagramCanvasMove).toHaveBeenNthCalledWith(2, 'llm-canvas', 2, 0, 1);
  });

  it('applies axis filtering to drag move mappings', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'move-canvas-x',
      type: 'diagram-canvas.move',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'pointer', event: 'drag', button: 'left', modifiers: ['shift'], axis: 'x' }],
    });

    const onDiagramCanvasMove = vi.fn();
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
        onDiagramCanvasMove,
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    target.dispatchEvent(makePointerEvent('pointerdown', { button: 0, shiftKey: true, clientX: 2, clientY: 3, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointermove', { button: 0, shiftKey: true, clientX: 12, clientY: 23, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointerup', { button: 0, shiftKey: true, clientX: 12, clientY: 23, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onDiagramCanvasMove).toHaveBeenCalledTimes(1);
    expect(onDiagramCanvasMove).toHaveBeenCalledWith('llm-canvas', 10, 0, 1);
  });

  it('locks wheel move to dominant axis when lockAxis is sticky', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'move-canvas-wheel',
      type: 'diagram-canvas.move',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'wheel', modifiers: ['shift'], axis: 'xy', lockAxis: 'sticky' }],
    });

    const onDiagramCanvasMove = vi.fn();
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
        onDiagramCanvasMove,
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new WheelEvent('wheel', { deltaX: 18, deltaY: 4, shiftKey: true, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onDiagramCanvasMove).toHaveBeenCalledTimes(1);
    expect(onDiagramCanvasMove).toHaveBeenCalledWith('llm-canvas', 18, 0, 1);
  });

  it('keeps wheel sticky lock axis across a continuous wheel gesture', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'move-canvas-wheel',
      type: 'diagram-canvas.move',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'wheel', modifiers: ['shift'], axis: 'xy', lockAxis: 'sticky' }],
    });

    const onDiagramCanvasMove = vi.fn();
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
        onDiagramCanvasMove,
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new WheelEvent('wheel', { deltaX: 20, deltaY: 3, shiftKey: true, bubbles: true, cancelable: true }));
    target.dispatchEvent(new WheelEvent('wheel', { deltaX: 1, deltaY: 14, shiftKey: true, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onDiagramCanvasMove).toHaveBeenCalledTimes(2);
    expect(onDiagramCanvasMove).toHaveBeenNthCalledWith(1, 'llm-canvas', 20, 0, 1);
    expect(onDiagramCanvasMove).toHaveBeenNthCalledWith(2, 'llm-canvas', 1, 0, 1);
  });

  it('does not let a subset modifier mapping override a more specific wheel mapping', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'move-canvas-wheel',
      type: 'diagram-canvas.move',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'wheel', modifiers: ['shift'], axis: 'xy', lockAxis: 'sticky' }],
    });
    spec.actions.push({
      id: 'rotate-canvas-wheel',
      type: 'diagram-canvas.rotate',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'wheel', modifiers: ['meta', 'shift'], axis: 'xy', lockAxis: 'sticky' }],
    });

    const onDiagramCanvasMove = vi.fn();
    const onDiagramCanvasRotate = vi.fn();
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
        onDiagramCanvasMove,
        onDiagramCanvasRotate,
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new WheelEvent('wheel', { deltaX: 14, deltaY: 3, shiftKey: true, metaKey: true, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onDiagramCanvasMove).toHaveBeenCalledTimes(0);
    expect(onDiagramCanvasRotate).toHaveBeenCalledTimes(1);
    expect(onDiagramCanvasRotate).toHaveBeenCalledWith('llm-canvas', 14, 0, 1);
  });

  it('dispatches camera dolly for pinch out mapping', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'pinch-out-dolly',
      type: 'camera.dolly',
      cameraId: 'camera',
      maps: [{ kind: 'pinch', direction: 'out', threshold: 1 }],
    });

    const onCameraDolly = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      {
        getSceneCount: () => 2,
        onSceneStep: () => {},
        onCameraOrbit: () => {},
        onCameraDolly,
        onCameraReset: () => {},
        onDiagramCanvasMove: () => {},
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    target.dispatchEvent(makeTouchPointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makeTouchPointerEvent('pointerdown', { pointerId: 2, clientX: 10, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makeTouchPointerEvent('pointermove', { pointerId: 2, clientX: 20, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makeTouchPointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makeTouchPointerEvent('pointerup', { pointerId: 2, clientX: 20, clientY: 0, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onCameraDolly).toHaveBeenCalledTimes(1);
    expect(onCameraDolly).toHaveBeenCalledWith('camera', 10, 1);
  });

  it('does not dispatch pinch out action when pinch direction is in', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'pinch-in-dolly',
      type: 'camera.dolly',
      cameraId: 'camera',
      maps: [{ kind: 'pinch', direction: 'in', threshold: 1 }],
    });

    const onCameraDolly = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      {
        getSceneCount: () => 2,
        onSceneStep: () => {},
        onCameraOrbit: () => {},
        onCameraDolly,
        onCameraReset: () => {},
        onDiagramCanvasMove: () => {},
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    target.dispatchEvent(makeTouchPointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makeTouchPointerEvent('pointerdown', { pointerId: 2, clientX: 10, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makeTouchPointerEvent('pointermove', { pointerId: 2, clientX: 20, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makeTouchPointerEvent('pointerup', { pointerId: 1, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makeTouchPointerEvent('pointerup', { pointerId: 2, clientX: 20, clientY: 0, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onCameraDolly).toHaveBeenCalledTimes(0);
  });

  it('dispatches pinch map from ctrl+wheel trackpad pinch signal', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'pinch-out-dolly',
      type: 'camera.dolly',
      cameraId: 'camera',
      maps: [{ kind: 'pinch', direction: 'out', threshold: 1 }],
    });

    const onCameraDolly = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      {
        getSceneCount: () => 2,
        onSceneStep: () => {},
        onCameraOrbit: () => {},
        onCameraDolly,
        onCameraReset: () => {},
        onDiagramCanvasMove: () => {},
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    const ev = new WheelEvent('wheel', { ctrlKey: true, deltaY: 12, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    ctrl.detach();

    expect(ev.defaultPrevented).toBe(true);
    expect(onCameraDolly).toHaveBeenCalledTimes(1);
    expect(onCameraDolly).toHaveBeenCalledWith('camera', 12, 1);
  });

  it('does not let wheel map consume ctrl+wheel pinch when pinch map exists', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'wheel-dolly',
      type: 'camera.dolly',
      cameraId: 'camera',
      maps: [{ kind: 'wheel', modifiers: ['ctrl'], axis: 'y' }],
    });
    spec.actions.push({
      id: 'pinch-out-dolly',
      type: 'camera.dolly',
      cameraId: 'camera',
      maps: [{ kind: 'pinch', direction: 'out', threshold: 1 }],
    });

    const onCameraDolly = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      {
        getSceneCount: () => 2,
        onSceneStep: () => {},
        onCameraOrbit: () => {},
        onCameraDolly,
        onCameraReset: () => {},
        onDiagramCanvasMove: () => {},
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    const ev = new WheelEvent('wheel', { ctrlKey: true, deltaY: 15, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    ctrl.detach();

    expect(ev.defaultPrevented).toBe(true);
    expect(onCameraDolly).toHaveBeenCalledTimes(1);
    expect(onCameraDolly).toHaveBeenCalledWith('camera', 15, 1);
  });

  it('consumes ctrl+wheel pinch exclusively even below pinch threshold', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'wheel-move',
      type: 'diagram-canvas.move',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'wheel', modifiers: ['ctrl'], axis: 'xy' }],
    });
    spec.actions.push({
      id: 'pinch-out-dolly',
      type: 'camera.dolly',
      cameraId: 'camera',
      maps: [{ kind: 'pinch', direction: 'out', threshold: 999 }],
    });

    const onCameraDolly = vi.fn();
    const onDiagramCanvasMove = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      {
        getSceneCount: () => 2,
        onSceneStep: () => {},
        onCameraOrbit: () => {},
        onCameraDolly,
        onCameraReset: () => {},
        onDiagramCanvasMove,
        onDiagramCanvasRotate: () => {},
        onDiagramCanvasReset: () => {},
        onDiagramCanvasFocus: () => {},
      },
      target,
    );

    ctrl.attach();
    const ev = new WheelEvent('wheel', { ctrlKey: true, deltaY: 10, deltaX: 2, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    ctrl.detach();

    expect(ev.defaultPrevented).toBe(true);
    expect(onCameraDolly).toHaveBeenCalledTimes(0);
    expect(onDiagramCanvasMove).toHaveBeenCalledTimes(0);
  });
});
