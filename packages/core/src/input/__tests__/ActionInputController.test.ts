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

  /** Minimal handler that satisfies the required fields. */
  const makeHandler = (overrides: Partial<Parameters<typeof ActionInputController>[2]> = {}) => ({
    getSceneCount: () => 2,
    onSceneStep: () => {},
    onCameraOrbit: () => {},
    onCameraDolly: () => {},
    onCameraReset: () => {},
    onCarouselStep: () => {},
    ...overrides,
  });

  it('routes diagram-canvas.move drag to onUnknownAction', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'move-canvas',
      type: 'diagram-canvas.move',
      canvasId: 'my-canvas',
      maps: [{ kind: 'pointer', event: 'drag', button: 'left' }],
    });

    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onUnknownAction }), target);

    ctrl.attach();
    target.dispatchEvent(makePointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointermove', { button: 0, clientX: 10, clientY: 5, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointerup', { button: 0, clientX: 10, clientY: 5, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onUnknownAction).toHaveBeenCalledTimes(1);
    const [type, canvasId, , extra] = onUnknownAction.mock.calls[0]!;
    expect(type).toBe('diagram-canvas.move');
    expect(canvasId).toBe('my-canvas');
    expect((extra as Record<string, unknown>).dx).toBe(10);
    expect((extra as Record<string, unknown>).dy).toBe(5);
  });

  it('routes camera.orbit drag to onCameraOrbit (not onUnknownAction)', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'orbit',
      type: 'camera.orbit',
      cameraId: 'cam',
      maps: [{ kind: 'pointer', event: 'drag', button: 'left' }],
    });

    const onCameraOrbit = vi.fn();
    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onCameraOrbit, onUnknownAction }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(makePointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointermove', { button: 0, clientX: 5, clientY: 3, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointerup', { button: 0, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onCameraOrbit).toHaveBeenCalledTimes(1);
    expect(onUnknownAction).not.toHaveBeenCalled();
  });

  it('routes scene.next key to onSceneStep (not onUnknownAction)', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'next',
      type: 'scene.next',
      maps: [{ kind: 'key', key: 'ArrowRight' }],
    });

    const onSceneStep = vi.fn();
    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onSceneStep, onUnknownAction }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onSceneStep).toHaveBeenCalledTimes(1);
    expect(onSceneStep).toHaveBeenCalledWith(1, 1);
    expect(onUnknownAction).not.toHaveBeenCalled();
  });

  it('routes diagram-canvas.reset key to onUnknownAction', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'reset-canvas',
      type: 'diagram-canvas.reset',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'key', key: '1', modifiers: ['ctrl'] }],
    });

    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onUnknownAction }), target);

    ctrl.attach();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onUnknownAction).toHaveBeenCalledTimes(1);
    const [type, canvasId] = onUnknownAction.mock.calls[0]!;
    expect(type).toBe('diagram-canvas.reset');
    expect(canvasId).toBe('llm-canvas');
  });

  it('fires camera.reset AND diagram-canvas.reset for same key combo', () => {
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
    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onCameraReset, onUnknownAction }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: '1', metaKey: true, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onCameraReset).toHaveBeenCalledTimes(1);
    expect(onCameraReset).toHaveBeenCalledWith('camera');
    expect(onUnknownAction).toHaveBeenCalledTimes(1);
    const [type, canvasId] = onUnknownAction.mock.calls[0]!;
    expect(type).toBe('diagram-canvas.reset');
    expect(canvasId).toBe('llm-canvas');
  });

  it('routes diagram-canvas.focus click to onUnknownAction with focusCenter in extra', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'focus-canvas',
      type: 'diagram-canvas.focus',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'pointer', event: 'click', button: 'left', modifiers: ['meta'] }],
    });

    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onUnknownAction }), target);

    ctrl.attach();
    target.dispatchEvent(new MouseEvent('click', { button: 0, metaKey: true, clientX: 320, clientY: 180, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onUnknownAction).toHaveBeenCalledTimes(1);
    const [type, canvasId, , extra] = onUnknownAction.mock.calls[0]!;
    expect(type).toBe('diagram-canvas.focus');
    expect(canvasId).toBe('llm-canvas');
    expect((extra as Record<string, unknown>).focusCenter).toBeUndefined();
  });

  it('passes action focusCenter to onUnknownAction extra for diagram-canvas.focus', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'focus-canvas',
      type: 'diagram-canvas.focus',
      canvasId: 'llm-canvas',
      focusCenter: [10, 20, 30],
      maps: [{ kind: 'pointer', event: 'click', button: 'left', modifiers: ['meta'] }],
    });

    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onUnknownAction }), target);

    ctrl.attach();
    target.dispatchEvent(new MouseEvent('click', { button: 0, metaKey: true, clientX: 1, clientY: 2, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onUnknownAction).toHaveBeenCalledTimes(1);
    const [, , , extra] = onUnknownAction.mock.calls[0]!;
    expect((extra as Record<string, unknown>).focusCenter).toEqual([10, 20, 30]);
  });

  it('locks drag to first dominant axis when lockAxis is sticky', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'move-canvas',
      type: 'diagram-canvas.move',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'pointer', event: 'drag', button: 'left', modifiers: ['shift'], axis: 'xy', lockAxis: 'sticky' }],
    });

    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onUnknownAction }), target);

    ctrl.attach();
    target.dispatchEvent(makePointerEvent('pointerdown', { button: 0, shiftKey: true, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointermove', { button: 0, shiftKey: true, clientX: 8, clientY: 1, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointermove', { button: 0, shiftKey: true, clientX: 10, clientY: 7, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointerup', { button: 0, shiftKey: true, clientX: 10, clientY: 7, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onUnknownAction).toHaveBeenCalledTimes(2);
    const extra0 = onUnknownAction.mock.calls[0]![3] as Record<string, unknown>;
    const extra1 = onUnknownAction.mock.calls[1]![3] as Record<string, unknown>;
    expect(extra0.dx).toBe(8);
    expect(extra0.dy).toBe(0);
    expect(extra1.dx).toBe(2);
    expect(extra1.dy).toBe(0);
  });

  it('applies axis filtering to drag move mappings', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'move-canvas-x',
      type: 'diagram-canvas.move',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'pointer', event: 'drag', button: 'left', modifiers: ['shift'], axis: 'x' }],
    });

    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onUnknownAction }), target);

    ctrl.attach();
    target.dispatchEvent(makePointerEvent('pointerdown', { button: 0, shiftKey: true, clientX: 2, clientY: 3, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointermove', { button: 0, shiftKey: true, clientX: 12, clientY: 23, bubbles: true, cancelable: true }));
    target.dispatchEvent(makePointerEvent('pointerup', { button: 0, shiftKey: true, clientX: 12, clientY: 23, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onUnknownAction).toHaveBeenCalledTimes(1);
    const extra = onUnknownAction.mock.calls[0]![3] as Record<string, unknown>;
    expect(extra.dx).toBe(10);
    expect(extra.dy).toBe(0);
  });

  it('locks wheel move to dominant axis when lockAxis is sticky', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'move-canvas-wheel',
      type: 'diagram-canvas.move',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'wheel', modifiers: ['shift'], axis: 'xy', lockAxis: 'sticky' }],
    });

    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onUnknownAction }), target);

    ctrl.attach();
    target.dispatchEvent(new WheelEvent('wheel', { deltaX: 18, deltaY: 4, shiftKey: true, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onUnknownAction).toHaveBeenCalledTimes(1);
    const extra = onUnknownAction.mock.calls[0]![3] as Record<string, unknown>;
    expect(extra.dx).toBe(18);
    expect(extra.dy).toBe(0);
  });

  it('inverts wheel Y deltas for wheel mappings', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'dolly-wheel',
      type: 'camera.dolly',
      cameraId: 'camera',
      maps: [{ kind: 'wheel', axis: 'y' }],
    });

    const onCameraDolly = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onCameraDolly }), target);

    ctrl.attach();
    target.dispatchEvent(new WheelEvent('wheel', { deltaY: 12, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onCameraDolly).toHaveBeenCalledTimes(1);
    expect(onCameraDolly).toHaveBeenCalledWith('camera', -12, 1);
  });

  it('keeps wheel sticky lock axis across a continuous wheel gesture', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'move-canvas-wheel',
      type: 'diagram-canvas.move',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'wheel', modifiers: ['shift'], axis: 'xy', lockAxis: 'sticky' }],
    });

    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onUnknownAction }), target);

    ctrl.attach();
    target.dispatchEvent(new WheelEvent('wheel', { deltaX: 20, deltaY: 3, shiftKey: true, bubbles: true, cancelable: true }));
    target.dispatchEvent(new WheelEvent('wheel', { deltaX: 1, deltaY: 14, shiftKey: true, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onUnknownAction).toHaveBeenCalledTimes(2);
    const extra0 = onUnknownAction.mock.calls[0]![3] as Record<string, unknown>;
    const extra1 = onUnknownAction.mock.calls[1]![3] as Record<string, unknown>;
    expect(extra0.dx).toBe(20);
    expect(extra0.dy).toBe(0);
    expect(extra1.dx).toBe(1);
    expect(extra1.dy).toBe(0);
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

    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onUnknownAction }), target);

    ctrl.attach();
    target.dispatchEvent(new WheelEvent('wheel', { deltaX: 14, deltaY: 3, shiftKey: true, metaKey: true, bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onUnknownAction).toHaveBeenCalledTimes(1);
    const [type] = onUnknownAction.mock.calls[0]!;
    expect(type).toBe('diagram-canvas.rotate');
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
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onCameraDolly }), target);

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
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onCameraDolly }), target);

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
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onCameraDolly }), target);

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
    const ctrl = new ActionInputController(target, () => spec, makeHandler({ onCameraDolly }), target);

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
    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onCameraDolly, onUnknownAction }),
      target,
    );

    ctrl.attach();
    const ev = new WheelEvent('wheel', { ctrlKey: true, deltaY: 10, deltaX: 2, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    ctrl.detach();

    expect(ev.defaultPrevented).toBe(true);
    expect(onCameraDolly).toHaveBeenCalledTimes(0);
    expect(onUnknownAction).toHaveBeenCalledTimes(0);
  });

  it('uses idDefaults.cameraId when action cameraId is omitted', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'reset-camera',
      type: 'camera.reset',
      maps: [{ kind: 'key', key: '1' }],
    });

    const onCameraReset = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onCameraReset }),
      target,
      { idDefaults: { cameraId: 'primary-camera', canvasId: 'primary-canvas' } },
    );

    ctrl.attach();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onCameraReset).toHaveBeenCalledWith('primary-camera');
  });

  it('routes diagram-canvas.reset with no canvasId to onUnknownAction with undefined canvasId', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'reset-canvas',
      type: 'diagram-canvas.reset',
      // no canvasId — action.canvasId is undefined
      maps: [{ kind: 'key', key: '2' }],
    });

    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onUnknownAction }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onUnknownAction).toHaveBeenCalledTimes(1);
    const [type, canvasId] = onUnknownAction.mock.calls[0]!;
    expect(type).toBe('diagram-canvas.reset');
    expect(canvasId).toBeUndefined();
  });

  it('falls back to legacy implicit IDs with one-time warnings', () => {
    const spec = makeSpec();
    spec.actions.push({
      id: 'reset-camera',
      type: 'camera.reset',
      maps: [{ kind: 'key', key: '1' }],
    });

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onCameraReset = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onCameraReset }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true }));
    target.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true }));
    ctrl.detach();

    expect(onCameraReset).toHaveBeenCalledTimes(2);
    expect(onCameraReset).toHaveBeenNthCalledWith(1, 'camera');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  describe('carousel dispatch', () => {
    it('routes carousel.next key to onCarouselStep with direction +1', () => {
      const spec = makeSpec();
      spec.actions.push({
        id: 'carousel-next',
        type: 'carousel.next',
        layoutId: 'my-carousel',
        stepSlides: 2,
        maps: [{ kind: 'key', key: 'ArrowRight' }],
      });

      const onCarouselStep = vi.fn();
      const target = document.createElement('div');
      const ctrl = new ActionInputController(target, () => spec, makeHandler({ onCarouselStep }), target);

      ctrl.attach();
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      ctrl.detach();

      expect(onCarouselStep).toHaveBeenCalledTimes(1);
      expect(onCarouselStep).toHaveBeenCalledWith('my-carousel', 1, 2);
    });

    it('routes carousel.prev key to onCarouselStep with direction -1', () => {
      const spec = makeSpec();
      spec.actions.push({
        id: 'carousel-prev',
        type: 'carousel.prev',
        layoutId: 'my-carousel',
        stepSlides: 1,
        maps: [{ kind: 'key', key: 'ArrowLeft' }],
      });

      const onCarouselStep = vi.fn();
      const target = document.createElement('div');
      const ctrl = new ActionInputController(target, () => spec, makeHandler({ onCarouselStep }), target);

      ctrl.attach();
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
      ctrl.detach();

      expect(onCarouselStep).toHaveBeenCalledTimes(1);
      expect(onCarouselStep).toHaveBeenCalledWith('my-carousel', -1, 1);
    });

    it('routes carousel.next click to onCarouselStep', () => {
      const spec = makeSpec();
      spec.actions.push({
        id: 'carousel-next',
        type: 'carousel.next',
        layoutId: 'slides',
        stepSlides: 1,
        maps: [{ kind: 'pointer', event: 'click', button: 'left' }],
      });

      const onCarouselStep = vi.fn();
      const target = document.createElement('div');
      const ctrl = new ActionInputController(target, () => spec, makeHandler({ onCarouselStep }), target);

      ctrl.attach();
      target.dispatchEvent(new MouseEvent('click', { button: 0, bubbles: true, cancelable: true }));
      ctrl.detach();

      expect(onCarouselStep).toHaveBeenCalledTimes(1);
      expect(onCarouselStep).toHaveBeenCalledWith('slides', 1, 1);
    });

    it('warns and does not call onCarouselStep when layoutId is missing', () => {
      const spec = makeSpec();
      spec.actions.push({
        id: 'carousel-next',
        type: 'carousel.next',
        // no layoutId
        maps: [{ kind: 'key', key: 'ArrowRight' }],
      });

      const onCarouselStep = vi.fn();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const target = document.createElement('div');
      const ctrl = new ActionInputController(target, () => spec, makeHandler({ onCarouselStep }), target);

      ctrl.attach();
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      ctrl.detach();

      expect(onCarouselStep).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toContain('carousel-next');
      expect(warn.mock.calls[0]![0]).toContain('carousel.next');
      expect(warn.mock.calls[0]![0]).toContain('layoutId');
      warn.mockRestore();
    });

    it('defaults stepSlides to 1 when absent', () => {
      const spec = makeSpec();
      spec.actions.push({
        id: 'carousel-next',
        type: 'carousel.next',
        layoutId: 'demo',
        // no stepSlides
        maps: [{ kind: 'key', key: 'ArrowRight' }],
      });

      const onCarouselStep = vi.fn();
      const target = document.createElement('div');
      const ctrl = new ActionInputController(target, () => spec, makeHandler({ onCarouselStep }), target);

      ctrl.attach();
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      ctrl.detach();

      expect(onCarouselStep).toHaveBeenCalledWith('demo', 1, 1);
    });
  });

  it('resets sticky wheel lock after configured idle timeout', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    let now = 0;
    nowSpy.mockImplementation(() => now);

    const spec = makeSpec();
    spec.actions.push({
      id: 'move-canvas-wheel',
      type: 'diagram-canvas.move',
      canvasId: 'llm-canvas',
      maps: [{ kind: 'wheel', modifiers: ['shift'], axis: 'xy', lockAxis: 'sticky' }],
    });

    const onUnknownAction = vi.fn();
    const target = document.createElement('div');
    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onUnknownAction }),
      target,
      { wheelLockIdleMs: 5 },
    );

    ctrl.attach();
    target.dispatchEvent(new WheelEvent('wheel', { deltaX: 20, deltaY: 2, shiftKey: true, bubbles: true, cancelable: true }));
    now = 10;
    target.dispatchEvent(new WheelEvent('wheel', { deltaX: 1, deltaY: 14, shiftKey: true, bubbles: true, cancelable: true }));
    ctrl.detach();

    const extra0 = onUnknownAction.mock.calls[0]![3] as Record<string, unknown>;
    const extra1 = onUnknownAction.mock.calls[1]![3] as Record<string, unknown>;
    // First wheel event: X dominant → dx=20, dy=0
    expect(extra0.dx).toBe(20);
    expect(extra0.dy).toBe(0);
    // After idle, lock resets: Y dominant for second event → dx=0, dy=-14 (inverted)
    expect(extra1.dx).toBe(0);
    expect(extra1.dy).toBe(-14);
    nowSpy.mockRestore();
  });
});
