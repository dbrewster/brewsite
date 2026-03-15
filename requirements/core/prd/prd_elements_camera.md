---
title: "BrewSite Core — Camera Element"
doc_type: prd
status: active
owner: brewsite-product-manager
last_updated: 2026-03-15
change_history:
  - date: 2026-03-09
    author: "Toolkit Product"
    summary: "NVS Universal Coordinate System: added nvsViewport as a fifth camera mode (mode: 'nvsViewport'). NVSViewportCamera accepts worldScale and zRange; compiles to an equivalent mode='world' CameraState at compile time — no special runtime handling. Non-Goals updated: removed reference to DiagramCanvas managing its own orthographic camera (DiagramCanvas has been removed from @brewsite/diagram). Breaking change assessment updated to minor (additive mode)."
  - date: 2026-03-07
    author: "Toolkit Product"
    summary: "Camera architecture cleanup: eliminated scene.userData inter-widget bus. ICameraFocusTarget interface added — CameraWidget implements it so downstream widgets (e.g. DiagramCanvasWidget) call context.cameraFocusTarget.requestFocus() instead of writing to scene.userData['__brewsite_camera_focus']. ICameraHost interface extracted so the player layer (useSceneEngine.ts) programs against an interface rather than importing concrete CameraWidget — exports setInteractionDefaults, isWheelClaimedByInteraction, getCameraOverride, getCameraInteractionDriver. CameraWidget.onTick() no longer duplicates RuntimeDriverImpl state resolution — reads resolvedState from AnimationTickContext instead. All __brewsite_camera, __brewsite_renderer, __brewsite_camera_override, __brewsite_cam_enabled, and __brewsite_camera_focus scene.userData keys eliminated. CameraPost.exposure JSDoc corrected: renderer injected via WidgetInitContext.renderer, not scene.userData."
  - date: 2026-03-08
    author: "Toolkit Product"
    summary: "Coordinate system audit: updated CameraLens defaults (near 0.1→0.01, far 2000→100) for 20× depth-precision improvement in 1-unit worlds. Added @deprecated to FitFloorDepthCamera.cameraY with new scene-extent-relative derivation formula (floorY + (floorZMax-floorZMin)*0.4). Documented CameraConstraints minDistance/maxDistance runtime guardrail defaults (0.1 / 50). Documented solveCameraZForFloor bisection search bound scaling. Added legacy callout for fitFloorDepth mode in Technical Considerations."
  - date: 2026-03-02
    author: "Toolkit Product"
    summary: "Core customization unblocking implemented: camera action routing supports non-primary camera targets via ICameraActionTarget, primaryCameraId defaults, configurable camera interaction tunables (wheel lock timing, axis dominance/threshold, orbit/dolly clamps), and one-time runtime warnings for invalid camera targets."
  - date: 2026-02-28
    author: brewsite-product-manager
    summary: "Initial PRD created. Full specification of the Camera element covering the four position descriptor modes, lens and post configuration, transition system, interactive trackpad controls, the ICameraInteractionDriver abstraction, camera override system, focus/frame actions, and the CameraWidget runtime contract."
  - date: 2026-03-15
    author: "Toolkit Product"
    summary: "Major accuracy pass against codebase. Removed NVSViewportCamera from CameraPositionDescriptor (nvsViewport is a DSL-only mode compiled to world at compile time, not a runtime descriptor variant). Fixed CameraProps to use flat props pattern (extends CameraDescriptorProps discriminated union with flat lens/post/interaction/transitionIn fields — no nested descriptor/lens/post objects). Fixed ICameraInteractionDriver to match actual interface (attach, setLookAt, update, configure, claimsWheel, dispose). Fixed CameraWidget implements list (adds ICameraHost, ICameraFocusTarget). Replaced incorrect CameraWidget methods with actual public API (applyCameraOrbit, applyCameraDolly, applyCameraPan, requestFocus, isWheelClaimedByInteraction, setInteractionDefaults). Removed tickPriority=100 claim. Fixed TrackpadCameraConfig: rotate/pan/zoom are boolean|CameraAxisConfig (not PointerGestureConfig), constraints are flat fields (not nested CameraConstraints), reset is KeyCombo|false, damping is number|false. Fixed ModifierKey (removed 'none'). Added CameraTransitionInterpolation types. Added CameraOverrideState, CameraInteractionDefaults, CameraInteractionDriverFactory, KeyCombo, MouseButton, CameraAxisConfig, DofConfig types. Updated SceneCamera to include enabled, interaction, and transitionIn fields. Updated all authoring examples to flat prop syntax. Updated FitBotHeightCamera.framingHeightPct default to 0.4. Updated CameraLens defaults to near=0.1, far=2000 per types.ts. Fixed compile.ts defaults (near=0.01, far=100 are DEFAULT_CAMERA lens defaults, not CameraLens type defaults). Added NvsViewportCameraProps DSL type documentation. Updated functional requirements throughout."
---

# BrewSite Core — Camera Element

## 1. Overview

The Camera element controls the Three.js `PerspectiveCamera` across scenes in `@brewsite/core`. It is declared once per scene in the DSL using flat props, compiled into a `SceneCamera` state value, and applied by `CameraWidget` at each tick. The element supports four runtime position descriptor modes — world-space, orbit-spherical, model-fit, and floor-fit — plus a compile-time-only `nvsViewport` DSL mode that resolves to `world` before entering the `SceneTrack`. Lens configuration, tone-mapping exposure, transition interpolation control, and an optional interactive camera controls layer for orbit, pan, and dolly via trackpad or pointer input are all supported.

The Camera element lives in `packages/core/src/elements/camera/` and follows the mandatory module pattern: `types.ts -> dsl.tsx -> compile.ts -> render.ts -> CameraWidget.ts -> index.ts`. Three.js is confined to `render.ts` and `CameraControlsDriver.ts`. The compiler layer is pure TypeScript with no Three.js imports.

The `@brewsite/diagram` package extends the camera interaction model with diagram focus actions (`canvas.focus`), which are routed through the `ActionInputController` and handled by `CameraWidget` via the `ICameraFocusTarget` interface. This extension is additive and does not modify the core camera type surface.

---

## 2. Problem Statement

Scene authors need precise, declarative control over camera position across scenes without writing Three.js camera math. Four distinct authoring scenarios arise in practice:

1. **Explicit world-space positioning** — the author knows exact coordinates and target.
2. **Spherical positioning** — the author thinks in orbit terms (azimuth, elevation, distance from target).
3. **Model framing** — the author wants the camera to fill the viewport with a specific model, regardless of the model's absolute size or position.
4. **Floor-plane framing** — the author wants the camera to frame a floor-level area for product or environment shots.

A fifth DSL mode — `nvsViewport` — addresses scenes containing diagrams, charts, or other NVS-positioned elements with no large-world 3D models. This mode is fully resolved to `world` at compile time.

Before the Camera element formalized these modes, consumer scenes either hardcoded world-space coordinates (fragile to model repositioning) or left framing math in ad-hoc widget subclasses (duplicated per project). Neither approach composed correctly with the SceneTrack interpolation system.

Additionally, interactive camera controls (orbit, dolly, pan via trackpad) are a common consumer requirement for presentation and demo scenes. The prior approach required consumers to wire `camera-controls` directly to the Three.js camera, bypassing the compiled state system and producing conflicts with scene transitions.

---

## 3. Goals & Success Metrics

**Primary metrics:**
- A consumer can switch from world-space to orbit mode by changing the `mode` field alone, with no other code changes.
- TypeScript's discriminated union inference narrows `CameraDescriptorProps` correctly at the call site — switching on `mode` gives the correct type without a cast.
- `FitBotHeight` mode produces a correctly framed shot for any model height when only `targetId` and `targetHeight` are specified, using sensible defaults for `framingHeightPct`.
- Interactive camera controls do not produce visual conflicts with scene-change transitions — controls reset cleanly on scene change when `resetOnSceneChange: true`.

**Guardrail metrics:**
- `ICameraInteractionDriver` abstraction allows the test suite to run `CameraWidget` without a real `camera-controls` instance.
- No regression to consumers currently using `<Camera mode="world" position={...} target={...} />`.

---

## 4. Non-Goals

- The Camera element does not implement cinematic camera paths (bezier curves, look-at tracking over time) as a DSL-level concept. Path-following transitions are supported via the `CameraTransitionInterpolation` system (bezier, orbit, path types), but these operate between scene states — they are not standalone camera animation primitives.
- Multiple simultaneous cameras (split-screen, picture-in-picture) are not supported by this element. The scene has exactly one active camera.
- Orthographic camera mode is not part of this element. The `nvsViewport` DSL mode positions the camera to give a near-orthographic frustum for NVS-primary scenes, but the camera remains a `PerspectiveCamera` — true orthographic mode is not provided.
- VR/AR camera rig management (XR reference space, XR session) is not in scope.
- Camera shake, procedural noise, or handheld simulation are consumer-widget concerns, not part of this element.
- The Camera element does not write to the `VariableStore` for consumption by other widgets in the first version. Read access (for label projection) is exposed via a direct method, not a reactive store key.

---

## 5. Consumer Stories

- As a toolkit consumer, I want to specify camera position and target as explicit world-space coordinates so that I have full control over the framing of a scene.
- As a toolkit consumer, I want to specify camera position in spherical orbit terms (azimuth, polar, distance) so that I can think about framing relationally rather than in absolute coordinates.
- As a toolkit consumer, I want to declare a model ID and height and have the camera automatically frame that model to fill 40% of the viewport height so that I can build bot-showcase scenes without computing camera math manually.
- As a toolkit consumer, I want to configure field-of-view and near/far clipping planes per scene so that I can achieve cinematic lens effects on a per-scene basis.
- As a toolkit consumer, I want the camera to smoothly interpolate position, target, and FOV between scenes so that scene transitions feel animated rather than jarring.
- As a toolkit consumer, I want to enable trackpad orbit and dolly for presentation scenes so that viewers can interactively explore the 3D content.
- As a toolkit consumer, I want interactive camera controls to reset when the user advances to a new scene so that the authored framing is preserved as the starting point.
- As a toolkit consumer, I want to constrain the interactive camera to a polar and distance range so that the user cannot orbit the camera into a bad angle or clip through geometry.
- As a toolkit consumer, I want the Camera element to expose a reset action so that users can return to the authored framing after interactive exploration.
- As a toolkit consumer building on `@brewsite/diagram`, I want the camera to animate to a focus point on a `canvas.focus` action so that clicking diagram nodes produces a smooth camera-to-node transition.
- As a toolkit consumer, I want to control the camera transition interpolation mode (linear, eased, bezier, orbit, path) per scene so that I can create cinematic scene-to-scene camera movements.

---

## 6. Functional Requirements

1. The `<Camera>` DSL component must accept flat props typed as `CameraProps`, which extends the `CameraDescriptorProps` discriminated union with flat lens, post, interaction, and transition fields. A scene without a `<Camera>` inherits the prior scene's camera state.
2. The `CameraDescriptorProps` type must be a discriminated union on a `mode` string literal. TypeScript must narrow the type correctly when switching on `mode`.
3. The five valid DSL `mode` values are: `'world'`, `'orbit'`, `'fitBotHeight'`, `'fitFloorDepth'`, and `'nvsViewport'`. The `nvsViewport` mode is resolved to an equivalent `mode: 'world'` `SceneCamera` at compile time and does not appear in the runtime `CameraPositionDescriptor`.
4. The four runtime `CameraPositionDescriptor` modes are: `WorldSpaceCamera`, `OrbitCamera`, `FitBotHeightCamera`, `FitFloorDepthCamera`.
5. `WorldSpaceCamera` must accept `position: Vec3`, `target: Vec3`, optional `up: Vec3` (default `[0, 1, 0]`), and optional `nvsTarget: readonly [number, number]` for NVS-space look-at override.
6. `OrbitCamera` must accept `target: Vec3`, `azimuth: number` (radians), `polar: number` (radians from equator, 0 = level, +PI/2 = top-down), `distance: number` (world units), optional `up: Vec3`, and optional `nvsTarget: readonly [number, number]`.
7. `FitBotHeightCamera` must accept `targetId: string` (ModelWidget ID), `targetHeight: number` (world units), optional `framingHeightPct: number` (default 0.4), optional `heightOffset: number`, and optional `distanceOffset: number`. The widget must compute the camera position at runtime using the current camera FOV and viewport dimensions.
8. `FitFloorDepthCamera` must accept `floorY: number`, `floorZMin: number`, `floorZMax: number`, and optional `lookAtZ`, `cameraX`, `cameraY`.
9. The `<Camera>` DSL component must accept optional flat lens fields: `fov`, `focalLength`, `filmGauge`, `near`, `far`. These map to `CameraLens`.
10. When `focalLength` is provided, it must take precedence over `fov`. The effective FOV is computed from focal length and film gauge using the standard formula.
11. The `<Camera>` DSL component must accept an optional flat `exposure` field. This maps to `CameraPost.exposure`.
12. The `<Camera>` DSL component must accept an optional `interaction` prop of type `TrackpadCameraConfig`. This prop is included in the compiled `SceneCamera` state for runtime consumption by `CameraWidget`.
13. The `<Camera>` DSL component must accept an optional `transitionIn` prop of type `CameraTransitionInterpolation` that controls how the camera moves between scene states during a transition.
14. Between scenes where camera descriptors are both `mode: 'world'` or both `mode: 'orbit'`, the runtime must interpolate position, target, and FOV using the transition interpolation mode specified by `transitionIn` on the destination camera (defaulting to linear).
15. Between scenes where camera mode changes (e.g., `orbit` -> `world`), the compiler must resolve both descriptors to world-space position and target at compile time, then interpolate the resolved coordinates.
16. When `interaction.resetOnSceneChange` is `true` (the default), the interaction driver must reset to the compiled camera position for the incoming scene on every scene change.
17. The `ICameraInteractionDriver` interface must be the only surface through which `CameraWidget` calls into the camera-controls library. No direct `camera-controls` import is permitted outside of the concrete driver implementation (`CameraControlsDriver.ts`).
18. The `canvas.focus` action, when received via `ICameraFocusTarget.requestFocus()`, must animate the camera to center on the specified world-space position and target. When interaction is active, this delegates to the driver's `setLookAt`. When interaction is not active, a pending focus override is stored and applied on the next `onTick()`.
19. `CameraPost.exposure` must be applied directly to `WebGLRenderer.toneMappingExposure` in `render.ts`. This must run every tick during a transition — not just at scene entry — to correctly interpolate exposure between scenes with different values.

---

## 7. API Design

### 7.1 Core State Types

```typescript
// packages/core/src/elements/camera/types.ts

import type { Vec3 } from '../../math';
export type { Vec3 } from '../../math';

export type MouseButton = 'left' | 'middle' | 'right';

export type ModifierKey = 'alt' | 'ctrl' | 'meta' | 'shift';

export type KeyCombo = {
  key: string;
  modifiers?: ModifierKey[];
};

export type WorldSpaceCamera = {
  mode: 'world';
  position: Vec3;
  target: Vec3;
  up?: Vec3;
  nvsTarget?: readonly [number, number];
};

export type OrbitCamera = {
  mode: 'orbit';
  target: Vec3;
  azimuth: number;        // horizontal angle in radians (0 = +Z axis)
  polar: number;          // vertical angle from equator in radians (0 = level, +PI/2 = top)
  distance: number;       // distance from target in world units
  up?: Vec3;
  nvsTarget?: readonly [number, number];
};

export type FitBotHeightCamera = {
  mode: 'fitBotHeight';
  targetId: string;           // ModelWidget ID to frame
  targetHeight: number;       // model height in world units
  framingHeightPct?: number;  // fraction of viewport height to fill, default 0.4
  heightOffset?: number;      // vertical offset, default 0
  distanceOffset?: number;    // additional camera distance, default 0
};

export type FitFloorDepthCamera = {
  mode: 'fitFloorDepth';
  floorY: number;
  floorZMin: number;
  floorZMax: number;
  lookAtZ?: number;
  cameraX?: number;
  /**
   * Camera Y position in world space. When omitted, the runtime derives a default from
   * `floorY + (floorZMax - floorZMin) * 0.4` to produce a scene-extent-relative height.
   *
   * @deprecated Supply `cameraY` explicitly. The auto-derived fallback is a best-effort
   * heuristic; `fitFloorDepth` mode is a v1 legacy API and is not calibrated for
   * 1-unit world scenes. Prefer `mode: 'world'` for new scenes.
   */
  cameraY?: number;
};

export type CameraPositionDescriptor =
  | WorldSpaceCamera
  | OrbitCamera
  | FitBotHeightCamera
  | FitFloorDepthCamera;
```

**Note:** There is no `NVSViewportCamera` variant in `CameraPositionDescriptor`. The `nvsViewport` DSL mode exists only in `CameraDescriptorProps` (the authoring surface) and is fully resolved to a `mode: 'world'` `SceneCamera` at compile time by `compileNvsViewportCamera()`. It never appears in the runtime descriptor union.

### 7.2 Lens, Post, and Transition Types

```typescript
// packages/core/src/elements/camera/types.ts (continued)

// Phase 2 placeholder — DoF not yet implemented
export type DofConfig = never;

export type CameraLens = {
  fov?: number;           // vertical FOV in degrees; default 45
  focalLength?: number;   // focal length in mm; overrides fov if set
  filmGauge?: number;     // sensor size in mm; default 35
  near?: number;          // near clipping plane; default 0.1
  far?: number;           // far clipping plane; default 2000
};

export type CameraPost = {
  exposure?: number;      // WebGLRenderer tone mapping exposure; default 1.0
};

export type EaseFnName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'smoothstep';

export type CameraTransitionInterpolation =
  | { type: 'linear' }
  | { type: 'eased'; ease: EaseFnName }
  | { type: 'bezier'; cp1: Vec3; cp2: Vec3; ease?: EaseFnName }
  | { type: 'orbit'; ease?: EaseFnName }
  | { type: 'path'; waypoints: Vec3[]; ease?: EaseFnName };
```

### 7.3 Interactive Camera Configuration

```typescript
// packages/core/src/elements/camera/types.ts (continued)

export type CameraAxisConfig = {
  speed?: number;         // multiplier on pixel delta; default 1.0
};

export type TrackpadCameraConfig = {
  enabled: boolean;       // master switch; default false

  rotate?: boolean | CameraAxisConfig;   // Ctrl+drag = orbit
  pan?: boolean | CameraAxisConfig;      // Shift+drag = pan
  zoom?: boolean | CameraAxisConfig;     // Alt+drag = dolly

  wheelZoom?: boolean;                   // Alt+wheel dolly; default false
  wheelLockIdleMs?: number;              // sticky-lock idle timeout ms; default 160
  wheelAxisDominance?: number;           // axis dominance ratio; default 1.2
  wheelAxisActivationThreshold?: number; // delta threshold before axis lock; default 10

  damping?: number | false;              // inertia in seconds; false = instant; default 0.25

  minDistance?: number;     // min orbit distance; runtime default 0.1
  maxDistance?: number;     // max orbit distance; runtime default 50
  minPolarAngle?: number;  // min polar angle (radians from top); default 0
  maxPolarAngle?: number;  // max polar angle (radians from top); default Math.PI

  reset?: KeyCombo | false;              // keyboard reset shortcut; default { key: 'r' }
  resetOnSceneChange?: boolean;          // reset on scene change; default true
};

export type CameraInteractionDefaults = {
  wheelLockIdleMs?: number;
  wheelAxisDominance?: number;
  wheelAxisActivationThreshold?: number;
  orbitPolarMin?: number;
  orbitPolarMax?: number;
  dollyRadiusMin?: number;
  dollyRadiusMax?: number;
};
```

### 7.4 Unified SceneCamera State

```typescript
// packages/core/src/elements/camera/types.ts (continued)

export type SceneCamera = {
  enabled: boolean;
  descriptor: CameraPositionDescriptor;
  lens?: CameraLens;
  post?: CameraPost;
  interaction?: TrackpadCameraConfig;
  transitionIn?: CameraTransitionInterpolation;
};

export type CameraOverrideState = {
  enabled: boolean;
  position: Vec3;
  target: Vec3;
  up?: Vec3;
  fov?: number;
  near?: number;
  far?: number;
  exposure?: number;
};
```

### 7.5 DSL Component

```typescript
// packages/core/src/elements/camera/dsl.tsx

export type WorldCameraProps = {
  mode: 'world';
  position: Vec3;
  target: Vec3;
  up?: Vec3;
};

export type OrbitCameraProps = {
  mode: 'orbit';
  target: Vec3;
  azimuth: number;
  polar: number;
  distance: number;
  up?: Vec3;
};

export type FitBotHeightCameraProps = {
  mode: 'fitBotHeight';
  targetId: string;
  targetHeight: number;
  framingHeightPct?: number;
  heightOffset?: number;
  distanceOffset?: number;
};

export type FitFloorDepthCameraProps = {
  mode: 'fitFloorDepth';
  floorY: number;
  floorZMin: number;
  floorZMax: number;
  lookAtZ?: number;
  cameraX?: number;
  cameraY?: number;
};

export type NvsViewportCameraProps = {
  mode: 'nvsViewport';
  worldScale?: number;    // NVS [0..1] height in world units; default 10
  zRange?: number;        // total visible Z depth centered on z=0; default worldScale/2
};

export type CameraDescriptorProps =
  | WorldCameraProps
  | OrbitCameraProps
  | FitBotHeightCameraProps
  | FitFloorDepthCameraProps
  | NvsViewportCameraProps;

export type CameraProps = CameraDescriptorProps & {
  // Lens (flat fields, map to CameraLens)
  fov?: CameraLens['fov'];
  focalLength?: CameraLens['focalLength'];
  filmGauge?: CameraLens['filmGauge'];
  near?: CameraLens['near'];
  far?: CameraLens['far'];
  // Post (flat field, maps to CameraPost)
  exposure?: CameraPost['exposure'];
  // Interaction
  interaction?: TrackpadCameraConfig;
  // Transition
  transitionIn?: CameraTransitionInterpolation;
};
```

The `<Camera>` component returns `null` at runtime. It is a pure compiler node. The `CUSTOM_NODE_HANDLER` on `CameraWidget` maps the flat `CameraProps` to the nested `SceneCamera` structure. The `nvsViewport` mode is compiled to a `mode: 'world'` `SceneCamera` by `compileNvsViewportCamera()` before entering the `SceneTrack`.

### 7.6 Authoring Examples

World-space camera with explicit lens and exposure:

```tsx
<Camera
  mode="world"
  position={[0, 2, 8]}
  target={[0, 0, 0]}
  fov={45}
  near={0.1}
  far={100}
  exposure={1.2}
/>
```

Orbit camera with polar/azimuth positioning:

```tsx
<Camera
  mode="orbit"
  target={[0, 0, 0]}
  azimuth={0.5}
  polar={1.2}
  distance={6}
  fov={50}
/>
```

Auto-framing a model to fill 40% of viewport height (with offset):

```tsx
<Camera
  mode="fitBotHeight"
  targetId="hero-bot"
  targetHeight={1.8}
  framingHeightPct={0.4}
  heightOffset={0.1}
/>
```

Floor-depth framing for environment shots:

```tsx
<Camera
  mode="fitFloorDepth"
  floorY={0}
  floorZMin={-2}
  floorZMax={4}
  cameraX={0}
/>
```

NVS-first camera for diagram/chart scenes (no 3D models):

```tsx
<Camera
  mode="nvsViewport"
  worldScale={10}
  zRange={5}
/>
```

The compiler resolves this to an equivalent `mode: 'world'` state. With defaults (`worldScale=10`, `zRange=5`): `cameraZ` is approximately 12.07, visible world height is 10 units, visible world width is approximately 17.78 at 16:9 aspect ratio. The NVS coordinate service then maps `[0..1]` positions to world-space using this camera.

Eased camera transition between scenes:

```tsx
<Camera
  mode="world"
  position={[0, 3, 10]}
  target={[0, 0, 0]}
  transitionIn={{ type: 'eased', ease: 'smoothstep' }}
/>
```

Bezier-path camera transition:

```tsx
<Camera
  mode="world"
  position={[5, 2, 0]}
  target={[0, 0, 0]}
  transitionIn={{
    type: 'bezier',
    cp1: [2, 5, 3],
    cp2: [4, 3, 1],
    ease: 'easeInOut',
  }}
/>
```

Full interactive orbit with constraints:

```tsx
<Camera
  mode="orbit"
  target={[0, 0, 0]}
  azimuth={0}
  polar={1.0}
  distance={5}
  interaction={{
    enabled: true,
    rotate: { speed: 0.8 },
    zoom: { speed: 0.5 },
    wheelZoom: true,
    damping: 0.25,
    minPolarAngle: 0.3,
    maxPolarAngle: 1.5,
    minDistance: 2,
    maxDistance: 12,
    resetOnSceneChange: true,
    reset: { key: 'r' },
  }}
/>
```

### 7.7 ICameraInteractionDriver Abstraction

```typescript
// packages/core/src/elements/camera/types.ts

export interface ICameraInteractionDriver {
  attach(cameraObject: unknown, domElement: HTMLElement, config: TrackpadCameraConfig): void;
  setLookAt(position: Vec3, target: Vec3, smooth: boolean): void;
  update(deltaSeconds: number): boolean;
  configure(config: TrackpadCameraConfig): void;
  claimsWheel(): boolean;
  dispose(): void;
}

export type CameraInteractionDriverFactory = (
  cameraObject: unknown,
  domElement: HTMLElement,
  config: TrackpadCameraConfig,
) => ICameraInteractionDriver;
```

The `cameraObject` parameter is typed as `unknown` to keep the interface free of Three.js imports. Implementors cast to `THREE.PerspectiveCamera` internally.

The concrete implementation `CameraControlsDriver` wraps the `camera-controls` npm package. The test double `FakeInteractionDriver` implements the same interface with no Three.js dependency, enabling `CameraWidget` unit tests to run in a Node environment. The `CameraInteractionDriverFactory` function type is injected into `CameraWidget`'s constructor, defaulting to a factory that creates and attaches a `CameraControlsDriver`.

### 7.8 ICameraHost and ICameraFocusTarget Interfaces

```typescript
// packages/core/src/elements/camera/types.ts

export interface ICameraHost {
  isWheelClaimedByInteraction(): boolean;
  setInteractionDefaults(defaults: CameraInteractionDefaults | null | undefined): void;
}
```

`ICameraHost` decouples the player layer (`useSceneEngine`) from the concrete `CameraWidget` class. The player programs to this interface instead of importing `CameraWidget` directly.

```typescript
// packages/core/src/widget/types.ts

export interface ICameraFocusTarget extends IWidget {
  requestFocus(
    position: readonly [number, number, number],
    target: readonly [number, number, number],
    smooth?: boolean,
  ): void;
}
```

`ICameraFocusTarget` enables downstream widgets (e.g., `DiagramCanvasWidget`) to request a camera focus via `context.cameraFocusTarget.requestFocus()` instead of writing to `scene.userData`. `RuntimeDriverImpl` resolves the first registered `ICameraFocusTarget` from the `WidgetRegistry` and injects it into `AnimationTickContext` before each tick.

### 7.9 CameraWidget Interface Summary

```typescript
// packages/core/src/elements/camera/CameraWidget.ts

class CameraWidget
  implements
    ISceneElement<SceneCamera>,
    IRenderable<SceneCamera>,
    IAnimationController,
    ICameraHost,
    ICameraFocusTarget {

  readonly nodeHandlerCategory = 'ambient';
  readonly widgetId = 'camera';
  readonly defaultState: SceneCamera;
  readonly transitionSpec: FunctionalTransitionSpec<SceneCamera>;
  readonly DslComponent: typeof Camera;
  readonly disableWhenAbsent = true;

  constructor(driverFactory?: CameraInteractionDriverFactory);

  // CUSTOM_NODE_HANDLER — maps flat CameraProps to nested SceneCamera
  readonly [CUSTOM_NODE_HANDLER]: (
    node: { props: CameraProps },
    api: { setWidgetState: (id: string, state: SceneCamera) => void },
  ) => void;

  // ISceneElement
  mergeSnapshot(prev: SceneCamera | undefined, next: SceneCamera | undefined): SceneCamera | undefined;

  // IRenderable
  initialize(context: WidgetInitContext): void;
  apply(state: SceneCamera, context: WidgetRenderContext): void;  // no-op; driven by onTick

  // ICameraFocusTarget
  requestFocus(
    position: readonly [number, number, number],
    target: readonly [number, number, number],
    smooth?: boolean,
  ): void;

  // IAnimationController
  onTick(context: AnimationTickContext): void;

  // ICameraHost
  isWheelClaimedByInteraction(): boolean;
  setInteractionDefaults(defaults: CameraInteractionDefaults | null | undefined): void;

  // Direct camera manipulation (called by ActionInputController handlers)
  applyCameraOrbit(dx: number, dy: number, speed: number): void;
  applyCameraDolly(delta: number, speed: number): void;
  applyCameraPan(dx: number, dy: number, speed: number): void;

  dispose(): void;
}
```

The `apply()` method is a no-op. Camera state application is driven by `onTick()`, which reads `context.resolvedState` (the functional transition-resolved state) and applies it to the Three.js camera via `applyCamera()` from `render.ts`.

---

## 8. Technical Considerations

### 8.1 Descriptor Resolution

`FitBotHeightCamera` and `FitFloorDepthCamera` cannot be fully resolved at compile time because they depend on runtime values (viewport dimensions, model bounding box). The compiled `SceneCamera` stores the descriptor verbatim. Resolution to a world-space position and target occurs in the `applyCamera()` render function at each tick.

**`fitFloorDepth` is a v1 legacy mode.** It was calibrated for large-world scenes (100+ unit geometry). For all new scenes, prefer `mode: 'world'` or `mode: 'orbit'`. If `fitFloorDepth` must be used, always supply `cameraY` explicitly — the auto-derived fallback (`floorY + (floorZMax - floorZMin) * 0.4`) is a best-effort heuristic and is not guaranteed to produce a correct framing for non-standard floor extents.

The `fitFloorDepth` camera Z position is solved by a bisection algorithm (`solveCameraZForFloor` in `render.ts`) that searches for the camera Z that places all floor geometry within the view frustum. The search upper bound scales with the floor Z extent: `hi = floorZMax + Math.max(10, (floorZMax - floorZMin) * 20)`. This prevents the solver from settling on a camera position thousands of units out for small (1-unit scale) worlds.

When computing `FitBotHeight`, the render function retrieves the model bounding box from the corresponding model widget state in the `SceneTrackTick`. If the model has not finished loading, the camera falls back to the previous frame's position.

This means the `FitBotHeight` and `FitFloorDepth` modes produce correct framing only at scene entry. If the model moves during the scene, the camera does not track it — that behavior belongs in a `LookAt` or tracking camera feature, which is explicitly out of scope.

### 8.2 nvsViewport Compile-Time Resolution

The `nvsViewport` DSL mode is resolved entirely at compile time by the `CUSTOM_NODE_HANDLER` on `CameraWidget`. When `mode === 'nvsViewport'`, the handler calls `compileNvsViewportCamera(worldScale, zRange)` which produces a `SceneCamera` with `mode: 'world'`, a computed `position`, and derived `lens.near` and `lens.far` values. The `nvsViewport` mode never enters the `SceneTrack`.

Derivation formula (FOV fixed at 45 degrees):
- `cameraZ = worldScale / (2 * tan(22.5 degrees))` (approximately `worldScale * 1.2071`)
- `near = max(0.01, cameraZ - zRange / 2)`
- `far = cameraZ + zRange / 2`
- `position = [0, 0, cameraZ]`
- `target = [0, 0, 0]`

Default values: `worldScale = 10`, `zRange = worldScale / 2`.

### 8.3 Cross-Mode Transition Handling

When the `mode` changes between two consecutive scenes, the `interpolateCameraDescriptor` function in `compile.ts` resolves each descriptor to an equivalent world-space representation via `extractWorldPosFromDescriptor`. This produces two `Vec3` pairs (position + target) that can be lerped directly. If either descriptor is an auto-framing mode (`fitBotHeight`, `fitFloorDepth`) that cannot be resolved at compile time, the transition falls back to a hard cut at the midpoint.

Orbit descriptors are resolved to world-space using:

```typescript
function extractWorldPosFromDescriptor(d: CameraPositionDescriptor): { position: Vec3; target: Vec3 } | null {
  if (d.mode === 'world') return { position: d.position, target: d.target };
  if (d.mode === 'orbit') {
    const { target, azimuth, polar, distance } = d;
    const x = target[0] + distance * Math.cos(polar) * Math.sin(azimuth);
    const y = target[1] + distance * Math.sin(polar);
    const z = target[2] + distance * Math.cos(polar) * Math.cos(azimuth);
    return { position: [x, y, z], target };
  }
  return null;
}
```

This function lives in `compile.ts` and has no Three.js dependency.

### 8.4 Transition Interpolation System

The `CameraTransitionInterpolation` discriminated union controls how the camera moves between two `SceneCamera` states during scene transitions. Five modes are supported:

- **`linear`** — Component-wise lerp of position and target.
- **`eased`** — Linear interpolation with an easing function applied to `t`.
- **`bezier`** — Camera position follows a cubic bezier path; target is linearly interpolated.
- **`orbit`** — Both descriptors must be `mode: 'orbit'`; spherical interpolation of azimuth and polar angles with shortest-angle wrapping. Falls back to linear if either descriptor is not orbit.
- **`path`** — Camera position follows a CatmullRom spline through waypoints; target is linearly interpolated.

The `transitionIn` field on `SceneCamera` applies to the incoming scene. The `functionalCameraTransitionSpec` drives the interpolation and is assigned to `CameraWidget.transitionSpec`.

### 8.5 Lens Computation

When `focalLength` is provided, FOV is derived using:

```typescript
function fovFromFocalLength(focalLength: number, filmGauge: number = 35): number {
  return 2 * Math.atan(filmGauge / (2 * focalLength)) * (180 / Math.PI);
}
```

This matches Three.js `PerspectiveCamera.setFocalLength()` semantics. The computed FOV is stored in the compiled tick, not the raw `focalLength`, so the renderer always works with a resolved FOV value.

### 8.6 Tone Mapping Exposure

`CameraPost.exposure` is applied to `renderer.toneMappingExposure` inside the `applyCamera()` render function. The renderer reference is provided through the `CameraRenderContext` parameter, which receives it from `WidgetInitContext.renderer`. This must run every tick during a transition — not just at scene entry — to correctly interpolate exposure between scenes with different exposure values.

### 8.7 camera-controls Integration

The `camera-controls` library is a peer dependency of `@brewsite/core`. It must not be imported by any module outside of `CameraControlsDriver.ts`. The `CameraInteractionDriverFactory` pattern ensures the driver is only instantiated when `interaction.enabled` is `true`.

When `interaction.enabled` is `false` (the default), no `ICameraInteractionDriver` is created, and `CameraWidget` operates in compiled-state-only mode. This is the zero-interaction-cost path.

The `CameraWidget` constructor accepts an optional `CameraInteractionDriverFactory`. The default factory creates a `CameraControlsDriver` and calls `attach()`. Tests inject a `FakeInteractionDriver` factory.

### 8.8 Wheel Guard

When a user is actively interacting and the interaction driver claims all wheel events (`claimsWheel()` returns `true`), the scroll engine must not advance the scene while the user is interacting. `CameraWidget.isWheelClaimedByInteraction()` is queried by the player layer's scroll handler each frame. When `true`, scroll events are consumed by the camera and do not advance the `SceneTrack` position.

When `wheelZoom` is `false` (the default), `claimsWheel()` returns `false`. The driver still handles `Alt+wheel` internally (since scene navigation's `modifiersMatch()` ignores modifier-held events by default), without claiming unmodified wheel events.

### 8.9 Focus Request Flow

The `ICameraFocusTarget.requestFocus()` method on `CameraWidget` is the typed replacement for the removed `scene.userData['__brewsite_camera_focus']` bus. When called:

1. If interaction is active and a driver exists: `driver.setLookAt(position, target, smooth)` is called for smooth/instant motion.
2. If interaction is not active: the request is stored as a `_pendingFocusOverride` (`RuntimeCameraOverride`) and drained on the next `onTick()` via `context.setCameraOverride()`.

This enables downstream widgets (e.g., `DiagramCanvasWidget`) to request camera focus without knowing whether interaction mode is active.

### 8.10 Direct Camera Manipulation API

`CameraWidget` exposes three direct manipulation methods for use by `ActionInputController` handlers:

- `applyCameraOrbit(dx, dy, speed)` — Applies an orbital rotation delta around the last known look-at target. Computes new spherical coordinates from the current camera position, applies sensitivity-scaled deltas, and stores the result as a pending focus override.
- `applyCameraDolly(delta, speed)` — Moves the camera along the camera-to-target axis. Clamps to prevent the camera from passing through the target.
- `applyCameraPan(dx, dy, speed)` — Translates both camera and target together in the camera's local XY plane (truck/pedestal).

All three methods set a `_pendingFocusOverride` that is applied on the next `onTick()`.

### 8.11 Build and Tree-shaking

`CameraControlsDriver.ts` is the only file in the element that imports `camera-controls`. Consumers who never use `interaction` config on `<Camera>` will not include `camera-controls` in their bundle if their bundler performs tree-shaking correctly.

The camera element does not import the model element. The bounding box read for `FitBotHeight` is performed through the `SceneTrackTick` state, not a direct widget import.

---

## 9. Breaking Change Assessment

**Semver impact: Minor** — This PRD describes the current, stable element API. No breaking changes are introduced.

The `CameraPositionDescriptor` discriminated union is stable. Adding a new `mode` value in a future release is a minor change (additive, no existing code breaks). Removing or renaming a mode value is a major change.

`TrackpadCameraConfig` is entirely optional. Consumers who do not specify `interaction` are unaffected by any change to `TrackpadCameraConfig`'s shape. Changes to the shape of `TrackpadCameraConfig` that are additive (new optional fields) are minor.

If `ICameraInteractionDriver` gains a required method, that is a breaking change for consumers who have implemented the interface (e.g., for custom test doubles). New required methods must be accompanied by a major version bump and a migration guide.

`CameraTransitionInterpolation` is a union type that can be extended with new `type` variants without breaking existing consumers (additive, minor).

---

## 10. Dependencies

- `three` — peer dependency; `PerspectiveCamera`, `WebGLRenderer`, `Vector3`. Must not be bundled.
- `camera-controls` — peer dependency; used only in `CameraControlsDriver.ts`. Consumers who enable `interaction` must install this separately.
- `@types/three` — dev dependency.
- No new external dependencies are introduced by this element beyond `camera-controls`.
- Internal dependency: `packages/core/src/math/` — `Vec3` type, `lerpVec3`.
- Internal dependency: `packages/core/src/widget/` — `IWidget`, `ISceneElement`, `IRenderable`, `IAnimationController`, `ICameraFocusTarget`, `CUSTOM_NODE_HANDLER`, `WidgetRegistry`.
- Internal dependency: `packages/core/src/compiler/transitions/` — `ElementTransitionSpec`, `FunctionalTransitionSpec`, `transitionT`, `makeSimpleContext`.
- Internal dependency: `packages/core/src/timeline/math.ts` — `smoothstep` easing function.
- Internal dependency: `packages/core/src/layout/nvsWorldBridge.ts` — `nvsToWorldAnalytic` (used in `render.ts` for NVS target resolution).

---

## 11. Risks & Mitigations

**API regret — `mode` discriminant is a string literal union:** Adding new modes is safe; the union is open for extension. However, any consumer switch statement on `mode` that lacks a default/exhaustive handler will produce a TypeScript error on upgrade if new modes are added. This is a desired behavior — it forces consumers to handle the new case. Document this expectation explicitly in the changelog.

**`FitBotHeight` runtime dependency on model state:** The camera element depends on being able to query a model's position from the `SceneTrackTick` state at runtime. If the model has not loaded, framing silently degrades. Risk: a consumer scene where the model loads slowly shows a wrong camera position for the first few frames. Mitigation: the render function should fall back to the previous frame's camera position when the target model is not found in the tick state.

**camera-controls version coupling:** `camera-controls` must be compatible with the same version of Three.js that the consumer installs. If Three.js has a major version bump, `camera-controls` may lag. Mitigation: specify compatible `camera-controls` and `three` version ranges in `peerDependencies` with a comment explaining the coupling. Test with the minimum stated version in CI.

**Wheel guard complexity:** The interaction between user wheel input, scene scroll navigation, and the wheel guard introduces state machine complexity. A user who scrolls slowly may experience jerky scene transitions if the guard threshold is wrong. Mitigation: expose `wheelLockIdleMs`, `wheelAxisDominance`, and `wheelAxisActivationThreshold` as configurable values on `TrackpadCameraConfig` and `CameraInteractionDefaults`.

**Exposure interpolation artifact:** Interpolating `toneMappingExposure` from 1.0 to 2.5 produces a visible "bloom swell" if the transition is fast. This is a rendering aesthetic issue, not a bug. Mitigation: document that large exposure deltas across scenes produce visible tone-map transitions. Recommend authors keep exposure values close across adjacent scenes.

**`requestFocus` and scene-change collision:** If the user triggers `requestFocus` at the same time as a scene change, the focus override and the scene-change camera transition compete for the same camera state. Mitigation: `onTick()` checks `context.cameraOverride` first, and if active, exits interaction mode. Scene-change resets via `setLookAt` when `resetOnSceneChange` is `true`.

**Transition interpolation for auto-framing modes:** Bezier, orbit, and path transition modes require world-space positions from both the source and destination descriptors. `fitBotHeight` and `fitFloorDepth` cannot provide compile-time positions. When `extractWorldPosFromDescriptor` returns `null`, the transition falls back to a hard cut at `t=0.5`. This is documented in the `FitBotHeightCameraProps` JSDoc.

---

## 12. Open Questions

- Should `OrbitCamera.azimuth` and `OrbitCamera.polar` accept degrees as an alternative to radians? Radians are consistent with Three.js conventions, but many authors think in degrees. A `degreesToRadians` utility is available but requires authors to wrap every value. Decision deferred to a minor version addition of a `unit?: 'rad' | 'deg'` field.
- Should the `FitBotHeightCamera` descriptor be resolved to world-space at compile time (requiring a pre-bake step that reads model metadata from the manifest) rather than at runtime? Compile-time resolution would produce a deterministic `SceneTrack` but requires manifest to include model bounding-box metadata. The current runtime-resolution approach is simpler but defers correctness.
- Should `TrackpadCameraConfig` be separately specifiable per scene (allowing different interaction constraints across scenes), or specified once at the player level? Current model: interaction config comes from each scene's `<Camera>` component and is picked up live via `configure()` on the driver each tick.

---

## 13. Launch Criteria

- The `CameraPositionDescriptor` discriminated union narrows correctly in TypeScript strict mode for all four `mode` values. Verified by a type-level test using `satisfies`.
- `compile.ts` unit tests cover: `extractWorldPosFromDescriptor` conversion (orbit to world), `compileNvsViewportCamera` derivation, `interpolateCameraDescriptor` for all transition types (linear, eased, bezier, orbit, path), and exposure interpolation.
- `CameraWidget` tick lifecycle (`initialize` -> `onTick` -> interaction -> `dispose`) is covered by integration tests using `FakeInteractionDriver` with no Three.js dependency.
- `FitBotHeight` framing is covered by an integration test that asserts the computed camera position produces the correct viewport framing for a known model height and FOV.
- At least one example scene in `apps/examples/` demonstrates each descriptor mode in a multi-scene sequence.
- At least one example scene demonstrates interactive camera controls with orbit, dolly, constraints, and reset.
- `packages/core/README.md` documents the `<Camera>` props table and the four descriptor modes with inline examples.
- `ICameraInteractionDriver` is documented as a stable interface that consumers may implement for custom camera control schemes.
- CHANGELOG entry written covering any new fields or descriptor modes.
- Bundle analysis confirms `camera-controls` is absent from builds where no scene uses `interaction: { enabled: true }`.
- TypeScript strict mode passes with zero errors on all camera element module files.
