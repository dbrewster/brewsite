// ViewWidget tests — interface-based stateful tests.
// Tests the widget's runtime contract: initialize/apply/dispose, delta transform math,
// lazy child reparenting, opacity application with short-circuit, and group teardown.

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ViewWidget } from '../ViewWidget';
import type { ViewState } from '../../../compiler/viewTypes';
import type { NVSRect } from '../../../layout/types';
import type { NormalizedPadding } from '../../../layout/regionTypes';
import { makeInitContext, makeRenderContext } from '../../__tests__/elementTestMocks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ZERO_PADDING: NormalizedPadding = [0, 0, 0, 0];

/** Builds a full-screen NVSRect with center at (0.5, 0.5). */
const FULL_BOUNDS: NVSRect = { x: 0, y: 0, w: 1, h: 1 };

/** Builds a ViewState with sensible defaults. */
function makeViewState(
  id: string,
  bounds: NVSRect,
  overrides: Partial<ViewState> = {},
): ViewState {
  return {
    id,
    bounds,
    padding: ZERO_PADDING,
    contentBounds: bounds,
    layer: 1,
    scale: 1.0,
    z: 0,
    opacity: 1.0,
    childWidgetIds: [],
    ...overrides,
  };
}

/** Looks up the named THREE.Group in scene children. */
function findGroup(scene: THREE.Scene, viewId: string): THREE.Group | undefined {
  return scene.children.find(
    (c): c is THREE.Group => c.name === `view-group-${viewId}`,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ViewWidget', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  // ── Test 1: Identity transform ─────────────────────────────────────────────

  it('group.position is (0,0,z) and scale is (1,1,1) when bounds match original', () => {
    const widget = new ViewWidget('v1', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v1' }));

    const ctx = makeRenderContext();
    const state = makeViewState('v1', FULL_BOUNDS); // center NVS = (0.5, 0.5)
    widget.apply(state, ctx);

    const group = findGroup(scene, 'v1');
    expect(group).toBeDefined();
    // toWorld(0.5, 0.5) = (0, 0) so G = (0,0) - (0,0)*1 = (0,0)
    expect(group!.position.x).toBeCloseTo(0);
    expect(group!.position.y).toBeCloseTo(0);
    expect(group!.position.z).toBe(0);
    expect(group!.scale.x).toBeCloseTo(1);
    expect(group!.scale.y).toBeCloseTo(1);
    expect(group!.scale.z).toBeCloseTo(1);
  });

  it('group.position.z is 0 when state.z equals originalZ (no carousel movement)', () => {
    const widget = new ViewWidget('v1z', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v1z' }));

    const ctx = makeRenderContext();
    // First apply captures originalZ = 2.5; state.z = 2.5 → delta = 0
    const state = makeViewState('v1z', FULL_BOUNDS, { z: 2.5 });
    widget.apply(state, ctx);

    const group = findGroup(scene, 'v1z');
    expect(group!.position.z).toBe(0);
  });

  it('group.position.z is 0 at compile time for an inactive view (originalZ = -0.5)', () => {
    const widget = new ViewWidget('v1z-inactive', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v1z-inactive' }));

    const ctx = makeRenderContext();
    // Inactive carousel view: first apply captures originalZ = -0.5; state.z still -0.5 → delta = 0
    const state = makeViewState('v1z-inactive', FULL_BOUNDS, { z: -0.5 });
    widget.apply(state, ctx);

    const group = findGroup(scene, 'v1z-inactive');
    expect(group!.position.z).toBeCloseTo(0);
  });

  it('group.position.z equals the delta after a carousel patch changes state.z', () => {
    const widget = new ViewWidget('v1z-delta', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v1z-delta' }));

    const ctx = makeRenderContext();
    // First apply captures originalZ = -0.5
    const first = makeViewState('v1z-delta', FULL_BOUNDS, { z: -0.5 });
    widget.apply(first, ctx);

    // Carousel moves view: state.z changes to 0.5 → delta = 0.5 - (-0.5) = 1.0
    const second = makeViewState('v1z-delta', FULL_BOUNDS, { z: 0.5 });
    widget.apply(second, ctx);

    const group = findGroup(scene, 'v1z-delta');
    expect(group!.position.z).toBeCloseTo(1.0);
  });

  // ── Test 2: Delta transform ────────────────────────────────────────────────

  it('group.position.x shifts by world-space delta when bounds center changes', () => {
    const widget = new ViewWidget('v2', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v2' }));

    const ctx = makeRenderContext();

    // First apply captures originalNvsCenter = (0.5, 0.5) → world (0, 0)
    const original = makeViewState('v2', FULL_BOUNDS);
    widget.apply(original, ctx);

    // Second apply with shifted center: x=0.3, w=1 → center.x = 0.8
    const shifted = makeViewState('v2', { x: 0.3, y: 0, w: 1, h: 1 });
    widget.apply(shifted, ctx);

    // Expected G.x = toWorld(0.8, 0.5)[0] - toWorld(0.5, 0.5)[0] * 1
    // toWorld(0.8, 0.5)[0] = (0.8 - 0.5) * visibleWorldWidth
    // toWorld(0.5, 0.5)[0] = 0
    const [expectedGx] = ctx.coords.toWorld(0.8, 0.5, 0);
    const [expectedOldX] = ctx.coords.toWorld(0.5, 0.5, 0); // = 0

    const group = findGroup(scene, 'v2');
    expect(group!.position.x).toBeCloseTo(expectedGx - expectedOldX);
  });

  it('group.position.y shifts by world-space delta when vertical bounds change', () => {
    const widget = new ViewWidget('v2y', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v2y' }));

    const ctx = makeRenderContext();
    const original = makeViewState('v2y', FULL_BOUNDS); // center y = 0.5
    widget.apply(original, ctx);

    // Shift bounds down: y=0.4, h=0.6 → center.y = 0.7
    const shifted = makeViewState('v2y', { x: 0, y: 0.4, w: 1, h: 0.6 });
    widget.apply(shifted, ctx);

    const [, expectedNewCy] = ctx.coords.toWorld(0.5, 0.7, 0);
    const [, expectedOldCy] = ctx.coords.toWorld(0.5, 0.5, 0); // = 0

    const group = findGroup(scene, 'v2y');
    expect(group!.position.y).toBeCloseTo(expectedNewCy - expectedOldCy);
  });

  // ── Test 3: Scale change ───────────────────────────────────────────────────

  it('group.scale equals (S/S0, S/S0, 1) after scale change', () => {
    const widget = new ViewWidget('v3', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v3' }));

    const ctx = makeRenderContext();

    // First apply captures originalScale = 0.75
    const first = makeViewState('v3', FULL_BOUNDS, { scale: 0.75 });
    widget.apply(first, ctx);

    // Second apply with scale = 0.5 → scaleRatio = 0.5 / 0.75
    const second = makeViewState('v3', FULL_BOUNDS, { scale: 0.5 });
    widget.apply(second, ctx);

    const expectedScale = 0.5 / 0.75;
    const group = findGroup(scene, 'v3');
    expect(group!.scale.x).toBeCloseTo(expectedScale);
    expect(group!.scale.y).toBeCloseTo(expectedScale);
    expect(group!.scale.z).toBeCloseTo(1);
  });

  it('G = P_new - P_old * scaleRatio when view has off-center bounds', () => {
    const widget = new ViewWidget('v3b', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v3b' }));

    const ctx = makeRenderContext();
    // Bounds with center at (0.3, 0.5)
    const offCenterBounds: NVSRect = { x: 0, y: 0, w: 0.6, h: 1.0 };

    // First apply: captures originalNvsCenter=(0.3, 0.5), originalScale=0.75
    const first = makeViewState('v3b', offCenterBounds, { scale: 0.75 });
    widget.apply(first, ctx);

    // Second apply: same bounds, scale=0.5
    const second = makeViewState('v3b', offCenterBounds, { scale: 0.5 });
    widget.apply(second, ctx);

    const scaleRatio = 0.5 / 0.75;
    const [newCx, newCy] = ctx.coords.toWorld(0.3, 0.5, 0);
    const [oldCx, oldCy] = ctx.coords.toWorld(0.3, 0.5, 0); // same center

    const group = findGroup(scene, 'v3b');
    expect(group!.position.x).toBeCloseTo(newCx - oldCx * scaleRatio);
    expect(group!.position.y).toBeCloseTo(newCy - oldCy * scaleRatio);
  });

  // ── Test 4: Reparenting ────────────────────────────────────────────────────

  it('children are added to the group on first apply() with childWidgetIds', () => {
    const child1 = new THREE.Object3D();
    const child2 = new THREE.Object3D();
    child1.name = 'child-1';
    child2.name = 'child-2';

    const resolveChildRoot = (id: string): THREE.Object3D | null => {
      if (id === 'child-1') return child1;
      if (id === 'child-2') return child2;
      return null;
    };

    const widget = new ViewWidget('v4', resolveChildRoot);
    widget.initialize(makeInitContext({ scene, widgetId: 'v4' }));

    const state = makeViewState('v4', FULL_BOUNDS, { childWidgetIds: ['child-1', 'child-2'] });
    widget.apply(state, makeRenderContext());

    const group = findGroup(scene, 'v4');
    expect(group!.children).toContain(child1);
    expect(group!.children).toContain(child2);
  });

  it('reparenting only happens once across multiple apply() calls', () => {
    let resolveCallCount = 0;
    const child = new THREE.Object3D();

    const resolveChildRoot = (id: string): THREE.Object3D | null => {
      if (id === 'child-1') {
        resolveCallCount++;
        return child;
      }
      return null;
    };

    const widget = new ViewWidget('v4b', resolveChildRoot);
    widget.initialize(makeInitContext({ scene, widgetId: 'v4b' }));

    const state = makeViewState('v4b', FULL_BOUNDS, { childWidgetIds: ['child-1'] });
    widget.apply(state, makeRenderContext());
    widget.apply(state, makeRenderContext());
    widget.apply(state, makeRenderContext());

    // resolveChildRoot should only be called during the first apply()
    expect(resolveCallCount).toBe(1);
  });

  it('dispose() removes the group from the scene without reparenting children back', () => {
    const child = new THREE.Object3D();
    const widget = new ViewWidget('v4c', (id) => (id === 'c1' ? child : null));
    widget.initialize(makeInitContext({ scene, widgetId: 'v4c' }));

    const state = makeViewState('v4c', FULL_BOUNDS, { childWidgetIds: ['c1'] });
    widget.apply(state, makeRenderContext());

    expect(findGroup(scene, 'v4c')).toBeDefined();

    widget.dispose();

    // Group removed from scene
    expect(findGroup(scene, 'v4c')).toBeUndefined();
    // Child is NOT moved back to scene root (it stays with the group in memory)
    expect(scene.children).not.toContain(child);
  });

  // ── Test 5: Opacity ────────────────────────────────────────────────────────

  it('apply() with opacity=0.5 sets mesh material opacity to 0.5', () => {
    const mat = new THREE.MeshBasicMaterial({ opacity: 1, transparent: true });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat);

    const widget = new ViewWidget('v5', (id) => (id === 'm1' ? mesh : null));
    widget.initialize(makeInitContext({ scene, widgetId: 'v5' }));

    const state = makeViewState('v5', FULL_BOUNDS, { childWidgetIds: ['m1'], opacity: 0.5 });
    widget.apply(state, makeRenderContext());

    expect(mat.opacity).toBeCloseTo(0.5);
    expect(mat.transparent).toBe(true);
  });

  it('applyOpacity sets mat.opacity directly from state.opacity, ignoring material base opacity', () => {
    const mat = new THREE.MeshBasicMaterial({ opacity: 0.8, transparent: true });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat);

    const widget = new ViewWidget('v5b', (id) => (id === 'm1' ? mesh : null));
    widget.initialize(makeInitContext({ scene, widgetId: 'v5b' }));

    const state = makeViewState('v5b', FULL_BOUNDS, { childWidgetIds: ['m1'], opacity: 0.5 });
    widget.apply(state, makeRenderContext());

    // Opacity set directly from state — no multiplication by material base opacity
    expect(mat.opacity).toBeCloseTo(0.5);
  });

  it('materials reach full opacity after transitioning from 0.15 to 1.0 (no stuck-at-0.15)', () => {
    const mat = new THREE.MeshBasicMaterial({ opacity: 1, transparent: true });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat);

    const widget = new ViewWidget('v5e', (id) => (id === 'm1' ? mesh : null));
    widget.initialize(makeInitContext({ scene, widgetId: 'v5e' }));

    // First apply with faded opacity (inactive carousel item)
    const fadedState = makeViewState('v5e', FULL_BOUNDS, { childWidgetIds: ['m1'], opacity: 0.15 });
    widget.apply(fadedState, makeRenderContext());
    expect(mat.opacity).toBeCloseTo(0.15);

    // Apply with full opacity (active carousel item) — must NOT be stuck at 0.15
    const activeState = makeViewState('v5e', FULL_BOUNDS, { childWidgetIds: ['m1'], opacity: 1.0 });
    widget.apply(activeState, makeRenderContext());
    expect(mat.opacity).toBeCloseTo(1.0);
    expect(mat.transparent).toBe(false);
  });

  it('applyOpacity short-circuits when opacity is unchanged', () => {
    const mat = new THREE.MeshBasicMaterial({ opacity: 1, transparent: true });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat);

    const widget = new ViewWidget('v5c', (id) => (id === 'm1' ? mesh : null));
    widget.initialize(makeInitContext({ scene, widgetId: 'v5c' }));

    const state = makeViewState('v5c', FULL_BOUNDS, { childWidgetIds: ['m1'], opacity: 0.5 });
    widget.apply(state, makeRenderContext());
    expect(mat.opacity).toBeCloseTo(0.5);

    // Manually change material opacity to detect if traversal fires again
    mat.opacity = 0.9;

    // Apply again with same opacity — should short-circuit, leaving mat.opacity = 0.9
    widget.apply(state, makeRenderContext());
    expect(mat.opacity).toBeCloseTo(0.9);
  });

  it('group.visible is false when opacity is 0', () => {
    const widget = new ViewWidget('v5d', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v5d' }));

    const state = makeViewState('v5d', FULL_BOUNDS, { opacity: 0 });
    widget.apply(state, makeRenderContext());

    const group = findGroup(scene, 'v5d');
    expect(group!.visible).toBe(false);
  });

  // ── Test 6: No reparent when childWidgetIds is empty ──────────────────────

  it('does not call resolveChildRoot when childWidgetIds is empty', () => {
    let resolveCalled = false;
    const widget = new ViewWidget('v6', () => {
      resolveCalled = true;
      return null;
    });
    widget.initialize(makeInitContext({ scene, widgetId: 'v6' }));

    const state = makeViewState('v6', FULL_BOUNDS, { childWidgetIds: [] });
    widget.apply(state, makeRenderContext());

    expect(resolveCalled).toBe(false);
  });

  it('group has no children when childWidgetIds is empty', () => {
    const widget = new ViewWidget('v6b', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v6b' }));

    const state = makeViewState('v6b', FULL_BOUNDS, { childWidgetIds: [] });
    widget.apply(state, makeRenderContext());

    const group = findGroup(scene, 'v6b');
    expect(group!.children).toHaveLength(0);
  });

  // ── Supplemental: group added to scene on initialize ──────────────────────

  it('adds group to scene on initialize()', () => {
    const widget = new ViewWidget('v-init', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v-init' }));

    expect(findGroup(scene, 'v-init')).toBeDefined();
  });

  it('group name matches view id', () => {
    const widget = new ViewWidget('my-view', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'my-view' }));

    const group = findGroup(scene, 'my-view');
    expect(group!.name).toBe('view-group-my-view');
  });

  it('apply() does not throw before initialize()', () => {
    const widget = new ViewWidget('v-noinit', () => null);
    const state = makeViewState('v-noinit', FULL_BOUNDS);
    expect(() => widget.apply(state, makeRenderContext())).not.toThrow();
  });

  it('dispose() does not throw when called without initialize()', () => {
    const widget = new ViewWidget('v-dis', () => null);
    expect(() => widget.dispose()).not.toThrow();
  });

  it('dispose() resets originalNvsCenter so next apply re-captures it', () => {
    const widget = new ViewWidget('v-reset', () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v-reset' }));

    const ctx = makeRenderContext();
    const state = makeViewState('v-reset', FULL_BOUNDS);
    widget.apply(state, ctx);
    widget.dispose();

    // Re-initialize and apply with different bounds — should re-capture, not use stale center
    const scene2 = new THREE.Scene();
    widget.initialize(makeInitContext({ scene: scene2, widgetId: 'v-reset' }));
    const newBounds: NVSRect = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }; // center (0.5, 0.5) still
    const state2 = makeViewState('v-reset', newBounds);
    expect(() => widget.apply(state2, ctx)).not.toThrow();

    const group = findGroup(scene2, 'v-reset');
    expect(group!.position.x).toBeCloseTo(0);
    expect(group!.position.y).toBeCloseTo(0);
  });
});
