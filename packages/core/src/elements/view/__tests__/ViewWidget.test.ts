// ViewWidget tests — interface-based stateful tests.
// Tests the new non-group ViewWidget contract: no THREE.Group added to scene,
// opacity delegated via IViewChild.applyViewOpacity(), child object position
// deltas computed from NVS center shift, and short-circuit on unchanged opacity.

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ViewWidget } from '../ViewWidget';
import type { ViewState } from '../../../compiler/viewTypes';
import type { NVSRect } from '../../../layout/types';
import type { NormalizedPadding } from '../../../layout/regionTypes';
import type { IViewChild } from '../../../widget/types';
import { makeInitContext, makeRenderContext } from '../../__tests__/elementTestMocks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ZERO_PADDING: NormalizedPadding = [0, 0, 0, 0];
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

/**
 * Test double implementing IViewChild.
 * Records every opacity value passed to applyViewOpacity().
 */
class TestViewChild implements IViewChild {
  readonly widgetId: string;
  readonly appliedOpacities: number[] = [];

  constructor(id: string) {
    this.widgetId = id;
  }

  applyViewOpacity(opacity: number): void {
    this.appliedOpacities.push(opacity);
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ViewWidget', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  // ── initialize() ──────────────────────────────────────────────────────────

  it('initialize() does NOT add a group to the scene', () => {
    const widget = new ViewWidget('v-init', () => undefined, () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v-init' }));
    expect(scene.children).toHaveLength(0);
  });

  // ── IViewChild opacity delegation ─────────────────────────────────────────

  it('apply() calls applyViewOpacity(0.5) on IViewChild children when opacity is 0.5', () => {
    const child = new TestViewChild('c1');
    const widget = new ViewWidget(
      'v1',
      (id) => (id === 'c1' ? child : undefined),
      () => null,
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v1' }));

    const state = makeViewState('v1', FULL_BOUNDS, {
      childWidgetIds: ['c1'],
      opacity: 0.5,
    });
    widget.apply(state, makeRenderContext());

    expect(child.appliedOpacities).toHaveLength(1);
    expect(child.appliedOpacities[0]).toBeCloseTo(0.5);
  });

  it('apply() calls applyViewOpacity(1.0) on IViewChild children at full opacity', () => {
    const child = new TestViewChild('c1');
    const widget = new ViewWidget(
      'v-full',
      (id) => (id === 'c1' ? child : undefined),
      () => null,
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-full' }));

    const state = makeViewState('v-full', FULL_BOUNDS, {
      childWidgetIds: ['c1'],
      opacity: 1.0,
    });
    widget.apply(state, makeRenderContext());

    expect(child.appliedOpacities).toHaveLength(1);
    expect(child.appliedOpacities[0]).toBeCloseTo(1.0);
  });

  it('apply() calls applyViewOpacity(0) on IViewChild children when opacity is 0', () => {
    const child = new TestViewChild('c1');
    const widget = new ViewWidget(
      'v-zero',
      (id) => (id === 'c1' ? child : undefined),
      () => null,
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-zero' }));

    const state = makeViewState('v-zero', FULL_BOUNDS, {
      childWidgetIds: ['c1'],
      opacity: 0,
    });
    widget.apply(state, makeRenderContext());

    expect(child.appliedOpacities).toHaveLength(1);
    expect(child.appliedOpacities[0]).toBeCloseTo(0);
  });

  it('apply() short-circuits applyViewOpacity when opacity is unchanged', () => {
    const child = new TestViewChild('c1');
    const widget = new ViewWidget(
      'v-short',
      (id) => (id === 'c1' ? child : undefined),
      () => null,
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-short' }));

    const state = makeViewState('v-short', FULL_BOUNDS, {
      childWidgetIds: ['c1'],
      opacity: 0.5,
    });
    widget.apply(state, makeRenderContext());
    widget.apply(state, makeRenderContext());
    widget.apply(state, makeRenderContext());

    // Called only once — short-circuited on 2nd and 3rd apply
    expect(child.appliedOpacities).toHaveLength(1);
  });

  it('apply() calls applyViewOpacity again when opacity changes after short-circuit', () => {
    const child = new TestViewChild('c1');
    const widget = new ViewWidget(
      'v-change',
      (id) => (id === 'c1' ? child : undefined),
      () => null,
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-change' }));

    const state1 = makeViewState('v-change', FULL_BOUNDS, {
      childWidgetIds: ['c1'],
      opacity: 0.3,
    });
    widget.apply(state1, makeRenderContext());
    expect(child.appliedOpacities).toHaveLength(1);

    const state2 = makeViewState('v-change', FULL_BOUNDS, {
      childWidgetIds: ['c1'],
      opacity: 0.8,
    });
    // ViewWidget lerps opacity — apply multiple times to converge.
    const ctx2 = makeRenderContext();
    for (let i = 0; i < 80; i++) widget.apply(state2, ctx2);
    expect(child.appliedOpacities.length).toBeGreaterThan(1);
    expect(child.appliedOpacities[child.appliedOpacities.length - 1]).toBeCloseTo(0.8, 1);
  });

  it('apply() does not call applyViewOpacity on non-IViewChild widgets', () => {
    // A plain IWidget that does NOT implement IViewChild
    const plainWidget = { widgetId: 'plain' };
    let opacityCallCount = 0;
    const widget = new ViewWidget(
      'v-plain',
      (id) => (id === 'plain' ? plainWidget : undefined),
      () => null,
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-plain' }));

    const state = makeViewState('v-plain', FULL_BOUNDS, {
      childWidgetIds: ['plain'],
      opacity: 0.5,
    });
    expect(() => widget.apply(state, makeRenderContext())).not.toThrow();
    expect(opacityCallCount).toBe(0);
  });

  // ── Child object position deltas ──────────────────────────────────────────

  it('apply() sets child object.visible = false when opacity is 0', () => {
    const childObj = new THREE.Object3D();
    childObj.visible = true;

    const widget = new ViewWidget(
      'v-vis',
      () => undefined,
      (id) => (id === 'c1' ? childObj : null),
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-vis' }));

    const state = makeViewState('v-vis', FULL_BOUNDS, {
      childWidgetIds: ['c1'],
      opacity: 0,
    });
    widget.apply(state, makeRenderContext());

    expect(childObj.visible).toBe(false);
  });

  it('apply() sets child object.visible = true when opacity > 0', () => {
    const childObj = new THREE.Object3D();
    childObj.visible = false;

    const widget = new ViewWidget(
      'v-vis2',
      () => undefined,
      (id) => (id === 'c1' ? childObj : null),
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-vis2' }));

    const state = makeViewState('v-vis2', FULL_BOUNDS, {
      childWidgetIds: ['c1'],
      opacity: 0.5,
    });
    widget.apply(state, makeRenderContext());

    expect(childObj.visible).toBe(true);
  });

  it('apply() identity: child position unchanged when bounds match original (scale=1)', () => {
    const childObj = new THREE.Object3D();
    childObj.position.set(1, 2, 3);

    const widget = new ViewWidget(
      'v-identity',
      () => undefined,
      (id) => (id === 'c1' ? childObj : null),
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-identity' }));

    const ctx = makeRenderContext();
    const state = makeViewState('v-identity', FULL_BOUNDS, { childWidgetIds: ['c1'] });
    widget.apply(state, ctx);

    // With scale=1 and no center shift, delta should be ~0
    // orig.x * 1 + deltaX = 1 * 1 + (toWorld(0.5,0.5)[0] - toWorld(0.5,0.5)[0]) = 1
    expect(childObj.position.x).toBeCloseTo(1);
    expect(childObj.position.y).toBeCloseTo(2);
    expect(childObj.position.z).toBeCloseTo(3);
  });

  it('apply() computes delta Z from state.z - originalZ', () => {
    const childObj = new THREE.Object3D();
    childObj.position.set(0, 0, 1);

    const widget = new ViewWidget(
      'v-dz',
      () => undefined,
      (id) => (id === 'c1' ? childObj : null),
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-dz' }));

    const ctx = makeRenderContext();
    // First apply captures originalZ = -0.5
    widget.apply(
      makeViewState('v-dz', FULL_BOUNDS, { childWidgetIds: ['c1'], z: -0.5 }),
      ctx,
    );

    // Second apply with state.z = 0.5 → deltaZ = 0.5 - (-0.5) = 1.0
    // ViewWidget lerps position — apply multiple times to converge.
    const state2 = makeViewState('v-dz', FULL_BOUNDS, { childWidgetIds: ['c1'], z: 0.5 });
    for (let i = 0; i < 80; i++) widget.apply(state2, ctx);

    // orig.z + deltaZ = 1 + 1.0 = 2.0
    expect(childObj.position.z).toBeCloseTo(2.0, 1);
  });

  it('apply() scales child object by scaleRatio when scale changes', () => {
    const childObj = new THREE.Object3D();
    childObj.scale.set(1, 1, 1);

    const widget = new ViewWidget(
      'v-scale',
      () => undefined,
      (id) => (id === 'c1' ? childObj : null),
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-scale' }));

    const ctx = makeRenderContext();
    // First apply captures originalScale = 0.5
    widget.apply(
      makeViewState('v-scale', FULL_BOUNDS, { childWidgetIds: ['c1'], scale: 0.5 }),
      ctx,
    );

    // Second apply with scale = 1.0 → scaleRatio = 1.0/0.5 = 2.0
    // ViewWidget lerps scale — apply multiple times to converge.
    const state2 = makeViewState('v-scale', FULL_BOUNDS, { childWidgetIds: ['c1'], scale: 1.0 });
    for (let i = 0; i < 80; i++) widget.apply(state2, ctx);

    expect(childObj.scale.x).toBeCloseTo(2.0, 1);
    expect(childObj.scale.y).toBeCloseTo(2.0, 1);
  });

  // ── resolveViewChildren laziness ──────────────────────────────────────────

  it('resolveChildWidget is not called when childWidgetIds is empty', () => {
    let resolveCalled = false;
    const widget = new ViewWidget(
      'v-lazy',
      () => { resolveCalled = true; return undefined; },
      () => null,
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-lazy' }));

    const state = makeViewState('v-lazy', FULL_BOUNDS, { childWidgetIds: [] });
    widget.apply(state, makeRenderContext());

    expect(resolveCalled).toBe(false);
  });

  it('resolveChildWidget is called only once across multiple apply() calls', () => {
    const child = new TestViewChild('c1');
    let resolveCallCount = 0;
    const widget = new ViewWidget(
      'v-once',
      (id) => {
        if (id === 'c1') resolveCallCount++;
        return id === 'c1' ? child : undefined;
      },
      () => null,
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-once' }));

    const state = makeViewState('v-once', FULL_BOUNDS, { childWidgetIds: ['c1'] });
    widget.apply(state, makeRenderContext());
    widget.apply(state, makeRenderContext());
    widget.apply(state, makeRenderContext());

    expect(resolveCallCount).toBe(1);
  });

  // ── dispose() ─────────────────────────────────────────────────────────────

  it('dispose() clears cached state so next apply() re-captures it', () => {
    const child = new TestViewChild('c1');
    const widget = new ViewWidget(
      'v-dispose',
      (id) => (id === 'c1' ? child : undefined),
      () => null,
    );
    widget.initialize(makeInitContext({ scene, widgetId: 'v-dispose' }));

    const state = makeViewState('v-dispose', FULL_BOUNDS, {
      childWidgetIds: ['c1'],
      opacity: 0.5,
    });
    widget.apply(state, makeRenderContext());
    expect(child.appliedOpacities).toHaveLength(1);

    widget.dispose();

    // Re-initialize and apply — should re-resolve children and re-apply opacity
    const scene2 = new THREE.Scene();
    widget.initialize(makeInitContext({ scene: scene2, widgetId: 'v-dispose' }));
    widget.apply(state, makeRenderContext());
    expect(child.appliedOpacities).toHaveLength(2);
  });

  it('dispose() does not throw when called without initialize()', () => {
    const widget = new ViewWidget('v-noinit', () => undefined, () => null);
    expect(() => widget.dispose()).not.toThrow();
  });

  it('apply() does not throw before initialize()', () => {
    const widget = new ViewWidget('v-preinit', () => undefined, () => null);
    const state = makeViewState('v-preinit', FULL_BOUNDS);
    expect(() => widget.apply(state, makeRenderContext())).not.toThrow();
  });

  it('dispose() does not add or remove anything from scene', () => {
    const widget = new ViewWidget('v-scene-clean', () => undefined, () => null);
    widget.initialize(makeInitContext({ scene, widgetId: 'v-scene-clean' }));
    widget.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
