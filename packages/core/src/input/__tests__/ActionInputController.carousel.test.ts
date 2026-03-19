// ActionInputController.carousel.test.ts — Tests for handleClick/handleKeyDown carousel selection with spatial gating inversion fix.
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { ActionInputController } from '../ActionInputController';
import type { ActionInputHandler, SceneInputControllerSpec } from '../types';

/** Builds a spec with carousel.next and carousel.prev actions targeting a given layoutId. */
const makeCarouselSpec = (layoutId: string): SceneInputControllerSpec => ({
  id: 'main',
  scope: 'canvas',
  actions: [
    {
      id: 'carousel-next',
      type: 'carousel.next',
      layoutId,
      stepSlides: 1,
      maps: [
        { kind: 'key', key: 'ArrowRight' },
        { kind: 'pointer', event: 'click', button: 'left' },
      ],
    },
    {
      id: 'carousel-prev',
      type: 'carousel.prev',
      layoutId,
      stepSlides: 1,
      maps: [
        { kind: 'key', key: 'ArrowLeft' },
      ],
    },
  ],
});

/** Minimal handler that satisfies the required fields. */
const makeHandler = (overrides: Partial<ActionInputHandler> = {}): ActionInputHandler => ({
  getSceneCount: () => 2,
  onSceneStep: () => {},
  onCameraOrbit: () => {},
  onCameraZoom: () => {},
  onCameraPan: () => {},
  onCameraReset: () => {},
  onCarouselStep: () => {},
  ...overrides,
});

/** Sets up a target element with a known bounding rect for NVS conversion. */
const makeTarget = (): HTMLDivElement => {
  const target = document.createElement('div');
  Object.defineProperty(target, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  });
  return target;
};

describe('ActionInputController — handleClick carousel selection dispatch', () => {
  it('dispatches onCarouselSelect when click is inside carousel bounds', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const getLayoutBounds = vi.fn().mockReturnValue({ x: 0, y: 0, w: 1, h: 1 });
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect, getLayoutBounds }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new MouseEvent('click', {
      button: 0, clientX: 50, clientY: 50, bubbles: true, cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    expect(onCarouselSelect).toHaveBeenCalledWith('products', 'pointer', 50, 50);
  });

  it('skips onCarouselSelect when click is outside carousel bounds', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    // Layout occupies the left half only
    const getLayoutBounds = vi.fn().mockReturnValue({ x: 0, y: 0, w: 0.5, h: 1 });
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect, getLayoutBounds }),
      target,
    );

    ctrl.attach();
    // Click at clientX=80 → NVS 0.8, outside 0-0.5 bounds
    target.dispatchEvent(new MouseEvent('click', {
      button: 0, clientX: 80, clientY: 50, bubbles: true, cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).not.toHaveBeenCalled();
  });

  it('calls onCarouselSelect even when getLayoutBounds is absent', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const target = makeTarget();

    // No getLayoutBounds provided — spatial gating should be skipped, not block selection
    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new MouseEvent('click', {
      button: 0, clientX: 50, clientY: 50, bubbles: true, cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    expect(onCarouselSelect).toHaveBeenCalledWith('products', 'pointer', 50, 50);
  });

  it('calls onCarouselSelect when getLayoutBounds returns null', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const getLayoutBounds = vi.fn().mockReturnValue(null);
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect, getLayoutBounds }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new MouseEvent('click', {
      button: 0, clientX: 50, clientY: 50, bubbles: true, cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    expect(onCarouselSelect).toHaveBeenCalledWith('products', 'pointer', 50, 50);
  });

  it('does not call onCarouselSelect when handler is absent', () => {
    const onCarouselStep = vi.fn();
    const getLayoutBounds = vi.fn().mockReturnValue({ x: 0, y: 0, w: 1, h: 1 });
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselStep, getLayoutBounds }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new MouseEvent('click', {
      button: 0, clientX: 50, clientY: 50, bubbles: true, cancelable: true,
    }));
    ctrl.detach();

    // Normal click processing runs since no onCarouselSelect handler
    expect(onCarouselStep).toHaveBeenCalledTimes(1);
  });

  it('skips carousel selection for non-carousel actions', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const target = makeTarget();

    const spec: SceneInputControllerSpec = {
      id: 'main',
      scope: 'canvas',
      actions: [
        {
          id: 'scene-next',
          type: 'scene.next',
          maps: [{ kind: 'pointer', event: 'click', button: 'left' }],
        },
      ],
    };

    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onCarouselSelect }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new MouseEvent('click', {
      button: 0, clientX: 50, clientY: 50, bubbles: true, cancelable: true,
    }));
    ctrl.detach();

    // No carousel actions in spec, so onCarouselSelect is never called
    expect(onCarouselSelect).not.toHaveBeenCalled();
  });

  it('short-circuits when onCarouselSelect returns true (consumed)', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const onCarouselStep = vi.fn();
    const getLayoutBounds = vi.fn().mockReturnValue({ x: 0, y: 0, w: 1, h: 1 });
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect, getLayoutBounds, onCarouselStep }),
      target,
    );

    ctrl.attach();
    const ev = new MouseEvent('click', {
      button: 0, clientX: 50, clientY: 50, bubbles: true, cancelable: true,
    });
    target.dispatchEvent(ev);
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
    // Normal click processing should NOT run — consumed by selection
    expect(onCarouselStep).not.toHaveBeenCalled();
  });

  it('falls through when onCarouselSelect returns false', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(false);
    const onCarouselStep = vi.fn();
    const getLayoutBounds = vi.fn().mockReturnValue({ x: 0, y: 0, w: 1, h: 1 });
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect, getLayoutBounds, onCarouselStep }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new MouseEvent('click', {
      button: 0, clientX: 50, clientY: 50, bubbles: true, cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    // Normal click processing fires carousel.next dispatchClick
    expect(onCarouselStep).toHaveBeenCalledTimes(1);
    expect(onCarouselStep).toHaveBeenCalledWith('products', 1, 1);
  });
});

describe('ActionInputController — handleKeyDown carousel selection dispatch', () => {
  it('dispatches onCarouselSelect on Enter key', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    expect(onCarouselSelect).toHaveBeenCalledWith('products', 'keyboard', null, null);
  });

  it('dispatches onCarouselSelect on Space key', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: ' ', bubbles: true, cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    expect(onCarouselSelect).toHaveBeenCalledWith('products', 'keyboard', null, null);
  });
});

/** Creates a fake PointerEvent using MouseEvent (jsdom lacks PointerEvent). */
const makePointerEvent = (
  type: string,
  options: MouseEventInit & { pointerId?: number; pointerType?: string } = {},
): PointerEvent => {
  const event = new MouseEvent(type, options) as PointerEvent;
  Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 });
  Object.defineProperty(event, 'pointerType', { value: options.pointerType ?? 'mouse' });
  return event;
};

describe('ActionInputController — handlePointerDown regression', () => {
  it('does not capture left-click when only touch-drag maps exist', () => {
    const target = makeTarget();
    const onCameraOrbit = vi.fn();

    const spec: SceneInputControllerSpec = {
      id: 'main',
      scope: 'canvas',
      actions: [
        {
          id: 'orbit',
          type: 'camera.orbit',
          maps: [{ kind: 'pointer', event: 'drag', button: 'left', touches: 1 }],
        },
      ],
    };

    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onCameraOrbit }),
      target,
    );

    ctrl.attach();

    // Simulate a mouse pointerdown (not touch)
    target.dispatchEvent(makePointerEvent('pointerdown', {
      button: 0,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
    }));

    // Move — should not dispatch orbit because the drag map is touch-only
    target.dispatchEvent(makePointerEvent('pointermove', {
      clientX: 60,
      clientY: 55,
      bubbles: true,
      pointerId: 1,
      pointerType: 'mouse',
    }));
    ctrl.detach();

    expect(onCameraOrbit).not.toHaveBeenCalled();
  });
});
