// SpotlightRigWidget tests — interface-based stateful tests.
// Tests the widget contract: initialize, onTick, dispose. Asserts on Three.js objects in the cache.
// Does NOT invoke the Three.js halo texture path (document.createElement) — all test states use showHalo=false.

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SpotlightRigWidget } from '../SpotlightRigWidget';
import type { SpotlightRigState } from '../types';
import { DEFAULT_SPOTLIGHT_RIG_THEME } from '../compile';
import { getOrCreateCache } from '../render';
import type { AnimationTickContext } from '../../../widget/types';

// ─── Test Helpers ──────────────────────────────────────────────────────────────

/**
 * Minimal mock scene for tests.
 * Three.js Scene works in node for object-graph operations, but we use a plain
 * object to avoid any WebGL dependency and to track add/remove calls exactly.
 */
class MockScene {
  readonly userData: Record<string, unknown> = {};
  readonly children: THREE.Object3D[] = [];

  add(obj: THREE.Object3D): this {
    if (!this.children.includes(obj)) this.children.push(obj);
    return this;
  }

  remove(obj: THREE.Object3D): this {
    const idx = this.children.indexOf(obj);
    if (idx !== -1) this.children.splice(idx, 1);
    return this;
  }
}

/** Build a full SpotlightRigState with sensible test defaults. showHalo is false to avoid document calls. */
const makeState = (overrides: Partial<SpotlightRigState> = {}): SpotlightRigState => ({
  ...DEFAULT_SPOTLIGHT_RIG_THEME,
  center: [0, 0, 0],
  target: null,
  count: 3,
  showHelper: false,
  enabled: true,
  showHalo: false,   // MUST stay false in node tests — avoids document.createElement
  haloOpacity: 0,
  ...overrides,
});

/** Build a minimal AnimationTickContext for onTick(). */
const makeTickCtx = (
  state: SpotlightRigState | null,
  wallTimeSeconds = 0,
): AnimationTickContext => ({
  clock: { wallTimeSeconds, deltaSeconds: 0.016 },
  effectiveDeltaSeconds: 0.016,
  scene: new THREE.Scene(),
  variables: {} as never,
  tick: null,
  track: null,
  resolvedState: state,
  cameraFocusTarget: null,
  cameraOverride: null,
  setCameraOverride: () => {},
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SpotlightRigWidget', () => {
  let widget: SpotlightRigWidget;
  let mockScene: MockScene;

  beforeEach(() => {
    widget = new SpotlightRigWidget('spotlight-rig');
    mockScene = new MockScene();
    widget.initialize({
      scene: mockScene as unknown as THREE.Scene,
      widgetId: 'spotlight-rig',
    });
  });

  it('has correct widgetId after construction', () => {
    expect(widget.widgetId).toBe('spotlight-rig');
  });

  it('defaultState has enabled=false', () => {
    expect(widget.defaultState.enabled).toBe(false);
  });

  it('defaultState has tickPriority=10', () => {
    expect(widget.tickPriority).toBe(10);
  });

  it('onTick with enabled=false does not create entries in the cache', () => {
    const state = makeState({ enabled: false });
    widget.onTick(makeTickCtx(state));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries).toHaveLength(0);
  });

  it('onTick with count=3 enabled=true creates 3 entries in the cache', () => {
    const state = makeState({ count: 3 });
    widget.onTick(makeTickCtx(state));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries).toHaveLength(3);
  });

  it('onTick with count=3 then count=5 grows pool to 5', () => {
    widget.onTick(makeTickCtx(makeState({ count: 3 })));
    widget.onTick(makeTickCtx(makeState({ count: 5 })));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries).toHaveLength(5);
  });

  it('onTick with count=5 then count=2 shrinks pool to 2 and adds removed lights', () => {
    widget.onTick(makeTickCtx(makeState({ count: 5 })));
    const cacheBefore = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    const removedEntry = cacheBefore.entries[4]!;

    widget.onTick(makeTickCtx(makeState({ count: 2 })));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries).toHaveLength(2);
    // Removed light must not be in scene children
    expect(mockScene.children).not.toContain(removedEntry.light);
  });

  it('onTick with showHelper=true creates a helper and adds it to scene', () => {
    widget.onTick(makeTickCtx(makeState({ count: 1, showHelper: true })));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    const entry = cache.entries[0]!;
    expect(entry.helper).not.toBeNull();
    expect(mockScene.children).toContain(entry.helper);
  });

  it('onTick with showHelper=true then showHelper=false removes and disposes helper', () => {
    widget.onTick(makeTickCtx(makeState({ count: 1, showHelper: true })));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    const helper = cache.entries[0]!.helper;

    widget.onTick(makeTickCtx(makeState({ count: 1, showHelper: false })));

    expect(cache.entries[0]!.helper).toBeNull();
    expect(mockScene.children).not.toContain(helper);
  });

  it('dispose removes all entries and nulls cache, scene not mutated after', () => {
    widget.onTick(makeTickCtx(makeState({ count: 3 })));
    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');

    widget.dispose();

    // Cache entries cleared
    expect(cache.entries).toHaveLength(0);
    // After dispose, further onTick calls should not throw
    expect(() => widget.onTick(makeTickCtx(makeState({ count: 3 })))).not.toThrow();
  });

  it('onTick after dispose does not throw and does not add to scene', () => {
    widget.onTick(makeTickCtx(makeState({ count: 3 })));
    const childCountBefore = mockScene.children.length;

    widget.dispose();
    const countAfterDispose = mockScene.children.length;

    // No throw
    widget.onTick(makeTickCtx(makeState({ count: 3 })));

    // After dispose, onTick is a no-op — scene child count unchanged
    expect(mockScene.children.length).toBe(countAfterDispose);
    expect(countAfterDispose).toBeLessThanOrEqual(childCountBefore);
  });

  it('castShadow toggle updates light.castShadow', () => {
    widget.onTick(makeTickCtx(makeState({ count: 1, castShadow: false })));
    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries[0]!.light.castShadow).toBe(false);

    widget.onTick(makeTickCtx(makeState({ count: 1, castShadow: true })));
    expect(cache.entries[0]!.light.castShadow).toBe(true);
  });

  it('showBeam=false results in beam.visible === false', () => {
    widget.onTick(makeTickCtx(makeState({ count: 1, showBeam: false, beamOpacity: 0 })));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries[0]!.beam.visible).toBe(false);
  });

  it('angle change triggers beam geometry rebuild (new geometry object reference)', () => {
    const angle1 = Math.PI / 16;
    const angle2 = Math.PI / 8;

    widget.onTick(makeTickCtx(makeState({ count: 1, angle: angle1, showBeam: true, beamOpacity: 0.1 })));
    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    const geoBefore = cache.entries[0]!.beam.geometry;

    widget.onTick(makeTickCtx(makeState({ count: 1, angle: angle2, showBeam: true, beamOpacity: 0.1 })));
    const geoAfter = cache.entries[0]!.beam.geometry;

    // Geometry should be a new object (disposed and rebuilt)
    expect(geoAfter).not.toBe(geoBefore);
    // New geometry fingerprint recorded
    expect(cache.entries[0]!.builtAngle).toBe(angle2);
  });

  // ── mergeSnapshot ──────────────────────────────────────────────────────────

  it('mergeSnapshot returns undefined when both inputs are undefined', () => {
    expect(widget.mergeSnapshot(undefined, undefined)).toBeUndefined();
  });

  it('mergeSnapshot returns prev when next is undefined (carry-forward)', () => {
    const prev = makeState({ count: 5, center: [1, 2, 3], target: [0, 0, -4] });
    const merged = widget.mergeSnapshot(prev, undefined);
    expect(merged).toEqual(prev);
  });

  it('mergeSnapshot returns next when prev is undefined', () => {
    const next = makeState({ count: 3 });
    const merged = widget.mergeSnapshot(undefined, next);
    expect(merged).toEqual(next);
  });

  it('mergeSnapshot shallow-merges next over prev', () => {
    const prev = makeState({ count: 5, center: [1, 2, 3], target: [0, 0, -4], speed: 0.5 });
    const next = makeState({ count: 7, speed: 1.2 });
    const merged = widget.mergeSnapshot(prev, next);
    expect(merged?.count).toBe(7);        // next wins
    expect(merged?.speed).toBe(1.2);      // next wins
    expect(merged?.center).toEqual([0, 0, 0]); // next's resolved default
    expect(merged?.target).toBeNull();    // next's resolved default
  });
});
