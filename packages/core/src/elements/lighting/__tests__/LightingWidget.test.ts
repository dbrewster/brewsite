// LightingWidget tests — interface-based stateful tests.
// Tests exercise the widget's contract through its public API:
// widgetId, defaultState, transitionSpec (pure blend functions), and IDslComposite declarations.
// apply() is NOT tested here — it requires Three.js and is excluded from coverage.

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { LightingWidget } from '../LightingWidget';
import type { SceneLighting } from '../types';
import { Ambient, Directional, GlowPoint, Point, Spot, LightStrand, Wave, Panel, Lighting } from '../dsl';
import { CUSTOM_NODE_HANDLER } from '../../../widget/WidgetRegistry';
import { makeSimpleContext } from '../../../compiler/transitions/transitionResolver';

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

  it('transitionSpec.interpolate at t=0 returns from-state ambient intensity', () => {
    const from = makeLighting(2.0);
    const to = makeLighting(0.0);
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0));
    expect(result.ambient.intensity).toBeCloseTo(2.0);
  });

  it('transitionSpec.interpolate at t=1 returns to-state ambient intensity', () => {
    const from = makeLighting(2.0);
    const to = makeLighting(0.0);
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(1));
    expect(result.ambient.intensity).toBeCloseTo(0.0);
  });

  it('transitionSpec.interpolate at t=0.5 blends ambient intensity', () => {
    const from = makeLighting(2.0);
    const to = makeLighting(0.0);
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const result = fn(makeSimpleContext(0.5));
    expect(result.ambient.intensity).toBeGreaterThan(0);
    expect(result.ambient.intensity).toBeLessThan(2.0);
  });

  it('transitionSpec.exit at t=1 fades ambient to 0', () => {
    const state = makeLighting(2.0);
    const fn = widget.transitionSpec.exitFn(state);
    const result = fn(makeSimpleContext(1));
    expect(result.ambient.intensity).toBeCloseTo(0);
  });

  it('transitionSpec.enter at t=0 has near-zero ambient intensity', () => {
    const state = makeLighting(2.0);
    const fn = widget.transitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(0));
    expect(result.ambient.intensity).toBeCloseTo(0);
  });

  it('transitionSpec.enter at t=1 returns full ambient intensity', () => {
    const state = makeLighting(2.0);
    const fn = widget.transitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(1));
    expect(result.ambient.intensity).toBeCloseTo(2.0);
  });

  // ─── IDslComposite declarations ───────────────────────────────────────────

  it('declares strand shape child DSL components', () => {
    expect(widget.childDslComponents).toHaveLength(10);
    const names = widget.childDslComponents.map((c) => c.displayName);
    expect(names).toContain('Ambient');
    expect(names).toContain('Directional');
    expect(names).toContain('GlowPoint');
    expect(names).toContain('Point');
    expect(names).toContain('Spot');
    expect(names).toContain('LightStrand');
    expect(names).toContain('Wave');
    expect(names).toContain('Circle');
    expect(names).toContain('Rectangle');
    expect(names).toContain('Panel');
  });

  it('all child components have topLevelError: true', () => {
    for (const child of widget.childDslComponents) {
      expect(child.topLevelError).toBe(true);
    }
  });

  it('custom node handler compiles child elements into lighting state', () => {
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: SceneLighting) => void; state: { widgets: Record<string, unknown> }; context: unknown }, helpers: {
        collectChildren: (n: { props: unknown }) => React.ReactNode[];
        resolveObjectValues: (v: unknown) => unknown;
        resolveValue: (v: unknown) => unknown;
      }) => void)
      | undefined;
    expect(handler).toBeDefined();
    let captured: SceneLighting | undefined;
    const node = {
      props: {
        intensityScale: 0.5,
        color: '#ff00ff',
        children: [
          React.createElement(Ambient, { intensity: 0.2, color: '#111111' }),
          React.createElement(Directional, { intensity: 0.9, color: '#222222', position: [1, 2, 3] }),
          React.createElement(GlowPoint, { intensity: 0.5, color: '#ffaa33', position: [2, 3, 4], distance: 14, decay: 1.1 }),
          React.createElement(Point, { intensity: 1, color: '#333333', position: [0, 1, 0] }),
          React.createElement(Spot, { intensity: 1, color: '#444444', position: [0, 2, 0], target: [0, 0, 0], angle: 0.4, penumbra: 0.1 }),
          React.createElement(LightStrand, {
            id: 'strand-a',
            count: 3,
            intensity: 0.4,
            color: '#ffaa66',
            position: [1, 2, 3],
          }, React.createElement(Wave, {
            length: 10,
            yOffset: 1,
            z: 2,
            waveAmplitude: 0.5,
            waveFrequency: 2,
            depthAmplitude: 0.25,
            depthFrequency: 3,
            depthPhase: 0.1,
          })),
          React.createElement(Panel, { id: 'p1', origin: [0, 0, 0], rows: 1, cols: 1, spacing: [1, 1, 1], intensity: 1, color: '#ffffff' }),
        ],
      },
    };
    handler?.(
      node,
      { setWidgetState: (_id, state) => { captured = state; }, state: { widgets: {} }, context: {} } as never,
      {
        collectChildren: (n) => {
          const children = (n.props as { children?: React.ReactNode }).children;
          return Array.isArray(children) ? children : (children ? [children] : []);
        },
        resolveObjectValues: (v) => v,
        resolveValue: (v) => v,
      },
    );
    expect(captured?.ambient.intensity).toBe(0.2);
    expect(captured?.directional.position).toEqual([1, 2, 3]);
    expect(captured?.glowPoint).toMatchObject({ intensity: 0.5, color: '#ffaa33', position: [2, 3, 4], distance: 14, decay: 1.1 });
    expect(captured?.lightStrands?.[0]?.id).toBe('strand-a');
    expect(captured?.lightStrands?.[0]?.count).toBe(3);
    expect(captured?.lightStrands?.[0]?.position).toEqual([1, 2, 3]);
    expect(captured?.lightStrands?.[0]?.shape.kind).toBe('wave');
    expect(captured?.points?.length).toBe(1);
    expect(captured?.spots?.length).toBe(1);
    expect(captured?.panels?.length).toBe(1);
    expect(captured?.intensityScale).toBe(0.5);
    expect(captured?.color).toBe('#ff00ff');
    expect(Lighting({})).toBeNull();
  });
});
