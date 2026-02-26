// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { InputController } from '../InputController';
import type { InputNavigationHandler } from '../types';

describe('InputController', () => {
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
});
