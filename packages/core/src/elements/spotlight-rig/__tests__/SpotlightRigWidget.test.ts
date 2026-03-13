// SpotlightRigWidget tests — interface-based stateful tests.
// Tests the widget contract: initialize, onTick, dispose. Asserts on Three.js objects in the cache.
// Does NOT invoke the Three.js halo texture path (document.createElement) — all test states use showHalo=false.

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { SpotlightRigWidget } from '../SpotlightRigWidget';
import type { SpotlightRigState, SpotlightLightState } from '../types';
import type { OrbitFn } from '../types';
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

/** Build a full SpotlightLightState with sensible test defaults. showHalo is false to avoid document calls. */
const makeLightState = (overrides: Partial<SpotlightLightState> = {}): SpotlightLightState => ({
  ...DEFAULT_SPOTLIGHT_RIG_THEME,
  phase: 0,
  target: null,
  showHalo: false,   // MUST stay false in node tests — avoids document.createElement
  haloOpacity: 0,
  ...overrides,
});

/**
 * Build a full SpotlightRigState with lights[].
 * @param lightOverrides - Array of per-light overrides. Length determines number of lights.
 * @param rigOverrides - Rig-level overrides (center, target, showHelper, etc.).
 */
const makeState = (
  lightOverrides: Partial<SpotlightLightState>[] = [{}],
  rigOverrides: Partial<Omit<SpotlightRigState, 'lights'>> = {},
): SpotlightRigState => ({
  center: [0, 0, 0],
  target: null,
  showHelper: false,
  enabled: true,
  lights: lightOverrides.map(makeLightState),
  ...rigOverrides,
});

/** Build a minimal AnimationTickContext for onTick(). */
const makeTickCtx = (
  state: SpotlightRigState | null,
  wallTimeSeconds = 0,
  sceneIndex = 0,
): AnimationTickContext => ({
  clock: { wallTimeSeconds, deltaSeconds: 0.016 },
  effectiveDeltaSeconds: 0.016,
  scene: new THREE.Scene(),
  variables: {} as never,
  tick: sceneIndex !== 0
    ? { index: 0, progress: 0, sceneId: 'test', sceneIndex, blockProgress: 0, state: {} as never, deltaForward: {}, deltaBackward: {} }
    : null,
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

  it('tickPriority is 10', () => {
    expect(widget.tickPriority).toBe(10);
  });

  it('IDslComposite.childDslComponents has one entry with displayName Spotlight and topLevelError=true', () => {
    expect(widget.childDslComponents).toHaveLength(1);
    expect(widget.childDslComponents[0]!.displayName).toBe('Spotlight');
    expect(widget.childDslComponents[0]!.topLevelError).toBe(true);
  });

  // ── onTick pool management ──────────────────────────────────────────────────

  it('onTick with enabled=false does not create entries in the cache', () => {
    const state = makeState([{}, {}, {}], { enabled: false });
    widget.onTick(makeTickCtx(state));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries).toHaveLength(0);
  });

  it('onTick with 3 lights creates 3 entries in the cache', () => {
    const state = makeState([{}, {}, {}]);
    widget.onTick(makeTickCtx(state));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries).toHaveLength(3);
  });

  it('onTick with 3 lights then 5 lights grows pool to 5', () => {
    widget.onTick(makeTickCtx(makeState([{}, {}, {}])));
    widget.onTick(makeTickCtx(makeState([{}, {}, {}, {}, {}])));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries).toHaveLength(5);
  });

  it('onTick with 5 lights then 2 lights shrinks pool to 2 and removes lights from scene', () => {
    widget.onTick(makeTickCtx(makeState([{}, {}, {}, {}, {}])));
    const cacheBefore = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    const removedEntry = cacheBefore.entries[4]!;

    widget.onTick(makeTickCtx(makeState([{}, {}])));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries).toHaveLength(2);
    // Removed light must not be in scene children
    expect(mockScene.children).not.toContain(removedEntry.light);
  });

  // ── showHelper toggle ───────────────────────────────────────────────────────

  it('showHelper toggle: onTick with showHelper=true creates a helper and adds it to scene', () => {
    widget.onTick(makeTickCtx(makeState([{}], { showHelper: true })));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    const entry = cache.entries[0]!;
    expect(entry.helper).not.toBeNull();
    expect(mockScene.children).toContain(entry.helper);
  });

  it('showHelper toggle: onTick with showHelper=true then showHelper=false removes and disposes helper', () => {
    widget.onTick(makeTickCtx(makeState([{}], { showHelper: true })));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    const helper = cache.entries[0]!.helper;

    widget.onTick(makeTickCtx(makeState([{}], { showHelper: false })));

    expect(cache.entries[0]!.helper).toBeNull();
    expect(mockScene.children).not.toContain(helper);
  });

  // ── dispose ─────────────────────────────────────────────────────────────────

  it('dispose removes all entries and clears orbit store', () => {
    const fn: OrbitFn = (t) => [t, 0, 0];
    widget.storeOrbitFn(0, 0, fn);
    widget.onTick(makeTickCtx(makeState([{}, {}, {}])));
    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');

    widget.dispose();

    // Cache entries cleared
    expect(cache.entries).toHaveLength(0);
    // Orbit store cleared
    expect(widget.getOrbitFns(0)).toHaveLength(0);
  });

  it('onTick after dispose does not throw and does not add to scene', () => {
    widget.onTick(makeTickCtx(makeState([{}, {}, {}])));

    widget.dispose();
    const countAfterDispose = mockScene.children.length;

    // No throw
    widget.onTick(makeTickCtx(makeState([{}, {}, {}])));

    // After dispose, onTick is a no-op — scene child count unchanged
    expect(mockScene.children.length).toBe(countAfterDispose);
  });

  // ── per-light properties ────────────────────────────────────────────────────

  it('castShadow toggle reads from lights[0].castShadow', () => {
    widget.onTick(makeTickCtx(makeState([{ castShadow: false }])));
    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries[0]!.light.castShadow).toBe(false);

    widget.onTick(makeTickCtx(makeState([{ castShadow: true }])));
    expect(cache.entries[0]!.light.castShadow).toBe(true);
  });

  it('showBeam=false reads from lights[0].showBeam: beam.visible===false', () => {
    widget.onTick(makeTickCtx(makeState([{ showBeam: false, beamOpacity: 0 }])));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    expect(cache.entries[0]!.beam.visible).toBe(false);
  });

  it('angle change on lights[0] triggers beam geometry rebuild', () => {
    const angle1 = Math.PI / 16;
    const angle2 = Math.PI / 8;

    widget.onTick(makeTickCtx(makeState([{ angle: angle1, showBeam: true, beamOpacity: 0.1 }])));
    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    const geoBefore = cache.entries[0]!.beam.geometry;

    widget.onTick(makeTickCtx(makeState([{ angle: angle2, showBeam: true, beamOpacity: 0.1 }])));
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
    const prev = makeState([{}, {}, {}], { center: [1, 2, 3], target: [0, 0, -4] });
    const merged = widget.mergeSnapshot(prev, undefined);
    expect(merged).toEqual(prev);
  });

  it('mergeSnapshot returns next when prev is undefined', () => {
    const next = makeState([{}, {}, {}]);
    const merged = widget.mergeSnapshot(undefined, next);
    expect(merged).toEqual(next);
  });

  it('mergeSnapshot shallow-merges next over prev', () => {
    const prev = makeState([{}, {}], { center: [1, 2, 3], target: [0, 0, -4] });
    const next = makeState([{}, {}, {}]);
    const merged = widget.mergeSnapshot(prev, next);
    // next's lights and fields win
    expect(merged?.lights).toHaveLength(3);
    expect(merged?.center).toEqual([0, 0, 0]);
    expect(merged?.target).toBeNull();
  });

  // ── Orbit function store ────────────────────────────────────────────────────

  it('storeOrbitFn and getOrbitFns: fn at index 0 is returned', () => {
    const fn: OrbitFn = (t) => [t, 0, 0];
    widget.storeOrbitFn(0, 0, fn);
    const result = widget.getOrbitFns(0);
    expect(result[0]).toBe(fn);
  });

  it('storeOrbitFn sparse: [fn0, undefined, fn2]', () => {
    const fn0: OrbitFn = (t) => [t, 0, 0];
    const fn2: OrbitFn = (t) => [0, t, 0];
    widget.storeOrbitFn(0, 0, fn0);
    widget.storeOrbitFn(0, 2, fn2);
    const result = widget.getOrbitFns(0);
    expect(result[0]).toBe(fn0);
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBe(fn2);
  });

  it('storeOrbitFn for scene 1 does not affect getOrbitFns(0)', () => {
    const fn: OrbitFn = (t) => [t, 0, 0];
    widget.storeOrbitFn(1, 0, fn);
    expect(widget.getOrbitFns(0)).toHaveLength(0);
  });

  it('after dispose, getOrbitFns(0) returns []', () => {
    const fn: OrbitFn = (t) => [t, 0, 0];
    widget.storeOrbitFn(0, 0, fn);
    widget.dispose();
    expect(widget.getOrbitFns(0)).toHaveLength(0);
  });

  // ── Orbit function render ────────────────────────────────────────────────────

  it('onTick with custom orbit fn: light position set to fn return + center offset', () => {
    const center: [number, number, number] = [1, 0, 2];
    const orbitResult: [number, number, number] = [3, 4, 5];
    const fn: OrbitFn = () => orbitResult;
    widget.storeOrbitFn(0, 0, fn);

    const state = makeState([{}], { center });
    widget.onTick(makeTickCtx(state));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    const pos = cache.entries[0]!.light.position;
    // Position = center + orbitResult
    expect(pos.x).toBeCloseTo(center[0] + orbitResult[0]);
    expect(pos.y).toBeCloseTo(center[1] + orbitResult[1]);
    expect(pos.z).toBeCloseTo(center[2] + orbitResult[2]);
  });

  it('onTick with no orbit fn: light positioned at circular orbit formula', () => {
    const speed = 0;  // speed=0 means position is purely phase-driven
    const phase = 0;  // theta = 0 * speed + 0 = 0
    const radius = 5;
    const height = 2;
    const state = makeState([{ speed, phase, radius, height }]);
    widget.onTick(makeTickCtx(state, 0));

    const cache = getOrCreateCache(mockScene as unknown as THREE.Scene, 'spotlight-rig');
    const pos = cache.entries[0]!.light.position;
    // theta = 0; sin(0)*5=0, height=2, cos(0)*5=5
    expect(pos.x).toBeCloseTo(0);
    expect(pos.y).toBeCloseTo(2);
    expect(pos.z).toBeCloseTo(5);
  });
});
