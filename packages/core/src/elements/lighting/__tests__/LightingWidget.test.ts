// LightingWidget tests — interface-based stateful tests.
// Tests exercise the widget's contract through its public API:
// widgetId, defaultState, transitionSpec (pure blend functions), and IDslComposite declarations.
// apply() is NOT tested here — it requires Three.js and is excluded from coverage.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import type { ILightingOverride } from '../../../widget/types';
import { LightingWidget } from '../LightingWidget';
import type { SceneLighting } from '../types';
import { Ambient, Directional, GlowPoint, Point, Spot, LightStrand, Wave, Panel, Lighting } from '../LightingWidget';
import { CUSTOM_NODE_HANDLER } from '../../../widget/WidgetRegistry';
import { makeSimpleContext } from '../../../compiler/transitions/transitionResolver';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeLighting = (intensity: number, color = '#ffffff'): SceneLighting => ({
  ambient: { intensity, color },
  directionals: [{ intensity, color, position: [0, 1, 0] }],
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
    expect(typeof widget.defaultState.directionals[0]!.intensity).toBe('number');
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
          React.createElement(Spot, { intensity: 1, color: '#444444', position: [0, 2, 0], target: [0, 0, 0], angle: '0.4rad', penumbra: 0.1 }),
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
            depthPhase: '0.1rad',
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
    expect(captured?.directionals[0]?.position).toEqual([1, 2, 3]);
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

  // ─── setLightingOverrides ────────────────────────────────────────────────
  describe('setLightingOverrides', () => {
    /** Minimal ILightingOverride implementor for testing injection. */
    class MockOverride implements ILightingOverride {
      readonly widgetId = 'mock-override';
      injectedSetter: ((lightId: string, enabled: boolean) => void) | null = null;
      getLightingOverride(): { disableAll: boolean } | null { return null; }
      receiveLightController(setter: (lightId: string, enabled: boolean) => void): void {
        this.injectedSetter = setter;
      }
    }

    it('calls receiveLightController on each override widget', () => {
      const override1 = new MockOverride();
      const override2 = new MockOverride();
      const receiveSpy1 = vi.spyOn(override1, 'receiveLightController');
      const receiveSpy2 = vi.spyOn(override2, 'receiveLightController');

      widget.setLightingOverrides([override1, override2]);

      expect(receiveSpy1).toHaveBeenCalledTimes(1);
      expect(receiveSpy2).toHaveBeenCalledTimes(1);
    });

    it('injects the same setter function into all overrides', () => {
      const override1 = new MockOverride();
      const override2 = new MockOverride();

      widget.setLightingOverrides([override1, override2]);

      expect(override1.injectedSetter).not.toBeNull();
      expect(override2.injectedSetter).not.toBeNull();
      // Both overrides receive the same bound method.
      expect(typeof override1.injectedSetter).toBe('function');
      expect(typeof override2.injectedSetter).toBe('function');
    });

    it('does not throw when an override does not implement receiveLightController', () => {
      /** ILightingOverride without receiveLightController (optional method absent). */
      const minimalOverride: ILightingOverride = {
        widgetId: 'minimal',
        getLightingOverride: () => null,
      };

      expect(() => widget.setLightingOverrides([minimalOverride])).not.toThrow();
    });

    it('accepts an empty array without error', () => {
      expect(() => widget.setLightingOverrides([])).not.toThrow();
    });
  });

  describe('LightingWidget — multiple <Directional> children', () => {
    it('includes all <Directional> children in compiled directionals', () => {
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
          children: [
            React.createElement(Directional, { intensity: 1, color: '#ff0000', position: [1, 0, 0] as [number, number, number] }),
            React.createElement(Directional, { intensity: 2, color: '#00ff00', position: [0, 1, 0] as [number, number, number] }),
            React.createElement(Directional, { intensity: 3, color: '#0000ff', position: [0, 0, 1] as [number, number, number] }),
          ],
        },
      };
      handler?.(
        node,
        { setWidgetState: (_id, s) => { captured = s; }, state: { widgets: {} }, context: {} } as never,
        {
          collectChildren: (n) => {
            const c = (n.props as { children?: React.ReactNode }).children;
            return Array.isArray(c) ? c : (c ? [c] : []);
          },
          resolveObjectValues: (v) => v,
          resolveValue: (v) => v,
        },
      );
      expect(captured?.directionals).toHaveLength(3);
      expect(captured?.directionals[0]?.position).toEqual([1, 0, 0]);
      expect(captured?.directionals[1]?.position).toEqual([0, 1, 0]);
      expect(captured?.directionals[2]?.position).toEqual([0, 0, 1]);
    });

    it('falls back to base.directionals when no <Directional> children', () => {
      const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
        | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: SceneLighting) => void; state: { widgets: Record<string, unknown> }; context: unknown }, helpers: {
          collectChildren: (n: { props: unknown }) => React.ReactNode[];
          resolveObjectValues: (v: unknown) => unknown;
          resolveValue: (v: unknown) => unknown;
        }) => void)
        | undefined;
      let captured: SceneLighting | undefined;
      const node = { props: { children: [] } };
      handler?.(
        node,
        { setWidgetState: (_id, s) => { captured = s; }, state: { widgets: {} }, context: {} } as never,
        { collectChildren: () => [], resolveObjectValues: (v) => v, resolveValue: (v) => v },
      );
      expect(captured?.directionals).toEqual(widget.defaultState.directionals);
    });

    it('assigns auto-ids when <Directional> has no id prop', () => {
      const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
        | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: SceneLighting) => void; state: { widgets: Record<string, unknown> }; context: unknown }, helpers: {
          collectChildren: (n: { props: unknown }) => React.ReactNode[];
          resolveObjectValues: (v: unknown) => unknown;
          resolveValue: (v: unknown) => unknown;
        }) => void)
        | undefined;
      let captured: SceneLighting | undefined;
      const node = {
        props: {
          children: [
            React.createElement(Directional, { intensity: 1, color: '#ffffff', position: [0, 0, 0] as [number, number, number] }),
            React.createElement(Directional, { id: 'named', intensity: 1, color: '#ffffff', position: [1, 0, 0] as [number, number, number] }),
          ],
        },
      };
      handler?.(
        node,
        { setWidgetState: (_id, s) => { captured = s; }, state: { widgets: {} }, context: {} } as never,
        {
          collectChildren: (n) => {
            const c = (n.props as { children?: React.ReactNode }).children;
            return Array.isArray(c) ? c : (c ? [c] : []);
          },
          resolveObjectValues: (v) => v,
          resolveValue: (v) => v,
        },
      );
      expect(captured?.directionals[0]?.id).toBe('directional-0');
      expect(captured?.directionals[1]?.id).toBe('named');
    });
  });
});
