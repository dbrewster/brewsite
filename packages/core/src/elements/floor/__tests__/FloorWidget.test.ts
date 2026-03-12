// FloorWidget tests — interface-based stateful tests.
// Tests the widget's contract: widgetId, defaultState, transitionSpec (pure functions),
// and initialize/apply/dispose without invoking Three.js render details.

import { describe, it, expect, beforeEach } from 'vitest';
import { FloorWidget } from '../FloorWidget';
import type { SceneFloor } from '../types';
import { makeInitContext, makeRenderContext } from '../../__tests__/elementTestMocks';
import { FloorPhysical, FloorMirror } from '../FloorWidget';
import { CUSTOM_NODE_HANDLER } from '../../../widget/WidgetRegistry';
import type { SceneTheme } from '../../../theme/types';
import React from 'react';
import { makeSimpleContext } from '../../../compiler/transitions/transitionResolver';
import * as THREE from 'three';

describe('FloorWidget', () => {
  let widget: FloorWidget;

  beforeEach(() => {
    widget = new FloorWidget();
  });

  it('has widgetId "floor"', () => {
    expect(widget.widgetId).toBe('floor');
  });

  it('defaultState is enabled with scene-base grid floor', () => {
    expect(widget.defaultState.enabled).toBe(true);
    expect(widget.defaultState.placement).toBe('sceneBase');
    expect(widget.defaultState.surface?.type).toBe('physical');
    expect((widget.defaultState.surface as { pattern?: string }).pattern).toBe('grid');
  });

  // ─── transitionSpec — pure blend functions ────────────────────────────────

  it('transitionSpec.exit disables when t=1', () => {
    const state: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/floor.jpg' } };
    const fn = widget.transitionSpec.exitFn(state);
    const result = fn(makeSimpleContext(1));
    expect(result.enabled).toBe(false);
  });

  it('transitionSpec.exit preserves enabled when t=0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = widget.transitionSpec.exitFn(state);
    const result = fn(makeSimpleContext(0));
    expect(result.enabled).toBe(true);
  });

  it('transitionSpec.enter enables when t>0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = widget.transitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(0.5));
    expect(result.enabled).toBe(true);
  });

  it('transitionSpec.enter stays disabled when t=0', () => {
    const state: SceneFloor = { enabled: true };
    const fn = widget.transitionSpec.enterFn(state);
    const result = fn(makeSimpleContext(0));
    expect(result.enabled).toBe(false);
  });

  it('transitionSpec.interpolate switches textureUrl at midpoint', () => {
    const from: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/from.jpg' } };
    const to: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/to.jpg' } };
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const at25 = fn(makeSimpleContext(0.25));
    const at75 = fn(makeSimpleContext(0.75));
    expect(at25.surface?.type).toBe('physical');
    expect((at25.surface as { textureUrl?: string })?.textureUrl).toBe('/from.jpg');
    expect(at75.surface?.type).toBe('physical');
    expect((at75.surface as { textureUrl?: string })?.textureUrl).toBe('/to.jpg');
  });

  it('transitionSpec.interpolate honors enabled on either side', () => {
    const from: SceneFloor = { enabled: true };
    const to: SceneFloor = { enabled: false };
    const fn = widget.transitionSpec.interpolateFn(from, to);
    const at0 = fn(makeSimpleContext(0));
    const at1 = fn(makeSimpleContext(1));
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

  it('apply() pulls floor grid defaults from sceneTheme userData when using default floor state', () => {
    const init = makeInitContext({ widgetId: widget.widgetId });
    const theme: SceneTheme = {
      colorMode: 'dark',
      font: { htmlFamily: 'system-ui' },
      fontSize: { heading: 1.5, body: 1, label: 0.85, caption: 0.7, annotation: 0.6 },
      floor: {
        grid: {
          fillColor: '#ff3300',
          lineOpacity: 0.22,
        },
      },
    };
    (init.scene.userData as Record<string, unknown>)['__brewsite_scene_theme'] = theme;
    widget.initialize(init);
    widget.apply(widget.defaultState, makeRenderContext());

    const floorMesh = init.scene.children.find((child) => child.name === 'Floor') as THREE.Mesh | undefined;
    expect(floorMesh).toBeDefined();
    const floorMaterial = floorMesh?.material as THREE.MeshPhysicalMaterial | undefined;
    expect(floorMaterial?.emissive.getHexString()).toBe('ff3300');
    expect(floorMaterial?.color.getHexString()).toBe('000000');

    const gridLines = floorMesh?.children.find((child) => child.name === 'FloorGridLines') as
      | THREE.LineSegments
      | undefined;
    const linesMaterial = gridLines?.material as THREE.LineBasicMaterial | undefined;
    expect(linesMaterial?.opacity).toBeCloseTo(0.22, 5);
  });

  it('dispose() clears scene reference', () => {
    widget.initialize(makeInitContext({ widgetId: widget.widgetId }));
    widget.dispose();
    expect(() => {
      widget.apply({ enabled: true }, makeRenderContext());
    }).not.toThrow();
  });

  it('custom node handler resolves surface from child components', () => {
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: SceneFloor) => void }, helpers: {
        collectChildren: (n: { props: unknown }) => React.ReactNode[];
        resolveObjectValues: (v: unknown) => unknown;
        resolveValue: (v: unknown) => unknown;
      }) => void)
      | undefined;

    expect(handler).toBeDefined();
    let captured: SceneFloor | undefined;
    const node = {
      props: {
        enabled: true,
        children: [
          React.createElement(FloorPhysical, { textureUrl: '/a.jpg' }),
          React.createElement(FloorMirror, { shadowOpacity: 0.2 }),
        ],
      },
    };
    handler?.(
      node,
      { setWidgetState: (_id, state) => { captured = state; }, state: { widgets: {} }, context: {} } as never,
      {
        collectChildren: (n) => (n.props as { children?: React.ReactNode }).children as React.ReactNode[],
        resolveObjectValues: (v) => v,
        resolveValue: (v) => v,
      },
    );
    expect(captured?.enabled).toBe(true);
    expect(captured?.surface?.type).toBe('mirror');
    expect(captured?.placement).toBe('sceneBase');
  });

  it('custom node handler supports mirror variant without child surface', () => {
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: SceneFloor) => void }, helpers: {
        collectChildren: (n: { props: unknown }) => React.ReactNode[];
        resolveObjectValues: (v: unknown) => unknown;
        resolveValue: (v: unknown) => unknown;
      }) => void)
      | undefined;

    let captured: SceneFloor | undefined;
    const node = {
      props: {
        enabled: true,
        variant: 'mirror',
      },
    };
    handler?.(
      node,
      { setWidgetState: (_id, state) => { captured = state; }, state: { widgets: {} }, context: {} } as never,
      {
        collectChildren: () => [],
        resolveObjectValues: (v) => v,
        resolveValue: (v) => v,
      },
    );
    expect(captured?.surface?.type).toBe('mirror');
  });

  it('custom node handler applies theme floor.grid tokens for grid variant', () => {
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: SceneFloor) => void }, helpers: {
        collectChildren: (n: { props: unknown }) => React.ReactNode[];
        resolveObjectValues: (v: unknown) => unknown;
        resolveValue: (v: unknown) => unknown;
      }) => void)
      | undefined;

    let captured: SceneFloor | undefined;
    const theme: SceneTheme = {
      colorMode: 'dark',
      font: { htmlFamily: 'system-ui' },
      fontSize: { heading: 1.5, body: 1, label: 0.85, caption: 0.7, annotation: 0.6 },
      floor: {
        negativeZExtent: 140,
        negativeZEdge: 'fade',
        negativeZFadeDistance: 24,
        grid: {
          spacing: 3,
          lineColor: '#112233',
          majorLineColor: '#445566',
          fillColor: '#080b10',
          lineOpacity: 0.6,
          fillOpacity: 0.2,
          majorEvery: 4,
        },
      },
    };

    handler?.(
      { props: { enabled: true, variant: 'grid', theme } },
      { setWidgetState: (_id, state) => { captured = state; }, state: { widgets: {} }, context: {} } as never,
      { collectChildren: () => [], resolveObjectValues: (v) => v, resolveValue: (v) => v },
    );

    expect(captured?.surface?.type).toBe('physical');
    const surface = captured?.surface as {
      pattern?: string;
      gridCellSize?: number;
      gridColor?: string;
      gridMajorColor?: string;
      color?: string;
      gridLineOpacity?: number;
      gridFillOpacity?: number;
      opacity?: number;
      gridMajorEvery?: number;
    };
    expect(surface.pattern).toBe('grid');
    expect(surface.gridCellSize).toBe(3);
    expect(surface.gridColor).toBe('#112233');
    expect(surface.gridMajorColor).toBe('#445566');
    expect(surface.color).toBe('#080b10');
    expect(surface.gridLineOpacity).toBe(0.6);
    expect(surface.gridFillOpacity).toBe(0.2);
    expect(surface.opacity).toBe(0.2);
    expect(surface.gridMajorEvery).toBe(4);
    expect(captured?.negativeZExtent).toBe(140);
    expect(captured?.negativeZEdge).toBe('fade');
    expect(captured?.negativeZFadeDistance).toBe(24);
  });

  it('explicit grid props override theme floor.grid tokens', () => {
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: SceneFloor) => void }, helpers: {
        collectChildren: (n: { props: unknown }) => React.ReactNode[];
        resolveObjectValues: (v: unknown) => unknown;
        resolveValue: (v: unknown) => unknown;
      }) => void)
      | undefined;

    let captured: SceneFloor | undefined;
    const theme: SceneTheme = {
      colorMode: 'dark',
      font: { htmlFamily: 'system-ui' },
      fontSize: { heading: 1.5, body: 1, label: 0.85, caption: 0.7, annotation: 0.6 },
      floor: {
        negativeZExtent: 300,
        negativeZEdge: 'fade',
        negativeZFadeDistance: 60,
        grid: { spacing: 10, lineColor: '#000000', fillOpacity: 0.1 },
      },
    };

    handler?.(
      {
        props: {
          enabled: true,
          variant: 'grid',
          negativeZExtent: 110,
          negativeZEdge: 'hard',
          negativeZFadeDistance: 0,
          theme,
          children: [
            React.createElement(FloorPhysical, {
              pattern: 'grid',
              gridCellSize: 1.5,
              gridColor: '#abcdef',
              gridFillOpacity: 0.45,
            }),
          ],
        },
      },
      { setWidgetState: (_id, state) => { captured = state; }, state: { widgets: {} }, context: {} } as never,
      {
        collectChildren: (n) => (n.props as { children?: React.ReactNode }).children as React.ReactNode[],
        resolveObjectValues: (v) => v,
        resolveValue: (v) => v,
      },
    );

    const surface = captured?.surface as {
      gridCellSize?: number;
      gridColor?: string;
      gridFillOpacity?: number;
    };
    expect(surface.gridCellSize).toBe(1.5);
    expect(surface.gridColor).toBe('#abcdef');
    expect(surface.gridFillOpacity).toBe(0.45);
    expect(captured?.negativeZExtent).toBe(110);
    expect(captured?.negativeZEdge).toBe('hard');
    expect(captured?.negativeZFadeDistance).toBe(0);
  });

  it('custom node handler preserves sceneBase placement when explicitly requested', () => {
    const handler = (widget as unknown as Record<symbol, unknown>)[CUSTOM_NODE_HANDLER] as
      | ((node: { props: unknown }, api: { setWidgetState: (id: string, state: SceneFloor) => void }, helpers: {
        collectChildren: (n: { props: unknown }) => React.ReactNode[];
        resolveObjectValues: (v: unknown) => unknown;
        resolveValue: (v: unknown) => unknown;
      }) => void)
      | undefined;

    let captured: SceneFloor | undefined;
    const node = {
      props: {
        enabled: true,
        placement: 'sceneBase',
      },
    };
    handler?.(
      node,
      { setWidgetState: (_id, state) => { captured = state; }, state: { widgets: {} }, context: {} } as never,
      {
        collectChildren: () => [],
        resolveObjectValues: (v) => v,
        resolveValue: (v) => v,
      },
    );
    expect(captured?.placement).toBe('sceneBase');
  });

  it('mergeSnapshot prefers next surface when provided', () => {
    const prev: SceneFloor = { enabled: true, surface: { type: 'physical', textureUrl: '/a.jpg' } };
    const next: SceneFloor = { enabled: true, surface: { type: 'mirror', shadowOpacity: 0.2 } };
    const merged = widget.mergeSnapshot(prev, next);
    expect(merged?.surface?.type).toBe('mirror');
  });
});
