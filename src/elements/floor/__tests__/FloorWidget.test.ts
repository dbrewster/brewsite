// FloorWidget tests — interface-based stateful tests.
// Tests the widget's contract: widgetId, defaultState, transitionSpec (pure functions),
// and initialize/apply/dispose without invoking Three.js render details.

import { describe, it, expect, beforeEach } from 'vitest';
import { FloorWidget } from '../FloorWidget';
import type { SceneFloor } from '../types';
import {
  makeTransitionContext,
  makeInitContext,
  makeRenderContext,
} from '../../__tests__/elementTestMocks';

describe('FloorWidget', () => {
  let widget: FloorWidget;

  beforeEach(() => {
    widget = new FloorWidget();
  });

  it('has widgetId "floor"', () => {
    expect(widget.widgetId).toBe('floor');
  });

  it('defaultState is disabled with no texture', () => {
    expect(widget.defaultState.enabled).toBe(false);
    expect(widget.defaultState.textureUrl).toBeUndefined();
  });

  // ─── transitionSpec — pure blend functions ────────────────────────────────

  it('transitionSpec.exit disables when tExit=1', () => {
    const state: SceneFloor = { enabled: true, textureUrl: '/floor.jpg' };
    const result = widget.transitionSpec.exit(state, makeTransitionContext({ tExit: 1 }));
    expect(result.enabled).toBe(false);
  });

  it('transitionSpec.exit preserves enabled when tExit=0', () => {
    const state: SceneFloor = { enabled: true };
    const result = widget.transitionSpec.exit(state, makeTransitionContext({ tExit: 0 }));
    expect(result.enabled).toBe(true);
  });

  it('transitionSpec.enter enables when tEnter>0', () => {
    const state: SceneFloor = { enabled: true };
    const result = widget.transitionSpec.enter(state, makeTransitionContext({ tEnter: 0.2 }));
    expect(result.enabled).toBe(true);
  });

  it('transitionSpec.enter stays disabled when tEnter=0', () => {
    const state: SceneFloor = { enabled: true };
    const result = widget.transitionSpec.enter(state, makeTransitionContext({ tEnter: 0 }));
    expect(result.enabled).toBe(false);
  });

  it('transitionSpec.interpolate switches textureUrl at midpoint', () => {
    const from: SceneFloor = { enabled: true, textureUrl: '/from.jpg' };
    const to: SceneFloor = { enabled: true, textureUrl: '/to.jpg' };
    const at25 = widget.transitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0.25 }));
    const at75 = widget.transitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0.75 }));
    expect(at25.textureUrl).toBe('/from.jpg');
    expect(at75.textureUrl).toBe('/to.jpg');
  });

  it('transitionSpec.interpolate honors enabled on either side', () => {
    const from: SceneFloor = { enabled: true };
    const to: SceneFloor = { enabled: false };
    const at0 = widget.transitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 0 }));
    const at1 = widget.transitionSpec.interpolate(from, to, makeTransitionContext({ tFull: 1 }));
    expect(at0.enabled).toBe(true);
    expect(at1.enabled).toBe(false);
  });

  // ─── initialize + apply + dispose ─────────────────────────────────────────

  it('apply() does not throw when not initialized', () => {
    expect(() => {
      widget.apply({ enabled: false }, makeRenderContext());
    }).not.toThrow();
  });

  it('apply() does not throw after initialize', () => {
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    expect(() => {
      widget.apply({ enabled: true }, makeRenderContext());
    }).not.toThrow();
  });

  it('dispose() clears scene reference', () => {
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    widget.dispose();
    expect(() => {
      widget.apply({ enabled: true }, makeRenderContext());
    }).not.toThrow();
  });
});
