// Tests for <View> and <ViewLayout> NodeHandlers — interface-based stateful tests.
// Uses real CompileApi (via resolveSceneFromDsl), real helpers, real layout algorithms.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveSceneFromDsl, Scene } from '../sceneDslCompiler';
import { clearRegistry, registerNode } from '../registry';
import { registerCoreHandlers, resetCoreHandlerRegistrationForTesting } from '../coreHandlers';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneSnapshotContext } from '../sceneTypes';
import type { NVSRect } from '../../layout/types';
import { View } from '../blocks/viewDsl';
import { ViewLayout } from '../blocks/viewLayoutDsl';
import type { ViewState, ViewLayoutState } from '../viewTypes';

const testContext: SceneSnapshotContext = {
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: true,
};

const registry = new WidgetRegistry();

function compile(tree: React.ReactElement): Record<string, unknown> {
  const result = resolveSceneFromDsl(tree, testContext, registry);
  return result.frame.widgets;
}

beforeEach(() => {
  clearRegistry();
  resetCoreHandlerRegistrationForTesting();
  // Re-register core handlers so View/ViewLayout/Scene are available.
  registerCoreHandlers();
});

// --- <View> tests ---

describe('viewHandler — standalone view', () => {
  it('stores ViewState with explicit bounds', () => {
    const tree = (
      <Scene id="s1">
        <View id="v1" x={0.1} y={0.1} w={0.8} h={0.8} />
      </Scene>
    );
    const widgets = compile(tree);
    const state = widgets['v1'] as ViewState;
    expect(state).toBeDefined();
    expect(state.id).toBe('v1');
    expect(state.bounds).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    expect(state.layer).toBe(0);
    expect(state.scale).toBe(1.0);
  });

  it('defaults to fullscreen bounds when no x/y/w/h provided', () => {
    const tree = (
      <Scene id="s1">
        <View id="v1" />
      </Scene>
    );
    const widgets = compile(tree);
    const state = widgets['v1'] as ViewState;
    expect(state.bounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('computes contentBounds correctly with padding', () => {
    const tree = (
      <Scene id="s1">
        <View id="v1" x={0} y={0} w={1} h={1} padding={0.1} />
      </Scene>
    );
    const widgets = compile(tree);
    const state = widgets['v1'] as ViewState;
    expect(state.contentBounds).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    expect(state.padding).toEqual([0.1, 0.1, 0.1, 0.1]);
  });

  it('does not set layoutId when standalone', () => {
    const tree = (
      <Scene id="s1">
        <View id="v1" x={0.1} y={0.1} w={0.8} h={0.8} />
      </Scene>
    );
    const widgets = compile(tree);
    const state = widgets['v1'] as ViewState;
    expect(state.layoutId).toBeUndefined();
  });
});

describe('viewHandler — composeBounds propagation', () => {
  it('child widget receives composed bounds when inside a View', () => {
    // Register a capture component that records api.composeBounds result
    const CaptureChild = (_props: { id: string }): null => null;
    CaptureChild.displayName = 'CaptureChild';

    let capturedBounds: NVSRect | undefined;
    registerNode(CaptureChild, (childNode, api) => {
      capturedBounds = api.composeBounds({ x: 0, y: 0, w: 1, h: 1 });
    });

    const tree = (
      <Scene id="s1">
        <View id="v1" x={0.1} y={0.1} w={0.8} h={0.8}>
          <CaptureChild id="mc1" />
        </View>
      </Scene>
    );
    compile(tree);
    // Full-viewport child inside View {0.1, 0.1, 0.8, 0.8} → composed bounds = view bounds
    expect(capturedBounds).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  });

  it('composeBounds is identity when no parent view', () => {
    const CaptureChild = (_props: { id: string }): null => null;
    CaptureChild.displayName = 'CaptureChildIdentity';

    let capturedBounds: NVSRect | undefined;
    registerNode(CaptureChild, (childNode, api) => {
      capturedBounds = api.composeBounds({ x: 0, y: 0, w: 1, h: 1 });
    });

    const tree = (
      <Scene id="s1">
        <CaptureChild id="mc1" />
      </Scene>
    );
    compile(tree);
    expect(capturedBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('composes nested view bounds correctly', () => {
    // outer: {0.1, 0.1, 0.8, 0.8}
    // inner: local {0.25, 0.25, 0.5, 0.5} → absolute {0.3, 0.3, 0.4, 0.4}
    const tree = (
      <Scene id="s1">
        <View id="outer" x={0.1} y={0.1} w={0.8} h={0.8}>
          <View id="inner" x={0.25} y={0.25} w={0.5} h={0.5} />
        </View>
      </Scene>
    );
    const widgets = compile(tree);
    const innerState = widgets['inner'] as ViewState;
    expect(innerState.bounds.x).toBeCloseTo(0.3);
    expect(innerState.bounds.y).toBeCloseTo(0.3);
    expect(innerState.bounds.w).toBeCloseTo(0.4);
    expect(innerState.bounds.h).toBeCloseTo(0.4);
  });
});

describe('viewHandler — error cases', () => {
  it('emits console.error and skips compilation when id is missing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // @ts-expect-error intentionally missing required id
    const tree = <Scene id="s1"><View x={0.1} y={0.1} w={0.8} h={0.8} /></Scene>;
    const widgets = compile(tree);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[View] Missing required "id" prop'),
    );
    // No ViewState should be stored
    expect(Object.keys(widgets).filter((k) => k !== '__scene__')).not.toContain('undefined');

    errorSpy.mockRestore();
  });
});

// --- <ViewLayout> tests ---

describe('viewLayoutHandler — stack layout', () => {
  it('places two views side by side with horizontal stack + gap', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="stack" direction="horizontal" gap={0.02}>
          <View id="v1" w={0.48} h={1} />
          <View id="v2" w={0.48} h={1} />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const v1 = widgets['v1'] as ViewState;
    const v2 = widgets['v2'] as ViewState;

    // v1 starts at x=0
    expect(v1.bounds.x).toBeCloseTo(0);
    expect(v1.bounds.w).toBeCloseTo(0.48);

    // v2 starts after v1.w + gap
    expect(v2.bounds.x).toBeCloseTo(0.48 + 0.02);
    expect(v2.bounds.w).toBeCloseTo(0.48);
  });

  it('stores ViewLayoutState with kind, bounds, and viewIds', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout id="layout1" kind="stack">
          <View id="v1" />
          <View id="v2" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const layout = widgets['layout1'] as ViewLayoutState;
    expect(layout).toBeDefined();
    expect(layout.id).toBe('layout1');
    expect(layout.kind).toBe('stack');
    expect(layout.bounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(layout.viewIds).toEqual(['v1', 'v2']);
  });
});

describe('viewLayoutHandler — carousel layout', () => {
  it('centers the active view at scale 1.0, others at inactiveScale', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" activeIndex={1}>
          <View id="v1" w={0.3} h={0.8} />
          <View id="v2" w={0.3} h={0.8} />
          <View id="v3" w={0.3} h={0.8} />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const v2 = widgets['v2'] as ViewState;
    const v1 = widgets['v1'] as ViewState;
    const v3 = widgets['v3'] as ViewState;

    // Active view (v2) at scale 1.0
    expect(v2.scale).toBe(1.0);
    expect(v2.layer).toBe(3); // N=3, distance=0, layer=3

    // Inactive views at inactiveScale (default 0.75)
    expect(v1.scale).toBeCloseTo(0.75);
    expect(v3.scale).toBeCloseTo(0.75);
    expect(v1.layer).toBe(2);
    expect(v3.layer).toBe(2);

    // v2 should be centered
    const centerX = 0.5; // container center (x=0, w=1 → center=0.5)
    const v2HalfW = (0.3 * 1.0) / 2;
    expect(v2.bounds.x).toBeCloseTo(centerX - v2HalfW);
  });
});

describe('viewLayoutHandler — managed view x/y warning', () => {
  it('emits warning when View inside layout has explicit x or y', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const tree = (
      <Scene id="s1">
        <ViewLayout id="layout1" kind="stack">
          <View id="v1" x={0.1} y={0.1} w={0.5} h={1} />
        </ViewLayout>
      </Scene>
    );
    compile(tree);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("View 'v1' is inside a ViewLayout; x/y will be ignored"),
    );
    warnSpy.mockRestore();
  });

  it('ignores x/y from View props when managed by layout', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout id="layout1" kind="stack">
          <View id="v1" x={0.9} y={0.9} w={0.5} h={1} />
          <View id="v2" w={0.5} h={1} />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const v1 = widgets['v1'] as ViewState;
    // x/y should be ignored — layout places v1 at x=0, not x=0.9
    expect(v1.bounds.x).toBeCloseTo(0);
    expect(v1.bounds.y).toBeCloseTo(0);
  });
});

describe('viewLayoutHandler — composed bounds with parent View', () => {
  it('composes ViewLayout container bounds into outer View content bounds', () => {
    const tree = (
      <Scene id="s1">
        <View id="outer" x={0.1} y={0.1} w={0.8} h={0.8}>
          <ViewLayout id="innerLayout" kind="stack">
            <View id="v1" />
            <View id="v2" />
          </ViewLayout>
        </View>
      </Scene>
    );
    const widgets = compile(tree);
    const layout = widgets['innerLayout'] as ViewLayoutState;
    // Layout container should be composed into outer view bounds {0.1, 0.1, 0.8, 0.8}
    expect(layout.bounds).toEqual({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });

    // Each view should occupy half the composed container (default stack: 2 equal views)
    const v1 = widgets['v1'] as ViewState;
    const v2 = widgets['v2'] as ViewState;
    expect(v1.bounds.x).toBeCloseTo(0.1);
    expect(v1.bounds.w).toBeCloseTo(0.4);
    expect(v2.bounds.x).toBeCloseTo(0.5);
    expect(v2.bounds.w).toBeCloseTo(0.4);
  });
});

describe('viewLayoutHandler — non-View children warning', () => {
  it('emits warning for non-View children', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const NotAView = (_props: { id: string }): null => null;
    NotAView.displayName = 'NotAView';
    registerNode(NotAView, () => {});

    const tree = (
      <Scene id="s1">
        <ViewLayout id="layout1" kind="stack">
          <View id="v1" />
          {/* @ts-expect-error intentionally non-View child */}
          <NotAView id="nv1" />
        </ViewLayout>
      </Scene>
    );
    compile(tree);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("contains non-View child"),
    );
    warnSpy.mockRestore();
  });
});

describe('viewLayoutHandler — degenerate cases', () => {
  it('single-child carousel: view centered at full scale, layer = 1', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" activeIndex={0}>
          <View id="v1" w={0.5} h={0.8} />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const v1 = widgets['v1'] as ViewState;
    expect(v1.scale).toBe(1.0);
    expect(v1.layer).toBe(1); // N=1, distance=0, layer=N-distance=1
    // Centered: x = 0 + (1 - 0.5)/2 = 0.25
    expect(v1.bounds.x).toBeCloseTo(0.25);
  });

  it('single-child stack: view occupies full container, layer = 0, scale = 1.0', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="stack">
          <View id="v1" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const v1 = widgets['v1'] as ViewState;
    expect(v1.layer).toBe(0);
    expect(v1.scale).toBe(1.0);
    // No explicit size → occupies full container
    expect(v1.bounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('nested ViewLayouts: outer layout context restored after inner layout compiles', () => {
    // Outer layout has v1 (which contains an inner layout) and v2.
    // After inner layout compiles, the outer context must still be accessible for v2.
    const tree = (
      <Scene id="s1">
        <ViewLayout id="outer" kind="stack">
          <View id="v1">
            <ViewLayout id="inner" kind="carousel" activeIndex={0}>
              <View id="inner1" w={0.5} h={0.8} />
              <View id="inner2" w={0.5} h={0.8} />
            </ViewLayout>
          </View>
          <View id="v2" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);

    // Outer layout state should list both v1 and v2
    const outerLayout = widgets['outer'] as ViewLayoutState;
    expect(outerLayout.viewIds).toEqual(['v1', 'v2']);

    // v2 should have correct bounds from the outer layout (right half of container)
    const v2 = widgets['v2'] as ViewState;
    expect(v2.bounds.x).toBeCloseTo(0.5);
    expect(v2.bounds.w).toBeCloseTo(0.5);
    expect(v2.layoutId).toBe('outer');

    // Inner layout views should have inner layout id
    const inner1 = widgets['inner1'] as ViewState;
    expect(inner1.layoutId).toBe('inner');
  });
});

describe('viewLayoutHandler — auto-generated id', () => {
  it('auto-generates id from kind and sceneIndex when no explicit id', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="stack">
          <View id="v1" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    // The auto-generated key should follow __viewLayout_{kind}_{sceneIndex} pattern
    expect(widgets['__viewLayout_stack_0']).toBeDefined();
  });
});

describe('loop carousel — composeOpacity flows to child widgets', () => {
  // Register a probe widget that records api.composeOpacity(1) in its widget state.
  const Probe = (_props: { id: string }): null => null;
  Probe.displayName = 'Probe';

  beforeEach(() => {
    registerNode(Probe, (node, api) => {
      const id = (node.props as { id: string }).id;
      api.setWidgetState(id, { composedOpacity: api.composeOpacity(1) });
    });
  });

  it('active view child gets opacity 1, back view child gets fadeMin-range opacity', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" loop activeIndex={0} zStep={4} fadeMin={0}>
          <View id="v1" w={0.4} h={0.6}>
            <Probe id="probe1" />
          </View>
          <View id="v2" w={0.4} h={0.6}>
            <Probe id="probe2" />
          </View>
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const p1 = widgets['probe1'] as { composedOpacity: number };
    const p2 = widgets['probe2'] as { composedOpacity: number };
    // View 0 is active → opacity=1, probe composeOpacity(1) = 1*1 = 1
    expect(p1.composedOpacity).toBe(1);
    // View 1 is directly behind (N=2, angle=π) → opacity≈0 (fadeMin=0)
    expect(p2.composedOpacity).toBeCloseTo(0);
  });

  it('changing activeIndex changes which child gets full opacity', () => {
    const tree0 = (
      <Scene id="s1">
        <ViewLayout kind="carousel" loop activeIndex={0} zStep={4} fadeMin={0.1}>
          <View id="v1" w={0.3} h={0.5}>
            <Probe id="p1" />
          </View>
          <View id="v2" w={0.3} h={0.5}>
            <Probe id="p2" />
          </View>
          <View id="v3" w={0.3} h={0.5}>
            <Probe id="p3" />
          </View>
        </ViewLayout>
      </Scene>
    );
    const tree1 = (
      <Scene id="s2">
        <ViewLayout kind="carousel" loop activeIndex={1} zStep={4} fadeMin={0.1}>
          <View id="v1" w={0.3} h={0.5}>
            <Probe id="p1" />
          </View>
          <View id="v2" w={0.3} h={0.5}>
            <Probe id="p2" />
          </View>
          <View id="v3" w={0.3} h={0.5}>
            <Probe id="p3" />
          </View>
        </ViewLayout>
      </Scene>
    );
    const w0 = compile(tree0);
    const w1 = compile(tree1);

    // Scene 1 (active=0): p1 full opacity, p2/p3 faded
    expect((w0['p1'] as { composedOpacity: number }).composedOpacity).toBe(1);
    expect((w0['p2'] as { composedOpacity: number }).composedOpacity).toBeLessThan(1);

    // Scene 2 (active=1): p2 full opacity, p1/p3 faded
    expect((w1['p2'] as { composedOpacity: number }).composedOpacity).toBe(1);
    expect((w1['p1'] as { composedOpacity: number }).composedOpacity).toBeLessThan(1);

    // p1 opacity should be different between scenes
    expect((w0['p1'] as { composedOpacity: number }).composedOpacity).not.toBeCloseTo(
      (w1['p1'] as { composedOpacity: number }).composedOpacity,
    );
  });
});
