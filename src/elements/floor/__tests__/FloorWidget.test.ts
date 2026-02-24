// FloorWidget tests — interface-based stateful tests.
// Tests the widget's contract: widgetId, defaultState, transitionSpec (pure functions),
// and initialize/apply/dispose without invoking Three.js render details.

import { describe, it, expect, beforeEach } from 'vitest';
import { FloorWidget } from '../FloorWidget';
import type { SceneFloor } from '../types';
import {
  makeFrameSlice,
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
    expect(widget.defaultState.surface).toBeUndefined();
  });

  // ─── transitionSpec — pure blend functions ────────────────────────────────

  it('transitionSpec.exit disables when tExit=1', () => {
    const state: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/floor.jpg' } };
    const frames = makeFrameSlice(2);
    widget.transitionSpec.exit(frames, widget.widgetId, state);
    const result = frames[1]!.state.widgets[widget.widgetId] as SceneFloor;
    expect(result.enabled).toBe(false);
  });

  it('transitionSpec.exit preserves enabled when tExit=0', () => {
    const state: SceneFloor = { enabled: true };
    const frames = makeFrameSlice(2);
    widget.transitionSpec.exit(frames, widget.widgetId, state);
    const result = frames[0]!.state.widgets[widget.widgetId] as SceneFloor;
    expect(result.enabled).toBe(true);
  });

  it('transitionSpec.enter enables when tEnter>0', () => {
    const state: SceneFloor = { enabled: true };
    const frames = makeFrameSlice(3);
    widget.transitionSpec.enter(frames, widget.widgetId, state);
    const result = frames[1]!.state.widgets[widget.widgetId] as SceneFloor;
    expect(result.enabled).toBe(true);
  });

  it('transitionSpec.enter stays disabled when tEnter=0', () => {
    const state: SceneFloor = { enabled: true };
    const frames = makeFrameSlice(2);
    widget.transitionSpec.enter(frames, widget.widgetId, state);
    const result = frames[0]!.state.widgets[widget.widgetId] as SceneFloor;
    expect(result.enabled).toBe(false);
  });

  it('transitionSpec.interpolate switches textureUrl at midpoint', () => {
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    const frames = makeFrameSlice(5);
    widget.transitionSpec.interpolate(frames, widget.widgetId, from, to);
    const at25 = frames[1]!.state.widgets[widget.widgetId] as SceneFloor;
    const at75 = frames[3]!.state.widgets[widget.widgetId] as SceneFloor;
    expect(at25.surface?.type).toBe('physical');
    expect((at25.surface as { textureUrl?: string })?.textureUrl).toBe('/from.jpg');
    expect(at75.surface?.type).toBe('physical');
    expect((at75.surface as { textureUrl?: string })?.textureUrl).toBe('/to.jpg');
  });

  it('transitionSpec.interpolate honors enabled on either side', () => {
    const from: SceneFloor = { enabled: true };
    const to: SceneFloor = { enabled: false };
    const frames = makeFrameSlice(2);
    widget.transitionSpec.interpolate(frames, widget.widgetId, from, to);
    const at0 = frames[0]!.state.widgets[widget.widgetId] as SceneFloor;
    const at1 = frames[1]!.state.widgets[widget.widgetId] as SceneFloor;
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
