// FloorWidget tests — interface-based stateful tests.
// Tests the widget's contract: widgetId, defaultState, transitionSpec (pure functions),
// and initialize/apply/dispose without invoking Three.js render details.

import { describe, it, expect, beforeEach } from 'vitest';
import { FloorWidget } from '../FloorWidget';
import type { SceneFloor } from '../types';
import { makeInitContext, makeRenderContext } from '../../__tests__/elementTestMocks';

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
    expect(widget.defaultState.surface).toBeUndefined();
  });

  // ─── transitionSpec — pure blend functions ────────────────────────────────

  it('transitionSpec.exit disables when t=1', () => {
    const state: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/floor.jpg' } };
    const fn = widget.transitionSpec.exitFn(state);
    const result = fn(1);
    expect(result.enabled).toBe(false);
  });

  it('transitionSpec.exit preserves enabled when t=0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = widget.transitionSpec.exitFn(state);
    const result = fn(0);
    expect(result.enabled).toBe(true);
  });

  it('transitionSpec.enter enables when t>0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = widget.transitionSpec.enterFn(state);
    const result = fn(0.5);
    expect(result.enabled).toBe(true);
  });

  it('transitionSpec.enter stays disabled when t=0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = widget.transitionSpec.enterFn(state);
    const result = fn(0);
    expect(result.enabled).toBe(false);
  });

  it('transitionSpec.interpolate switches textureUrl at midpoint', () => {
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const at25 = fn(0.25);
    const at75 = fn(0.75);
    expect(at25.surface?.type).toBe('physical');
    expect((at25.surface as { textureUrl?: string })?.textureUrl).toBe('/from.jpg');
    expect(at75.surface?.type).toBe('physical');
    expect((at75.surface as { textureUrl?: string })?.textureUrl).toBe('/to.jpg');
  });

  it('transitionSpec.interpolate honors enabled on either side', () => {
    const from: SceneFloor = { enabled: true };
    const to: SceneFloor = { enabled: false };
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const at0 = fn(0);
    const at1 = fn(1);
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
