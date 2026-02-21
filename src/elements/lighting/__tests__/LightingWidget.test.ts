// LightingWidget tests — interface-based stateful tests.
// Tests exercise the widget's contract through its public API:
// widgetId, defaultState, transitionSpec (pure blend functions), and IDslComposite declarations.
// apply() is NOT tested here — it requires Three.js and is excluded from coverage.

import { describe, it, expect, beforeEach } from 'vitest';
import { LightingWidget } from '../LightingWidget';
import type { SceneLighting } from '../types';
import { makeFrameSlice } from '../../__tests__/elementTestMocks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeLighting = (intensity: number, color = '#ffffff'): SceneLighting => ({
  ambient: { intensity, color },
  directional: { intensity, color, position: [0, 1, 0] },
  intensityScale: 1,
  color,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LightingWidget', () => {
  let widget: LightingWidget;

  beforeEach(() => {
    widget = new LightingWidget();
  });

  it('has widgetId "lighting"', () => {
    expect(widget.widgetId).toBe('lighting');
  });

  it('defaultState has finite ambient and directional intensities', () => {
    expect(typeof widget.defaultState.ambient.intensity).toBe('number');
    expect(typeof widget.defaultState.directional.intensity).toBe('number');
    expect(isFinite(widget.defaultState.ambient.intensity)).toBe(true);
  });

  it('defaultState has valid intensityScale', () => {
    expect(widget.defaultState.intensityScale).toBeGreaterThan(0);
  });

  // ─── transitionSpec — pure blend functions ────────────────────────────────

  it('transitionSpec.interpolate at tFull=0 returns from-state ambient intensity', () => {
    const from = makeLighting(2.0);
    const to = makeLighting(0.0);
    const frames = makeFrameSlice(2);
    widget.transitionSpec.interpolate(frames, widget.widgetId, from, to);
    const result = frames[0]!.state.widgets[widget.widgetId] as SceneLighting;
    expect(result.ambient.intensity).toBeCloseTo(2.0);
  });

  it('transitionSpec.interpolate at tFull=1 returns to-state ambient intensity', () => {
    const from = makeLighting(2.0);
    const to = makeLighting(0.0);
    const frames = makeFrameSlice(2);
    widget.transitionSpec.interpolate(frames, widget.widgetId, from, to);
    const result = frames[1]!.state.widgets[widget.widgetId] as SceneLighting;
    expect(result.ambient.intensity).toBeCloseTo(0.0);
  });

  it('transitionSpec.interpolate at tFull=0.5 blends ambient intensity', () => {
    const from = makeLighting(2.0);
    const to = makeLighting(0.0);
    const frames = makeFrameSlice(3);
    widget.transitionSpec.interpolate(frames, widget.widgetId, from, to);
    const result = frames[1]!.state.widgets[widget.widgetId] as SceneLighting;
    expect(result.ambient.intensity).toBeGreaterThan(0);
    expect(result.ambient.intensity).toBeLessThan(2.0);
  });

  it('transitionSpec.exit at tExit=1 fades ambient to 0', () => {
    const state = makeLighting(2.0);
    const frames = makeFrameSlice(2);
    widget.transitionSpec.exit(frames, widget.widgetId, state);
    const result = frames[1]!.state.widgets[widget.widgetId] as SceneLighting;
    expect(result.ambient.intensity).toBeCloseTo(0);
  });

  it('transitionSpec.enter at tEnter=0 has near-zero ambient intensity', () => {
    const state = makeLighting(2.0);
    const frames = makeFrameSlice(2);
    widget.transitionSpec.enter(frames, widget.widgetId, state);
    const result = frames[0]!.state.widgets[widget.widgetId] as SceneLighting;
    expect(result.ambient.intensity).toBeCloseTo(0);
  });

  it('transitionSpec.enter at tEnter=1 returns full ambient intensity', () => {
    const state = makeLighting(2.0);
    const frames = makeFrameSlice(2);
    widget.transitionSpec.enter(frames, widget.widgetId, state);
    const result = frames[1]!.state.widgets[widget.widgetId] as SceneLighting;
    expect(result.ambient.intensity).toBeCloseTo(2.0);
  });

  // ─── IDslComposite declarations ───────────────────────────────────────────

  it('declares five child DSL components (Ambient, Directional, Point, Spot, Panel)', () => {
    expect(widget.childDslComponents).toHaveLength(5);
    const names = widget.childDslComponents.map((c) => c.displayName);
    expect(names).toContain('Ambient');
    expect(names).toContain('Directional');
    expect(names).toContain('Point');
    expect(names).toContain('Spot');
    expect(names).toContain('Panel');
  });

  it('all child components have topLevelError: true', () => {
    for (const child of widget.childDslComponents) {
      expect(child.topLevelError).toBe(true);
    }
  });
});
