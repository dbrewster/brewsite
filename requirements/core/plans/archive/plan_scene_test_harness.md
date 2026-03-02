---
title: Scene Test Harness
doc_type: plan
owner: architecture
status: ready
updated: 2026-02-26
---

# Scene Test Harness

## Overview

This plan specifies a headless testing infrastructure that enables three distinct tiers of tests,
all running in a Node.js Vitest environment with no browser or WebGL context required.

**Test Tiers:**

| Tier | Input | Assert Surface | Use Case |
|---|---|---|---|
| 1 | Scene DSL (JSX) | Compiled `SceneTrack` widget state | "Did my scene compile the way I think?" |
| 2 | Pre-built `SceneTrack` | Three.js scene graph objects | "Does the renderer produce the right objects for known state?" |
| 3 | Scene DSL (JSX) | Both compiled state AND Three.js scene graph | "Full E2E smoke test" |

**Camera testing** is a first-class concern. A `TestableCameraWidget` provides a real
`THREE.PerspectiveCamera` seeded into the scene and records every applied `SceneCamera` state,
enabling assertions on both compiled camera state and resulting Three.js camera position/orientation.

---

## Architecture Constraints (Must Not Violate)

- `render.ts` files are NOT imported by test utilities in core — they belong to Three.js only.
- `TestableCameraWidget` re-implements camera descriptor math directly using `compile.ts` types only,
  avoiding `render.ts` and `camera-controls` (which requires DOM).
- `SceneTestHarness` lives in `packages/core/src/runtime/mocks/` — excluded from coverage and
  production builds per existing convention.
- `packages/diagram` depends on `@brewsite/core`, never the reverse.
- Three.js math/scene graph (`THREE.Scene`, `THREE.Group`, `THREE.Mesh`, `THREE.PerspectiveCamera`,
  materials, geometries) runs in Node.js without WebGL — this is the foundation.
- `troika-three-text` `sync()` requires WebGL; it is stubbed in diagram-package test setup.

---

## What Already Works (Do Not Duplicate)

- `packages/core/src/elements/__tests__/elementTestMocks.ts` already provides `makeInitContext()`,
  `makeRenderContext()`, `makeFakeDomElement()`, `makeFrameSlice()`. Reuse these.
- `packages/core/src/runtime/mocks/widgetMocks.ts` provides `createMockRenderable()`,
  `createMockSceneElementWidget()`, `createMockAnimationController()`. Reuse these.
- `packages/core/src/runtime/__tests__/RuntimeDriver.test.ts` already demonstrates
  `new THREE.Scene()` + `RuntimeDriverImpl` + manual `SceneTrack` construction working in Node.js.

---

## Key Facts Discovered During Design (Reference for Implementor)

- `CAMERA_KEY = '__brewsite_camera'` is a private string constant defined independently in
  `CameraWidget.ts` and `DiagramWidget.ts`. It is NOT exported. `TestableCameraWidget` must define
  this same literal string: `const CAMERA_KEY = '__brewsite_camera'`.
- `compileSceneTrack` takes `scenes: SceneDefinition[]` (not `SceneGroup`). Pass
  `sceneGroup.scenes` when providing a `SceneGroup`.
- `CompileSceneTrackOptions.blockSize` controls frames per transition block. Use `10` for tests.
- `WidgetRegistry.register(widget)` also side-effects into the global compiler node handler
  registry via `registerNode()`. Each test suite calling `registry.register(new DiagramWidget())`
  will register DSL handlers. Call `registerDiagramHandlers()` BEFORE creating a registry for
  diagram-involved tests — the registry's own `register()` call handles `<Camera>` and `<Diagram>`
  DSL routing automatically, but lower-level DSL primitives (`<DiagramNode>`, `<DiagramEdge>`,
  `<Exit>`, `<Enter>`) need `registerDiagramHandlers()` first.
- `VariableStore` is at `packages/core/src/widget/VariableStore.ts`.
- `CameraWidget` implements only `ISceneElement` + `IAnimationController` (NOT `IRenderable`).
  The camera is applied in `onTick()`, not `apply()`.
- `DiagramWidget` implements `ISceneElement` + `IRenderable` + `IAnimationController`
  (`tickPriority = 1`). `TestableCameraWidget` must use `tickPriority = 0` to run first and seed
  the camera into `scene.userData` before DiagramWidget's `onTick()` reads it.
- `applyCamera()` from `render.ts` imports `camera-controls` which needs DOM. Do NOT import it
  in test code. `TestableCameraWidget` implements camera descriptor math directly.
- `THREE.RGBELoader` (env map loading) fires async in `DiagramRenderer` on first `apply()` when
  `themeConfig.environment.envMapUrl !== null`. Tests must use `envMapUrl: null` via a test theme
  constant to suppress this. DiagramWidget does NOT implement `ILoadable`, so env map async errors
  surface as unhandled rejections, not driver errors.

---

## New Files to Create

### 1. `packages/core/src/runtime/mocks/SceneCompileHarness.ts`

**Responsibility:** Tier 1 only — headless DSL → compile → assert on `SceneTrack` state.
No Three.js. No widget rendering. Pure data.

```typescript
// packages/core/src/runtime/mocks/SceneCompileHarness.ts
// Tier 1 test harness: compile a SceneGroup and inspect the resulting SceneTrack.

import type { SceneDefinition } from '../../compiler/sceneTypes';
import type { SceneGroup } from '../../compiler/sceneTypes';
import type { SceneTrack, SceneTrackTick, SceneWindow } from '../../compiler/sceneTrackTypes';
import { compileSceneTrack } from '../../compiler/sceneTrackCompiler';
import { createSceneTrackSampler } from '../../compiler/sceneTrackSampler';
import type { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { ClipMeta } from '../../compiler/sceneTrackTypes';

export type CompileTestOptions = {
  /**
   * Frames per transition block. Smaller = faster tests.
   * Default: 10 (coarser than prod default but sufficient for state assertions).
   */
  blockSize?: number;
  clipMeta?: ClipMeta[];
};

export type CompileHarnessResult = {
  /** The full compiled SceneTrack. Inspect ticks[], sceneWindows[], transitionBlocks[]. */
  readonly track: SceneTrack;

  /**
   * Sample the compiled widget state for a specific widgetId at a given progress [0..1].
   * Evaluates functional transition closures (transitionBlocks) when present for the
   * sampled tick, then falls back to discrete tick state, then to undefined.
   * This is the primary Tier 1 assertion method.
   */
  getWidgetStateAt<T>(widgetId: string, progress: number): T | undefined;

  /**
   * Get the raw SceneTrackTick at a progress value [0..1].
   * Use this when you need the full tick (blockProgress, sceneId, sceneIndex, etc.).
   */
  sampleTick(progress: number): SceneTrackTick;

  /**
   * Get the SceneWindow for a scene by id.
   * Returns undefined if scene id not found.
   */
  getSceneWindow(sceneId: string): SceneWindow | undefined;

  /**
   * Get the discrete (non-functional) widget state from a specific tick.
   * Does NOT evaluate functional closures. Use getWidgetStateAt() for the resolved state.
   */
  getDiscreteWidgetState<T>(widgetId: string, progress: number): T | undefined;
};

/**
 * Compiles a SceneGroup or SceneDefinition array and returns a Tier 1 assertion surface.
 * No Three.js, no widget rendering — pure compilation pipeline.
 *
 * Prerequisites before calling in a test suite:
 *   - If the SceneGroup contains Diagram DSL: call registerDiagramHandlers() in beforeAll().
 *   - The widgetRegistry must have widget instances registered for all DSL components used.
 *
 * @example
 * ```typescript
 * const result = compileForTest(
 *   { id: 'test', scenes: [{ id: 's1', index: 0, getFrame: () => <MyScene /> }] },
 *   registry,
 * );
 * const state = result.getWidgetStateAt<DiagramState>('arch', 0.0);
 * expect(state?.nodes).toHaveLength(3);
 * ```
 */
export const compileForTest = (
  sceneGroupOrScenes: SceneGroup | SceneDefinition[],
  widgetRegistry: WidgetRegistry,
  options: CompileTestOptions = {},
): CompileHarnessResult => {
  const scenes = Array.isArray(sceneGroupOrScenes)
    ? sceneGroupOrScenes
    : sceneGroupOrScenes.scenes;

  const track = compileSceneTrack({
    scenes,
    widgetRegistry,
    blockSize: options.blockSize ?? 10,
    clipMeta: options.clipMeta ?? [],
  });

  const sampler = createSceneTrackSampler(track);

  const sampleTick = (progress: number): SceneTrackTick => sampler.sample(progress);

  const getWidgetStateAt = <T>(widgetId: string, progress: number): T | undefined => {
    const tick = sampleTick(progress);
    // Evaluate functional closure if present for this tick's block
    const functionalBlock = track.transitionBlocks?.find(
      (b) => b.blockIndex === tick.sceneIndex,
    );
    const fn = functionalBlock?.widgetFns[widgetId];
    if (fn) {
      return fn.fn(tick.blockProgress) as T;
    }
    return tick.state.widgets[widgetId] as T | undefined;
  };

  const getDiscreteWidgetState = <T>(widgetId: string, progress: number): T | undefined => {
    const tick = sampleTick(progress);
    return tick.state.widgets[widgetId] as T | undefined;
  };

  const getSceneWindow = (sceneId: string): SceneWindow | undefined =>
    track.sceneWindows.find((w) => w.id === sceneId);

  return { track, getWidgetStateAt, sampleTick, getSceneWindow, getDiscreteWidgetState };
};
```

---

### 2. `packages/core/src/runtime/mocks/TestableCameraWidget.ts`

**Responsibility:** A camera test double that:
- Implements `ISceneElement<SceneCamera>` + `IAnimationController` (same interfaces as real `CameraWidget`)
- Seeds `scene.userData['__brewsite_camera']` with a real `THREE.PerspectiveCamera` on first tick
- Resolves `SceneCamera` state from the tick/track (same logic as production)
- Applies `WorldSpaceCamera` and `OrbitCamera` descriptors directly to the Three.js camera
  using only inline math — NO import of `render.ts` or `camera-controls`
- Records every applied `SceneCamera` for Tier 1 assertions
- Exposes `camera: THREE.PerspectiveCamera` for position/orientation inspection

**IMPORTANT — descriptor coverage:**
- `WorldSpaceCamera`: fully supported (direct `camera.position` + `camera.lookAt`)
- `OrbitCamera`: fully supported (spherical → Cartesian conversion)
- `FitBotHeightCamera`: partially supported — applies position from target + distance only if
  `bonePositions` has the `targetId` entry; otherwise logs a warning and skips position update
- `FitFloorDepthCamera`: not supported in tests (iterative solver requires complex scene state);
  logs a warning and skips. Tests requiring floor-framing camera should use `WorldSpaceCamera`.

```typescript
// packages/core/src/runtime/mocks/TestableCameraWidget.ts
// Camera test double — no camera-controls, no render.ts, no DOM.

import * as THREE from 'three';
import type {
  ISceneElement,
  IAnimationController,
  AnimationTickContext,
} from '../../widget/types';
import type { SceneCamera, OrbitCamera, WorldSpaceCamera } from '../../elements/camera/types';
import {
  DEFAULT_CAMERA,
  functionalCameraTransitionSpec,
} from '../../elements/camera/compile';
import { Camera } from '../../elements/camera/dsl';
import type { SceneTrack, SceneTrackTick } from '../../compiler/sceneTrackTypes';

/** The shared userData key for the scene's active PerspectiveCamera. */
const CAMERA_KEY = '__brewsite_camera';

export type TestableCameraWidget = ISceneElement<SceneCamera> &
  IAnimationController & {
    /** The Three.js camera managed by this widget. Inspect position/rotation after tickAt(). */
    readonly camera: THREE.PerspectiveCamera;
    /** Every SceneCamera state applied via onTick(), in order. */
    readonly appliedStates: SceneCamera[];
    /** The last applied SceneCamera, or null if never ticked. */
    readonly lastAppliedState: SceneCamera | null;
  };

/**
 * Creates a testable camera widget that applies camera descriptor math directly to a
 * THREE.PerspectiveCamera without browser dependencies.
 *
 * Usage in tests:
 *   const cam = createTestableCameraWidget();
 *   registry.register(cam);
 *   // ... after tickAt(progress):
 *   expect(cam.appliedStates[0].descriptor.mode).toBe('world');
 *   expect(cam.camera.position.x).toBeCloseTo(0);
 */
export const createTestableCameraWidget = (
  camera?: THREE.PerspectiveCamera,
): TestableCameraWidget => {
  const _camera = camera ?? new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const appliedStates: SceneCamera[] = [];

  const resolveState = (
    tick: SceneTrackTick | null,
    track: SceneTrack | null | undefined,
  ): SceneCamera => {
    if (!tick) return DEFAULT_CAMERA;
    const functionalBlock = track?.transitionBlocks?.find(
      (b) => b.blockIndex === tick.sceneIndex,
    );
    const fn = functionalBlock?.widgetFns['camera'];
    if (fn) return fn.fn(tick.blockProgress) as SceneCamera;
    return (tick.state.widgets['camera'] as SceneCamera) ?? DEFAULT_CAMERA;
  };

  const applyDescriptor = (state: SceneCamera): void => {
    const desc = state.descriptor;

    if (desc.mode === 'world') {
      const d = desc as WorldSpaceCamera;
      _camera.position.set(d.position[0], d.position[1], d.position[2]);
      _camera.lookAt(d.target[0], d.target[1], d.target[2]);
    } else if (desc.mode === 'orbit') {
      const d = desc as OrbitCamera;
      const azimuth = d.azimuth ?? 0;
      const polar = d.polar ?? Math.PI / 4;
      const distance = d.distance ?? 10;
      const target = d.target ?? [0, 0, 0];
      // Spherical → Cartesian (Three.js convention: Y-up)
      const x = target[0] + distance * Math.sin(polar) * Math.sin(azimuth);
      const y = target[1] + distance * Math.cos(polar);
      const z = target[2] + distance * Math.sin(polar) * Math.cos(azimuth);
      _camera.position.set(x, y, z);
      _camera.lookAt(target[0], target[1], target[2]);
    } else if (desc.mode === 'fitBotHeight') {
      // Partial support: no bone positions in headless tests.
      // Position is not updated. Warn so test authors know.
      console.warn(
        '[TestableCameraWidget] fitBotHeight mode is not fully supported in headless tests. ' +
        'Camera position will not be updated. Use WorldSpaceCamera for position assertions.',
      );
    } else if (desc.mode === 'fitFloorDepth') {
      console.warn(
        '[TestableCameraWidget] fitFloorDepth mode is not supported in headless tests. ' +
        'Camera position will not be updated. Use WorldSpaceCamera for position assertions.',
      );
    }

    // Apply lens if provided
    if (state.lens) {
      if (state.lens.fov !== undefined) _camera.fov = state.lens.fov;
      if (state.lens.near !== undefined) _camera.near = state.lens.near;
      if (state.lens.far !== undefined) _camera.far = state.lens.far;
      _camera.updateProjectionMatrix();
    }
  };

  return {
    // ── IWidget ─────────────────────────────────────────────────────────────
    widgetId: 'camera',

    // ── ISceneElement<SceneCamera> ───────────────────────────────────────────
    defaultState: DEFAULT_CAMERA,
    transitionSpec: functionalCameraTransitionSpec,
    DslComponent: Camera,

    mergeSnapshot(
      prev: SceneCamera | undefined,
      next: SceneCamera | undefined,
    ): SceneCamera | undefined {
      if (!prev && !next) return undefined;
      return { ...prev, ...next } as SceneCamera;
    },

    // ── IAnimationController ─────────────────────────────────────────────────
    tickPriority: 0, // Must run before DiagramWidget (tickPriority 1)

    onTick(context: AnimationTickContext): void {
      // Seed camera into scene so DiagramWidget and others can find it
      context.scene.userData[CAMERA_KEY] = _camera;

      const state = resolveState(context.tick, context.track);
      applyDescriptor(state);
      appliedStates.push(state);
    },

    // ── Testable surface ─────────────────────────────────────────────────────
    get camera(): THREE.PerspectiveCamera { return _camera; },
    get appliedStates(): SceneCamera[] { return appliedStates; },
    get lastAppliedState(): SceneCamera | null {
      return appliedStates[appliedStates.length - 1] ?? null;
    },
  };
};
```

---

### 3. `packages/core/src/runtime/mocks/SceneTestHarness.ts`

**Responsibility:** Tiers 2 and 3 — wires compile → `RuntimeDriverImpl` → tick → Three.js scene
graph inspection. One class, two static factory methods.

**Lifecycle:**
1. `fromSceneGroup()` compiles the DSL, then creates a harness (Tier 3 — full E2E)
2. `fromTrack()` accepts a pre-built track, skips compilation (Tier 2)
3. Both factories: create `THREE.Scene`, call `driver.initialize()`, return a ready harness
4. `tickAt(progress)` drives `driver.tick()` at that progress value
5. Inspection methods walk the scene graph
6. `dispose()` cleans up all widgets and Three.js resources

```typescript
// packages/core/src/runtime/mocks/SceneTestHarness.ts
// Tier 2 + 3 test harness: compile + runtime + Three.js scene graph assertions.
// No browser, no WebGL required.

import * as THREE from 'three';
import type { SceneGroup } from '../../compiler/sceneTypes';
import type { SceneDefinition } from '../../compiler/sceneTypes';
import type { SceneTrack, SceneTrackTick } from '../../compiler/sceneTrackTypes';
import { compileForTest, type CompileHarnessResult, type CompileTestOptions } from './SceneCompileHarness';
import { RuntimeDriverImpl } from '../RuntimeDriver';
import { VariableStore } from '../../widget/VariableStore';
import type { WidgetRegistry } from '../../widget/WidgetRegistry';
import type { IRuntimeDriver } from '../types';
import type { SceneCamera } from '../../elements/camera/types';
import type { TestableCameraWidget } from './TestableCameraWidget';

const CAMERA_KEY = '__brewsite_camera';

export type SceneTestHarnessOptions = CompileTestOptions & {
  /**
   * Called after scene creation and BEFORE driver.initialize().
   * Use this to seed scene.userData or add test-specific Three.js objects.
   */
  beforeInitialize?: (scene: THREE.Scene) => void;
};

/**
 * The full test harness surface: compile state + scene graph inspection + camera.
 *
 * Obtain via:
 *   SceneTestHarness.fromSceneGroup(sceneGroup, registry)  // Tier 3 — DSL → render
 *   SceneTestHarness.fromTrack(track, registry)            // Tier 2 — compiled → render
 */
export class SceneTestHarness {
  /** The Three.js scene. Walk scene.children to inspect the object hierarchy. */
  readonly scene: THREE.Scene;
  /** The driver managing all widgets. Use getCurrentTick() to inspect tick state. */
  readonly driver: IRuntimeDriver;
  /** The compiled SceneTrack (available in Tier 3; provided by caller in Tier 2). */
  readonly track: SceneTrack;
  /**
   * Compile-layer assertion surface. Provides getWidgetStateAt(), sampleTick(), etc.
   * Available in Tier 3 only (null in Tier 2 unless also constructing from a SceneGroup).
   */
  readonly compile: CompileHarnessResult | null;

  private constructor(
    scene: THREE.Scene,
    driver: IRuntimeDriver,
    track: SceneTrack,
    compile: CompileHarnessResult | null,
  ) {
    this.scene = scene;
    this.driver = driver;
    this.track = track;
    this.compile = compile;
  }

  // ── Factory: Tier 3 — DSL → render (full E2E) ─────────────────────────────

  /**
   * Compiles a SceneGroup and initialises the runtime.
   * Use this for Tier 3 tests that verify the full pipeline.
   *
   * @example
   * ```typescript
   * const harness = await SceneTestHarness.fromSceneGroup(
   *   { id: 'test', scenes: [{ id: 's1', index: 0, getFrame: () => <MyScene /> }] },
   *   registry,
   * );
   * harness.tickAt(0.5);
   * const mesh = harness.findByName('node:api') as THREE.Mesh;
   * expect(mesh.visible).toBe(true);
   * ```
   */
  static async fromSceneGroup(
    sceneGroupOrScenes: SceneGroup | SceneDefinition[],
    widgetRegistry: WidgetRegistry,
    options: SceneTestHarnessOptions = {},
  ): Promise<SceneTestHarness> {
    const compile = compileForTest(sceneGroupOrScenes, widgetRegistry, options);
    return SceneTestHarness._build(compile.track, widgetRegistry, options, compile);
  }

  // ── Factory: Tier 2 — compiled track → render ─────────────────────────────

  /**
   * Accepts a pre-built SceneTrack and initialises the runtime.
   * Use this for Tier 2 tests that verify renderer behaviour for known state.
   *
   * @example
   * ```typescript
   * const track = buildKnownTrack(); // from a Tier 1 test or manual construction
   * const harness = await SceneTestHarness.fromTrack(track, registry);
   * harness.tickAt(0.0);
   * const meshes = harness.findByType(THREE.Mesh);
   * expect(meshes.length).toBeGreaterThan(0);
   * ```
   */
  static async fromTrack(
    track: SceneTrack,
    widgetRegistry: WidgetRegistry,
    options: SceneTestHarnessOptions = {},
  ): Promise<SceneTestHarness> {
    return SceneTestHarness._build(track, widgetRegistry, options, null);
  }

  // ── Internal builder ──────────────────────────────────────────────────────

  private static async _build(
    track: SceneTrack,
    widgetRegistry: WidgetRegistry,
    options: SceneTestHarnessOptions,
    compile: CompileHarnessResult | null,
  ): Promise<SceneTestHarness> {
    const scene = new THREE.Scene();
    const variableStore = new VariableStore();

    options.beforeInitialize?.(scene);

    const driver = new RuntimeDriverImpl({
      widgetRegistry,
      variableStore,
      manifest: null,
    });

    driver.setSceneTrack(track);
    await driver.initialize(scene);

    return new SceneTestHarness(scene, driver, track, compile);
  }

  // ── Drive the runtime ─────────────────────────────────────────────────────

  /**
   * Drives the runtime to a specific progress value [0..1].
   * Calls all IAnimationController.onTick() then all IRenderable.apply().
   * After this call, the Three.js scene reflects the state at that progress.
   *
   * @param progress Global progress in [0..1]
   * @param deltaSeconds Simulated frame delta. Defaults to 1/60 (~16ms).
   * @param wallTimeSeconds Simulated wall time. Defaults to progress * 10.
   */
  tickAt(
    progress: number,
    deltaSeconds = 1 / 60,
    wallTimeSeconds?: number,
  ): void {
    this.driver.tick({
      deltaSeconds,
      globalProgress: progress,
      wallTimeSeconds: wallTimeSeconds ?? progress * 10,
    });
  }

  /**
   * Drives the runtime through a range of progress values in equal steps.
   * Useful for verifying transitions and intermediate animation states.
   *
   * @param fromProgress Start progress [0..1]
   * @param toProgress End progress [0..1]
   * @param steps Number of tick calls (minimum 2)
   */
  tickRange(fromProgress: number, toProgress: number, steps: number): void {
    const count = Math.max(2, steps);
    for (let i = 0; i < count; i++) {
      const t = fromProgress + ((toProgress - fromProgress) * i) / (count - 1);
      this.tickAt(t);
    }
  }

  // ── Compile state inspection (Tier 1 bridge) ──────────────────────────────

  /**
   * Sample the compiled widget state at a given progress value.
   * Evaluates functional transition closures when present.
   * Only available when the harness was created via fromSceneGroup().
   * Throws if compile is null (Tier 2 — use harness.track directly).
   */
  getCompiledWidgetStateAt<T>(widgetId: string, progress: number): T | undefined {
    if (!this.compile) {
      throw new Error(
        'getCompiledWidgetStateAt() requires a SceneTestHarness created via fromSceneGroup(). ' +
        'For Tier 2 tests, use harness.track and createSceneTrackSampler() directly.',
      );
    }
    return this.compile.getWidgetStateAt<T>(widgetId, progress);
  }

  // ── Scene graph inspection ────────────────────────────────────────────────

  /**
   * Walk the full scene graph (depth-first) and return all objects matching predicate.
   * Includes the scene root's entire descendant hierarchy.
   */
  find(predicate: (obj: THREE.Object3D) => boolean): THREE.Object3D[] {
    const results: THREE.Object3D[] = [];
    this.scene.traverse((obj) => {
      if (predicate(obj)) results.push(obj);
    });
    return results;
  }

  /**
   * Return all objects of a specific Three.js constructor type.
   * @example harness.findByType(THREE.Mesh)
   * @example harness.findByType(THREE.DirectionalLight)
   */
  findByType<T extends THREE.Object3D>(
    ctor: new (...args: never[]) => T,
  ): T[] {
    return this.find((obj) => obj instanceof ctor) as T[];
  }

  /**
   * Find the first object with a matching name (exact string match).
   * Returns null if not found.
   */
  findByName(name: string): THREE.Object3D | null {
    return this.find((obj) => obj.name === name)[0] ?? null;
  }

  /**
   * Find all objects whose name matches a string pattern or RegExp.
   * @example harness.findAllByName(/^node:/)
   */
  findAllByName(pattern: string | RegExp): THREE.Object3D[] {
    if (typeof pattern === 'string') {
      return this.find((obj) => obj.name.includes(pattern));
    }
    return this.find((obj) => pattern.test(obj.name));
  }

  /**
   * Convenience: return all Mesh objects in the scene.
   * Equivalent to findByType(THREE.Mesh).
   */
  get meshes(): THREE.Mesh[] {
    return this.findByType(THREE.Mesh);
  }

  /**
   * Convenience: return all Group objects in the scene.
   */
  get groups(): THREE.Group[] {
    return this.findByType(THREE.Group);
  }

  // ── Camera inspection ─────────────────────────────────────────────────────

  /**
   * The Three.js PerspectiveCamera seeded by TestableCameraWidget.
   * Returns null if no camera widget is registered.
   * Inspect .position and .quaternion after tickAt() for camera positioning assertions.
   */
  get camera(): THREE.PerspectiveCamera | null {
    return (this.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera) ?? null;
  }

  /**
   * The last SceneCamera state applied by TestableCameraWidget.
   * Returns null if no TestableCameraWidget is registered, or if no ticks have run.
   * Use for Tier 1-style camera state assertions within a Tier 3 test.
   */
  get lastAppliedCameraState(): SceneCamera | null {
    const widgets = (this.driver as RuntimeDriverImpl).widgetRegistry?.getAll?.() ?? [];
    const cam = widgets.find(
      (w): w is TestableCameraWidget =>
        w.widgetId === 'camera' && 'appliedStates' in w,
    );
    return cam?.lastAppliedState ?? null;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  /**
   * Dispose all widgets and release Three.js resources.
   * Call in afterEach() to prevent resource leaks.
   */
  dispose(): void {
    this.driver.dispose();
  }
}
```

**Note for implementor:** `lastAppliedCameraState` accesses `widgetRegistry` on the `RuntimeDriverImpl`
instance. If `RuntimeDriverImpl` does not expose `widgetRegistry` publicly, either:
(a) add a `readonly widgetRegistry: WidgetRegistry` property to `RuntimeDriverImpl`, or
(b) use a module-level `WeakMap<IRuntimeDriver, WidgetRegistry>` populated in the `_build` factory.
Option (a) is preferred — it's a clean public field with no privacy concern.

---

### 4. `packages/core/src/runtime/mocks/index.ts` (MODIFY — additive only)

Add the following exports to the existing barrel:

```typescript
export { compileForTest } from './SceneCompileHarness';
export type { CompileHarnessResult, CompileTestOptions } from './SceneCompileHarness';
export { createTestableCameraWidget } from './TestableCameraWidget';
export type { TestableCameraWidget } from './TestableCameraWidget';
export { SceneTestHarness } from './SceneTestHarness';
export type { SceneTestHarnessOptions } from './SceneTestHarness';
```

---

### 5. `packages/diagram/src/testing/troikaStub.ts`

**Responsibility:** Provides `FakeText` (a `THREE.Object3D` subclass) and the vi.mock factory
for `troika-three-text`. Import this in test files that exercise `DiagramWidget` rendering.

`FakeText` must be testable with `instanceof` checks. It stores all properties that
`DiagramRenderer` writes so tests can assert on text content, size, position, and opacity.

```typescript
// packages/diagram/src/testing/troikaStub.ts
// Provides a mock for troika-three-text Text objects used in headless render tests.
// Import this module and call mockTroikaText() in each test file that creates DiagramWidgets.

import * as THREE from 'three';
import { vi } from 'vitest';

/**
 * A testable substitute for troika-three-text's Text class.
 * Extends THREE.Object3D so it can be added to scenes and traversed.
 * Settable properties mirror what DiagramRenderer reads/writes.
 */
export class FakeText extends THREE.Object3D {
  text: string = '';
  fontSize: number = 0.5;
  color: string | number = '#ffffff';
  fillOpacity: number = 1;
  outlineColor: string = '#000000';
  outlineBlur: number = 0;
  anchorX: string = 'center';
  anchorY: string = 'middle';
  maxWidth: number | undefined = undefined;
  textAlign: string = 'center';
  lineHeight: number | string = 'auto';
  letterSpacing: number = 0;
  font: string | undefined = undefined;

  /** No-op in tests — real impl triggers SDF font rendering (needs WebGL). */
  sync = vi.fn();
  /** No-op in tests. */
  dispose = vi.fn();
}

/**
 * Call this at the TOP of any test file that imports DiagramWidget or DiagramRenderer.
 * Must be called before the module under test is imported (Vitest hoisting handles this
 * when placed at the describe() or module scope, not inside beforeEach).
 *
 * @example
 * ```typescript
 * // At the top of your test file, before other imports from diagram:
 * import { mockTroikaText } from '@brewsite/diagram-testing';
 * mockTroikaText(); // hoisted by Vitest's vi.mock transformer
 * ```
 */
export const mockTroikaText = (): void => {
  vi.mock('troika-three-text', () => ({
    Text: FakeText,
    preloadFont: vi.fn(),
    getCaretAtPoint: vi.fn(),
  }));
};

/**
 * Module-level mock factory for use in vitest.config.ts setupFiles.
 * When configured as a setup file, the mock applies to ALL tests in the package.
 * This is the recommended approach for the diagram package.
 */
export const TROIKA_MOCK_FACTORY = () => ({
  Text: FakeText,
  preloadFont: vi.fn(),
  getCaretAtPoint: vi.fn(),
});
```

---

### 6. `packages/diagram/src/testing/index.ts`

Barrel for diagram test utilities. Keeps import paths clean.

```typescript
// packages/diagram/src/testing/index.ts
// Public test utility surface for the @brewsite/diagram package.
// Import from this barrel in diagram test files.

export { FakeText, mockTroikaText } from './troikaStub';
```

---

### 7. Vitest Setup File for Diagram Package: `packages/diagram/src/testing/vitest-setup.ts`

**Responsibility:** Global mock setup for the diagram Vitest environment. Applied to every test
in the package via `setupFiles` in `vitest.config.ts`.

```typescript
// packages/diagram/src/testing/vitest-setup.ts
// Applied globally to all diagram package tests via vitest.config setupFiles.
// Stubs out WebGL-dependent modules before any test code runs.

import * as THREE from 'three';
import { vi } from 'vitest';

// ── troika-three-text stub ────────────────────────────────────────────────────
// troika-three-text Text.sync() requires a WebGL context. Stub the whole module
// so DiagramRenderer can create Text objects without hanging or throwing.

class FakeText extends THREE.Object3D {
  text: string = '';
  fontSize: number = 0.5;
  color: string | number = '#ffffff';
  fillOpacity: number = 1;
  outlineColor: string = '#000000';
  outlineBlur: number = 0;
  anchorX: string = 'center';
  anchorY: string = 'middle';
  maxWidth: number | undefined = undefined;
  textAlign: string = 'center';
  lineHeight: number | string = 'auto';
  font: string | undefined = undefined;
  sync = vi.fn();
  dispose = vi.fn();
}

vi.mock('troika-three-text', () => ({
  Text: FakeText,
  preloadFont: vi.fn(),
  getCaretAtPoint: vi.fn(),
}));
```

**Note:** `vi.mock()` calls in setupFiles ARE hoisted by Vitest's transformer. This requires
`globals: true` in `vitest.config.ts`.

---

## Modified Files

### `packages/diagram/vitest.config.ts`

Add `globals: true` and `setupFiles` to the existing test config. These are additive changes only.

```typescript
// In the test: { ... } section, add:
test: {
  environment: 'node',
  globals: true,                                    // ADD: enables vi.mock() in setup files
  setupFiles: ['./src/testing/vitest-setup.ts'],    // ADD: troika stub applied globally
  include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  // ... coverage block unchanged ...
}
```

### `packages/diagram/vitest.config.ts` — alias addition

Add `@brewsite/core-testing` alias so diagram tests can import harness utilities cleanly:

```typescript
resolve: {
  alias: {
    '@brewsite/core': '../../packages/core/src/index.ts',
    '@brewsite/diagram': 'src/index.ts',
    '@brewsite/core-testing': '../../packages/core/src/runtime/mocks', // ADD
    '@brewsite/diagram-testing': 'src/testing',                        // ADD
  },
},
```

---

## Dependency Rules (Verify at Implementation Time)

Each new file must respect these import constraints:

| File | May Import | May NOT Import |
|---|---|---|
| `SceneCompileHarness.ts` | `../../compiler/*`, `../../widget/WidgetRegistry`, `../../widget/VariableStore` | Three.js, `render.ts`, React |
| `TestableCameraWidget.ts` | Three.js, `../../elements/camera/types`, `../../elements/camera/compile`, `../../elements/camera/dsl`, `../../widget/types`, `../../compiler/sceneTrackTypes` | `render.ts`, `camera-controls`, DOM |
| `SceneTestHarness.ts` | Three.js, `./SceneCompileHarness`, `./TestableCameraWidget`, `../RuntimeDriver`, `../../widget/*`, `../../compiler/*`, `../../elements/camera/types` | React-DOM, `render.ts` (except via RuntimeDriverImpl indirection) |
| `troikaStub.ts` | Three.js, vitest | troika-three-text (it's the mock target) |
| `vitest-setup.ts` | Three.js, vitest | anything from src (it runs first) |

---

## Test Tier Patterns (With Full Working Examples)

### Tier 1: DSL → Compile

**Purpose:** Assert that a scene DSL compiles to the expected widget state.
No Three.js, no rendering. Fast pure-function tests.

```typescript
// packages/diagram/src/elements/diagram/__tests__/compile-tier1.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { WidgetRegistry } from '@brewsite/core';
import { Scene } from '@brewsite/core';
import { Diagram, DiagramNode, DiagramEdge, DiagramWidget, registerDiagramHandlers } from '@brewsite/diagram';
import type { DiagramState } from '@brewsite/diagram';
import { compileForTest } from '@brewsite/core-testing';

// REQUIRED: registers DSL primitive handlers (<DiagramNode>, <DiagramEdge>, etc.)
// Must run once before any call to compileForTest() that includes Diagram DSL.
beforeAll(() => {
  registerDiagramHandlers();
});

describe('Diagram DSL → compile', () => {
  const makeRegistry = () => {
    const registry = new WidgetRegistry();
    registry.register(new DiagramWidget('arch'));
    return registry;
  };

  it('compiles two nodes into DiagramState', () => {
    const result = compileForTest(
      {
        id: 'test',
        scenes: [{
          id: 's1',
          index: 0,
          getFrame: () => (
            <Scene id="s1" index={0}>
              <Diagram id="arch">
                <DiagramNode id="api" label="API Gateway" position={[0, 0, 0]} size={[4, 2]} />
                <DiagramNode id="db"  label="Database"    position={[6, 0, 0]} size={[4, 2]} />
                <DiagramEdge from="api" to="db" />
              </Diagram>
            </Scene>
          ),
        }],
      },
      makeRegistry(),
    );

    const state = result.getWidgetStateAt<DiagramState>('arch', 0.0);
    expect(state).toBeDefined();
    expect(state!.nodes).toHaveLength(2);
    expect(state!.edges).toHaveLength(1);
    expect(state!.nodes[0].id).toBe('api');
    expect(state!.nodes[0].label).toBe('API Gateway');
  });

  it('scene windows have correct ids and ordering', () => {
    const result = compileForTest(
      {
        id: 'test',
        scenes: [
          { id: 's1', index: 0, getFrame: () => <Scene id="s1" index={0}><Diagram id="arch"><DiagramNode id="a" label="A" /></Diagram></Scene> },
          { id: 's2', index: 1, getFrame: () => <Scene id="s2" index={1}><Diagram id="arch"><DiagramNode id="b" label="B" /></Scene> },
        ],
      },
      makeRegistry(),
    );

    expect(result.getSceneWindow('s1')).toBeDefined();
    expect(result.getSceneWindow('s2')).toBeDefined();
    expect(result.getSceneWindow('s1')!.index).toBe(0);
    expect(result.getSceneWindow('s2')!.index).toBe(1);
  });

  it('interpolates node opacity during enter transition', () => {
    // With a two-scene track, progress=0.5 is mid-transition between s1 and s2.
    // The node that enters should have opacity interpolated between 0 and 1.
    const result = compileForTest(/* two-scene DSL */);
    const midState = result.getWidgetStateAt<DiagramState>('arch', 0.5);
    const enteringNode = midState!.nodes.find(n => n.id === 'newNode');
    expect(enteringNode!.opacity).toBeGreaterThan(0);
    expect(enteringNode!.opacity).toBeLessThan(1);
  });
});
```

### Tier 2: Compiled Track → Render

**Purpose:** Assert that the Three.js renderer produces the correct scene graph for a known,
pre-compiled state. Isolates renderer logic from DSL compilation.

```typescript
// packages/diagram/src/elements/diagram/__tests__/render-tier2.test.ts

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as THREE from 'three';
import { WidgetRegistry } from '@brewsite/core';
import { DiagramWidget, registerDiagramHandlers } from '@brewsite/diagram';
import type { DiagramState } from '@brewsite/diagram';
import { SceneTestHarness } from '@brewsite/core-testing';
import { createTestableCameraWidget } from '@brewsite/core-testing';

beforeAll(() => { registerDiagramHandlers(); });

describe('DiagramRenderer (compiled → render)', () => {
  let harness: SceneTestHarness;

  afterEach(() => harness?.dispose());

  it('creates a mesh for each node in the compiled state', async () => {
    // Build a known track manually (or from a Tier 1 result)
    const track = buildTestTrackWithTwoNodes(); // see helper below

    const registry = new WidgetRegistry();
    registry.register(createTestableCameraWidget());
    registry.register(new DiagramWidget('arch'));

    harness = await SceneTestHarness.fromTrack(track, registry);
    harness.tickAt(0.0);

    const meshes = harness.findByType(THREE.Mesh);
    // Expect at least 2 node meshes (one per node)
    expect(meshes.length).toBeGreaterThanOrEqual(2);
  });

  it('node mesh has the correct material opacity after full entry', async () => {
    const track = buildTestTrackWithTwoNodes();
    const registry = makeTestRegistry();

    harness = await SceneTestHarness.fromTrack(track, registry);
    harness.tickAt(1.0); // end of track — all elements fully entered

    const meshes = harness.findByType(THREE.Mesh);
    for (const mesh of meshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat && 'opacity' in mat) {
        expect(mat.opacity).toBeCloseTo(1.0);
      }
    }
  });

  it('diagram root group exists in scene', async () => {
    const track = buildTestTrackWithTwoNodes();
    harness = await SceneTestHarness.fromTrack(track, makeTestRegistry());
    harness.tickAt(0.0);

    const diagramGroup = harness.findByName('diagram:arch');
    expect(diagramGroup).not.toBeNull();
  });
});
```

### Tier 3: DSL → Render (E2E Smoke Test)

**Purpose:** Full pipeline test: author the DSL → compile → render → assert on both
compiled state and Three.js scene graph. Validates that the complete integration works.

```typescript
// packages/diagram/src/elements/diagram/__tests__/e2e-tier3.test.ts

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import React from 'react';
import * as THREE from 'three';
import { WidgetRegistry, Scene } from '@brewsite/core';
import { Diagram, DiagramNode, DiagramEdge, DiagramWidget, registerDiagramHandlers } from '@brewsite/diagram';
import type { DiagramState } from '@brewsite/diagram';
import { SceneTestHarness, createTestableCameraWidget } from '@brewsite/core-testing';

beforeAll(() => { registerDiagramHandlers(); });

describe('Diagram DSL → render (E2E)', () => {
  let harness: SceneTestHarness;

  afterEach(() => harness?.dispose());

  const makeRegistry = () => {
    const registry = new WidgetRegistry();
    registry.register(createTestableCameraWidget());
    registry.register(new DiagramWidget('arch'));
    return registry;
  };

  const makeTwoNodeGroup = () => ({
    id: 'test',
    scenes: [{
      id: 's1',
      index: 0,
      getFrame: () => (
        <Scene id="s1" index={0}>
          <Diagram id="arch" layout="manual">
            <DiagramNode id="api" label="API" position={[0, 0, 0]} size={[4, 2]} opacity={1} />
            <DiagramNode id="db"  label="DB"  position={[6, 0, 0]} size={[4, 2]} opacity={1} />
            <DiagramEdge from="api" to="db" />
          </Diagram>
        </Scene>
      ),
    }],
  });

  it('compiles two nodes and renders at least two meshes', async () => {
    harness = await SceneTestHarness.fromSceneGroup(makeTwoNodeGroup(), makeRegistry());
    harness.tickAt(0.0);

    // Tier 1 assertion: compiled state
    const compiled = harness.getCompiledWidgetStateAt<DiagramState>('arch', 0.0);
    expect(compiled!.nodes).toHaveLength(2);

    // Tier 3 assertion: rendered objects
    const meshes = harness.findByType(THREE.Mesh);
    expect(meshes.length).toBeGreaterThanOrEqual(2);
  });

  it('applies compiled node label to FakeText object', async () => {
    harness = await SceneTestHarness.fromSceneGroup(makeTwoNodeGroup(), makeRegistry());
    harness.tickAt(0.0);

    // FakeText is a THREE.Object3D — traverse finds it
    const textNodes = harness.find((obj) => 'text' in obj) as Array<{ text: string }>;
    const labels = textNodes.map((t) => t.text);
    expect(labels).toContain('API');
    expect(labels).toContain('DB');
  });
});
```

### Camera Tier: DSL → Compiled Camera State + Three.js Camera Position

**Purpose:** Verify that scene camera DSL compiles to the correct `SceneCamera` state AND
that `TestableCameraWidget` applies that state to the Three.js camera correctly.

```typescript
// packages/core/src/elements/camera/__tests__/camera-e2e.test.ts

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { WidgetRegistry, Scene } from '@brewsite/core';
import { Camera } from '@brewsite/core';
import { CameraWidget } from '@brewsite/core';
import type { SceneCamera } from '@brewsite/core';
import { SceneTestHarness, createTestableCameraWidget, compileForTest } from '@brewsite/core-testing';

const makeCameraScene = (position: [number, number, number], target: [number, number, number]) => ({
  id: 'test',
  scenes: [{
    id: 's1',
    index: 0,
    getFrame: () => (
      <Scene id="s1" index={0}>
        <Camera mode="world" x={position[0]} y={position[1]} z={position[2]}
                targetX={target[0]} targetY={target[1]} targetZ={target[2]} />
      </Scene>
    ),
  }],
});

describe('Camera DSL → compile + render', () => {
  let harness: SceneTestHarness;

  afterEach(() => harness?.dispose());

  it('compiles world-space camera to correct SceneCamera descriptor (Tier 1)', () => {
    const registry = new WidgetRegistry();
    registry.register(new CameraWidget()); // real widget for compile contracts

    const result = compileForTest(makeCameraScene([0, 5, 10], [0, 0, 0]), registry);
    const state = result.getWidgetStateAt<SceneCamera>('camera', 0.0);

    expect(state!.descriptor.mode).toBe('world');
    expect((state!.descriptor as WorldSpaceCamera).position).toEqual([0, 5, 10]);
    expect((state!.descriptor as WorldSpaceCamera).target).toEqual([0, 0, 0]);
  });

  it('applies world-space camera to Three.js PerspectiveCamera position (Tier 3)', async () => {
    const camWidget = createTestableCameraWidget();
    const registry = new WidgetRegistry();
    registry.register(camWidget);

    harness = await SceneTestHarness.fromSceneGroup(
      makeCameraScene([0, 5, 10], [0, 0, 0]),
      registry,
    );
    harness.tickAt(0.0);

    // Assert compiled state
    expect(camWidget.lastAppliedState!.descriptor.mode).toBe('world');

    // Assert Three.js camera position
    expect(harness.camera!.position.x).toBeCloseTo(0);
    expect(harness.camera!.position.y).toBeCloseTo(5);
    expect(harness.camera!.position.z).toBeCloseTo(10);
  });

  it('interpolates camera position during scene transition (mid-transition)', async () => {
    // Two scenes with different world-space camera positions
    const registry = new WidgetRegistry();
    const camWidget = createTestableCameraWidget();
    registry.register(camWidget);

    const twoSceneGroup = {
      id: 'test',
      scenes: [
        { id: 's1', index: 0, getFrame: () => <Scene id="s1" index={0}><Camera mode="world" x={0} y={5} z={10} targetX={0} targetY={0} targetZ={0} /></Scene> },
        { id: 's2', index: 1, getFrame: () => <Scene id="s2" index={1}><Camera mode="world" x={10} y={5} z={0} targetX={0} targetY={0} targetZ={0} /></Scene> },
      ],
    };

    harness = await SceneTestHarness.fromSceneGroup(twoSceneGroup, registry);

    // Mid-transition: camera X should be between 0 and 10
    harness.tickAt(0.5);
    expect(harness.camera!.position.x).toBeGreaterThan(0);
    expect(harness.camera!.position.x).toBeLessThan(10);
  });
});
```

---

## Implementation Sequence

Implement in this order. Each phase is independently testable before starting the next.

### Phase 1 — Core mocks (no diagram dependency)

1. **Create `TestableCameraWidget.ts`**
   - Implement `createTestableCameraWidget()` factory
   - Import only from `../../elements/camera/types`, `../../elements/camera/compile`,
     `../../elements/camera/dsl`, and `../../widget/types`
   - Add inline orbital math (no `render.ts`)
   - Verify: import in a test file that only imports Three.js and @brewsite/core — no errors

2. **Create `SceneCompileHarness.ts`**
   - Implement `compileForTest()` function
   - Verify: write a simple test with a mock widget that asserts on discrete state — passes

3. **Create `SceneTestHarness.ts`**
   - Add `readonly widgetRegistry: WidgetRegistry` to `RuntimeDriverImpl` if not already public
   - Implement `SceneTestHarness` class with both static factories
   - Verify: write a test using `createMockSceneElementWidget` (existing mock) — harness creates,
     ticks, and disposes without errors

4. **Update `packages/core/src/runtime/mocks/index.ts`**
   - Add the three new exports listed above

### Phase 2 — Diagram test infrastructure

5. **Create `packages/diagram/src/testing/vitest-setup.ts`**
   - Implement `FakeText` class extending `THREE.Object3D`
   - Install `vi.mock('troika-three-text', ...)`

6. **Modify `packages/diagram/vitest.config.ts`**
   - Add `globals: true`
   - Add `setupFiles: ['./src/testing/vitest-setup.ts']`
   - Add `@brewsite/core-testing` and `@brewsite/diagram-testing` aliases

7. **Create `packages/diagram/src/testing/index.ts`**
   - Barrel export for `FakeText`, `mockTroikaText`

### Phase 3 — Verification tests (harness self-tests)

8. **Write Tier 1 test** (diagram compile assertions)
   - Location: `packages/diagram/src/elements/diagram/__tests__/compile-tier1.test.ts`
   - Uses only `compileForTest()` — no Three.js
   - Tests: node count, edge count, scene windows, opacity interpolation

9. **Write Tier 3 test** (E2E diagram smoke test)
   - Location: `packages/diagram/src/elements/diagram/__tests__/render-e2e.test.ts`
   - Uses `SceneTestHarness.fromSceneGroup()`
   - Tests: mesh existence, FakeText content, camera position

10. **Write camera test**
    - Location: `packages/core/src/elements/camera/__tests__/camera-e2e.test.ts`
    - Tests: compiled camera state, Three.js camera position after tick

---

## Test Themes and Helpers

### Required Test Theme Constant

Create this in `packages/diagram/src/testing/index.ts` alongside the barrel exports.
Every diagram test that renders must use this theme to prevent RGBELoader from firing.

```typescript
import type { DiagramTheme } from '../elements/diagram/types';
import { darkGlassTheme } from '../elements/diagram/themes';

/**
 * A test-safe DiagramTheme that disables environment map loading.
 * Use this in test DSL via <Diagram theme={TEST_DIAGRAM_THEME} />.
 * Without it, THREE.RGBELoader will attempt a fetch() call in Node.js tests.
 */
export const TEST_DIAGRAM_THEME: DiagramTheme = {
  ...darkGlassTheme,
  environment: {
    ...darkGlassTheme.environment,
    envMapUrl: null,
  },
};
```

---

## Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| `FitBotHeightCamera` not fully applied in tests | Camera position not updated when mode is `fitBotHeight` | Use `WorldSpaceCamera` in tests that assert position |
| `FitFloorDepthCamera` not supported | Same | Use `WorldSpaceCamera` |
| `ModelWidget` / `EnvironmentWidget` not provided | Tests can't verify model rendering | Use `createMockRenderable()` or add a `TestableModelWidget` in a future phase |
| Env map loading fires if test theme not used | Unhandled promise rejections | Always pass `theme={TEST_DIAGRAM_THEME}` in diagram test DSL |
| `troika-three-text` `sync()` is a no-op | Text geometry not built; `textSize` etc. are defaults | FakeText properties are assertable; actual SDF layout is not |
| CAMERA_KEY is not exported from core | TestableCameraWidget and SceneTestHarness must redefine the string `'__brewsite_camera'` | Accept duplication, or export `CAMERA_KEY` from `packages/core/src/elements/camera/index.ts` as a future clean-up |

### Recommended Follow-Up Work

- Export `CAMERA_KEY` from `packages/core/src/elements/camera/index.ts` to eliminate the
  duplication in `TestableCameraWidget.ts`, `SceneTestHarness.ts`, and `DiagramWidget.ts`.
- Add `TestableModelWidget` when model rendering tests are needed (inject pre-built `THREE.Group`,
  implement `ISceneElement` + `IRenderable`, skip `ILoadable`).
- Add a `packages/core/src/testing.ts` public entry point and a `@brewsite/core/testing` alias
  in consuming packages so test utilities can be imported without deep relative paths.
- Add coverage for Tier 2/3 harness code to `vitest.config.ts` exclude lists (test utilities
  should not contribute to coverage metrics).

---

## Coverage Configuration Update

Add new test utility files to the coverage exclude list in both packages.

**`packages/core/vitest.config.ts`** — add to `coverage.exclude`:
```
'src/runtime/mocks/SceneTestHarness.ts',
'src/runtime/mocks/SceneCompileHarness.ts',
'src/runtime/mocks/TestableCameraWidget.ts',
```

**`packages/diagram/vitest.config.ts`** — add to `coverage.exclude`:
```
'src/testing/**',
```
