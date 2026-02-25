// EnvironmentWidget tests — interface-based stateful tests.
// Tests the widget's contract: widgetId, defaultState, transitionSpec (pure functions),
// and load/initialize/apply/dispose behaviors without Three.js render assertions.

import { describe, it, expect, beforeEach } from 'vitest';
import { EnvironmentWidget } from '../EnvironmentWidget';
import type { SceneEnvironment } from '../types';
import { makeInitContext, makeRenderContext } from '../../__tests__/elementTestMocks';

describe('EnvironmentWidget', () => {
  let widget: EnvironmentWidget;

  beforeEach(() => {
    widget = new EnvironmentWidget();
  });

  it('has widgetId "environment"', () => {
    expect(widget.widgetId).toBe('environment');
  });

  it('defaultState is disabled with intensity 1', () => {
    expect(widget.defaultState.enabled).toBe(false);
    expect(widget.defaultState.intensity).toBe(1);
    expect(widget.defaultState.source).toBeUndefined();
  });

  // ─── transitionSpec — pure blend functions ────────────────────────────────

  it('transitionSpec.exit disables when t=1 and fades intensity', () => {
    const state: SceneEnvironment = {
      enabled: true,
      intensity: 1,
      source: { type: 'hdr', url: '/env.hdr' },
    };
    const fn = widget.transitionSpec.exitFn(state);
    const result = fn(1);
    expect(result.enabled).toBe(false);
    expect(result.intensity).toBeCloseTo(0);
  });

  it('transitionSpec.enter enables when t>0 and fades intensity in', () => {
    const state: SceneEnvironment = { enabled: true, intensity: 0.8 };
    const fn = widget.transitionSpec.enterFn(state);
    const result = fn(0.5);
    expect(result.enabled).toBe(true);
    expect(result.intensity).toBeGreaterThan(0);
  });

  it('transitionSpec.interpolate blends intensity and switches source at midpoint', () => {
    const from: SceneEnvironment = {
      enabled: true,
      intensity: 0.2,
      source: { type: 'hdr', url: '/from.hdr' },
    };
    const to: SceneEnvironment = {
      enabled: true,
      intensity: 0.8,
      source: { type: 'hdr', url: '/to.hdr' },
    };
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const at25 = fn(0.25);
    const at75 = fn(0.75);
    expect(at25.source && 'url' in at25.source ? at25.source.url : '').toBe('/from.hdr');
    expect(at75.source && 'url' in at75.source ? at75.source.url : '').toBe('/to.hdr');
    expect(at25.intensity).toBeGreaterThan(0.2);
    expect(at25.intensity).toBeLessThan(0.8);
  });

  // ─── load + initialize + apply + dispose ──────────────────────────────────

  it('load() flips isLoaded to true', async () => {
    expect(widget.isLoaded).toBe(false);
    await widget.load(null);
    expect(widget.isLoaded).toBe(true);
  });

  it('apply() does not throw before initialize', () => {
    expect(() => {
      widget.apply({ enabled: false, intensity: 1 }, makeRenderContext());
    }).not.toThrow();
  });

  it('apply() does not throw after initialize', () => {
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    expect(() => {
      widget.apply({ enabled: true, intensity: 1 }, makeRenderContext());
    }).not.toThrow();
  });

  it('dispose() clears scene and resets isLoaded', async () => {
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    await widget.load(null);
    widget.dispose();
    expect(widget.isLoaded).toBe(false);
    expect(() => {
      widget.apply({ enabled: true, intensity: 1 }, makeRenderContext());
    }).not.toThrow();
  });
});
