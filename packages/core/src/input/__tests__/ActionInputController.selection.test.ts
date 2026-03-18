// ActionInputController.selection.test.ts — Tests for carousel selection dispatch (click + keyboard).
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

describe('ActionInputController — carousel selection (click)', () => {
  it('calls onCarouselSelect with pointer source when click is inside carousel bounds', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const getLayoutBounds = vi.fn().mockReturnValue({ x: 0, y: 0, w: 1, h: 1 });
    const target = makeTarget();
    const spec = makeCarouselSpec('products');

    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onCarouselSelect, getLayoutBounds }),
      target,
    );

    ctrl.attach();
    const ev = new MouseEvent('click', {
      button: 0,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(ev);
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    expect(onCarouselSelect).toHaveBeenCalledWith('products', 'pointer', 50, 50);
  });

  it('calls preventDefault on the DOM event when onCarouselSelect returns true', () => {
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
    const ev = new MouseEvent('click', {
      button: 0,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(ev);
    ctrl.detach();

    expect(ev.defaultPrevented).toBe(true);
  });

  it('fires carousel.select action event when selection is consumed', () => {
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
    const fired: Array<{ type: string; id: string; layoutId?: string }> = [];
    ctrl.onActionFired((type, id, detail) => fired.push({ type, id, layoutId: detail.layoutId }));

    target.dispatchEvent(new MouseEvent('click', {
      button: 0,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    }));
    ctrl.detach();

    expect(fired).toHaveLength(1);
    expect(fired[0]!.type).toBe('carousel.select');
    expect(fired[0]!.layoutId).toBe('products');
  });

  it('does not call onCarouselSelect when click is outside carousel bounds', () => {
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
      button: 0,
      clientX: 80,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).not.toHaveBeenCalled();
  });

  it('falls through to normal click processing when onCarouselSelect returns false', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(false);
    const getLayoutBounds = vi.fn().mockReturnValue({ x: 0, y: 0, w: 1, h: 1 });
    const onCarouselStep = vi.fn();
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect, getLayoutBounds, onCarouselStep }),
      target,
    );

    ctrl.attach();
    const ev = new MouseEvent('click', {
      button: 0,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(ev);
    ctrl.detach();

    // onCarouselSelect was called but returned false
    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    // Normal click processing should run — carousel.next click action dispatches
    expect(onCarouselStep).toHaveBeenCalledTimes(1);
    expect(onCarouselStep).toHaveBeenCalledWith('products', 1, 1);
  });

  it('does not call onCarouselSelect when handler is not provided', () => {
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
      button: 0,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    }));
    ctrl.detach();

    // Normal click processing runs since no onCarouselSelect handler
    expect(onCarouselStep).toHaveBeenCalledTimes(1);
  });

  it('skips actions without layoutId during selection detection', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const getLayoutBounds = vi.fn().mockReturnValue({ x: 0, y: 0, w: 1, h: 1 });
    const target = makeTarget();

    const spec: SceneInputControllerSpec = {
      id: 'main',
      scope: 'canvas',
      actions: [
        {
          id: 'carousel-next-no-layout',
          type: 'carousel.next',
          // No layoutId
          stepSlides: 1,
          maps: [{ kind: 'pointer', event: 'click', button: 'left' }],
        },
      ],
    };

    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onCarouselSelect, getLayoutBounds }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new MouseEvent('click', {
      button: 0,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    }));
    ctrl.detach();

    // Action has no layoutId, so selection detection skips it
    expect(onCarouselSelect).not.toHaveBeenCalled();
  });
});

describe('ActionInputController — carousel selection (keyboard)', () => {
  it('calls onCarouselSelect with keyboard source on Enter key', () => {
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
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    expect(onCarouselSelect).toHaveBeenCalledWith('products', 'keyboard', null, null);
  });

  it('calls onCarouselSelect with keyboard source on Space key', () => {
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
      key: ' ',
      bubbles: true,
      cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    expect(onCarouselSelect).toHaveBeenCalledWith('products', 'keyboard', null, null);
  });

  it('calls preventDefault on keyboard event when onCarouselSelect returns true', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect }),
      target,
    );

    ctrl.attach();
    const ev = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(ev);
    ctrl.detach();

    expect(ev.defaultPrevented).toBe(true);
  });

  it('fires carousel.select action event on keyboard selection', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect }),
      target,
    );

    ctrl.attach();
    const fired: Array<{ type: string; id: string; layoutId?: string }> = [];
    ctrl.onActionFired((type, id, detail) => fired.push({ type, id, layoutId: detail.layoutId }));

    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
    ctrl.detach();

    expect(fired).toHaveLength(1);
    expect(fired[0]!.type).toBe('carousel.select');
    expect(fired[0]!.layoutId).toBe('products');
  });

  it('falls through to normal key processing when onCarouselSelect returns false', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(false);
    const target = makeTarget();

    // Add an Enter key mapping for scene.next to verify fallthrough
    const spec: SceneInputControllerSpec = {
      id: 'main',
      scope: 'canvas',
      actions: [
        {
          id: 'carousel-next',
          type: 'carousel.next',
          layoutId: 'products',
          stepSlides: 1,
          maps: [{ kind: 'key', key: 'ArrowRight' }],
        },
        {
          id: 'scene-next',
          type: 'scene.next',
          maps: [{ kind: 'key', key: 'Enter' }],
        },
      ],
    };

    const onSceneStep = vi.fn();
    const ctrl = new ActionInputController(
      target,
      () => spec,
      makeHandler({ onCarouselSelect, onSceneStep }),
      target,
    );

    ctrl.attach();
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    // Normal key processing should fire scene.next
    expect(onSceneStep).toHaveBeenCalledTimes(1);
    expect(onSceneStep).toHaveBeenCalledWith(1, 1);
  });

  it('does not trigger selection for non-Enter/Space keys', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const onCarouselStep = vi.fn();
    const target = makeTarget();

    const ctrl = new ActionInputController(
      target,
      () => makeCarouselSpec('products'),
      makeHandler({ onCarouselSelect, onCarouselStep }),
      target,
    );

    ctrl.attach();
    // ArrowRight should route to carousel.next, not to selection
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).not.toHaveBeenCalled();
    expect(onCarouselStep).toHaveBeenCalledTimes(1);
  });

  it('uses the first carousel layout in spec for keyboard selection', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const target = makeTarget();

    const spec: SceneInputControllerSpec = {
      id: 'main',
      scope: 'canvas',
      actions: [
        {
          id: 'first-carousel-next',
          type: 'carousel.next',
          layoutId: 'first-carousel',
          stepSlides: 1,
          maps: [{ kind: 'key', key: 'ArrowRight' }],
        },
        {
          id: 'second-carousel-next',
          type: 'carousel.next',
          layoutId: 'second-carousel',
          stepSlides: 1,
          maps: [{ kind: 'key', key: 'ArrowRight' }],
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
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).toHaveBeenCalledTimes(1);
    expect(onCarouselSelect).toHaveBeenCalledWith('first-carousel', 'keyboard', null, null);
  });

  it('skips keyboard selection when no carousel actions have layoutId', () => {
    const onCarouselSelect = vi.fn().mockReturnValue(true);
    const target = makeTarget();

    const spec: SceneInputControllerSpec = {
      id: 'main',
      scope: 'canvas',
      actions: [
        {
          id: 'carousel-next-no-layout',
          type: 'carousel.next',
          // No layoutId
          stepSlides: 1,
          maps: [{ kind: 'key', key: 'ArrowRight' }],
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
    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    }));
    ctrl.detach();

    expect(onCarouselSelect).not.toHaveBeenCalled();
  });
});
