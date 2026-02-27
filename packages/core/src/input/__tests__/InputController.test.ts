// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { InputController } from '../InputController';
import type { InputNavigationHandler } from '../types';

describe('InputController', () => {
  const makePointerEvent = (type: string, options: MouseEventInit & { pointerId?: number } = {}) => {
    const event = new MouseEvent(type, options) as PointerEvent;
    Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 });
    return event;
  };
  it('fires onJumpToScene(0) when Home key pressed', () => {
    const calls: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: () => {},
      onJumpToScene: (i) => calls.push(i),
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    const ctrl = new InputController(el, { mode: 'direct', keys: {} }, handler);
    ctrl.attach();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(calls).toEqual([0]);
    ctrl.detach();
  });

  it('fires onJumpToScene(3) when End key pressed with 4 scenes', () => {
    const calls: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: () => {},
      onJumpToScene: (i) => calls.push(i),
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    const ctrl = new InputController(el, { mode: 'direct', keys: {} }, handler);
    ctrl.attach();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(calls).toEqual([3]);
    ctrl.detach();
  });

  it('fires onScroll with positive delta when ArrowRight pressed', () => {
    const deltas: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: (d) => deltas.push(d),
      onJumpToScene: () => {},
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    const ctrl = new InputController(el, { mode: 'direct', keys: {} }, handler);
    ctrl.attach();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(deltas.length).toBe(1);
    expect(deltas[0]).toBeGreaterThan(0);
    ctrl.detach();
  });

  it('does not fire when modifiers are required but not held', () => {
    const deltas: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: (d) => deltas.push(d),
      onJumpToScene: () => {},
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    const ctrl = new InputController(el, {
      mode: 'direct',
      wheel: { modifiers: ['shift'] },
      keys: false,
    }, handler);
    ctrl.attach();
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }));
    expect(deltas.length).toBe(0);
    ctrl.detach();
  });

  it('handles wheel events in direct mode', () => {
    const deltas: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: (d) => deltas.push(d),
      onJumpToScene: () => {},
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    const ctrl = new InputController(el, { mode: 'direct', wheel: {} }, handler);
    ctrl.attach();
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }));
    expect(deltas.length).toBe(1);
    ctrl.detach();
  });

  it('does not prevent wheel events in scroll mode', () => {
    const deltas: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: (d) => deltas.push(d),
      onJumpToScene: () => {},
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    const ctrl = new InputController(el, { mode: 'scroll', wheel: {} }, handler);
    ctrl.attach();
    const event = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(deltas.length).toBe(0);
    ctrl.detach();
  });

  it('suppresses wheel navigation when wheelGuard returns true', () => {
    const deltas: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: (d) => deltas.push(d),
      onJumpToScene: () => {},
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    const ctrl = new InputController(el, { mode: 'direct', wheel: {} }, handler, undefined, () => true);
    ctrl.attach();
    el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }));
    expect(deltas.length).toBe(0);
    ctrl.detach();
  });

  it('handles drag to update scroll progress', () => {
    const deltas: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: (d) => deltas.push(d),
      onJumpToScene: () => {},
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    (el as unknown as { setPointerCapture: () => void }).setPointerCapture = vi.fn();
    const ctrl = new InputController(el, { mode: 'direct', drag: { axis: 'y', pixelsPerScene: 100 } }, handler);
    ctrl.attach();
    el.dispatchEvent(makePointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, bubbles: true }));
    el.dispatchEvent(makePointerEvent('pointermove', { button: 0, clientX: 0, clientY: 50, bubbles: true }));
    el.dispatchEvent(makePointerEvent('pointerup', { button: 0, bubbles: true }));
    expect(deltas.length).toBeGreaterThan(0);
    ctrl.detach();
  });

  it('handles swipe navigation', () => {
    const deltas: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: (d) => deltas.push(d),
      onJumpToScene: () => {},
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    const ctrl = new InputController(el, { mode: 'direct', swipe: { direction: 'horizontal', velocityThreshold: 0 } }, handler);
    ctrl.attach();
    const touchStart = new Event('touchstart', { bubbles: true }) as TouchEvent;
    Object.defineProperty(touchStart, 'touches', {
      value: [{ clientX: 0, clientY: 0 }],
    });
    const touchEnd = new Event('touchend', { bubbles: true }) as TouchEvent;
    Object.defineProperty(touchEnd, 'changedTouches', {
      value: [{ clientX: 100, clientY: 0 }],
    });
    el.dispatchEvent(touchStart);
    el.dispatchEvent(touchEnd);
    expect(deltas.length).toBeGreaterThan(0);
    ctrl.detach();
  });

  it('handles click navigation with drag threshold', () => {
    const deltas: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: (d) => deltas.push(d),
      onJumpToScene: () => {},
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    const ctrl = new InputController(el, { mode: 'direct', click: { action: 'nextScene', dragThreshold: 4 } }, handler);
    ctrl.attach();
    el.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { button: 0, clientX: 10, clientY: 0, bubbles: true }));
    expect(deltas.length).toBe(0);
    el.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { button: 0, clientX: 1, clientY: 1, bubbles: true }));
    expect(deltas.length).toBe(1);
    ctrl.detach();
  });

  it('handles contextmenu navigation and prevents default', () => {
    const deltas: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: (d) => deltas.push(d),
      onJumpToScene: () => {},
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    const ctrl = new InputController(el, {
      mode: 'direct',
      click: { action: 'prevScene', button: 'right' },
    }, handler);
    ctrl.attach();
    const event = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(deltas.length).toBe(1);
    ctrl.detach();
  });
});
