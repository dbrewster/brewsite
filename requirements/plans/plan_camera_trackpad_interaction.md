---
title: "Camera Trackpad/Mouse Interaction — Modifier-Key Model"
doc_type: plan
owner: brewflow-architect
status: ready-to-implement
updated: 2026-02-27
---

# Plan: Camera Trackpad/Mouse Interaction — Modifier-Key Model

## 1. Problem Diagnosis

The existing `CameraInteractionConfig` (in `types.ts`) maps camera actions to mouse **buttons**
(`left`, `middle`, `right`) via the `camera-controls` library's `mouseButtons` property. Two
problems make this non-functional:

1. **camera-controls v3.1.2 has no modifier-key bindings.** The `MouseButtons` interface only
   exposes `left`, `middle`, `right`, `wheel`. There is no `shiftLeft`, `ctrlLeft`, or `altLeft`
   property. Modifier-key combos require a custom event handler, not camera-controls config.

2. **The `CameraWidget` test file uses `vi.mock('../render')`**, which violates the
   interface-based stateful testing philosophy. The tests assert on which internal functions were
   called rather than on the observable contract of the widget.

## 2. Goals

1. **Modifier-key camera control**: one-finger drag (pointer-hold + move) with:
   - `Ctrl` = orbit/rotate around target
   - `Shift` = pan (truck — translate camera and target together)
   - `Alt` = dolly/zoom (change distance to target)
   - `Alt + wheel` = optional dolly via scroll wheel
2. **Proper abstraction**: extract camera interaction state machine behind a pure interface
   (`ICameraInteractionDriver`) so `CameraWidget` can be tested without Three.js or DOM mocks.
3. **No camera-controls mouseButtons wiring**: disable all built-in camera-controls input
   bindings; drive camera-controls programmatically via its `rotate()`, `truck()`, `dolly()` API.

## 3. Dependency Boundary Rules (unchanged)

```
types.ts   — No Three.js, no DOM imports (HTMLElement is a TS built-in, allowed)
dsl.tsx    — No Three.js
compile.ts — No Three.js, no React
render.ts  — Only file that imports Three.js / camera-controls
CameraWidget.ts — Bridges all layers; depends on types, compile, render
```

`ICameraInteractionDriver` lives in `types.ts` because it only references `Vec3`, `HTMLElement`
(built-in), and `TrackpadCameraConfig` (also in types.ts). The `cameraObject` parameter is
typed as `unknown` to avoid importing `THREE.PerspectiveCamera` from types.ts.

---

## 4. Files Changed

| File | Change |
|---|---|
| `packages/core/src/elements/camera/types.ts` | Add `TrackpadCameraConfig`, `ICameraInteractionDriver`, `CameraInteractionDriverFactory`; remove `CameraInteractionConfig`, `PointerAction` |
| `packages/core/src/elements/camera/render.ts` | Add `CameraControlsDriver` class; remove `createCameraControls`, `configureCameraControls` |
| `packages/core/src/elements/camera/CameraWidget.ts` | Refactor to depend on `ICameraInteractionDriver` via constructor-injected factory |
| `packages/core/src/elements/camera/dsl.tsx` | Change `interaction?: CameraInteractionConfig` to `interaction?: TrackpadCameraConfig` |
| `packages/core/src/elements/camera/compile.ts` | No logic change; `interaction` field in transition spec still passes through as-is |
| `packages/core/src/elements/camera/__tests__/CameraWidget.test.ts` | Full rewrite using `FakeInteractionDriver` test double; zero mocks |
| `packages/core/src/elements/camera/index.ts` | Export new types |

---

## 5. Type Contract Changes

### 5.1 Remove from `types.ts`

Delete the entire `PointerAction` type and `CameraInteractionConfig` type.

### 5.2 Add to `types.ts`

Add after the existing `CameraPost` block and before the existing transition types:

```typescript
// ─── Interactive Camera Control (Modifier-Key Model) ─────────────────────────

/**
 * Per-axis speed tuning for a camera interaction binding.
 * `speed` multiplies the pixel-to-world delta. Default 1.0.
 */
export type CameraAxisConfig = {
  /** Multiplier applied to pixel delta when computing the camera movement. Default 1.0. */
  speed?: number;
};

/**
 * Trackpad / mouse interaction configuration.
 *
 * Modifier-key bindings (all use left-button drag or one-finger trackpad drag):
 *   Ctrl  + drag → orbit (rotate around target)
 *   Shift + drag → pan   (translate camera + target in screen space)
 *   Alt   + drag → dolly (change distance to target)
 *
 * No modifier key held → drag does nothing (avoids conflicting with page scroll).
 */
export type TrackpadCameraConfig = {
  /** Whether interactive control is active for this scene. Default: false */
  enabled: boolean;

  /**
   * Ctrl + drag = orbit/rotate.
   * false disables this binding. Object form sets speed. Default: enabled.
   */
  rotate?: boolean | CameraAxisConfig;

  /**
   * Shift + drag = pan/truck (translate camera + target together).
   * false disables this binding. Object form sets speed. Default: enabled.
   */
  pan?: boolean | CameraAxisConfig;

  /**
   * Alt + drag = dolly/zoom (change distance to target).
   * false disables this binding. Object form sets speed. Default: enabled.
   */
  zoom?: boolean | CameraAxisConfig;

  /**
   * Alt + scroll wheel also dolly/zooms.
   * When true, the driver returns claimsWheel()=false — only Alt-modified
   * wheel events are intercepted; regular wheel still reaches scene navigation.
   * Default: false.
   */
  wheelZoom?: boolean;

  /**
   * Inertia/damping in seconds. Applies to all axes.
   * false = no inertia (instant response).
   * Default: 0.25s.
   */
  damping?: number | false;

  /** Minimum camera distance from target. */
  minDistance?: number;
  /** Maximum camera distance from target. */
  maxDistance?: number;
  /** Minimum polar angle (radians from top). Default 0. */
  minPolarAngle?: number;
  /** Maximum polar angle (radians from top). Default Math.PI. */
  maxPolarAngle?: number;

  /**
   * Keyboard shortcut to reset camera to scene-defined position.
   * false disables the reset shortcut.
   * Default: { key: 'r' }.
   */
  reset?: KeyCombo | false;

  /**
   * When true, camera smoothly resets to scene-defined position when the
   * scene index changes (user scrolls to a new scene). Default: true.
   */
  resetOnSceneChange?: boolean;
};

/**
 * Abstraction over camera interaction backends.
 * Production implementation: CameraControlsDriver (in render.ts, uses camera-controls).
 * Test implementation: FakeInteractionDriver (in __tests__/, plain class, no Three.js).
 *
 * The `cameraObject` parameter is typed as `unknown` to keep this interface free of
 * Three.js imports. Implementors cast to THREE.PerspectiveCamera internally.
 *
 * All methods take and return only plain types (Vec3, numbers, booleans, HTMLElement).
 */
export interface ICameraInteractionDriver {
  /**
   * Attach the driver to a camera and DOM element. Called once when entering
   * interaction mode. Implementations add their own event listeners here.
   */
  attach(cameraObject: unknown, domElement: HTMLElement, config: TrackpadCameraConfig): void;

  /**
   * Sync the driver's internal look-at state to world-space position and target.
   * Called when interaction mode is first entered (snap) and on smooth reset.
   * `smooth=false` → instant snap. `smooth=true` → animated glide.
   */
  setLookAt(position: Vec3, target: Vec3, smooth: boolean): void;

  /**
   * Advance the driver by deltaSeconds for damping/inertia computation.
   * Must be called every frame while interaction is active.
   * Returns true if the camera moved this frame (used for dirty-checking, optional).
   */
  update(deltaSeconds: number): boolean;

  /**
   * Apply new configuration (speeds, constraints, damping) without re-attaching.
   * Called every tick while interaction is active to pick up scene-state changes.
   */
  configure(config: TrackpadCameraConfig): void;

  /**
   * Returns true when this driver intends to claim ALL wheel events, suppressing
   * scene navigation. Used by useSceneEngine's wheelGuard.
   *
   * NOTE: When wheelZoom is false (default), this returns false. The driver still
   * handles Alt+wheel internally (since scene nav's modifiersMatch() ignores
   * modifier-held events by default), without claiming unmodified wheel.
   */
  claimsWheel(): boolean;

  /**
   * Detach all DOM listeners and release internal state.
   * Called when exiting interaction mode or when CameraWidget is disposed.
   */
  dispose(): void;
}

/**
 * Factory function that creates an ICameraInteractionDriver, attaches it, and returns it.
 * Injected into CameraWidget. Production default uses CameraControlsDriver from render.ts.
 * Tests inject a FakeInteractionDriver factory.
 */
export type CameraInteractionDriverFactory = (
  cameraObject: unknown,
  domElement: HTMLElement,
  config: TrackpadCameraConfig,
) => ICameraInteractionDriver;
```

### 5.3 Keep in `types.ts` unchanged

All existing types stay: `Vec3`, `MouseButton`, `ModifierKey`, `KeyCombo`,
all four `*Camera` descriptor types, `CameraPositionDescriptor`, `CameraLens`, `CameraPost`,
`DofConfig`, `EaseFnName`, `CameraTransitionInterpolation`, `SceneCamera`, `CameraOverrideState`.

### 5.4 Update `SceneCamera.interaction` field

```typescript
// Before:
interaction?: CameraInteractionConfig;

// After:
interaction?: TrackpadCameraConfig;
```

---

## 6. `render.ts` — Add `CameraControlsDriver`

Remove `createCameraControls` and `configureCameraControls` functions. Add the `CameraControlsDriver`
class. Keep `applyCamera`, `CameraRenderContext`, and all helper functions.

### 6.1 New exports from `render.ts`

```typescript
// Add at the top of render.ts:
import type { ICameraInteractionDriver, TrackpadCameraConfig, Vec3 } from './types';
```

### 6.2 `CameraControlsDriver` class (add to `render.ts`)

```typescript
/**
 * Production implementation of ICameraInteractionDriver using camera-controls.
 * Disables all built-in camera-controls input bindings and drives the library
 * programmatically via rotate(), truck(), dolly() based on modifier-key events.
 *
 * Modifier key → action mapping:
 *   Ctrl  + left drag → rotate(azimuth, polar)
 *   Shift + left drag → truck(x, y)  [pan in screen space]
 *   Alt   + left drag → dolly(delta) [change distance to target]
 *   Alt   + wheel     → dolly(delta) [when wheelZoom: true]
 */
export class CameraControlsDriver implements ICameraInteractionDriver {
  private cc: CameraControls | null = null;
  private domElement: HTMLElement | null = null;
  private config: TrackpadCameraConfig | null = null;

  // Drag tracking
  private dragState: {
    startX: number;
    startY: number;
    modifier: 'rotate' | 'pan' | 'zoom';
  } | null = null;

  // Bound event handlers (stored for cleanup)
  private readonly handlePointerDownBound: (e: PointerEvent) => void;
  private readonly handlePointerMoveBound: (e: PointerEvent) => void;
  private readonly handlePointerUpBound: (e: PointerEvent) => void;
  private readonly handleWheelBound: (e: WheelEvent) => void;

  constructor() {
    this.handlePointerDownBound = this.handlePointerDown.bind(this);
    this.handlePointerMoveBound = this.handlePointerMove.bind(this);
    this.handlePointerUpBound = this.handlePointerUp.bind(this);
    this.handleWheelBound = this.handleWheel.bind(this);
  }

  attach(cameraObject: unknown, domElement: HTMLElement, config: TrackpadCameraConfig): void {
    const camera = cameraObject as THREE.PerspectiveCamera;
    type CCCamera = ConstructorParameters<typeof CameraControls>[0];
    this.cc = new CameraControls(camera as unknown as CCCamera, domElement);
    this.domElement = domElement;
    this.config = config;

    // Disable ALL built-in camera-controls mouse/touch bindings.
    // We route pointer events to camera-controls' programmatic API ourselves.
    this.cc.mouseButtons.left = CameraControls.ACTION.NONE;
    this.cc.mouseButtons.right = CameraControls.ACTION.NONE;
    this.cc.mouseButtons.middle = CameraControls.ACTION.NONE;
    this.cc.mouseButtons.wheel = CameraControls.ACTION.NONE;
    this.cc.touches.one = CameraControls.ACTION.NONE;
    this.cc.touches.two = CameraControls.ACTION.NONE;
    this.cc.touches.three = CameraControls.ACTION.NONE;

    this.applyConfig(config);

    domElement.addEventListener('pointerdown', this.handlePointerDownBound);
    domElement.addEventListener('pointermove', this.handlePointerMoveBound);
    domElement.addEventListener('pointerup', this.handlePointerUpBound);
    domElement.addEventListener('pointercancel', this.handlePointerUpBound);
    domElement.addEventListener('wheel', this.handleWheelBound as EventListener, { passive: false });

    // Ensure pointer capture works
    domElement.style.touchAction = 'none';
  }

  setLookAt(position: Vec3, target: Vec3, smooth: boolean): void {
    this.cc?.setLookAt(
      position[0], position[1], position[2],
      target[0], target[1], target[2],
      smooth,
    );
  }

  update(deltaSeconds: number): boolean {
    return this.cc?.update(deltaSeconds) ?? false;
  }

  configure(config: TrackpadCameraConfig): void {
    this.config = config;
    if (this.cc) this.applyConfig(config);
  }

  claimsWheel(): boolean {
    // Return false: we only intercept Alt+wheel (which scene nav ignores anyway
    // because modifiersMatch() rejects events with unexpected modifiers held).
    // Return true only if the caller wants ALL wheel events claimed.
    return false;
  }

  dispose(): void {
    const el = this.domElement;
    if (el) {
      el.removeEventListener('pointerdown', this.handlePointerDownBound);
      el.removeEventListener('pointermove', this.handlePointerMoveBound);
      el.removeEventListener('pointerup', this.handlePointerUpBound);
      el.removeEventListener('pointercancel', this.handlePointerUpBound);
      el.removeEventListener('wheel', this.handleWheelBound as EventListener);
    }
    this.cc?.dispose();
    this.cc = null;
    this.domElement = null;
    this.dragState = null;
    this.config = null;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private applyConfig(config: TrackpadCameraConfig): void {
    const cc = this.cc;
    if (!cc) return;

    if (config.damping === false) {
      cc.smoothTime = 0;
      cc.draggingSmoothTime = 0;
    } else {
      const t = typeof config.damping === 'number' ? config.damping : 0.25;
      cc.smoothTime = t;
      cc.draggingSmoothTime = t * 0.5; // slightly snappier during drag
    }

    if (config.minDistance !== undefined) cc.minDistance = config.minDistance;
    if (config.maxDistance !== undefined) cc.maxDistance = config.maxDistance;
    if (config.minPolarAngle !== undefined) cc.minPolarAngle = config.minPolarAngle;
    if (config.maxPolarAngle !== undefined) cc.maxPolarAngle = config.maxPolarAngle;
  }

  private resolveModifier(
    e: PointerEvent,
    cfg: TrackpadCameraConfig,
  ): 'rotate' | 'pan' | 'zoom' | null {
    if (e.ctrlKey && cfg.rotate !== false) return 'rotate';
    if (e.shiftKey && cfg.pan !== false) return 'pan';
    if (e.altKey && cfg.zoom !== false) return 'zoom';
    return null;
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return; // Left button only
    const cfg = this.config;
    if (!cfg) return;

    const modifier = this.resolveModifier(e, cfg);
    if (!modifier) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture may throw in certain environments (e.g. jsdom); safe to ignore
    }
    this.dragState = { startX: e.clientX, startY: e.clientY, modifier };
    e.preventDefault();
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.dragState || !this.cc) return;
    const cfg = this.config!;

    const dx = e.clientX - this.dragState.startX;
    const dy = e.clientY - this.dragState.startY;
    // Update start each move for incremental delta (not absolute from drag-start)
    this.dragState.startX = e.clientX;
    this.dragState.startY = e.clientY;

    const w = this.domElement?.clientWidth ?? 800;
    const h = this.domElement?.clientHeight ?? 600;

    switch (this.dragState.modifier) {
      case 'rotate': {
        const speed = (cfg.rotate && typeof cfg.rotate === 'object' ? cfg.rotate.speed : undefined) ?? 1;
        // Full canvas-width drag = 2π azimuth, full canvas-height drag = π polar
        const azimuth = -(dx / w) * Math.PI * 2 * speed;
        const polar = -(dy / h) * Math.PI * speed;
        void this.cc.rotate(azimuth, polar, false);
        break;
      }
      case 'pan': {
        const speed = (cfg.pan && typeof cfg.pan === 'object' ? cfg.pan.speed : undefined) ?? 1;
        // Normalize to [0..1] range; camera-controls truck() takes world-space delta
        // relative to the current look-at distance. Using 0.01 * speed as a
        // proportional scale (tune per scene via speed).
        void this.cc.truck(-(dx / w) * speed, (dy / h) * speed, false);
        break;
      }
      case 'zoom': {
        const speed = (cfg.zoom && typeof cfg.zoom === 'object' ? cfg.zoom.speed : undefined) ?? 1;
        // Positive dy (drag down) = zoom out (increase distance)
        const delta = (dy / h) * 3 * speed;
        void this.cc.dolly(delta, false);
        break;
      }
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (this.dragState) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // safe to ignore
      }
      this.dragState = null;
    }
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.cc || !this.config?.wheelZoom) return;
    if (!e.altKey) return; // Alt+wheel only
    e.preventDefault();
    e.stopPropagation();
    const speed = (this.config.zoom && typeof this.config.zoom === 'object' ? this.config.zoom.speed : undefined) ?? 1;
    const delta = (e.deltaY / 100) * speed;
    void this.cc.dolly(delta, false);
  }
}
```

---

## 7. `CameraWidget.ts` — Refactor

### 7.1 Constructor signature

```typescript
export class CameraWidget implements ISceneElement<SceneCamera>, IAnimationController {
  readonly widgetId = 'camera';
  readonly defaultState: SceneCamera = DEFAULT_CAMERA;
  readonly transitionSpec = functionalCameraTransitionSpec;
  readonly DslComponent = Camera;
  readonly useDefaultStateWhenAbsent = false;

  constructor(
    /**
     * Factory that creates an ICameraInteractionDriver, attaches it, and returns it.
     * Defaults to creating a CameraControlsDriver (production implementation).
     * Inject a FakeInteractionDriver factory in tests.
     */
    private readonly driverFactory: CameraInteractionDriverFactory = defaultDriverFactory,
  ) {}
```

### 7.2 Private fields (replace old camera-controls fields)

```typescript
  // ─── Renderer / DOM references (lazy-init from scene.userData) ──────────
  private domElement: HTMLElement | null = null;
  private rendererRef: THREE.WebGLRenderer | null = null;

  // ─── Interaction driver lifecycle ────────────────────────────────────────
  private driver: ICameraInteractionDriver | null = null;
  private isInteractionActive = false;
  private savedSceneState: SceneCamera | null = null;

  // ─── Scene change tracking ───────────────────────────────────────────────
  private lastSceneIndex = -1;

  // ─── Camera reference for reset fallback ────────────────────────────────
  private cameraRef: THREE.PerspectiveCamera | null = null;
  private lastTick: SceneTrackTick | null = null;

  // ─── Keyboard/context-menu listeners ────────────────────────────────────
  private resetKeyListener: ((e: KeyboardEvent) => void) | null = null;
  private contextMenuListener: ((e: MouseEvent) => void) | null = null;
```

### 7.3 `onTick` method (full replacement)

```typescript
  onTick(context: AnimationTickContext): void {
    const tick = context.tick;
    if (!tick) return;

    const camera = context.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!camera) return;
    this.cameraRef = camera;
    this.lastTick = tick;

    // Lazy-init DOM element + renderer from scene.userData (not available at construction)
    if (!this.domElement) {
      const renderer = context.scene.userData[RENDERER_KEY] as THREE.WebGLRenderer | undefined;
      if (renderer) {
        this.domElement = renderer.domElement;
        this.rendererRef = renderer;
      }
    }

    // Override path: bypass scene-driven + interactive camera
    const override = context.scene.userData[CAMERA_OVERRIDE_KEY] as CameraOverrideState | undefined;
    if (override?.enabled) {
      if (this.isInteractionActive) this.exitInteractionMode();
      applyCamera(
        {
          enabled: true,
          descriptor: { mode: 'world', position: override.position, target: override.target, up: override.up },
          lens: { fov: override.fov, near: override.near, far: override.far },
          post: override.exposure !== undefined ? { exposure: override.exposure } : undefined,
        },
        { camera, tick, renderer: this.rendererRef ?? undefined },
      );
      return;
    }

    // Resolve current scene camera state from functional block or pre-baked tick
    const functionalBlock = context.track?.transitionBlocks?.[tick.sceneIndex];
    const functionalWidget = functionalBlock?.widgetFns[this.widgetId];
    const state = functionalWidget
      ? (functionalWidget.fn(tick.blockProgress) as SceneCamera)
      : ((tick.state.widgets[this.widgetId] as SceneCamera | undefined) ?? this.defaultState);

    const wantsInteraction = state.interaction?.enabled === true;

    // Seed camera position before camera-controls takes over (prevents zero-distance orbit)
    if (wantsInteraction && !this.isInteractionActive) {
      applyCamera({ ...state, enabled: true }, { camera, tick, renderer: this.rendererRef ?? undefined });
      this.enterInteractionMode(state, camera, tick);
    } else if (!wantsInteraction && this.isInteractionActive) {
      this.exitInteractionMode();
    }

    if (this.isInteractionActive && this.driver) {
      // Re-configure each tick so scene-state changes (speeds, constraints) propagate live
      if (state.interaction) this.driver.configure(state.interaction);

      // Smooth reset when user navigates to a different scene
      if (tick.sceneIndex !== this.lastSceneIndex && this.lastSceneIndex !== -1) {
        this.savedSceneState = state;
        if (state.interaction?.resetOnSceneChange !== false) {
          const pos = this.resolveWorldPos(state, camera, tick);
          if (pos) this.driver.setLookAt(pos.position, pos.target, true);
        }
      }
      this.lastSceneIndex = tick.sceneIndex;
      this.driver.update(context.deltaSeconds);
      return;
    }

    this.lastSceneIndex = tick.sceneIndex;

    // Scene-driven: apply compiled camera state each tick
    applyCamera(state, { camera, tick, renderer: this.rendererRef ?? undefined });
  }
```

### 7.4 `dispose()` method

```typescript
  dispose(): void {
    this.exitInteractionMode();
    this.domElement = null;
    this.rendererRef = null;
  }
```

### 7.5 `isWheelClaimedByInteraction()` method

```typescript
  isWheelClaimedByInteraction(): boolean {
    if (!this.isInteractionActive || !this.driver) return false;
    return this.driver.claimsWheel();
  }
```

### 7.6 `enterInteractionMode` (private)

```typescript
  private enterInteractionMode(
    state: SceneCamera,
    camera: THREE.PerspectiveCamera,
    tick: SceneTrackTick,
  ): void {
    if (!this.domElement || !state.interaction) return;

    // Create and attach the driver
    this.driver = this.driverFactory(camera, this.domElement, state.interaction);

    // Sync driver's internal look-at to scene-defined position
    const pos = extractWorldPosFromDescriptor(state.descriptor)
      ?? this.resolveWorldPos(state, camera, tick);
    if (pos) {
      this.driver.setLookAt(pos.position, pos.target, false);
      this.driver.update(0);
    }

    this.savedSceneState = state;
    this.isInteractionActive = true;

    // Prevent native context menu on right-click (no longer used for pan, but keeps UX clean)
    this.contextMenuListener = (e: MouseEvent) => e.preventDefault();
    this.domElement.addEventListener('contextmenu', this.contextMenuListener);

    // Keyboard reset shortcut
    const resetCombo = state.interaction.reset;
    if (resetCombo !== false) {
      const combo = resetCombo ?? { key: 'r' };
      this.resetKeyListener = (e: KeyboardEvent) => {
        if (e.key !== combo.key) return;
        const mods = combo.modifiers ?? [];
        const ok =
          (!mods.includes('alt')   || e.altKey) &&
          (!mods.includes('ctrl')  || e.ctrlKey) &&
          (!mods.includes('meta')  || e.metaKey) &&
          (!mods.includes('shift') || e.shiftKey);
        if (!ok) return;
        e.preventDefault();
        if (this.savedSceneState) {
          const cam = this.cameraRef;
          const t = this.lastTick ?? undefined;
          const p = extractWorldPosFromDescriptor(this.savedSceneState.descriptor)
            ?? (cam && t ? this.resolveWorldPos(this.savedSceneState, cam, t) : null);
          if (p) this.driver?.setLookAt(p.position, p.target, true);
        }
      };
      this.domElement.addEventListener('keydown', this.resetKeyListener);
    }
  }
```

### 7.7 `exitInteractionMode` (private)

```typescript
  private exitInteractionMode(): void {
    if (this.resetKeyListener && this.domElement) {
      this.domElement.removeEventListener('keydown', this.resetKeyListener);
      this.resetKeyListener = null;
    }
    if (this.contextMenuListener && this.domElement) {
      this.domElement.removeEventListener('contextmenu', this.contextMenuListener);
      this.contextMenuListener = null;
    }
    this.driver?.dispose();
    this.driver = null;
    this.isInteractionActive = false;
    this.savedSceneState = null;
    this.lastSceneIndex = -1;
  }
```

### 7.8 `resolveWorldPos` helper (replaces the old `resolveCameraLookAt`)

```typescript
  /**
   * Resolves a world-space {position, target} for modes that cannot be derived
   * from the descriptor alone (fitBotHeight, fitFloorDepth).
   * For world/orbit modes, use extractWorldPosFromDescriptor() instead.
   */
  private resolveWorldPos(
    state: SceneCamera,
    camera: THREE.PerspectiveCamera,
    tick?: SceneTrackTick,
  ): { position: Vec3; target: Vec3 } | null {
    const d = state.descriptor;
    if (d.mode === 'fitFloorDepth') {
      const lookAtZ = d.lookAtZ ?? (d.floorZMin + d.floorZMax) / 2;
      const cameraX = d.cameraX ?? 0;
      return {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [cameraX, d.floorY, lookAtZ],
      };
    }
    if (d.mode === 'fitBotHeight') {
      if (!tick) return null;
      const raw = tick.state.widgets[d.targetId] as SceneModelInstanceState | undefined;
      const targetPos = raw?.model?.position;
      if (!targetPos) return null;
      return {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: targetPos,
      };
    }
    return null;
  }
```

### 7.9 Default driver factory (module-level constant)

```typescript
// Module-level default factory — avoids importing CameraControlsDriver at types.ts level.
// CameraControlsDriver lives in render.ts and is only imported here (CameraWidget.ts).
import { applyCamera, CameraControlsDriver } from './render';

const defaultDriverFactory: CameraInteractionDriverFactory = (cameraObject, domElement, config) => {
  const driver = new CameraControlsDriver();
  driver.attach(cameraObject, domElement, config);
  return driver;
};
```

### 7.10 Remove from imports

Remove: `import { ... createCameraControls, configureCameraControls } from './render';`
Add: `import { applyCamera, CameraControlsDriver } from './render';`

---

## 8. `dsl.tsx` — Update `interaction` type

```typescript
// Before:
import type { ..., CameraInteractionConfig, ... } from './types';
// ...
interaction?: CameraInteractionConfig;

// After:
import type { ..., TrackpadCameraConfig, ... } from './types';
// ...
interaction?: TrackpadCameraConfig;
```

---

## 9. `compile.ts` — No logic changes required

The `functionalCameraTransitionSpec` references `state.interaction` as a passthrough:
```typescript
interaction: t < 0.5 ? from.interaction : to.interaction,
```
This works unchanged because `TrackpadCameraConfig` has the same `enabled` boolean shape as
the old type. No interpolation is performed on interaction config; it switches at the midpoint.

---

## 10. `index.ts` — Export new public types

```typescript
// Add to existing re-exports:
export type { TrackpadCameraConfig, ICameraInteractionDriver, CameraInteractionDriverFactory } from './types';
// Remove from re-exports (if previously exported):
// CameraInteractionConfig, PointerAction
```

---

## 11. Test File: `__tests__/CameraWidget.test.ts` (complete rewrite)

**Environment:** `@vitest-environment jsdom`

**Test double:**

```typescript
// FakeInteractionDriver — implements ICameraInteractionDriver contract.
// No Three.js, no DOM event manipulation, no spies.
// Records method calls and stores the last setLookAt position/target.
class FakeInteractionDriver implements ICameraInteractionDriver {
  readonly calls: string[] = [];
  position: Vec3 = [0, 0, 0];
  target: Vec3 = [0, 0, 0];
  private _claimsWheel = false;

  attach(_cam: unknown, _el: HTMLElement, _config: TrackpadCameraConfig): void {
    this.calls.push('attach');
  }
  setLookAt(position: Vec3, target: Vec3, smooth: boolean): void {
    this.calls.push(smooth ? 'setLookAt:smooth' : 'setLookAt:snap');
    this.position = position;
    this.target = target;
  }
  update(_dt: number): boolean {
    this.calls.push('update');
    return false;
  }
  configure(_config: TrackpadCameraConfig): void {
    this.calls.push('configure');
  }
  claimsWheel(): boolean {
    return this._claimsWheel;
  }
  setWheelClaim(v: boolean): void {
    this._claimsWheel = v;
  }
  dispose(): void {
    this.calls.push('dispose');
  }
}
```

**Test setup helpers:**

```typescript
const makeCamera = (): THREE.PerspectiveCamera =>
  new THREE.PerspectiveCamera(45, 1, 0.1, 2000);

const makeScene = (camera: THREE.PerspectiveCamera): THREE.Scene =>
  ({
    userData: {
      __brewsite_camera: camera,
      __brewsite_renderer: { domElement: document.createElement('div') },
    },
  } as unknown as THREE.Scene);

const makeTick = (
  sceneIndex: number,
  widgets: Record<string, unknown> = {},
): SceneTrackTick =>
  ({ sceneIndex, blockProgress: 0, state: { widgets } } as never);

const makeCameraState = (
  interactionEnabled: boolean,
  overrides: Partial<TrackpadCameraConfig> = {},
): SceneCamera => ({
  enabled: true,
  descriptor: { mode: 'world', position: [1, 2, 3], target: [0, 0, 0] },
  interaction: { enabled: interactionEnabled, ...overrides } as TrackpadCameraConfig,
});

const makeTickCtx = (
  tick: SceneTrackTick,
  scene: THREE.Scene,
): AnimationTickContext => ({
  tick,
  scene,
  track: undefined,
  deltaSeconds: 0.016,
  wallTimeSeconds: 0,
  variables: {} as never,
});
```

**Test cases:**

```
1. CUSTOM_NODE_HANDLER maps world props → descriptor (no change from existing test)
2. CUSTOM_NODE_HANDLER maps orbit props → descriptor
3. CUSTOM_NODE_HANDLER maps fitFloorDepth props → descriptor
4. CUSTOM_NODE_HANDLER maps fitBotHeight props → descriptor
5. mergeSnapshot merges same-mode descriptors
6. mergeSnapshot uses next descriptor when mode changes

7. [interaction=false] driver factory is NOT called; applyCamera path runs
8. [interaction=true, first tick] factory is called once; attach + setLookAt:snap + configure + update
9. [interaction=true, 3 ticks] driver.update called 3 times; driver.attach called 1 time
10. [interaction=true then false] driver.dispose called when disabled
11. [scene change, resetOnSceneChange default] setLookAt:smooth called when sceneIndex changes
12. [scene change, resetOnSceneChange=false] setLookAt:smooth NOT called
13. [isWheelClaimedByInteraction, inactive] returns false
14. [isWheelClaimedByInteraction, active, claimsWheel=true] returns true
15. [isWheelClaimedByInteraction, active, claimsWheel=false] returns false
16. [dispose while active] driver.dispose called
17. [camera override] interaction mode exited; applyCamera called with override values
```

All tests: no `vi.mock`, no spy assertions on internal render functions. Pure state-machine
contract testing against observable output via `fake.calls` and `fake.position/target`.

---

## 12. `CameraControlsDriver` Unit Tests (optional, in `__tests__/render.test.ts`)

These are harder to unit-test since they require a DOM and Three.js camera. They should be
**integration tests**: create a real `CameraControlsDriver`, dispatch real pointer events,
assert camera position changed. Mark with `@vitest-environment jsdom`.

Key tests:
- `attach` + `update(0)` does not throw
- Ctrl+pointerdown + pointermove with dx>0 → `cc.rotate` was called (observable via camera position change after update)
- Shift+pointerdown + pointermove → camera translated
- Alt+pointerdown + pointermove → camera distance changed
- `dispose` removes all event listeners (capture counter pattern)

These tests live in the existing `__tests__/render.test.ts` and should be additive.

---

## 13. Scene Author Usage Example

```tsx
// In a scene file (no Three.js, no animation logic):
<Camera
  mode="world"
  position={[5, 8, 20]}
  target={[0, 2, 0]}
  fov={55}
  interaction={{
    enabled: true,
    rotate: { speed: 1.2 },    // Ctrl + drag = orbit (slightly faster)
    pan: { speed: 0.8 },       // Shift + drag = pan (slightly slower)
    zoom: true,                // Alt + drag = dolly (default speed)
    wheelZoom: false,          // Alt + wheel = dolly disabled (scene nav owns wheel)
    damping: 0.3,              // slightly more inertia than default 0.25s
    minDistance: 3,
    maxDistance: 50,
    reset: { key: 'r' },       // press R to snap back to scene-defined position
    resetOnSceneChange: true,  // smooth glide back when scrolling to next scene
  }}
/>
```

---

## 14. Interaction Behavior Notes

### Wheel event routing
- **Unmodified wheel** → `modifiersMatch(e, undefined)` returns false (modifier held check) in
  InputController → scene navigation **skips** → camera driver's wheel handler checks `e.altKey`
  → false → **nothing happens**. Regular unmodified wheel reaches scene navigation normally.
- **Alt + wheel** → InputController's `modifiersMatch(e, undefined)` returns false (alt is held)
  → scene navigation skips → camera driver's `handleWheel` checks `e.altKey` → true →
  dolly applied. No scene navigation.
- `claimsWheel()` always returns false in the new design (we don't need to claim all wheel events).

### No-modifier drag
- When no modifier key is held, `resolveModifier()` returns null → `handlePointerDown` returns
  early → camera does NOT respond → the drag falls through to other handlers (e.g. scene
  navigation's drag config if configured, or nothing).

### Touch
- One-finger touch on mobile: generates `pointerdown` + `pointermove` events, which `CameraControlsDriver`
  listens to. With modifier key (e.g. Shift+touch on hardware keyboard): pan works.
- Two-finger pinch: generates touch events but NOT captured by `CameraControlsDriver`. If the
  scene needs two-finger zoom, it can be added later via `touchstart`/`touchmove` handlers.

### Preventing ctrl+click browser zoom (macOS)
- On macOS, `Ctrl+click` opens a context menu. The existing `contextMenuListener` in CameraWidget
  calls `e.preventDefault()` on all `contextmenu` events while interaction is active, suppressing this.
- `e.preventDefault()` in `handlePointerDown` when a modifier is matched prevents any default
  browser behaviour (e.g. text selection on Shift+drag).

---

## 15. Implementation Sequence

Implement in this order to keep the test suite green at each step:

1. **`types.ts`**: Add `TrackpadCameraConfig`, `ICameraInteractionDriver`, `CameraInteractionDriverFactory`. Remove `CameraInteractionConfig`, `PointerAction`. Update `SceneCamera.interaction`.
2. **`render.ts`**: Add `CameraControlsDriver`. Remove `createCameraControls`, `configureCameraControls`.
3. **`CameraWidget.ts`**: Refactor using new types and driver pattern.
4. **`dsl.tsx`**: Update `interaction` prop type.
5. **`__tests__/CameraWidget.test.ts`**: Full rewrite with `FakeInteractionDriver`.
6. **`index.ts`**: Update exports.
7. Run `pnpm --filter @brewsite/core test` — all tests should pass.
8. Run `pnpm typecheck` — zero type errors.
9. Run `pnpm dev` and manually verify Ctrl+drag = orbit, Shift+drag = pan, Alt+drag = zoom.

---

## 16. Known Limitations / Future Work

- **Touch pinch** is not implemented in this plan (two-finger zoom on mobile). Can be added to
  `CameraControlsDriver` as a `touchstart`/`touchmove` handler in a follow-up.
- **Unmodified drag = orbit** (for scenes that want it) can be added by checking `!e.altKey && !e.ctrlKey && !e.shiftKey` in `resolveModifier` and mapping it to 'rotate' when `defaultOrbit` config is added.
- **Sensitivity tuning**: The rotate, pan, zoom scale factors (`2π/w` for azimuth etc.) are chosen
  as reasonable defaults. Scene authors can tune via `speed` in `CameraAxisConfig`. If global
  defaults need tuning after testing, adjust the constants in `CameraControlsDriver.handlePointerMove`.
- **`camera-controls@3.1.2` upgrade**: v3.x does not expose modifier-key `mouseButtons` bindings.
  If a future version adds this, we could simplify `CameraControlsDriver` to use the native API,
  but the `ICameraInteractionDriver` abstraction would remain intact regardless.
