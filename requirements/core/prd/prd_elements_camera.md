---
title: "BrewSite Core — Camera Element"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-02
change_history:
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Core customization unblocking implemented: camera action routing supports non-primary camera targets via ICameraActionTarget, primaryCameraId defaults, configurable camera interaction tunables (wheel lock timing, axis dominance/threshold, orbit/dolly clamps), and one-time runtime warnings for invalid camera targets."
  - date: 2026-02-28
    author: brewsite-product-manager
    summary: "Initial PRD created. Full specification of the Camera element covering the four position descriptor modes, lens and post configuration, transition system, interactive trackpad controls, the ICameraInteractionDriver abstraction, camera override system, focus/frame actions, and the CameraWidget runtime contract."
---

# BrewSite Core — Camera Element

## 1. Overview

The Camera element controls the Three.js `PerspectiveCamera` across scenes in `@brewsite/core`. It is declared once per scene in the DSL, compiled into a `SceneCamera` state value, and applied by `CameraWidget` at each tick. The element supports four position descriptor modes — world-space, orbit-spherical, model-fit, and floor-fit — along with lens configuration, tone-mapping exposure, and an optional interactive camera controls layer for orbit, pan, and dolly via trackpad or pointer input.

The Camera element lives in `packages/core/src/elements/camera/` and follows the mandatory module pattern: `types.ts → dsl.tsx → compile.ts → render.ts → CameraWidget.ts → index.ts`. Three.js is confined to `render.ts` and `CameraWidget.ts`. The compiler layer is pure TypeScript with no Three.js imports.

The `@brewsite/diagram` package extends the camera interaction model with `DiagramCanvas`-specific focus actions (`canvas.focus`), which are routed through the `ActionInputController` and handled by `CameraWidget` via the `ICameraInteractionDriver` abstraction. This extension is additive and does not modify the core camera type surface.

---

## 2. Problem Statement

Scene authors need precise, declarative control over camera position across scenes without writing Three.js camera math. Four distinct authoring scenarios arise in practice:

1. **Explicit world-space positioning** — the author knows exact coordinates and target.
2. **Spherical positioning** — the author thinks in orbit terms (azimuth, elevation, distance from target).
3. **Model framing** — the author wants the camera to fill the viewport with a specific model, regardless of the model's absolute size or position.
4. **Floor-plane framing** — the author wants the camera to frame a floor-level area for product or environment shots.

Before the Camera element formalized these modes, consumer scenes either hardcoded world-space coordinates (fragile to model repositioning) or left framing math in ad-hoc widget subclasses (duplicated per project). Neither approach composed correctly with the SceneTrack interpolation system.

Additionally, interactive camera controls (orbit, dolly, pan via trackpad) are a common consumer requirement for presentation and demo scenes. The prior approach required consumers to wire `camera-controls` directly to the Three.js camera, bypassing the compiled state system and producing conflicts with scene transitions.

---

## 3. Goals & Success Metrics

**Primary metrics:**
- A consumer can switch from world-space to orbit mode by changing the `mode` field alone, with no other code changes.
- TypeScript's discriminated union inference narrows `CameraPositionDescriptor` correctly at the call site — switching on `mode` gives the correct type without a cast.
- `FitBotHeight` mode produces a correctly framed shot for any model height when only `targetId` and `targetHeight` are specified, using sensible defaults for `framingHeightPct`.
- Interactive camera controls do not produce visual conflicts with scene-change transitions — controls reset cleanly on scene change when `resetOnSceneChange: true`.

**Guardrail metrics:**
- `CameraWidget` ticks last in the widget priority order (`tickPriority = 100`). No other built-in widget ticks after the camera.
- `ICameraInteractionDriver` abstraction allows the test suite to run `CameraWidget` without a real `camera-controls` instance.
- No regression to consumers currently using `<Camera descriptor={{ mode: 'world', ... }} />`.

---

## 4. Non-Goals

- The Camera element does not implement cinematic camera paths (bezier curves, look-at tracking over time). Path-following is an animation library concern; within the scene system, smooth transitions are the responsibility of the interpolation system between discrete scene states.
- Multiple simultaneous cameras (split-screen, picture-in-picture) are not supported by this element. The scene has exactly one active camera.
- Orthographic camera mode is not part of this element. The `DiagramCanvas` element in `@brewsite/diagram` manages its own orthographic camera independently.
- VR/AR camera rig management (XR reference space, XR session) is not in scope.
- Camera shake, procedural noise, or handheld simulation are consumer-widget concerns, not part of this element.
- The Camera element does not write to the `VariableStore` for consumption by other widgets in the first version. Read access (for label projection) is exposed via a direct method, not a reactive store key.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to specify camera position and target as explicit world-space coordinates so that I have full control over the framing of a scene.
- As a toolkit consumer, I want to specify camera position in spherical orbit terms (azimuth, polar, distance) so that I can think about framing relationally rather than in absolute coordinates.
- As a toolkit consumer, I want to declare a model ID and height and have the camera automatically frame that model to fill 80% of the viewport height so that I can build bot-showcase scenes without computing camera math manually.
- As a toolkit consumer, I want to configure field-of-view and near/far clipping planes per scene so that I can achieve cinematic lens effects on a per-scene basis.
- As a toolkit consumer, I want the camera to smoothly interpolate position, target, and FOV between scenes so that scene transitions feel animated rather than jarring.
- As a toolkit consumer, I want to enable trackpad orbit and dolly for presentation scenes so that viewers can interactively explore the 3D content.
- As a toolkit consumer, I want interactive camera controls to reset when the user advances to a new scene so that the authored framing is preserved as the starting point.
- As a toolkit consumer, I want to constrain the interactive camera to a polar and distance range so that the user cannot orbit the camera into a bad angle or clip through geometry.
- As a toolkit consumer, I want the Camera element to expose a reset action so that users can return to the authored framing after interactive exploration.
- As a toolkit consumer building on `@brewsite/diagram`, I want the camera to animate to a focus point on a `canvas.focus` action so that clicking diagram nodes produces a smooth camera-to-node transition.

---

## 6. Functional Requirements

1. The `<Camera>` DSL component must accept a `descriptor` prop typed as `CameraPositionDescriptor`. The `descriptor` is required; a scene without a `<Camera>` inherits the prior scene's camera state.
2. The `CameraPositionDescriptor` type must be a discriminated union on a `mode` string literal. TypeScript must narrow the type correctly when switching on `mode`.
3. The four valid `mode` values are: `'world'`, `'orbit'`, `'fitBotHeight'`, and `'fitFloorDepth'`. No other mode values are valid.
4. `WorldSpaceCamera` must accept `position: Vec3`, `target: Vec3`, and optional `up: Vec3` (default `[0, 1, 0]`).
5. `OrbitCamera` must accept `target: Vec3`, `azimuth: number` (radians), `polar: number` (radians from up axis), `distance: number` (world units), and optional `up: Vec3`.
6. `FitBotHeightCamera` must accept `targetId: string` (ModelWidget ID), `targetHeight: number` (world units), optional `framingHeightPct: number` (default 0.8), optional `heightOffset: number`, and optional `distanceOffset: number`. The widget must compute the camera position at runtime using the current camera FOV and viewport dimensions.
7. `FitFloorDepthCamera` must accept `floorY: number`, `floorZMin: number`, `floorZMax: number`, and optional `lookAtZ`, `cameraX`, `cameraY`.
8. The `<Camera>` DSL component must accept an optional `lens` prop of type `CameraLens` for FOV, focal length, film gauge, near, and far clipping configuration.
9. When `lens.focalLength` is provided, it must take precedence over `lens.fov`. The effective FOV is computed from focal length and film gauge using the standard formula.
10. The `<Camera>` DSL component must accept an optional `post` prop of type `CameraPost` for tone-mapping exposure configuration.
11. The `<Camera>` DSL component must accept an optional `interaction` prop of type `TrackpadCameraConfig`. This prop is consumed at the player layer and does not affect the compiled `SceneCamera` state.
12. Between scenes where camera descriptors are both `mode: 'world'` or both `mode: 'orbit'`, the runtime must interpolate position, target, and FOV using component-wise lerp.
13. Between scenes where camera mode changes (e.g., `orbit` → `world`), the compiler must resolve both descriptors to world-space position and target at compile time, then interpolate the resolved coordinates.
14. `CameraWidget` must tick with `tickPriority = 100`, ensuring it ticks after all model widgets.
15. When `interaction.resetOnSceneChange` is `true`, the interaction driver must reset to the compiled camera position for the incoming scene on every scene change.
16. The `ICameraInteractionDriver` interface must be the only surface through which `CameraWidget` calls into the camera-controls library. No direct `camera-controls` import is permitted outside of the concrete driver implementation.
17. The `camera.reset` action must animate the camera from its current interactive position back to the compiled scene position, using the `CameraResetConfig.duration` field for animation timing.
18. The `canvas.focus` action must accept an optional `focusCenter: Vec3` and animate the camera to center on that point over a configurable duration, without modifying the compiled `SceneCamera` state.
19. The `CameraWidget` must expose a `getCamera(): THREE.PerspectiveCamera` method for consumption by the player layer (e.g., `LabelPositioner`, `CameraControlPanel`).
20. `CameraPost.exposure` must be applied directly to `WebGLRenderer.toneMappingExposure` in `render.ts`. This must be applied every tick to handle transitions between scenes with different exposure values.

---

## 7. API Design

### 7.1 Core State Types

```typescript
// packages/core/src/elements/camera/types.ts

export type Vec3 = [number, number, number];

export interface WorldSpaceCamera {
  mode: 'world';
  position: Vec3;
  target: Vec3;
  up?: Vec3;              // default [0, 1, 0]
}

export interface OrbitCamera {
  mode: 'orbit';
  target: Vec3;
  azimuth: number;        // horizontal angle in radians
  polar: number;          // vertical angle from up axis in radians
  distance: number;       // distance from target in world units
  up?: Vec3;              // default [0, 1, 0]
}

export interface FitBotHeightCamera {
  mode: 'fitBotHeight';
  targetId: string;           // ModelWidget ID to frame
  targetHeight: number;       // model height in world units
  framingHeightPct?: number;  // fraction of viewport height to fill, default 0.8
  heightOffset?: number;      // vertical offset of the framing center in world units
  distanceOffset?: number;    // additional camera distance beyond the computed value
}

export interface FitFloorDepthCamera {
  mode: 'fitFloorDepth';
  floorY: number;         // Y position of the floor plane
  floorZMin: number;      // near Z boundary of the floor area to frame
  floorZMax: number;      // far Z boundary of the floor area to frame
  lookAtZ?: number;       // Z coordinate to look at; defaults to midpoint of floorZMin/floorZMax
  cameraX?: number;       // horizontal camera position; defaults to 0
  cameraY?: number;       // vertical camera position override; computed from framing if omitted
}

export type CameraPositionDescriptor =
  | WorldSpaceCamera
  | OrbitCamera
  | FitBotHeightCamera
  | FitFloorDepthCamera;

export interface CameraLens {
  fov?: number;           // field of view in degrees; default 45
  focalLength?: number;   // focal length in mm (35mm equivalent); takes precedence over fov
  filmGauge?: number;     // sensor size in mm; default 35
  near?: number;          // near clipping plane; default 0.1
  far?: number;           // far clipping plane; default 1000
}

export interface CameraPost {
  exposure?: number;      // WebGLRenderer tone mapping exposure; default 1.0
}

export interface SceneCamera {
  descriptor: CameraPositionDescriptor;
  lens?: CameraLens;
  post?: CameraPost;
}
```

### 7.2 Interactive Camera Configuration

```typescript
// packages/core/src/elements/camera/types.ts (continued)

export type ModifierKey = 'ctrl' | 'meta' | 'alt' | 'shift' | 'none';

export interface PointerGestureConfig {
  key: ModifierKey;
  sensitivity?: number;   // multiplier on raw input delta; default 1.0
}

export interface WheelZoomConfig {
  enabled?: boolean;      // default true
  sensitivity?: number;   // default 1.0
}

export interface CameraConstraints {
  minPolar?: number;      // minimum polar angle in radians
  maxPolar?: number;      // maximum polar angle in radians
  minAzimuth?: number;    // minimum azimuth angle in radians
  maxAzimuth?: number;    // maximum azimuth angle in radians
  minDistance?: number;   // minimum orbit distance in world units
  maxDistance?: number;   // maximum orbit distance in world units
}

export interface CameraResetConfig {
  position?: Vec3;        // reset-to position override; uses compiled scene position if omitted
  target?: Vec3;          // reset-to target override; uses compiled scene target if omitted
  duration?: number;      // animation duration in seconds; default 0.5
}

export interface TrackpadCameraConfig {
  enabled?: boolean;      // master switch; default false

  rotate?: PointerGestureConfig;
  pan?: PointerGestureConfig;
  zoom?: PointerGestureConfig;
  wheelZoom?: WheelZoomConfig;

  damping?: number;           // camera-controls damping factor, range 0–1; default 0.05
  constraints?: CameraConstraints;
  reset?: CameraResetConfig;
  resetOnSceneChange?: boolean;  // reset to compiled position on scene change; default true
}
```

### 7.3 DSL Component

```typescript
// packages/core/src/elements/camera/dsl.tsx

export interface CameraProps {
  descriptor: CameraPositionDescriptor;
  lens?: CameraLens;
  post?: CameraPost;
  interaction?: TrackpadCameraConfig;
}

export declare function Camera(props: CameraProps): null;
```

The `<Camera>` component returns `null` at runtime. It is a pure compiler node. Its `interaction` prop is consumed by the player layer when wiring the `ActionInputController`; it does not enter the compiled `SceneCamera` state and does not appear in the `SceneTrack`.

### 7.4 Authoring Examples

World-space camera with explicit lens:

```tsx
<Camera
  descriptor={{ mode: 'world', position: [0, 2, 8], target: [0, 0, 0] }}
  lens={{ fov: 45, near: 0.1, far: 100 }}
  post={{ exposure: 1.2 }}
/>
```

Orbit camera with polar/azimuth positioning:

```tsx
<Camera
  descriptor={{
    mode: 'orbit',
    target: [0, 0, 0],
    azimuth: 0.5,
    polar: 1.2,
    distance: 6,
  }}
  lens={{ fov: 50 }}
/>
```

Auto-framing a model to fill 85% of viewport height:

```tsx
<Camera
  descriptor={{
    mode: 'fitBotHeight',
    targetId: 'hero-bot',
    targetHeight: 1.8,
    framingHeightPct: 0.85,
    heightOffset: 0.1,
  }}
/>
```

Floor-depth framing for environment shots:

```tsx
<Camera
  descriptor={{
    mode: 'fitFloorDepth',
    floorY: 0,
    floorZMin: -2,
    floorZMax: 4,
    cameraX: 0,
  }}
/>
```

Full interactive orbit with constraints:

```tsx
<Camera
  descriptor={{ mode: 'orbit', target: [0, 0, 0], azimuth: 0, polar: 1.0, distance: 5 }}
  interaction={{
    enabled: true,
    rotate: { key: 'none', sensitivity: 0.8 },
    zoom: { key: 'none', sensitivity: 0.5 },
    wheelZoom: { enabled: true },
    damping: 0.08,
    constraints: { minPolar: 0.3, maxPolar: 1.5, minDistance: 2, maxDistance: 12 },
    resetOnSceneChange: true,
    reset: { duration: 0.6 },
  }}
/>
```

### 7.5 ICameraInteractionDriver Abstraction

```typescript
// packages/core/src/elements/camera/types.ts

export interface ICameraInteractionDriver {
  setEnabled(enabled: boolean): void;
  setConstraints(constraints: CameraConstraints): void;

  // Programmatic camera commands
  reset(config?: CameraResetConfig): void;
  applyOrbit(dx: number, dy: number): void;
  applyDolly(delta: number): void;
  applyPan(dx: number, dy: number): void;

  // Focus animation — animates camera to center on a world-space point
  focusOn(target: Vec3, duration?: number): void;

  // Frame tick advance
  update(deltaSeconds: number): void;

  // Cleanup
  dispose(): void;
}
```

The concrete implementation `CameraControlsDriver` wraps the `camera-controls` npm package. The test double `FakeInteractionDriver` implements the same interface with no Three.js dependency, enabling `CameraWidget` unit tests to run in a Node environment.

### 7.6 CameraWidget Interface Summary

```typescript
// packages/core/src/elements/camera/CameraWidget.ts

class CameraWidget
  implements
    IWidget,
    ISceneElement<SceneCamera>,
    IRenderable<SceneCamera>,
    IAnimationController {

  readonly id: string;
  readonly tickPriority = 100;  // ticks last, after all model widgets

  // Camera access for player layer
  getCamera(): THREE.PerspectiveCamera;

  // ISceneElement
  compileState(props: CameraProps, ctx: CompileExtraContext): SceneCamera;

  // IRenderable
  apply(state: SceneCamera, ctx: RenderContext): void;

  // IAnimationController
  onTick(ctx: TickContext): void;

  // Interaction driver wiring (called by player layer after creation)
  setInteractionDriver(driver: ICameraInteractionDriver): void;
  setInteractionConfig(config: TrackpadCameraConfig): void;

  // Action handlers (registered with ActionInputController)
  handleOrbit(dx: number, dy: number): void;
  handleDolly(delta: number): void;
  handleReset(): void;
  handleFocus(target: Vec3, duration?: number): void;

  // Wheel guard (prevents scene navigation during user dolly)
  isUserInteracting(): boolean;

  dispose(): void;
}
```

---

## 8. Technical Considerations

### 8.1 Descriptor Resolution

`FitBotHeightCamera` and `FitFloorDepthCamera` cannot be fully resolved at compile time because they depend on runtime values (viewport dimensions, model bounding box). The compiled `SceneCamera` stores the descriptor verbatim. Resolution to a world-space position and target occurs in `CameraWidget.apply()` at the first tick of each scene.

When computing `FitBotHeight`, `CameraWidget` retrieves the model bounding box from the corresponding `ModelWidget` via the widget registry. If the model has not finished loading, the camera falls back to the previous frame's position.

This means the `FitBotHeight` and `FitFloorDepth` modes produce correct framing only at scene entry. If the model moves during the scene, the camera does not track it — that behavior belongs in a `LookAt` or tracking camera feature, which is explicitly out of scope.

### 8.2 Cross-Mode Transition Handling

When the `mode` changes between two consecutive scenes, the compiler resolves each descriptor to an equivalent world-space representation at the baked tick boundary. This produces two `Vec3` pairs (position + target) that can be lerped directly. The resolved representation is stored in the compiled `SceneTrack` tick at the transition point.

Orbit descriptors are resolved to world-space using:

```typescript
function orbitToWorld(desc: OrbitCamera): { position: Vec3; target: Vec3 } {
  const x = desc.target[0] + desc.distance * Math.sin(desc.polar) * Math.sin(desc.azimuth);
  const y = desc.target[1] + desc.distance * Math.cos(desc.polar);
  const z = desc.target[2] + desc.distance * Math.sin(desc.polar) * Math.cos(desc.azimuth);
  return { position: [x, y, z], target: desc.target };
}
```

This function lives in `compile.ts` and has no Three.js dependency.

### 8.3 Lens Computation

When `focalLength` is provided, FOV is derived using:

```typescript
function fovFromFocalLength(focalLength: number, filmGauge: number = 35): number {
  return 2 * Math.atan(filmGauge / (2 * focalLength)) * (180 / Math.PI);
}
```

This matches Three.js `PerspectiveCamera.setFocalLength()` semantics. The computed FOV is stored in the compiled tick, not the raw `focalLength`, so the renderer always works with a resolved FOV value.

### 8.4 Tone Mapping Exposure

`CameraPost.exposure` is applied to `renderer.toneMappingExposure` inside `CameraWidget.apply()`. The renderer reference is provided through the `RenderContext` parameter. This must run every tick during a transition — not just at scene entry — to correctly interpolate exposure between scenes with different values.

### 8.5 camera-controls Integration

The `camera-controls` library is a peer dependency of `@brewsite/core`. It must not be imported by any module that does not have `ICameraInteractionDriver` in its direct call chain. The import is confined to `CameraControlsDriver.ts` in `elements/camera/`.

The consumer must install `camera-controls` independently if they use `interaction` config. The player layer's `createDefaultWidgetRegistry` call does not instantiate a `CameraControlsDriver` unless `interaction.enabled` is `true` on at least one scene's `<Camera>` component.

When `interaction.enabled` is `false` (the default), no `ICameraInteractionDriver` is created, and `CameraWidget` operates in compiled-state-only mode. This is the zero-interaction-cost path.

### 8.6 Wheel Guard

When a user is actively dollying with the wheel or trackpad and the scene is in scroll-drive mode, the scroll engine must not advance the scene while the user is interacting. `CameraWidget.isUserInteracting()` is queried by the player layer's scroll handler each frame. When `true`, scroll events are consumed by the camera and do not advance the `SceneTrack` position.

### 8.7 `canvas.focus` Action Integration

The `canvas.focus` action originates from `@brewsite/diagram`'s `ActionInputController` registration, but is handled by `CameraWidget` in `@brewsite/core`. The action payload carries an optional `focusCenter: Vec3`. When received:

1. `CameraWidget.handleFocus(target, duration)` is called.
2. `ICameraInteractionDriver.focusOn(target, duration)` is dispatched to the concrete driver.
3. The driver animates the camera to center the view on `target` while maintaining the current orbit distance.
4. The compiled `SceneCamera` state is not modified. The focus is an interactive overlay, not a compiled scene state change.

If `focusCenter` is absent from the action payload, the camera holds its current position. This allows `canvas.focus` to be dispatched as a no-op reset.

### 8.8 VariableStore and Label Projection

`CameraWidget` exposes `getCamera()` for use by `LabelPositioner`. The `LabelPositioner` projects 3D world positions to screen coordinates using the camera's projection matrix. This is a direct method call, not a `VariableStore` subscription, because label projection is a synchronous per-frame computation that does not need reactive update semantics.

### 8.9 Build and Tree-shaking

`CameraControlsDriver` is the only file in the element that imports `camera-controls`. It is only instantiated by the player layer when interaction is enabled. Consumers who never use `interaction` config on `<Camera>` will not include `camera-controls` in their bundle if their bundler performs tree-shaking correctly.

The camera element does not import the model element. The bounding box read for `FitBotHeight` is performed through the widget registry interface using a capability check, not a direct import.

---

## 9. Breaking Change Assessment

**Semver impact: Minor** — This PRD describes the current, stable element API. No breaking changes are introduced.

The `CameraPositionDescriptor` discriminated union is stable. Adding a new `mode` value in a future release is a minor change (additive, no existing code breaks). Removing or renaming a mode value is a major change.

`TrackpadCameraConfig` is entirely optional. Consumers who do not specify `interaction` are unaffected by any change to `TrackpadCameraConfig`'s shape. Changes to the shape of `TrackpadCameraConfig` that are additive (new optional fields) are minor.

If `ICameraInteractionDriver` gains a required method, that is a breaking change for consumers who have implemented the interface (e.g., for custom test doubles). New required methods must be accompanied by a major version bump and a migration guide.

---

## 10. Dependencies

- `three` — peer dependency; `PerspectiveCamera`, `WebGLRenderer`, `Vector3`, `Quaternion`. Must not be bundled.
- `camera-controls` — peer dependency; used only in `CameraControlsDriver.ts`. Consumers who enable `interaction` must install this separately.
- `@types/three` — dev dependency.
- No new external dependencies are introduced by this element beyond `camera-controls`.
- Internal dependency: `packages/core/src/math/` — orbit-to-world resolution, Vec3 lerp.
- Internal dependency: `packages/core/src/widget/` — `IWidget`, `ISceneElement`, `IRenderable`, `IAnimationController`, `CUSTOM_NODE_HANDLER`, `WidgetRegistry`.
- Internal dependency: `packages/core/src/elements/model/` — bounding box access for `FitBotHeight` mode (via registry capability check only; no direct import).

---

## 11. Risks & Mitigations

**API regret — `mode` discriminant is a string literal enum:** Adding new modes is safe; the union is open for extension. However, any consumer switch statement on `mode` that lacks a default/exhaustive handler will produce a TypeScript error on upgrade if new modes are added. This is a desired behavior — it forces consumers to handle the new case. Document this expectation explicitly in the changelog.

**`FitBotHeight` runtime dependency on ModelWidget:** The camera element depends on being able to query a model's bounding box at runtime. If the model has not loaded, framing silently degrades. Risk: a consumer scene where the model loads slowly shows a wrong camera position for the first few frames. Mitigation: `CameraWidget.apply()` should log a warning (not throw) when the target model is not found in the registry, and use a sensible fallback.

**camera-controls version coupling:** `camera-controls` must be compatible with the same version of Three.js that the consumer installs. If Three.js has a major version bump, `camera-controls` may lag. Mitigation: specify compatible `camera-controls` and `three` version ranges in `peerDependencies` with a comment explaining the coupling. Test with the minimum stated version in CI.

**Wheel guard complexity:** The interaction between user wheel input, scene scroll navigation, and the wheel guard introduces state machine complexity. A user who scrolls slowly may experience jerky scene transitions if the guard threshold is wrong. Mitigation: expose `wheelGuardThreshold` as a configurable value on `TrackpadCameraConfig`. Add an integration test that simulates concurrent wheel and scroll events.

**Exposure interpolation artifact:** Interpolating `toneMappingExposure` from 1.0 to 2.5 produces a visible "bloom swell" if the transition is fast. This is a rendering aesthetic issue, not a bug. Mitigation: document that large exposure deltas across scenes produce visible tone-map transitions. Recommend authors keep exposure values close across adjacent scenes.

**`canvas.focus` and scene-change collision:** If the user triggers `canvas.focus` at the same time as a scene change, the focus animation and the scene-change camera transition compete for the same camera state. Mitigation: `canvas.focus` dispatches to `ICameraInteractionDriver`, which operates on top of the compiled state. Scene-change resets the interaction driver first (if `resetOnSceneChange: true`), which cancels any in-flight focus animation.

---

## 12. Open Questions

- Should `OrbitCamera.azimuth` and `OrbitCamera.polar` accept degrees as an alternative to radians? Radians are consistent with Three.js conventions, but many authors think in degrees. A `degreesToRadians` utility is available but requires authors to wrap every value. Decision deferred to a minor version addition of a `unit?: 'rad' | 'deg'` field.
- Should the `FitBotHeightCamera` descriptor be resolved to world-space at compile time (requiring a pre-bake step that reads model metadata from the manifest) rather than at runtime? Compile-time resolution would produce a deterministic `SceneTrack` but requires manifest to include model bounding-box metadata. The current runtime-resolution approach is simpler but defers correctness.
- Should `ICameraInteractionDriver.focusOn()` accept a `distance` parameter to also change the orbit distance during focus, or should it maintain the current distance? Changing distance provides better framing for diagram node focus. Maintaining distance is simpler. Current behavior: maintains distance.
- Should `TrackpadCameraConfig` be separately specifiable per scene (allowing different interaction constraints across scenes), or specified once at the player level? Current model: interaction config comes from the first `<Camera>` in the first scene and persists. Per-scene reconfiguration is a future enhancement.

---

## 13. Launch Criteria

- The `CameraPositionDescriptor` discriminated union narrows correctly in TypeScript strict mode for all four `mode` values. Verified by a type-level test using `satisfies`.
- `compile.ts` unit tests cover: `orbitToWorld` conversion, `fovFromFocalLength` computation, cross-mode descriptor resolution (orbit → world lerp), and exposure interpolation.
- `CameraWidget` tick lifecycle (apply → onTick → interaction → dispose) is covered by integration tests using `FakeInteractionDriver` with no Three.js dependency.
- `FitBotHeight` framing is covered by an integration test that asserts the computed camera position produces the correct viewport framing for a known model height and FOV.
- At least one example scene in `apps/examples/` demonstrates each of the four descriptor modes in a multi-scene sequence.
- At least one example scene demonstrates interactive camera controls with orbit, dolly, constraints, and reset.
- `packages/core/README.md` documents the `<Camera>` props table and the four descriptor modes with inline examples.
- `ICameraInteractionDriver` is documented as a stable interface that consumers may implement for custom camera control schemes.
- CHANGELOG entry written covering any new fields or descriptor modes.
- Bundle analysis confirms `camera-controls` is absent from builds where no scene uses `interaction: { enabled: true }`.
- TypeScript strict mode passes with zero errors on all camera element module files.
