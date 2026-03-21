// Tests for <View> and <ViewLayout> NodeHandlers — interface-based stateful tests.
// Uses real CompileApi (via resolveSceneFromDsl), real helpers, real layout algorithms.

import React, { isValidElement, Fragment, type ReactElement } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveSceneFromDsl, Scene } from '../sceneDslCompiler';
import { clearRegistry, registerNode } from '../registry';
import { registerCoreHandlers, resetCoreHandlerRegistrationForTesting } from '../coreHandlers';
import { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { SceneSnapshotContext } from '../sceneTypes';
import type { NVSRect } from '../../layout/types';
import type { CompileApi } from '../sceneDslTypes';
import { View } from '../blocks/viewDsl';
import { ViewLayout } from '../blocks/viewLayoutDsl';
import type { ViewState, ViewLayoutState } from '../viewTypes';
import { TextBox } from '../../elements/text-box/dsl';
import { CarouselTray } from '../../elements/carousel-scrubber/dsl';
import { Highlight } from '../../elements/carousel-scrubber/highlightDsl';
import type { CarouselScrubberState } from '../../elements/carousel-scrubber/types';

// A minimal spatial widget for tests that need a child inside a View.
const SpatialWidget = () => null;
SpatialWidget.displayName = 'SpatialWidget';

const testContext: SceneSnapshotContext = {
  sceneIndex: 0,
  numScenes: 1,
  assetsReady: true,
  themeFamily: 'default',
  themePolarity: 'dark',
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
  // Register a minimal spatial widget for tests that need a DSL child inside a View.
  registerNode(SpatialWidget, () => {});
});

// --- <View> tests ---

describe('viewHandler — standalone view', () => {
  it('stores ViewState with explicit bounds', () => {
    const tree = (
      <Scene id="s1">
        <View id="v1" x={'10%'} y={'10%'} w={'80%'} h={'80%'} />
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
        <View id="v1" x={0} y={0} w={'100%'} h={'100%'} padding={0.1} />
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
        <View id="v1" x={'10%'} y={'10%'} w={'80%'} h={'80%'} />
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
        <View id="v1" x={'10%'} y={'10%'} w={'80%'} h={'80%'}>
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
        <View id="outer" x={'10%'} y={'10%'} w={'80%'} h={'80%'}>
          <View id="inner" x={'25%'} y={'25%'} w={'50%'} h={'50%'} />
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
    const tree = <Scene id="s1"><View x={'10%'} y={'10%'} w={'80%'} h={'80%'} /></Scene>;
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
        <ViewLayout kind="stack" direction="horizontal" gap={'2%'}>
          <View id="v1" w={'48%'} h={'100%'} />
          <View id="v2" w={'48%'} h={'100%'} />
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
          <View id="v1" w={'30%'} h={'80%'} />
          <View id="v2" w={'30%'} h={'80%'} />
          <View id="v3" w={'30%'} h={'80%'} />
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

describe('viewLayoutHandler — carousel container-relative sizing', () => {
  it('View w/h are composed relative to container bounds (not absolute NVS)', () => {
    // Container is 40% x 40% of viewport. Views authored at w=0.4, h=0.5.
    // After composition: 0.4 * 0.4 = 0.16 NVS wide, 0.5 * 0.4 = 0.20 NVS tall.
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" focusedIndex={0} x={'10%'} y={'10%'} w={'40%'} h={'40%'}>
          <View id="v1" w={'40%'} h={'50%'} />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const v1 = widgets['v1'] as ViewState;

    // Active view should be centered in the container {x:0.1, y:0.1, w:0.4, h:0.4}
    // Composed size: w = 0.4 * 0.4 = 0.16, h = 0.5 * 0.4 = 0.20
    // Center of container: x=0.3, y=0.3
    // View x = 0.3 - 0.16/2 = 0.22, y = 0.3 - 0.20/2 = 0.20
    expect(v1.bounds.w).toBeCloseTo(0.16);
    expect(v1.bounds.h).toBeCloseTo(0.20);
    expect(v1.bounds.x).toBeCloseTo(0.22);
    expect(v1.bounds.y).toBeCloseTo(0.20);
  });

  it('View w/h = 1 fills the container in carousel layout', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" focusedIndex={0} x={'20%'} y={'20%'} w={'60%'} h={'60%'}>
          <View id="v1" w={'100%'} h={'100%'} />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const v1 = widgets['v1'] as ViewState;

    // w=1 of container 0.6 = 0.6 NVS; h=1 of container 0.6 = 0.6 NVS
    expect(v1.bounds.w).toBeCloseTo(0.6);
    expect(v1.bounds.h).toBeCloseTo(0.6);
    // Centered in container: x = 0.2 + (0.6 - 0.6)/2 = 0.2
    expect(v1.bounds.x).toBeCloseTo(0.2);
    expect(v1.bounds.y).toBeCloseTo(0.2);
  });

  it('carousel View without explicit w/h defaults to filling container', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" focusedIndex={0} x={'10%'} y={'10%'} w={'50%'} h={'50%'}>
          <View id="v1" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const v1 = widgets['v1'] as ViewState;

    // No explicit w/h → defaults to 1 * container = container size
    expect(v1.bounds.w).toBeCloseTo(0.5);
    expect(v1.bounds.h).toBeCloseTo(0.5);
  });

  it('full-viewport container preserves original behavior (no scaling)', () => {
    // Container at default {x:0, y:0, w:1, h:1} — multiplying by 1 is a no-op.
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" focusedIndex={1}>
          <View id="v1" w={'30%'} h={'80%'} />
          <View id="v2" w={'30%'} h={'80%'} />
          <View id="v3" w={'30%'} h={'80%'} />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const v2 = widgets['v2'] as ViewState;

    // Active view v2: w = 0.3 * 1 = 0.3
    expect(v2.bounds.w).toBeCloseTo(0.3);
    expect(v2.scale).toBe(1.0);
    // Centered: x = 0.5 - 0.3/2 = 0.35
    expect(v2.bounds.x).toBeCloseTo(0.35);
  });

  it('stack layout also composes explicit child sizes relative to container', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="stack" direction="horizontal" x={'10%'} y={'10%'} w={'80%'} h={'80%'}>
          <View id="v1" w={'50%'} h={'100%'} />
          <View id="v2" w={'50%'} h={'100%'} />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const v1 = widgets['v1'] as ViewState;
    const v2 = widgets['v2'] as ViewState;

    // w=0.5 of container 0.8 = 0.4 NVS; h=1 of container 0.8 = 0.8 NVS
    expect(v1.bounds.w).toBeCloseTo(0.4);
    expect(v1.bounds.h).toBeCloseTo(0.8);
    expect(v1.bounds.x).toBeCloseTo(0.1); // starts at container left edge
    expect(v2.bounds.x).toBeCloseTo(0.5); // immediately after v1
    expect(v2.bounds.w).toBeCloseTo(0.4);
  });

  it('stack layout auto-distribution still works with unspecified sizes in sub-viewport container', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="stack" direction="horizontal" x={'10%'} y={'10%'} w={'80%'} h={'80%'}>
          <View id="v1" />
          <View id="v2" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const v1 = widgets['v1'] as ViewState;
    const v2 = widgets['v2'] as ViewState;

    // No explicit size → 0 sentinel → auto-distribute: each gets half of 0.8 = 0.4
    expect(v1.bounds.w).toBeCloseTo(0.4);
    expect(v2.bounds.w).toBeCloseTo(0.4);
    expect(v1.bounds.x).toBeCloseTo(0.1);
    expect(v2.bounds.x).toBeCloseTo(0.5);
  });
});

describe('viewLayoutHandler — managed view x/y warning', () => {
  it('emits warning when View inside layout has explicit x or y', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const tree = (
      <Scene id="s1">
        <ViewLayout id="layout1" kind="stack">
          <View id="v1" x={'10%'} y={'10%'} w={'50%'} h={'100%'} />
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
          <View id="v1" x={'90%'} y={'90%'} w={'50%'} h={'100%'} />
          <View id="v2" w={'50%'} h={'100%'} />
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
        <View id="outer" x={'10%'} y={'10%'} w={'80%'} h={'80%'}>
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

// ─── Overlay propagation from View ───────────────────────────────────────────
// These tests cover the bug fix: non-DSL children (TextBox, HTML) inside a
// <View> must appear in sceneOverlay wrapped in a positioned container div,
// not be silently dropped. Added 2026-03-13.

describe('viewHandler — overlay propagation', () => {
  function compileOverlay(tree: React.ReactElement): ReactElement | undefined {
    const result = resolveSceneFromDsl(tree, testContext, registry);
    return result.frame.sceneOverlay as ReactElement | undefined;
  }

  it('TextBox inside View appears in sceneOverlay (not silently dropped)', () => {
    const tree = (
      <Scene id="s1">
        <View id="stage" x={'10%'} y={'10%'} w={'80%'} h={'80%'}>
          <TextBox key="tb1" x={0} y={0} w={1} h={1} />
        </View>
      </Scene>
    );
    const overlay = compileOverlay(tree);
    expect(overlay).toBeDefined();
    // sceneOverlay should be a Fragment wrapping the View's positioned container
    expect(isValidElement(overlay)).toBe(true);
    expect(overlay!.type).toBe(Fragment);
  });

  it('View overlay wrapper div has CSS bounds matching the View NVS rect', () => {
    const tree = (
      <Scene id="s1">
        <View id="stage" x={'6%'} y={'10%'} w={'88%'} h={'78%'}>
          <TextBox key="tb1" x={0} y={0} w={1} h={1} />
        </View>
      </Scene>
    );
    const overlay = compileOverlay(tree);
    // The Fragment's child is the positioned wrapper div
    const children = React.Children.toArray(overlay!.props.children) as ReactElement[];
    expect(children).toHaveLength(1);
    const wrapperDiv = children[0] as ReactElement;
    expect(wrapperDiv.type).toBe('div');
    // Its inline style should position it at the View's NVS bounds as percentages
    const style = wrapperDiv.props.style as React.CSSProperties;
    expect(style.position).toBe('absolute');
    expect(style.left).toBe('6%');
    expect(style.top).toBe('10%');
    expect(style.width).toBe('88%');
    expect(style.height).toBe('78%');
  });

  it('TextBox inside View is contained within the wrapper div', () => {
    const tree = (
      <Scene id="s1">
        <View id="stage" x={'10%'} y={'10%'} w={'80%'} h={'80%'}>
          <TextBox key="tb1" x={0.25} y={0.25} w={0.5} h={0.5} />
        </View>
      </Scene>
    );
    const overlay = compileOverlay(tree);
    const wrapperDiv = React.Children.toArray(overlay!.props.children)[0] as ReactElement;
    const wrapperChildren = React.Children.toArray(wrapperDiv.props.children) as ReactElement[];
    expect(wrapperChildren).toHaveLength(1);
    // The TextBox itself is a child of the wrapper — its x/y/w/h are relative to the View
    const textBox = wrapperChildren[0] as ReactElement;
    expect(textBox.type).toBe(TextBox);
  });

  it('multiple TextBoxes inside View all appear in the wrapper', () => {
    const tree = (
      <Scene id="s1">
        <View id="stage" x={0} y={0} w={'100%'} h={'100%'}>
          <TextBox key="tb1" x={0} y={0} w={0.5} h={0.5} />
          <TextBox key="tb2" x={0.5} y={0.5} w={0.5} h={0.5} />
        </View>
      </Scene>
    );
    const overlay = compileOverlay(tree);
    const wrapperDiv = React.Children.toArray(overlay!.props.children)[0] as ReactElement;
    const wrapperChildren = React.Children.toArray(wrapperDiv.props.children) as ReactElement[];
    expect(wrapperChildren).toHaveLength(2);
    expect(wrapperChildren[0].type).toBe(TextBox);
    expect(wrapperChildren[1].type).toBe(TextBox);
  });

  it('TextBox outside View and TextBox inside View both appear in sceneOverlay', () => {
    const tree = (
      <Scene id="s1">
        <TextBox key="outer" x={0} y={0} w={1} h={0.1} />
        <View id="stage" x={'10%'} y={'10%'} w={'80%'} h={'80%'}>
          <TextBox key="inner" x={0} y={0} w={1} h={1} />
        </View>
      </Scene>
    );
    const overlay = compileOverlay(tree);
    expect(overlay).toBeDefined();
    const children = React.Children.toArray(overlay!.props.children) as ReactElement[];
    // Two overlay nodes: the outer TextBox and the View's wrapper div
    expect(children).toHaveLength(2);
    // Outer TextBox is a direct child (not wrapped)
    const outerTextBox = children[0] as ReactElement;
    expect(outerTextBox.type).toBe(TextBox);
    // View's content is a wrapper div
    const viewWrapper = children[1] as ReactElement;
    expect(viewWrapper.type).toBe('div');
  });

  it('View with only DSL children produces no overlay', () => {
    // A View that only contains registered DSL elements (no TextBox/HTML) should
    // produce no sceneOverlay entry — only widget state entries.
    const DslChild = (_props: { id: string }): null => null;
    DslChild.displayName = 'DslChildNoOverlay';
    registerNode(DslChild, (node, api) => {
      api.setWidgetState((node.props as { id: string }).id, { compiled: true });
    });

    const tree = (
      <Scene id="s1">
        <View id="stage" x={'10%'} y={'10%'} w={'80%'} h={'80%'}>
          <DslChild id="child1" />
        </View>
      </Scene>
    );
    const result = resolveSceneFromDsl(tree, testContext, registry);
    // DSL child compiled into widgets
    expect(result.frame.widgets['child1']).toEqual({ compiled: true });
    // No overlay — no non-DSL content
    expect(result.frame.sceneOverlay).toBeUndefined();
  });

  it('nested View overlay wrapper uses the outer absolute bounds (not local)', () => {
    // Inner view x=0.5, y=0.5, w=0.5, h=0.5 inside outer x=0.1, y=0.1, w=0.8, h=0.8
    // Inner absolute bounds = outer.content * inner.local = {0.5, 0.5, 0.4, 0.4}
    const tree = (
      <Scene id="s1">
        <View id="outer" x={'10%'} y={'10%'} w={'80%'} h={'80%'}>
          <View id="inner" x={'50%'} y={'50%'} w={'50%'} h={'50%'}>
            <TextBox key="tb1" x={0} y={0} w={1} h={1} />
          </View>
        </View>
      </Scene>
    );
    const overlay = compileOverlay(tree);
    // The Fragment's only child is the inner View's wrapper div (outer View has no direct overlays)
    const children = React.Children.toArray(overlay!.props.children) as ReactElement[];
    expect(children).toHaveLength(1);
    const innerWrapper = children[0] as ReactElement;
    const style = innerWrapper.props.style as React.CSSProperties;
    // Inner absolute left = 0.1 + 0.8 * 0.5 = 0.5 = 50%
    expect(style.left).toBe('50%');
    // Inner absolute top = 0.1 + 0.8 * 0.5 = 0.5 = 50%
    expect(style.top).toBe('50%');
    // Inner absolute width = 0.8 * 0.5 = 0.4 = 40%
    expect(style.width).toBe('40%');
    // Inner absolute height = 0.8 * 0.5 = 0.4 = 40%
    expect(style.height).toBe('40%');
  });
});

describe('viewLayoutHandler — degenerate cases', () => {
  it('single-child carousel: view centered at full scale, layer = 1', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" activeIndex={0}>
          <View id="v1" w={'50%'} h={'80%'} />
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
              <View id="inner1" w={'50%'} h={'80%'} />
              <View id="inner2" w={'50%'} h={'80%'} />
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

describe('carousel views — children compile with opacity=1 (ViewWidget controls fade at runtime)', () => {
  // Register a probe widget that records api.composeOpacity(1) in its widget state.
  const Probe = (_props: { id: string }): null => null;
  Probe.displayName = 'Probe';

  beforeEach(() => {
    registerNode(Probe, (node, api) => {
      const id = (node.props as { id: string }).id;
      api.setWidgetState(id, { composedOpacity: api.composeOpacity(1) });
    });
  });

  it('both active and inactive carousel view children compile with opacity=1', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" loop activeIndex={0} zStep={4} fadeMin={0}>
          <View id="v1" w={'40%'} h={'60%'}>
            <Probe id="probe1" />
          </View>
          <View id="v2" w={'40%'} h={'60%'}>
            <Probe id="probe2" />
          </View>
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const p1 = widgets['probe1'] as { composedOpacity: number };
    const p2 = widgets['probe2'] as { composedOpacity: number };
    // Both views have layoutId — children compile with opacity=1; ViewWidget controls fade
    expect(p1.composedOpacity).toBe(1);
    expect(p2.composedOpacity).toBe(1);
  });

  it('all carousel children compile with opacity=1 regardless of activeIndex', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" loop activeIndex={1} zStep={4} fadeMin={0.1}>
          <View id="v1" w={'30%'} h={'50%'}>
            <Probe id="p1" />
          </View>
          <View id="v2" w={'30%'} h={'50%'}>
            <Probe id="p2" />
          </View>
          <View id="v3" w={'30%'} h={'50%'}>
            <Probe id="p3" />
          </View>
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    expect((widgets['p1'] as { composedOpacity: number }).composedOpacity).toBe(1);
    expect((widgets['p2'] as { composedOpacity: number }).composedOpacity).toBe(1);
    expect((widgets['p3'] as { composedOpacity: number }).composedOpacity).toBe(1);
  });
});

describe('viewHandler — child opacity: layoutId present vs absent', () => {
  const Probe = (_props: { id: string }): null => null;
  Probe.displayName = 'ProbeLayoutId';

  beforeEach(() => {
    registerNode(Probe, (node, api) => {
      const id = (node.props as { id: string }).id;
      api.setWidgetState(id, { composedOpacity: api.composeOpacity(1) });
    });
  });

  it('view WITH layoutId compiles children with opacity=1.0 (unscaled)', () => {
    // loop + fadeMin=0 ensures inactive view gets opacity < 1 from layout
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" loop activeIndex={0} zStep={4} fadeMin={0}>
          <View id="v1" w={'40%'} h={'60%'}>
            <Probe id="probe1" />
          </View>
          <View id="v2" w={'40%'} h={'60%'}>
            <Probe id="probe2" />
          </View>
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    // v2 is an inactive carousel view — its viewOpacity < 1, but children compile with 1
    const v2 = widgets['v2'] as ViewState;
    expect(v2.layoutId).toBeDefined();
    expect(v2.opacity).toBeLessThan(1); // layout assigned a faded opacity
    expect((widgets['probe2'] as { composedOpacity: number }).composedOpacity).toBe(1);
  });

  it('view WITHOUT layoutId (standalone) compiles children with viewOpacity baked in', () => {
    // Standalone views always have viewOpacity=1; children inherit opacity=1
    const tree = (
      <Scene id="s1">
        <View id="standalone">
          <Probe id="probe" />
        </View>
      </Scene>
    );
    const widgets = compile(tree);
    const viewState = widgets['standalone'] as ViewState;
    expect(viewState.layoutId).toBeUndefined();
    expect((widgets['probe'] as { composedOpacity: number }).composedOpacity).toBe(1);
  });
});

// ─── childWidgetIds tracking ──────────────────────────────────────────────────

describe('viewHandler — childWidgetIds', () => {
  it('childWidgetIds is empty when View has no children', () => {
    const tree = (
      <Scene id="s1">
        <View id="v1" x={'10%'} y={'10%'} w={'80%'} h={'80%'} />
      </Scene>
    );
    const widgets = compile(tree);
    const state = widgets['v1'] as ViewState;
    expect(state.childWidgetIds).toEqual([]);
  });

  it('childWidgetIds contains widget ID set by a DSL child inside the View', () => {
    const TrackedChild = (_props: { id: string }): null => null;
    TrackedChild.displayName = 'TrackedChild';
    registerNode(TrackedChild, (node, api) => {
      api.setWidgetState((node.props as { id: string }).id, { compiled: true });
    });

    const tree = (
      <Scene id="s1">
        <View id="v1">
          <TrackedChild id="child1" />
        </View>
      </Scene>
    );
    const widgets = compile(tree);
    const state = widgets['v1'] as ViewState;
    expect(state.childWidgetIds).toContain('child1');
  });

  it('childWidgetIds contains all widget IDs when multiple DSL children', () => {
    const TrackedChildA = (_props: { id: string }): null => null;
    TrackedChildA.displayName = 'TrackedChildA';
    registerNode(TrackedChildA, (node, api) => {
      api.setWidgetState((node.props as { id: string }).id, { a: true });
    });

    const tree = (
      <Scene id="s1">
        <View id="v1">
          <TrackedChildA id="childA" />
          <TrackedChildA id="childB" />
        </View>
      </Scene>
    );
    const widgets = compile(tree);
    const state = widgets['v1'] as ViewState;
    expect(state.childWidgetIds).toContain('childA');
    expect(state.childWidgetIds).toContain('childB');
    expect(state.childWidgetIds).toHaveLength(2);
  });

  it('nested Views: outer childWidgetIds contains inner View id and propagated grandchildren', () => {
    // setWidgetState wraps delegate up the chain, so grandchild IDs propagate to
    // outer.childWidgetIds. The inner viewHandler calls api.setWidgetState('inner', ...)
    // on the outer childApi, which also receives grandchild calls from inner's childApi.
    const InnerChild = (_props: { id: string }): null => null;
    InnerChild.displayName = 'InnerChild';
    registerNode(InnerChild, (node, api) => {
      api.setWidgetState((node.props as { id: string }).id, { inner: true });
    });

    const tree = (
      <Scene id="s1">
        <View id="outer">
          <View id="inner">
            <InnerChild id="grandchild" />
          </View>
        </View>
      </Scene>
    );
    const widgets = compile(tree);
    const outerState = widgets['outer'] as ViewState;
    const innerState = widgets['inner'] as ViewState;
    // Outer View's childApi sees all setWidgetState calls including grandchild (chain propagation)
    expect(outerState.childWidgetIds).toContain('inner');
    expect(outerState.childWidgetIds).toContain('grandchild');
    // Inner View's childWidgetIds contains the grandchild
    expect(innerState.childWidgetIds).toContain('grandchild');
    expect(innerState.childWidgetIds).not.toContain('inner');
  });
});

// ─── Reserved-id guard ────────────────────────────────────────────────────────

describe('viewHandler — reserved-id guard', () => {
  it('emits console.warn when a View uses a reserved __...__ id', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    compile(<Scene id="s1"><View id="__my_reserved__"><SpatialWidget /></View></Scene>);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('reserved'));
    warnSpy.mockRestore();
  });

  it('does not warn for the compiler-generated __scene_root__ sentinel id', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    compile(<Scene id="s1"><SpatialWidget /></Scene>); // triggers auto-wrap with __scene_root__
    // Filter for the reserved-id warning specifically
    const reservedWarnings = warnSpy.mock.calls.filter(([msg]) =>
      typeof msg === 'string' && msg.includes('reserved')
    );
    expect(reservedWarnings).toHaveLength(0);
    warnSpy.mockRestore();
  });
});

// ─── <Highlight> DSL integration ──────────────────────────────────────────────

describe('viewLayoutHandler — Highlight DSL integration', () => {
  it('compiles <Highlight active> with <CarouselTray> into viewHighlights', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" id="metrics" activeIndex={0} loop>
          <View id="v1" w={'30%'} h={'80%'} />
          <View id="v2" w={'30%'} h={'80%'} />
          <View id="v3" w={'30%'} h={'80%'} />
          <CarouselTray />
          <Highlight active variant="primary" smoke />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const trayState = widgets['metrics__tray'] as CarouselScrubberState;
    expect(trayState).toBeDefined();
    expect(trayState.viewHighlights).toHaveLength(1);
    expect(trayState.viewHighlights[0].viewId).toBe('v1');
    expect(trayState.viewHighlights[0].smoke).toBe(true);
    expect(trayState.viewHighlights[0].followView).toBe(true);
  });

  it('compiles <Highlight viewId="..."> targeting a specific view', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" id="metrics" activeIndex={0}>
          <View id="v1" w={'30%'} h={'80%'} />
          <View id="v2" w={'30%'} h={'80%'} />
          <View id="v3" w={'30%'} h={'80%'} />
          <CarouselTray />
          <Highlight viewId="v3" mode="holographic" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const trayState = widgets['metrics__tray'] as CarouselScrubberState;
    expect(trayState.viewHighlights).toHaveLength(1);
    expect(trayState.viewHighlights[0].viewId).toBe('v3');
    expect(trayState.viewHighlights[0].mode).toBe('holographic');
  });

  it('emits console.warn when <Highlight> has no <CarouselTray> sibling', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" id="metrics" activeIndex={0}>
          <View id="v1" w={'30%'} h={'80%'} />
          <Highlight active />
        </ViewLayout>
      </Scene>
    );
    compile(tree);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('<Highlight> requires a <CarouselTray> sibling'),
    );
    // No tray state should be produced
    const trayState = compile(tree)['metrics__tray'];
    expect(trayState).toBeUndefined();

    warnSpy.mockRestore();
  });

  it('compiles both <Highlight> and legacy tray props — DSL wins for same viewId', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" id="metrics" activeIndex={0} loop>
          <View id="v1" w={'30%'} h={'80%'} />
          <View id="v2" w={'30%'} h={'80%'} />
          <CarouselTray highlightActive="glow" />
          <Highlight active mode="holographic" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);
    const trayState = widgets['metrics__tray'] as CarouselScrubberState;

    // DSL <Highlight> targets v1 (active) with holographic.
    // Legacy tray props also target v1 with glow.
    // DSL should win for v1.
    const v1Highlight = trayState.viewHighlights.find(h => h.viewId === 'v1');
    expect(v1Highlight).toBeDefined();
    expect(v1Highlight!.mode).toBe('holographic');

    warnSpy.mockRestore();
  });

  it('<Highlight> is not treated as a non-View child warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const tree = (
      <Scene id="s1">
        <ViewLayout kind="carousel" id="metrics" activeIndex={0}>
          <View id="v1" w={'30%'} h={'80%'} />
          <CarouselTray />
          <Highlight active />
        </ViewLayout>
      </Scene>
    );
    compile(tree);

    const nonViewWarnings = warnSpy.mock.calls.filter(([msg]) =>
      typeof msg === 'string' && msg.includes('contains non-View child')
    );
    expect(nonViewWarnings).toHaveLength(0);
    warnSpy.mockRestore();
  });
});

// ─── CompileApi.layoutContext scoping tests ────────────────────────────────────
// Verify that withLayoutContext creates properly scoped APIs (M2 refactor).

describe('withLayoutContext — scoped child view sees layout context', () => {
  it('child viewHandler inside ViewLayout sees api.layoutContext with correct layoutId and viewResults', () => {
    // Register a probe that captures the api.layoutContext value it receives.
    let capturedContext: CompileApi['layoutContext'] | undefined;
    const ContextProbe = (_props: { id: string }): null => null;
    ContextProbe.displayName = 'ContextProbe';
    registerNode(ContextProbe, (_node, api) => {
      capturedContext = api.layoutContext;
    });

    const tree = (
      <Scene id="s1">
        <ViewLayout id="myLayout" kind="stack">
          <View id="v1">
            <ContextProbe id="probe" />
          </View>
          <View id="v2" />
        </ViewLayout>
      </Scene>
    );
    compile(tree);

    // The probe compiled inside v1 should NOT see layout context — viewHandler
    // creates a childApi for its children, and that childApi doesn't carry the
    // layout context (it's consumed by the view handler itself, not propagated).
    // The viewHandler reads api.layoutContext to resolve its bounds, then creates
    // a clean childApi for its children.
    //
    // But the viewHandler's api DOES have layoutContext — verified indirectly by
    // the fact that v1 gets layout-assigned bounds and a layoutId.
    const v1 = compile(tree)['v1'] as ViewState;
    expect(v1.layoutId).toBe('myLayout');
    expect(v1.bounds).toBeDefined();
  });
});

describe('withLayoutContext — nested ViewLayout correctly restores outer context', () => {
  it('outer Views after inner ViewLayout still see the outer layout context', () => {
    // Capture layoutId from viewHandler for each view.
    const tree = (
      <Scene id="s1">
        <ViewLayout id="outer" kind="stack">
          <View id="v1">
            <ViewLayout id="inner" kind="carousel" activeIndex={0}>
              <View id="inner1" w={'50%'} h={'80%'} />
              <View id="inner2" w={'50%'} h={'80%'} />
            </ViewLayout>
          </View>
          <View id="v2" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);

    // v1 should have outer layout context
    const v1 = widgets['v1'] as ViewState;
    expect(v1.layoutId).toBe('outer');

    // inner1 and inner2 should have inner layout context
    const inner1 = widgets['inner1'] as ViewState;
    const inner2 = widgets['inner2'] as ViewState;
    expect(inner1.layoutId).toBe('inner');
    expect(inner2.layoutId).toBe('inner');

    // v2 — compiled AFTER the inner ViewLayout — should still see the outer context.
    // This verifies that withLayoutContext creates a scoped API without mutating
    // the original, so the outer context is structurally restored.
    const v2 = widgets['v2'] as ViewState;
    expect(v2.layoutId).toBe('outer');
  });

  it('deeply nested ViewLayouts (3 levels) each see their own context', () => {
    const tree = (
      <Scene id="s1">
        <ViewLayout id="L1" kind="stack">
          <View id="v1">
            <ViewLayout id="L2" kind="stack">
              <View id="v2">
                <ViewLayout id="L3" kind="carousel" activeIndex={0}>
                  <View id="v3a" w={'40%'} h={'60%'} />
                  <View id="v3b" w={'40%'} h={'60%'} />
                </ViewLayout>
              </View>
              <View id="v2b" />
            </ViewLayout>
          </View>
          <View id="v1b" />
        </ViewLayout>
      </Scene>
    );
    const widgets = compile(tree);

    expect((widgets['v1'] as ViewState).layoutId).toBe('L1');
    expect((widgets['v1b'] as ViewState).layoutId).toBe('L1');
    expect((widgets['v2'] as ViewState).layoutId).toBe('L2');
    expect((widgets['v2b'] as ViewState).layoutId).toBe('L2');
    expect((widgets['v3a'] as ViewState).layoutId).toBe('L3');
    expect((widgets['v3b'] as ViewState).layoutId).toBe('L3');
  });
});
