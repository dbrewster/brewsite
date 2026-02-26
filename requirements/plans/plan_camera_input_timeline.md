---
title: "Camera, Input, and Timeline Redesign"
doc_type: plan
owner: brewflow-architect
status: approved
updated: 2026-02-25
---

# Plan: Camera, Input, and Timeline Redesign

## 1. Overview & Motivation

The current BrewSite engine has three tightly scoped subsystems that have reached the limits of their original design:

1. **Camera** — Two auto-framing modes (`fitBotHeight`, `fitFloorDepth`) with no world-space positioning, no physical lens properties, and no interactive control.
2. **Scene navigation** — Pure window-scroll only. No keyboard, mouse-wheel, drag, swipe, or button support. No configurable bindings.
3. **Timeline** — Math utilities exist (`packages/core/src/timeline/`) but no visual widget exists. No HUD scrubber.

This plan redesigns all three with backward compatibility as a hard constraint. Existing scenes compile and run without modification. All new capability is additive.

### Goals
1. A first-class physical camera model with world-space positioning, orbital coordinates, FOV, focal length, and exposure.
2. Declarative camera transitions: linear, eased, bezier-path, orbit-arc, and object-follow.
3. Per-scene interactive camera control (orbit, pan, dolly) using pointer/touch events.
4. A configurable input system for scene navigation: wheel, drag, swipe, keyboard shortcuts, and button wiring.
5. A `TimelineWidget` React component for HUD-based progress scrubbing.

> **Phase 2 (not in this plan):** Depth-of-field / bokeh post-processing via `EffectComposer` + `BokehPass`. This requires reworking the render loop to call `composer.render()` instead of `renderer.render(scene, camera)` and is deferred to keep this plan scoped.

### Non-Goals
- Changing the compile pipeline (SceneTrackCompiler, SceneTrackSampler stay as-is).
- Breaking the element module pattern or dependency direction rules.
- Adding Three.js to anything other than `render.ts` files.
- Server-side rendering support.

---

## 2. Current State Summary

| Concern | Current Location | Limitation |
|---|---|---|
| Camera positioning | `elements/camera/render.ts` → `applyCamera()` | Mode-locked: only `fitBotHeight` / `fitFloorDepth` |
| Camera properties | `elements/camera/types.ts` → `SceneCamera` | FOV only; no position, orientation, focal length, DoF |
| Camera transitions | `elements/camera/compile.ts` → `functionalCameraTransitionSpec` | Blends numeric props; no path/orbit interpolation |
| Scene navigation | `player/useEngineScroll.ts` | Window scroll only |
| Input bindings | none | n/a |
| Timeline widget | none | Only `timeline/math.ts` utilities exist |

The Three.js camera (`PerspectiveCamera`) is created in `useSceneEngine.ts` at line 206 as a plain `new THREE.PerspectiveCamera(45, 1, 0.1, 2000)` and stored in `scene.userData['__brewsite_camera']`. The `CameraWidget.onTick()` reads it from there and calls `applyCamera()` each tick.

---

## 3. Package Dependencies

New packages to add to `packages/core/package.json`:

```json
"camera-controls": "^3.1.2"
```

`camera-controls` (yomotsu) is the only new runtime dependency. It wraps `THREE.PerspectiveCamera` with a full orbit/pan/dolly control system, smooth inertia/damping, and a clean update loop. It must be imported **only** inside `elements/camera/render.ts`.

No other new packages. Do NOT add `Hammer.js` or `react-three-fiber`; pointer events are sufficient for gesture recognition.

---

## 4. Area 1 — Camera System Redesign

### 4.1 New `SceneCamera` Type

**File:** `packages/core/src/elements/camera/types.ts`

Replace the current flat type with a discriminated union for the positioning descriptor, wrapped in a unified `SceneCamera` container. Preserve the existing modes as union members. Add two new modes: `world` and `orbit`.

```typescript
// packages/core/src/elements/camera/types.ts
// Camera element — pure type contracts. No runtime or Three.js imports.

/** 3-element tuple for world-space coordinates. */
export type Vec3 = [number, number, number];

/** Mouse button identifier for interaction bindings. */
export type MouseButton = 'left' | 'middle' | 'right';

/** Keyboard modifier keys. */
export type ModifierKey = 'alt' | 'ctrl' | 'meta' | 'shift';

/** A keyboard shortcut combo. */
export type KeyCombo = {
  /** Key value per KeyboardEvent.key (e.g. 'ArrowRight', 'r', 'Escape'). */
  key: string;
  modifiers?: ModifierKey[];
};

// ─── Positioning Descriptors ────────────────────────────────────────────────

/**
 * Explicit world-space camera: position and look-at target both in world coords.
 * Most precise; use for diagrams and layout-sensitive scenes.
 */
export type WorldSpaceCamera = {
  mode: 'world';
  /** Camera position in world space. */
  position: Vec3;
  /** Point the camera looks at. */
  target: Vec3;
  /** Up vector, default [0, 1, 0]. */
  up?: Vec3;
};

/**
 * Orbital camera: expressed as spherical coordinates around a target point.
 * Good for "turntable" views and scenes that rotate the camera around a subject.
 */
export type OrbitCamera = {
  mode: 'orbit';
  /** Orbit center in world space. */
  target: Vec3;
  /** Horizontal angle in radians (0 = +Z axis, positive = counter-clockwise). */
  azimuth: number;
  /** Vertical angle from horizontal plane in radians (0 = equator, +PI/2 = top). */
  polar: number;
  /** Distance from target in world units. */
  distance: number;
  /** Up vector, default [0, 1, 0]. */
  up?: Vec3;
};

/**
 * Auto-frame: positions camera to frame a target model at a given height.
 * Preserved from v1 for backward compatibility.
 */
export type FitBotHeightCamera = {
  mode: 'fitBotHeight';
  /** Widget ID of the model to frame. */
  targetId: string;
  /** Target object height at scale=1 in world units. */
  targetHeight: number;
  /** Portion of viewport height the target should occupy (0..1). Default 0.4. */
  framingHeightPct?: number;
  /** Camera Y offset relative to target position. Default 0. */
  heightOffset?: number;
  /** Additional distance added to computed camera distance. Default 0. */
  distanceOffset?: number;
};

/**
 * Auto-frame: positions camera to frame a floor Z span in view.
 * Preserved from v1 for backward compatibility.
 */
export type FitFloorDepthCamera = {
  mode: 'fitFloorDepth';
  floorY: number;
  floorZMin: number;
  floorZMax: number;
  lookAtZ?: number;
  cameraX?: number;
  cameraY?: number;
};

/** All positioning descriptor variants. */
export type CameraPositionDescriptor =
  | WorldSpaceCamera
  | OrbitCamera
  | FitBotHeightCamera
  | FitFloorDepthCamera;

// ─── Lens / Optics ──────────────────────────────────────────────────────────

// Phase 2 (deferred): DofConfig and full bokeh post-processing via EffectComposer.
// Implementing DoF requires calling composer.render() instead of renderer.render()
// which is a runtime loop change out of scope for this plan. The type is reserved
// here as a placeholder so scene authors can wire it up in a future phase without
// a breaking change to SceneCamera.
export type DofConfig = never; // Phase 2 — not yet implemented

/**
 * Lens properties for the Three.js PerspectiveCamera.
 * All are optional; undefined means "use Three.js defaults".
 */
export type CameraLens = {
  /** Vertical field of view in degrees. Default 45. */
  fov?: number;
  /**
   * Focal length in millimetres relative to filmGauge.
   * If set, overrides fov. 50mm on 35mm film ≈ 39.6° FOV.
   */
  focalLength?: number;
  /** Film gauge in mm. Default 35. Affects focalLength computation. */
  filmGauge?: number;
  /** Near clip plane in world units. Default 0.1. */
  near?: number;
  /** Far clip plane in world units. Default 2000. */
  far?: number;
};

/**
 * Rendering properties applied directly to the WebGLRenderer each tick.
 * Phase 2 will extend this with DoF/bokeh via EffectComposer.
 */
export type CameraPost = {
  /**
   * Renderer tone-mapping exposure multiplier.
   * Applied as renderer.toneMappingExposure. Default 1.0.
   * The renderer reference is read from scene.userData['__brewsite_renderer'].
   */
  exposure?: number;
  // dof?: DofConfig;  ← Phase 2: deferred
};

// ─── Interactive Camera Control ──────────────────────────────────────────────

/**
 * Per-axis interaction override.
 * Setting to false disables the action entirely.
 */
export type PointerAction = {
  /** Which mouse button triggers this action. */
  pointer?: MouseButton;
  /** Required keyboard modifiers (all must be held). */
  modifiers?: ModifierKey[];
  /** Number of touch fingers (for touch devices). */
  touchFingers?: number;
} | false;

/**
 * Camera interaction configuration embedded in SceneCamera.
 * When enabled, camera-controls takes over input on the canvas element.
 * Scene-defined camera position is saved and can be restored via reset.
 */
export type CameraInteractionConfig = {
  /** Whether interactive camera control is active for this scene. Default false. */
  enabled: boolean;

  /**
   * Orbit (rotate around target).
   * Default: left-click drag, single-finger touch.
   */
  orbit?: PointerAction;

  /**
   * Pan (truck/pedestal — translate camera and target together).
   * Default: right-click drag, two-finger touch drag.
   */
  pan?: PointerAction;

  /**
   * Dolly (zoom — change distance to target).
   * wheel: true = enable mouse-wheel dolly.
   * pinch: true = enable pinch-to-zoom (touch).
   */
  dolly?: {
    wheel?: boolean;
    pinch?: boolean;
    wheelModifiers?: ModifierKey[];
  } | false;

  /** Keyboard shortcut to reset camera to scene-defined position. Default { key: 'r' }. */
  reset?: KeyCombo;

  /**
   * Whether to smoothly return the camera to the scene-defined position when
   * the scene index changes (i.e. the user scrolls to a new scene while in
   * interaction mode). Default true.
   *
   * The reset is animated — camera-controls.setLookAt(..., enableTransition=true)
   * is called so the camera glides back rather than snapping. The duration is
   * governed by camera-controls' internal smoothTime (~0.25s with default damping).
   *
   * Set to false if you want the user's camera position to persist across
   * scene transitions (e.g. a continuous multi-scene diagram).
   */
  resetOnSceneChange?: boolean;

  // ─── Constraints ─────────────────────────────────────────────────────────
  minDistance?: number;
  maxDistance?: number;
  /** Minimum polar angle from top (radians). Default 0. */
  minPolarAngle?: number;
  /** Maximum polar angle from top (radians). Default Math.PI. */
  maxPolarAngle?: number;
  minAzimuthAngle?: number;
  maxAzimuthAngle?: number;

  // ─── Feel ─────────────────────────────────────────────────────────────────
  /**
   * Inertia/damping coefficient. true = 0.05 default.
   * Higher = more inertia. 0 = no inertia.
   */
  damping?: boolean | number;
  orbitSpeed?: number;
  panSpeed?: number;
  dollySpeed?: number;
};

// ─── Transition Interpolation ────────────────────────────────────────────────

/**
 * Easing function names for camera transitions.
 * These correspond to the easing functions available in timeline/math.ts.
 */
export type EaseFnName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'smoothstep';

/**
 * Camera transition interpolation descriptor.
 * Controls how the camera moves between two SceneCamera states during a scene transition.
 */
export type CameraTransitionInterpolation =
  | {
      type: 'linear';
    }
  | {
      type: 'eased';
      ease: EaseFnName;
    }
  | {
      /**
       * Camera position follows a cubic bezier path through world space.
       * p0 = fromPosition, p3 = toPosition.
       * cp1 and cp2 are intermediate control points in world coords.
       */
      type: 'bezier';
      cp1: Vec3;
      cp2: Vec3;
      ease?: EaseFnName;
    }
  | {
      /**
       * Camera orbits around its target point while interpolating.
       * Both azimuth and polar are spherically interpolated.
       * Best for "rotate around subject" transitions.
       */
      type: 'orbit';
      ease?: EaseFnName;
    }
  | {
      /**
       * Camera follows a CatmullRom spline through the given waypoints.
       * First waypoint = fromPosition, last waypoint = toPosition.
       * Intermediate waypoints shape the curve.
       */
      type: 'path';
      waypoints: Vec3[];
      ease?: EaseFnName;
    };

// ─── Unified SceneCamera ────────────────────────────────────────────────────

/**
 * The complete scene camera state compiled into each SceneTrackTick.
 * This is what lives in tick.state.widgets['camera'].
 *
 * v1 compatibility: the 'fitBotHeight' and 'fitFloorDepth' modes are still
 * supported and behave identically to the original implementation.
 */
export type SceneCamera = {
  /** Whether this camera descriptor is active. false = use Three.js defaults. */
  enabled: boolean;

  /** Positioning descriptor. Determines how camera position/orientation are computed. */
  descriptor: CameraPositionDescriptor;

  /** Lens and projection settings. */
  lens?: CameraLens;

  /** Post-processing and rendering settings. */
  post?: CameraPost;

  /** Interactive camera control for this scene. */
  interaction?: CameraInteractionConfig;

  /**
   * Interpolation mode for this camera when transitioning INTO this scene.
   * Overrides the default linear blend in functionalCameraTransitionSpec.
   */
  transitionIn?: CameraTransitionInterpolation;
};
```

### 4.2 DSL Component

**File:** `packages/core/src/elements/camera/dsl.tsx`

The `CameraProps` type is flattened for ergonomic authoring. The DSL component maps flat props to the nested `SceneCamera` structure via a custom node handler (registered in `CameraWidget.ts`).

```typescript
// packages/core/src/elements/camera/dsl.tsx
// Camera DSL component — authoring surface. No Three.js. No runtime imports.

import type {
  Vec3,
  CameraLens,
  CameraPost,
  CameraInteractionConfig,
  CameraTransitionInterpolation,
} from './types';

// ─── Flat authoring props ─────────────────────────────────────────────────

/**
 * World-space camera props.
 * Use when you want explicit control of position and target.
 */
export type WorldCameraProps = {
  mode: 'world';
  position: Vec3;
  target: Vec3;
  up?: Vec3;
};

/**
 * Orbital camera props.
 * Use for turntable views or rotate-around-subject transitions.
 */
export type OrbitCameraProps = {
  mode: 'orbit';
  target: Vec3;
  /** Horizontal angle in radians. 0 = +Z facing. */
  azimuth: number;
  /** Vertical angle from equator in radians. 0 = level, +PI/2 = top-down. */
  polar: number;
  /** Distance from target in world units. */
  distance: number;
  up?: Vec3;
};

/** Legacy fitBotHeight props for backward compatibility. */
export type FitBotHeightCameraProps = {
  mode?: 'fitBotHeight';
  targetId: string;
  targetHeight: number;
  framingHeightPct?: number;
  heightOffset?: number;
  distanceOffset?: number;
};

/** Legacy fitFloorDepth props for backward compatibility. */
export type FitFloorDepthCameraProps = {
  mode: 'fitFloorDepth';
  floorY: number;
  floorZMin: number;
  floorZMax: number;
  lookAtZ?: number;
  cameraX?: number;
  cameraY?: number;
};

export type CameraDescriptorProps =
  | WorldCameraProps
  | OrbitCameraProps
  | FitBotHeightCameraProps
  | FitFloorDepthCameraProps;

/**
 * Full Camera DSL props.
 * Combine a positioning descriptor with optional lens/post/interaction config.
 */
export type CameraProps = CameraDescriptorProps & {
  // Lens (flat, maps to CameraLens)
  fov?: number;
  focalLength?: number;
  filmGauge?: number;
  near?: number;
  far?: number;
  // Post (flat, maps to CameraPost) — DoF is Phase 2
  exposure?: number;
  // Interaction
  interaction?: CameraInteractionConfig;
  // Transition
  transitionIn?: CameraTransitionInterpolation;
};

/** Camera DSL component — returns null; consumed purely by the compiler. */
export const Camera = (_props: CameraProps): null => null;

Camera.displayName = 'Camera';
```

### 4.3 Compile Layer

**File:** `packages/core/src/elements/camera/compile.ts`

```typescript
// packages/core/src/elements/camera/compile.ts
// Camera element compilation — pure functions. No Three.js. No React.

import type { SceneCamera, CameraPositionDescriptor, CameraTransitionInterpolation, Vec3 } from './types';
import type { FunctionalTransitionSpec } from '../../compiler/transitions/transitionTypes';

// ─── Defaults ─────────────────────────────────────────────────────────────

export const DEFAULT_CAMERA_DESCRIPTOR: CameraPositionDescriptor = {
  mode: 'fitBotHeight',
  targetId: '',
  targetHeight: 1,
  framingHeightPct: 0.4,
  heightOffset: 0,
  distanceOffset: 0,
};

export const DEFAULT_CAMERA: SceneCamera = {
  enabled: false,
  descriptor: DEFAULT_CAMERA_DESCRIPTOR,
  lens: { fov: 45, near: 0.1, far: 2000 },
};

// ─── Vec3 interpolation helpers ────────────────────────────────────────────

const lerpVec3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const lerpNum = (a: number | undefined, b: number | undefined, t: number): number | undefined => {
  if (a === undefined || b === undefined) return t < 0.5 ? a : b;
  return a + (b - a) * t;
};

// ─── Easing functions ─────────────────────────────────────────────────────

import { smoothstep } from '../../timeline/math';

const EASE_FNS: Record<string, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  smoothstep,
};

const applyEase = (t: number, easeName?: string): number => {
  const fn = easeName ? EASE_FNS[easeName] : undefined;
  return fn ? fn(t) : t;
};

// ─── Bezier cubic interpolation ────────────────────────────────────────────

const cubicBezierVec3 = (p0: Vec3, cp1: Vec3, cp2: Vec3, p3: Vec3, t: number): Vec3 => {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const uuu = uu * u;
  const ttt = tt * t;
  return [
    uuu * p0[0] + 3 * uu * t * cp1[0] + 3 * u * tt * cp2[0] + ttt * p3[0],
    uuu * p0[1] + 3 * uu * t * cp1[1] + 3 * u * tt * cp2[1] + ttt * p3[1],
    uuu * p0[2] + 3 * uu * t * cp1[2] + 3 * u * tt * cp2[2] + ttt * p3[2],
  ];
};

// ─── CatmullRom spline interpolation ──────────────────────────────────────

const catmullRomVec3 = (waypoints: Vec3[], t: number): Vec3 => {
  if (waypoints.length < 2) return waypoints[0] ?? [0, 0, 0];
  const n = waypoints.length - 1;
  const scaled = t * n;
  const segment = Math.min(Math.floor(scaled), n - 1);
  const segT = scaled - segment;

  const p0 = waypoints[Math.max(0, segment - 1)] as Vec3;
  const p1 = waypoints[segment] as Vec3;
  const p2 = waypoints[Math.min(n, segment + 1)] as Vec3;
  const p3 = waypoints[Math.min(n, segment + 2)] as Vec3;

  const t2 = segT * segT;
  const t3 = t2 * segT;

  return [
    0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * segT + (2*p0[0] - 5*p1[0] + 4*p2[0] - p3[0]) * t2 + (-p0[0] + 3*p1[0] - 3*p2[0] + p3[0]) * t3),
    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * segT + (2*p0[1] - 5*p1[1] + 4*p2[1] - p3[1]) * t2 + (-p0[1] + 3*p1[1] - 3*p2[1] + p3[1]) * t3),
    0.5 * ((2 * p1[2]) + (-p0[2] + p2[2]) * segT + (2*p0[2] - 5*p1[2] + 4*p2[2] - p3[2]) * t2 + (-p0[2] + 3*p1[2] - 3*p2[2] + p3[2]) * t3),
  ];
};

// ─── Descriptor position extraction helpers ──────────────────────────────

/**
 * Extracts a world-space [position, target] pair from a descriptor, if possible.
 * Returns null for auto-framing modes (those are resolved at render time).
 */
export const extractWorldPosFromDescriptor = (
  d: import('./types').CameraPositionDescriptor,
): { position: Vec3; target: Vec3 } | null => {
  if (d.mode === 'world') return { position: d.position, target: d.target };
  if (d.mode === 'orbit') {
    const { target, azimuth, polar, distance } = d;
    const x = target[0] + distance * Math.cos(polar) * Math.sin(azimuth);
    const y = target[1] + distance * Math.sin(polar);
    const z = target[2] + distance * Math.cos(polar) * Math.cos(azimuth);
    return { position: [x, y, z], target };
  }
  return null;
};

// ─── Position interpolation using transitionIn spec ──────────────────────

/**
 * Interpolates camera world-space position and target according to
 * the `transitionIn` spec on the destination camera state.
 * Returns an interpolated 'world' descriptor if both descriptors
 * can be resolved to world positions; otherwise falls back to a
 * half-way switch.
 */
export const interpolateCameraDescriptor = (
  from: SceneCamera,
  to: SceneCamera,
  rawT: number,
): import('./types').CameraPositionDescriptor => {
  const interp = to.transitionIn ?? { type: 'linear' };
  const t = applyEase(rawT, interp.type === 'eased' ? interp.ease : undefined);

  const fromPos = extractWorldPosFromDescriptor(from.descriptor);
  const toPos = extractWorldPosFromDescriptor(to.descriptor);

  if (!fromPos || !toPos) {
    // Can't interpolate auto-framing modes; switch at midpoint
    return rawT < 0.5 ? from.descriptor : to.descriptor;
  }

  switch (interp.type) {
    case 'linear':
    case 'eased':
      return {
        mode: 'world',
        position: lerpVec3(fromPos.position, toPos.position, t),
        target: lerpVec3(fromPos.target, toPos.target, t),
      };

    case 'bezier': {
      const easedT = applyEase(rawT, interp.ease);
      return {
        mode: 'world',
        position: cubicBezierVec3(fromPos.position, interp.cp1, interp.cp2, toPos.position, easedT),
        target: lerpVec3(fromPos.target, toPos.target, easedT),
      };
    }

    case 'orbit': {
      // Both must be orbit descriptors for this to be meaningful
      if (from.descriptor.mode === 'orbit' && to.descriptor.mode === 'orbit') {
        const easedT = applyEase(rawT, interp.ease);
        // Spherical interpolation for azimuth/polar, linear for distance and target
        const shortAngle = (a: number, b: number) => {
          let delta = ((b - a) % (2 * Math.PI));
          if (delta > Math.PI) delta -= 2 * Math.PI;
          if (delta < -Math.PI) delta += 2 * Math.PI;
          return a + delta * easedT;
        };
        return {
          mode: 'orbit',
          target: lerpVec3(from.descriptor.target, to.descriptor.target, easedT),
          azimuth: shortAngle(from.descriptor.azimuth, to.descriptor.azimuth),
          polar: lerpNum(from.descriptor.polar, to.descriptor.polar, easedT) as number,
          distance: lerpNum(from.descriptor.distance, to.descriptor.distance, easedT) as number,
        };
      }
      // Fallback to linear world-space
      return {
        mode: 'world',
        position: lerpVec3(fromPos.position, toPos.position, t),
        target: lerpVec3(fromPos.target, toPos.target, t),
      };
    }

    case 'path': {
      const easedT = applyEase(rawT, interp.ease);
      const allPoints: Vec3[] = [fromPos.position, ...interp.waypoints, toPos.position];
      return {
        mode: 'world',
        position: catmullRomVec3(allPoints, easedT),
        target: lerpVec3(fromPos.target, toPos.target, easedT),
      };
    }

    default:
      return rawT < 0.5 ? from.descriptor : to.descriptor;
  }
};

// ─── Lens interpolation ───────────────────────────────────────────────────

const interpolateLens = (
  from: SceneCamera,
  to: SceneCamera,
  t: number,
): import('./types').CameraLens | undefined => {
  const fl = from.lens;
  const tl = to.lens;
  if (!fl && !tl) return undefined;
  return {
    fov: lerpNum(fl?.fov, tl?.fov, t),
    focalLength: lerpNum(fl?.focalLength, tl?.focalLength, t),
    filmGauge: t < 0.5 ? fl?.filmGauge : tl?.filmGauge,
    near: lerpNum(fl?.near, tl?.near, t),
    far: lerpNum(fl?.far, tl?.far, t),
  };
};

const interpolatePost = (
  from: SceneCamera,
  to: SceneCamera,
  t: number,
): import('./types').CameraPost | undefined => {
  const fp = from.post;
  const tp = to.post;
  if (!fp && !tp) return undefined;
  // Phase 2: DoF interpolation will be added here alongside EffectComposer support.
  return {
    exposure: lerpNum(fp?.exposure, tp?.exposure, t),
  };
};

// ─── Functional transition spec ───────────────────────────────────────────

export const functionalCameraTransitionSpec: FunctionalTransitionSpec<SceneCamera> = {
  exitFn: (from) => (t) => ({ ...from, enabled: from.enabled && t < 1 }),

  enterFn: (to) => (t) => ({ ...to, enabled: to.enabled && t > 0 }),

  interpolateFn: (from, to) => (t) => ({
    enabled: (from.enabled && t < 1) || (to.enabled && t > 0),
    descriptor: interpolateCameraDescriptor(from, to, t),
    lens: interpolateLens(from, to, t),
    post: interpolatePost(from, to, t),
    // Interaction and transitionIn come from the destination (to) scene
    interaction: to.interaction,
    transitionIn: to.transitionIn,
  }),
};
```

### 4.4 Render Layer

**File:** `packages/core/src/elements/camera/render.ts`

```typescript
// packages/core/src/elements/camera/render.ts
// Camera element renderer — Three.js camera control.
// ONLY file in the camera module that may import Three.js.

import * as THREE from 'three';
import CameraControls from 'camera-controls';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { SceneModelInstanceState } from '../model/types';
import type { SceneCamera, CameraInteractionConfig } from './types';
import { extractWorldPosFromDescriptor } from './compile';

// Install camera-controls THREE subset (called once at module load)
CameraControls.install({ THREE: THREE });

export type CameraRenderContext = {
  camera: THREE.PerspectiveCamera;
  tick: SceneTrackTick;
  /**
   * Renderer reference, used for exposure application.
   * Read from scene.userData['__brewsite_renderer'] in CameraWidget.
   */
  renderer?: THREE.WebGLRenderer;
};

// ─── Helpers (preserved from v1) ─────────────────────────────────────────

const degToRad = (deg: number): number => (deg * Math.PI) / 180;

const getTargetState = (tick: SceneTrackTick, targetId: string): SceneModelInstanceState | null => {
  const raw = tick.state.widgets[targetId] as SceneModelInstanceState | undefined;
  if (!raw?.model?.position) return null;
  return raw;
};

const computeRayIntersectionZ = (
  camera: THREE.PerspectiveCamera,
  ndcY: number,
  floorY: number,
): number | null => {
  const origin = camera.position.clone();
  const point = new THREE.Vector3(0, ndcY, 0.5).unproject(camera);
  const dir = point.sub(origin).normalize();
  if (Math.abs(dir.y) < 1e-6) return null;
  const t = (floorY - origin.y) / dir.y;
  if (!Number.isFinite(t) || t <= 0) return null;
  return origin.z + dir.z * t;
};

const solveCameraZForFloor = (
  camera: THREE.PerspectiveCamera,
  params: {
    floorY: number; floorZMin: number; floorZMax: number;
    lookAtZ: number; cameraX: number; cameraY: number;
  },
): number | null => {
  const zMin = Math.min(params.floorZMin, params.floorZMax);
  const zMax = Math.max(params.floorZMin, params.floorZMax);
  let lo = zMax + 1;
  let hi = zMax + 5000;
  let bestZ = lo;
  let bestErr = Infinity;

  for (let i = 0; i < 30; i++) {
    const step = (hi - lo) / 4;
    const candidates = [lo, lo + step, lo + 2 * step, lo + 3 * step, hi];
    let bestIdx = 0;
    for (let c = 0; c < candidates.length; c++) {
      const z = candidates[c] as number;
      camera.position.set(params.cameraX, params.cameraY, z);
      camera.lookAt(params.cameraX, params.floorY, params.lookAtZ);
      camera.updateMatrixWorld(true);
      const zTop = computeRayIntersectionZ(camera, 1, params.floorY);
      const zBottom = computeRayIntersectionZ(camera, -1, params.floorY);
      if (zTop === null || zBottom === null) continue;
      const err = (zTop - zMin) ** 2 + (zBottom - zMax) ** 2;
      if (err < bestErr) { bestErr = err; bestZ = z; bestIdx = c; }
    }
    const center = candidates[bestIdx] as number;
    lo = Math.max(zMax + 1, center - step);
    hi = center + step;
  }
  return Number.isFinite(bestZ) ? bestZ : null;
};

// ─── Position application ────────────────────────────────────────────────

/**
 * Applies camera position and orientation from a SceneCamera state.
 * Call this on every tick (CameraWidget.onTick) UNLESS interactive mode is active.
 */
export const applyCamera = (state: SceneCamera, ctx: CameraRenderContext): void => {
  if (!state.enabled) return;
  const { camera, tick } = ctx;

  // Apply lens
  const lens = state.lens;
  if (lens) {
    if (lens.filmGauge !== undefined) camera.filmGauge = lens.filmGauge;
    if (lens.focalLength !== undefined) {
      camera.setFocalLength(lens.focalLength);
    } else if (lens.fov !== undefined) {
      camera.fov = lens.fov;
    }
    if (lens.near !== undefined) camera.near = lens.near;
    if (lens.far !== undefined) camera.far = lens.far;
    camera.updateProjectionMatrix();
  }

  // Apply post (exposure only — DoF is Phase 2)
  if (ctx.renderer && state.post?.exposure !== undefined) {
    ctx.renderer.toneMappingExposure = state.post.exposure;
  }

  const desc = state.descriptor;

  // World-space mode
  if (desc.mode === 'world') {
    camera.position.set(...desc.position);
    camera.lookAt(...desc.target);
    if (desc.up) camera.up.set(...desc.up);
    return;
  }

  // Orbit mode — convert spherical to Cartesian
  if (desc.mode === 'orbit') {
    const { target, azimuth, polar, distance } = desc;
    const x = target[0] + distance * Math.cos(polar) * Math.sin(azimuth);
    const y = target[1] + distance * Math.sin(polar);
    const z = target[2] + distance * Math.cos(polar) * Math.cos(azimuth);
    camera.position.set(x, y, z);
    camera.lookAt(...target);
    if (desc.up) camera.up.set(...desc.up);
    return;
  }

  // fitBotHeight mode (v1 preserved)
  if (desc.mode === 'fitBotHeight') {
    if (!desc.targetId || typeof desc.targetHeight !== 'number') return;
    const target = getTargetState(tick, desc.targetId);
    if (!target) return;
    const targetPos = target.model.position;
    const targetScale = target.model.scale ?? 1;
    const framing = desc.framingHeightPct ?? 0.4;
    if (framing <= 0) return;
    const fovRad = degToRad(lens?.fov ?? camera.fov ?? 45);
    const targetHeight = desc.targetHeight * targetScale;
    const distance = (targetHeight / framing) / (2 * Math.tan(fovRad / 2));
    const yOffset = desc.heightOffset ?? 0;
    const zOffset = desc.distanceOffset ?? 0;
    camera.position.set(targetPos[0], targetPos[1] + yOffset, targetPos[2] + distance + zOffset);
    camera.lookAt(targetPos[0], targetPos[1], targetPos[2]);
    return;
  }

  // fitFloorDepth mode (v1 preserved)
  if (desc.mode === 'fitFloorDepth') {
    if (
      typeof desc.floorY !== 'number' ||
      typeof desc.floorZMin !== 'number' ||
      typeof desc.floorZMax !== 'number'
    ) return;
    const lookAtZ = desc.lookAtZ ?? (desc.floorZMin + desc.floorZMax) / 2;
    const cameraX = desc.cameraX ?? 0;
    const cameraY = desc.cameraY ?? desc.floorY + 50;
    const solvedZ = solveCameraZForFloor(camera, {
      floorY: desc.floorY,
      floorZMin: desc.floorZMin,
      floorZMax: desc.floorZMax,
      lookAtZ,
      cameraX,
      cameraY,
    });
    if (typeof solvedZ !== 'number') return;
    camera.position.set(cameraX, cameraY, solvedZ);
    camera.lookAt(cameraX, desc.floorY, lookAtZ);
  }
};

// ─── CameraControls creation ─────────────────────────────────────────────

/**
 * Creates a camera-controls instance for the given camera and DOM element.
 * The config is read from CameraInteractionConfig.
 * Call this when entering interactive mode.
 */
export const createCameraControls = (
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  config: CameraInteractionConfig,
): CameraControls => {
  const cc = new CameraControls(camera, domElement);

  // Damping
  if (config.damping === false || config.damping === 0) {
    cc.dampingFactor = 0;
  } else if (typeof config.damping === 'number') {
    cc.dampingFactor = config.damping;
  } else {
    cc.dampingFactor = 0.05; // default
  }

  // Speeds
  if (config.orbitSpeed !== undefined) cc.azimuthRotateSpeed = config.orbitSpeed;
  if (config.panSpeed !== undefined) cc.truckSpeed = config.panSpeed;
  if (config.dollySpeed !== undefined) cc.dollySpeed = config.dollySpeed;

  // Constraints
  if (config.minDistance !== undefined) cc.minDistance = config.minDistance;
  if (config.maxDistance !== undefined) cc.maxDistance = config.maxDistance;
  if (config.minPolarAngle !== undefined) cc.minPolarAngle = config.minPolarAngle;
  if (config.maxPolarAngle !== undefined) cc.maxPolarAngle = config.maxPolarAngle;
  if (config.minAzimuthAngle !== undefined) cc.minAzimuthAngle = config.minAzimuthAngle;
  if (config.maxAzimuthAngle !== undefined) cc.maxAzimuthAngle = config.maxAzimuthAngle;

  // Mouse button bindings
  const LEFT = CameraControls.ACTION.ROTATE;
  const MIDDLE = CameraControls.ACTION.DOLLY;
  const RIGHT = CameraControls.ACTION.TRUCK;
  const NONE = CameraControls.ACTION.NONE;

  // Orbit binding
  const orbitCfg = config.orbit;
  if (orbitCfg === false) {
    cc.mouseButtons.left = NONE;
    cc.touches.one = CameraControls.ACTION.NONE;
  } else if (orbitCfg) {
    const btn = orbitCfg.pointer ?? 'left';
    if (btn === 'left') cc.mouseButtons.left = LEFT;
    else if (btn === 'middle') cc.mouseButtons.middle = LEFT;
    else if (btn === 'right') cc.mouseButtons.right = LEFT;
  }

  // Pan binding
  const panCfg = config.pan;
  if (panCfg === false) {
    cc.mouseButtons.right = NONE;
    cc.touches.two = CameraControls.ACTION.NONE;
  } else if (panCfg) {
    const btn = panCfg.pointer ?? 'right';
    if (btn === 'left') cc.mouseButtons.left = RIGHT;
    else if (btn === 'middle') cc.mouseButtons.middle = RIGHT;
    else if (btn === 'right') cc.mouseButtons.right = RIGHT;
  }

  // Dolly binding
  const dollyCfg = config.dolly;
  if (dollyCfg === false) {
    cc.mouseButtons.wheel = NONE;
    cc.touches.two = CameraControls.ACTION.NONE;
  } else if (dollyCfg) {
    if (dollyCfg.wheel !== false) cc.mouseButtons.wheel = MIDDLE;
    if (dollyCfg.pinch !== false) {
      cc.touches.two = CameraControls.ACTION.TOUCH_DOLLY_TRUCK;
    }
  }

  return cc;
};
```

### 4.5 CameraWidget

**File:** `packages/core/src/elements/camera/CameraWidget.ts`

Key design notes before the code:

1. **`initialize()` is NOT called on `IAnimationController` instances** — only on `IRenderable`. The camera and renderer references are therefore lazy-initialised inside `onTick()` by reading from `scene.userData`. `useSceneEngine.ts` must store `scene.userData['__brewsite_renderer'] = renderer` alongside `scene.userData['__brewsite_camera'] = camera` (both happen at Three.js init time, line ~208).

2. **Scene change detection** — `lastSceneIndex` tracks the previous `tick.sceneIndex`. When it changes and `interaction.resetOnSceneChange !== false`, a smooth animated reset fires via `camera-controls.setLookAt(..., enableTransition=true)`.

3. **Keyboard reset listener** — attached to `domElement` on interaction enter, removed on exit. `tabIndex` on the canvas is handled by `EngineInputRegion`.

4. **`camera-controls` import** — `CameraWidget.ts` imports `camera-controls` for its TypeScript type and for calling `cameraControls.update()`. The Three.js `CameraControls.install()` call and all `createCameraControls` factory logic stay in `render.ts`. This is acceptable because `CameraWidget.ts` is not the compile layer — it is the runtime widget file, and `camera-controls` is a control library (not a Three.js renderer).

5. **Wheel conflict guard** — `CameraWidget` exposes `isWheelClaimedByInteraction(): boolean`. `useEngineInput` reads this flag when deciding whether to process wheel events for scene navigation. See §6.2.

```typescript
// CameraWidget — ISceneElement + IAnimationController.
// Manages both scene-driven and interactive camera modes.

import type { SceneCamera } from './types';
import type * as THREE from 'three';
import type CameraControls from 'camera-controls';
import { DEFAULT_CAMERA, functionalCameraTransitionSpec, extractWorldPosFromDescriptor } from './compile';
import { Camera } from './dsl';
import type { CameraProps } from './dsl';
import { applyCamera, createCameraControls } from './render';
import type { AnimationTickContext, IAnimationController, ISceneElement } from '../../widget/types';

const CAMERA_KEY = '__brewsite_camera';
const RENDERER_KEY = '__brewsite_renderer';

// Symbol for WidgetRegistry's custom DSL node handler lookup.
// Must match the key used in WidgetRegistry.registerTypeFactory internals.
export const CUSTOM_NODE_HANDLER = '__customNodeHandler';

export class CameraWidget implements ISceneElement<SceneCamera>, IAnimationController {
  readonly widgetId = 'camera';
  readonly defaultState: SceneCamera = DEFAULT_CAMERA;
  readonly transitionSpec = functionalCameraTransitionSpec;
  readonly DslComponent = Camera;
  readonly useDefaultStateWhenAbsent = false;

  // Lazy-initialised on first onTick call (read from scene.userData)
  private domElement: HTMLElement | null = null;
  private rendererRef: THREE.WebGLRenderer | null = null;

  // camera-controls lifecycle
  private cameraControls: CameraControls | null = null;
  private isInteractionActive = false;

  // Scene change tracking for smooth reset
  private lastSceneIndex = -1;
  private savedCameraState: SceneCamera | null = null;

  // Keyboard reset listener (attached/detached with interaction mode)
  private resetKeyListener: ((e: KeyboardEvent) => void) | null = null;

  // ─── Custom DSL node handler ─────────────────────────────────────────────

  /**
   * Installed on the instance so WidgetRegistry can find it via CUSTOM_NODE_HANDLER.
   * Maps flat CameraProps to the nested SceneCamera structure.
   */
  readonly [CUSTOM_NODE_HANDLER] = (
    node: { props: CameraProps },
    api: { setWidgetState: (id: string, state: SceneCamera) => void },
  ): void => {
    const p = node.props;

    let descriptor: SceneCamera['descriptor'];
    if (p.mode === 'world' && 'position' in p && 'target' in p) {
      descriptor = { mode: 'world', position: p.position, target: p.target, up: p.up };
    } else if (p.mode === 'orbit' && 'target' in p && 'azimuth' in p) {
      descriptor = {
        mode: 'orbit',
        target: p.target,
        azimuth: p.azimuth,
        polar: p.polar,
        distance: p.distance,
        up: p.up,
      };
    } else if (p.mode === 'fitFloorDepth' && 'floorY' in p) {
      descriptor = {
        mode: 'fitFloorDepth',
        floorY: p.floorY,
        floorZMin: p.floorZMin,
        floorZMax: p.floorZMax,
        lookAtZ: p.lookAtZ,
        cameraX: p.cameraX,
        cameraY: p.cameraY,
      };
    } else {
      descriptor = {
        mode: 'fitBotHeight',
        targetId: (p as { targetId?: string }).targetId ?? '',
        targetHeight: (p as { targetHeight?: number }).targetHeight ?? 1,
        framingHeightPct: (p as { framingHeightPct?: number }).framingHeightPct ?? 0.4,
        heightOffset: (p as { heightOffset?: number }).heightOffset ?? 0,
        distanceOffset: (p as { distanceOffset?: number }).distanceOffset ?? 0,
      };
    }

    const state: SceneCamera = {
      enabled: true,
      descriptor,
      lens: {
        fov: p.fov,
        focalLength: p.focalLength,
        filmGauge: p.filmGauge,
        near: p.near,
        far: p.far,
      },
      post: p.exposure !== undefined ? { exposure: p.exposure } : undefined,
      interaction: p.interaction,
      transitionIn: p.transitionIn,
    };
    api.setWidgetState(this.widgetId, state);
  };

  // ─── ISceneElement ───────────────────────────────────────────────────────

  mergeSnapshot(prev: SceneCamera | undefined, next: SceneCamera | undefined): SceneCamera | undefined {
    if (!prev && !next) return undefined;
    if (!next) return prev;
    return { ...prev, ...next } as SceneCamera;
  }

  // ─── IAnimationController ────────────────────────────────────────────────

  onTick(context: AnimationTickContext): void {
    const tick = context.tick;
    if (!tick) return;

    const camera = context.scene.userData[CAMERA_KEY] as THREE.PerspectiveCamera | undefined;
    if (!camera) return;

    // Lazy-init DOM element and renderer on first tick (not available at construction time)
    if (!this.domElement) {
      const renderer = context.scene.userData[RENDERER_KEY] as THREE.WebGLRenderer | undefined;
      if (renderer) {
        this.domElement = renderer.domElement;
        this.rendererRef = renderer;
      }
    }

    // Resolve current scene camera state
    const functionalBlock = context.track?.transitionBlocks?.[tick.sceneIndex];
    const functionalWidget = functionalBlock?.widgetFns[this.widgetId];
    const state = functionalWidget
      ? (functionalWidget.fn(tick.blockProgress) as SceneCamera)
      : ((tick.state.widgets[this.widgetId] as SceneCamera | undefined) ?? this.defaultState);

    // Update camera-controls lifecycle
    this.updateInteractionMode(state, camera, tick.sceneIndex);

    // If interactive mode is active, camera-controls owns the camera transform
    if (this.isInteractionActive && this.cameraControls) {
      // Smooth reset when scene changes (unless opted out)
      if (tick.sceneIndex !== this.lastSceneIndex && this.lastSceneIndex !== -1) {
        this.savedCameraState = state; // update saved state to new scene definition
        if (state.interaction?.resetOnSceneChange !== false) {
          this.smoothResetToSceneCamera(state);
        }
      }
      this.lastSceneIndex = tick.sceneIndex;
      this.cameraControls.update(context.deltaSeconds);
      return;
    }

    this.lastSceneIndex = tick.sceneIndex;

    // Apply scene-driven camera position and exposure
    applyCamera(state, { camera, tick, renderer: this.rendererRef ?? undefined });
  }

  dispose(): void {
    this.exitInteractionMode();
    this.domElement = null;
    this.rendererRef = null;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Returns true when camera-controls is active AND wheel dolly is enabled.
   * useEngineInput reads this to suppress wheel-based scene navigation.
   */
  isWheelClaimedByInteraction(): boolean {
    if (!this.isInteractionActive) return false;
    const dolly = this.savedCameraState?.interaction?.dolly;
    return dolly !== false && (dolly?.wheel !== false);
  }

  // ─── Interaction mode management ──────────────────────────────────────────

  private updateInteractionMode(
    state: SceneCamera,
    camera: THREE.PerspectiveCamera,
    sceneIndex: number,
  ): void {
    const wantsInteraction = state.interaction?.enabled === true;

    if (wantsInteraction && !this.isInteractionActive) {
      this.enterInteractionMode(state, camera);
    } else if (!wantsInteraction && this.isInteractionActive) {
      this.exitInteractionMode();
    }
  }

  private enterInteractionMode(state: SceneCamera, camera: THREE.PerspectiveCamera): void {
    if (!this.domElement || !state.interaction) return;
    this.cameraControls?.dispose();
    this.cameraControls = createCameraControls(camera, this.domElement, state.interaction);
    this.savedCameraState = state;
    this.isInteractionActive = true;

    // Keyboard reset listener
    const resetKey = state.interaction.reset ?? { key: 'r' };
    this.resetKeyListener = (e: KeyboardEvent) => {
      if (e.key === resetKey.key) {
        const mods = resetKey.modifiers ?? [];
        const ok =
          (!mods.includes('alt') || e.altKey) &&
          (!mods.includes('ctrl') || e.ctrlKey) &&
          (!mods.includes('meta') || e.metaKey) &&
          (!mods.includes('shift') || e.shiftKey);
        if (ok) {
          e.preventDefault();
          if (this.savedCameraState) this.smoothResetToSceneCamera(this.savedCameraState);
        }
      }
    };
    // Attach to domElement (requires tabIndex on canvas — set by EngineInputRegion)
    this.domElement.addEventListener('keydown', this.resetKeyListener);
  }

  private exitInteractionMode(): void {
    if (this.resetKeyListener && this.domElement) {
      this.domElement.removeEventListener('keydown', this.resetKeyListener);
      this.resetKeyListener = null;
    }
    this.cameraControls?.dispose();
    this.cameraControls = null;
    this.isInteractionActive = false;
    this.savedCameraState = null;
    this.lastSceneIndex = -1;
  }

  /**
   * Smoothly animate back to the scene-defined camera position.
   * Uses camera-controls' built-in smooth transition (governed by smoothTime,
   * ~0.25s with default damping). NOT a snap — the camera glides back.
   */
  private smoothResetToSceneCamera(state: SceneCamera): void {
    if (!this.cameraControls) return;
    const pos = extractWorldPosFromDescriptor(state.descriptor);
    if (!pos) return;
    this.cameraControls.setLookAt(
      pos.position[0], pos.position[1], pos.position[2],
      pos.target[0], pos.target[1], pos.target[2],
      true, // enableTransition — camera glides, not jumps
    );
  }
}
```

**Required change in `useSceneEngine.ts`** (alongside existing camera line ~208):

```typescript
scene.userData['__brewsite_camera'] = camera;
scene.userData['__brewsite_renderer'] = rendererRef.current; // ADD THIS
```

This single line makes the lazy-init in `CameraWidget.onTick()` work without any interface changes.

---

## 5. Area 2 — Input System (Scene Navigation)

### 5.1 Overview

A new module `packages/core/src/input/` owns all input normalization. It is the single place that touches DOM event APIs. It converts raw events into **named actions** and dispatches them to registered handlers.

The module knows nothing about Three.js, React, or the scene compile pipeline. It takes a `SceneNavInputMap` config and calls `onNavigate(delta: number)` or `onJumpToScene(index: number)`.

### 5.2 Input Types

**File:** `packages/core/src/input/types.ts`

```typescript
// packages/core/src/input/types.ts
// Input system type contracts. No DOM, Three.js, or React imports.

import type { ModifierKey, KeyCombo } from '../elements/camera/types';
export type { ModifierKey, KeyCombo };

/** Mouse button identifier. */
export type MouseButton = 'left' | 'middle' | 'right';

/** Scroll/wheel configuration. */
export type WheelConfig = {
  /**
   * Fraction of total progress to advance per wheel tick (normalized to 100px).
   * Default: 1 / (sceneCount - 1), i.e. one scene per standard wheel tick.
   */
  sensitivity?: number;
  /** Required modifiers (all must be held). Empty array = no modifiers required. */
  modifiers?: ModifierKey[];
};

/** Pointer drag configuration for direct-mode navigation. */
export type DragConfig = {
  button?: MouseButton;
  modifiers?: ModifierKey[];
  /**
   * Pixels of drag required to advance one scene.
   * Default: 200.
   */
  pixelsPerScene?: number;
  axis?: 'x' | 'y'; // default 'y'
};

/** Touch swipe configuration. */
export type SwipeConfig = {
  direction?: 'horizontal' | 'vertical' | 'both'; // default 'vertical'
  /**
   * Minimum velocity (px/ms) to trigger a scene jump.
   * Default: 0.3.
   */
  velocityThreshold?: number;
};

/**
 * Named keyboard actions for scene navigation.
 * Each can be assigned a KeyCombo. null = disable.
 */
export type SceneNavKeys = {
  nextScene?: KeyCombo | null;
  prevScene?: KeyCombo | null;
  nextFrame?: KeyCombo | null;
  prevFrame?: KeyCombo | null;
  home?: KeyCombo | null;
  end?: KeyCombo | null;
};

/**
 * Scene navigation input map.
 * All fields are optional; omitting a field disables that input method.
 */
export type SceneNavInputMap = {
  /**
   * 'scroll'  — page-scroll drives progress (current behavior, default).
   * 'direct'  — canvas-local events drive progress; no tall spacer div.
   */
  mode?: 'scroll' | 'direct';

  /**
   * Mouse wheel / trackpad scroll.
   * Set to false to disable. Default: enabled in both modes.
   */
  wheel?: WheelConfig | false;

  /**
   * Pointer drag (direct mode only; ignored in scroll mode).
   * Set to false to disable.
   */
  drag?: DragConfig | false;

  /**
   * Touch swipe (direct mode only).
   * Set to false to disable.
   */
  swipe?: SwipeConfig | false;

  /**
   * Keyboard navigation shortcuts.
   * Set to false to disable all keyboard navigation.
   * Default shortcuts:
   *   nextScene:  ArrowRight / ArrowDown
   *   prevScene:  ArrowLeft / ArrowUp
   *   nextFrame:  Period (.)
   *   prevFrame:  Comma (,)
   *   home:       Home
   *   end:        End
   */
  keys?: SceneNavKeys | false;
};

/** Callback interface the InputController uses to report navigation. */
export type InputNavigationHandler = {
  /** Advance/retreat progress by a fraction (0..1). Negative = backward. */
  onScroll: (delta: number) => void;
  /** Jump directly to a scene by index. */
  onJumpToScene: (sceneIndex: number) => void;
  /** Get current progress (0..1). */
  getProgress: () => number;
  /** Get total number of scenes. */
  getSceneCount: () => number;
};
```

### 5.3 InputController

**File:** `packages/core/src/input/InputController.ts`

```typescript
// packages/core/src/input/InputController.ts
// Normalizes DOM events → navigation actions via SceneNavInputMap.
// No React, no Three.js, no compile pipeline.

import type {
  SceneNavInputMap,
  InputNavigationHandler,
  ModifierKey,
  KeyCombo,
  WheelConfig,
  DragConfig,
  SwipeConfig,
} from './types';

const DEFAULT_KEYS = {
  nextScene:  [{ key: 'ArrowRight' }, { key: 'ArrowDown' }] as KeyCombo[],
  prevScene:  [{ key: 'ArrowLeft' }, { key: 'ArrowUp' }] as KeyCombo[],
  nextFrame:  [{ key: '.' }] as KeyCombo[],
  prevFrame:  [{ key: ',' }] as KeyCombo[],
  home:       [{ key: 'Home' }] as KeyCombo[],
  end:        [{ key: 'End' }] as KeyCombo[],
};

const modifiersMatch = (event: KeyboardEvent | WheelEvent | PointerEvent, required?: ModifierKey[]): boolean => {
  if (!required || required.length === 0) {
    // Only fire if NO modifiers are held (avoids hijacking browser shortcuts)
    return !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
  }
  return (
    (!required.includes('alt') || event.altKey) &&
    (!required.includes('ctrl') || event.ctrlKey) &&
    (!required.includes('meta') || event.metaKey) &&
    (!required.includes('shift') || event.shiftKey)
  );
};

const keyMatches = (event: KeyboardEvent, combo: KeyCombo): boolean => {
  return event.key === combo.key && modifiersMatch(event, combo.modifiers);
};

export class InputController {
  private handler: InputNavigationHandler;
  private map: SceneNavInputMap;
  private target: HTMLElement | Window;
  private keyboardTarget: HTMLElement | Document;

  // Drag state
  private dragStart: { x: number; y: number; progress: number } | null = null;
  // Swipe state
  private touchStart: { x: number; y: number; t: number } | null = null;

  // Bound listeners (kept as references for cleanup)
  private onWheel: (e: WheelEvent) => void;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;
  private onTouchStart: (e: TouchEvent) => void;
  private onTouchEnd: (e: TouchEvent) => void;

  constructor(
    target: HTMLElement | Window,
    map: SceneNavInputMap,
    handler: InputNavigationHandler,
  ) {
    this.target = target;
    this.map = map;
    this.handler = handler;
    this.keyboardTarget = target instanceof HTMLElement ? target : document;

    // Build bound listeners
    this.onWheel = this.handleWheel.bind(this);
    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onPointerDown = this.handlePointerDown.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerUp = this.handlePointerUp.bind(this);
    this.onTouchStart = this.handleTouchStart.bind(this);
    this.onTouchEnd = this.handleTouchEnd.bind(this);
  }

  attach(): void {
    const mode = this.map.mode ?? 'scroll';

    // Wheel: active in both modes
    if (this.map.wheel !== false) {
      this.target.addEventListener('wheel', this.onWheel as EventListener, { passive: false });
    }

    // Keyboard: always active when configured
    if (this.map.keys !== false) {
      this.keyboardTarget.addEventListener('keydown', this.onKeyDown as EventListener);
    }

    // Drag and touch: only in direct mode
    if (mode === 'direct') {
      if (this.map.drag !== false) {
        this.target.addEventListener('pointerdown', this.onPointerDown as EventListener);
        this.target.addEventListener('pointermove', this.onPointerMove as EventListener);
        this.target.addEventListener('pointerup', this.onPointerUp as EventListener);
        this.target.addEventListener('pointercancel', this.onPointerUp as EventListener);
      }
      if (this.map.swipe !== false) {
        this.target.addEventListener('touchstart', this.onTouchStart as EventListener, { passive: true });
        this.target.addEventListener('touchend', this.onTouchEnd as EventListener, { passive: true });
      }
    }
  }

  detach(): void {
    this.target.removeEventListener('wheel', this.onWheel as EventListener);
    this.keyboardTarget.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('pointerdown', this.onPointerDown as EventListener);
    this.target.removeEventListener('pointermove', this.onPointerMove as EventListener);
    this.target.removeEventListener('pointerup', this.onPointerUp as EventListener);
    this.target.removeEventListener('pointercancel', this.onPointerUp as EventListener);
    this.target.removeEventListener('touchstart', this.onTouchStart as EventListener);
    this.target.removeEventListener('touchend', this.onTouchEnd as EventListener);
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  private handleWheel(e: WheelEvent): void {
    const cfg = this.map.wheel;
    if (cfg === false) return;
    const wheelCfg = typeof cfg === 'object' ? cfg : {};
    if (!modifiersMatch(e, wheelCfg.modifiers)) return;

    const mode = this.map.mode ?? 'scroll';
    if (mode === 'scroll') {
      // In scroll mode, let the browser handle scrolling naturally.
      // The useEngineScroll hook reads window.scrollY.
      return;
    }

    // Direct mode: convert wheel delta to progress delta
    e.preventDefault();
    const sceneCount = this.handler.getSceneCount();
    const sensitivity = wheelCfg.sensitivity ?? 1 / Math.max(1, sceneCount - 1);
    // deltaY is in pixels (100 = typical one wheel tick)
    const normalized = e.deltaY / 100;
    const delta = normalized * sensitivity;
    this.handler.onScroll(delta);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const cfg = this.map.keys;
    if (cfg === false) return;
    const keys = typeof cfg === 'object' ? cfg : {};

    const sceneCount = this.handler.getSceneCount();
    const currentProgress = this.handler.getProgress();

    const check = (combos: KeyCombo[], action: () => void) => {
      if (combos.some((c) => keyMatches(e, c))) {
        e.preventDefault();
        action();
      }
    };

    const nextSceneCombos = keys.nextScene !== null
      ? (keys.nextScene ? [keys.nextScene] : DEFAULT_KEYS.nextScene)
      : [];
    const prevSceneCombos = keys.prevScene !== null
      ? (keys.prevScene ? [keys.prevScene] : DEFAULT_KEYS.prevScene)
      : [];
    const nextFrameCombos = keys.nextFrame !== null
      ? (keys.nextFrame ? [keys.nextFrame] : DEFAULT_KEYS.nextFrame)
      : [];
    const prevFrameCombos = keys.prevFrame !== null
      ? (keys.prevFrame ? [keys.prevFrame] : DEFAULT_KEYS.prevFrame)
      : [];
    const homeCombos = keys.home !== null
      ? (keys.home ? [keys.home] : DEFAULT_KEYS.home)
      : [];
    const endCombos = keys.end !== null
      ? (keys.end ? [keys.end] : DEFAULT_KEYS.end)
      : [];

    const step = sceneCount > 1 ? 1 / (sceneCount - 1) : 1;

    check(nextSceneCombos, () => this.handler.onScroll(step));
    check(prevSceneCombos, () => this.handler.onScroll(-step));
    check(nextFrameCombos, () => this.handler.onScroll(step / 10));
    check(prevFrameCombos, () => this.handler.onScroll(-step / 10));
    check(homeCombos, () => this.handler.onJumpToScene(0));
    check(endCombos, () => this.handler.onJumpToScene(sceneCount - 1));
  }

  private handlePointerDown(e: PointerEvent): void {
    const cfg = this.map.drag as DragConfig | undefined;
    if (!cfg) return;
    const button = cfg.button ?? 'left';
    const buttonIndex = button === 'left' ? 0 : button === 'middle' ? 1 : 2;
    if (e.button !== buttonIndex) return;
    if (!modifiersMatch(e, cfg.modifiers)) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.dragStart = { x: e.clientX, y: e.clientY, progress: this.handler.getProgress() };
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.dragStart) return;
    const cfg = this.map.drag as DragConfig | undefined;
    const pixelsPerScene = cfg?.pixelsPerScene ?? 200;
    const axis = cfg?.axis ?? 'y';
    const delta = axis === 'y'
      ? e.clientY - this.dragStart.y
      : e.clientX - this.dragStart.x;
    const sceneCount = this.handler.getSceneCount();
    const step = sceneCount > 1 ? 1 / (sceneCount - 1) : 1;
    const progressDelta = (delta / pixelsPerScene) * step;
    // Drag downward/rightward = backward (previous scene)
    const newProgress = Math.min(1, Math.max(0, this.dragStart.progress + progressDelta));
    this.handler.onScroll(newProgress - this.handler.getProgress());
  }

  private handlePointerUp(_e: PointerEvent): void {
    this.dragStart = null;
  }

  private handleTouchStart(e: TouchEvent): void {
    const touch = e.touches[0];
    if (!touch) return;
    this.touchStart = { x: touch.clientX, y: touch.clientY, t: performance.now() };
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (!this.touchStart) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const cfg = this.map.swipe as SwipeConfig | undefined;
    const direction = cfg?.direction ?? 'vertical';
    const velocityThreshold = cfg?.velocityThreshold ?? 0.3;

    const dx = touch.clientX - this.touchStart.x;
    const dy = touch.clientY - this.touchStart.y;
    const dt = performance.now() - this.touchStart.t;
    this.touchStart = null;

    const vx = Math.abs(dx / dt);
    const vy = Math.abs(dy / dt);
    const sceneCount = this.handler.getSceneCount();
    const step = sceneCount > 1 ? 1 / (sceneCount - 1) : 1;

    if (direction === 'vertical' || direction === 'both') {
      if (vy > velocityThreshold && Math.abs(dy) > Math.abs(dx)) {
        this.handler.onScroll(dy > 0 ? -step : step);
      }
    }
    if (direction === 'horizontal' || direction === 'both') {
      if (vx > velocityThreshold && Math.abs(dx) > Math.abs(dy)) {
        this.handler.onScroll(dx > 0 ? -step : step);
      }
    }
  }
}
```

### 5.4 `index.ts`

**File:** `packages/core/src/input/index.ts`

```typescript
// packages/core/src/input/index.ts
// Public exports for the input module.

export type {
  SceneNavInputMap,
  WheelConfig,
  DragConfig,
  SwipeConfig,
  SceneNavKeys,
  KeyCombo,
  ModifierKey,
  InputNavigationHandler,
} from './types';

export { InputController } from './InputController';
```

---

## 6. Area 3 — `useEngineInput` and `EngineInputRegion`

### 6.1 `useEngineInput` Hook

**File:** `packages/core/src/player/useEngineInput.ts`

`useEngineInput` extends the behavior of `useEngineScroll`. When `mode === 'scroll'`, it uses `useEngineScroll` internally and the `InputController` is added for keyboard navigation only. When `mode === 'direct'`, it manages its own progress ref and the `InputController` is the sole source of progress.

```typescript
// packages/core/src/player/useEngineInput.ts
// Extended engine input hook — replaces useEngineScroll when inputMap is provided.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { SceneNavInputMap } from '../input/types';
import { InputController } from '../input/InputController';
import { useEngineScroll } from './useEngineScroll';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export type UseEngineInputOptions = {
  scrollRegionRef: RefObject<HTMLElement | null>;
  scrollRegionHeightPx: number;
  /** Number of scenes, used for keyboard step calculation. */
  sceneCount: number;
  /** Optional canvas element ref for direct-mode event attachment. */
  canvasRef?: RefObject<HTMLElement | null>;
  /** Input configuration. If omitted, behaves identically to useEngineScroll. */
  inputMap?: SceneNavInputMap;
  /**
   * Optional guard: if this returns true, wheel events for scene navigation
   * are suppressed. Wire to CameraWidget.isWheelClaimedByInteraction() to
   * prevent double-handling when camera-controls has wheel dolly active.
   */
  wheelGuard?: () => boolean;
};

export type UseEngineInputResult = {
  progress: number;
  scrollToProgress: (next: number) => void;
  getGlobalProgress: () => number;
};

export const useEngineInput = (options: UseEngineInputOptions): UseEngineInputResult => {
  const {
    scrollRegionRef,
    scrollRegionHeightPx,
    sceneCount,
    canvasRef,
    inputMap,
    wheelGuard,
  } = options;

  const mode = inputMap?.mode ?? 'scroll';

  // ─── Scroll mode: delegate to useEngineScroll ─────────────────────────
  const scrollResult = useEngineScroll({ scrollRegionRef, scrollRegionHeightPx });

  // Extract stable function references to avoid tearing down InputController
  // on every render. scrollResult object reference changes each render, but
  // the functions it returns are stable useCallback instances.
  const scrollToProgressStable = scrollResult.scrollToProgress;
  const getGlobalProgressStable = scrollResult.getGlobalProgress;

  // ─── Direct mode: self-managed progress ref ───────────────────────────
  const [directProgress, setDirectProgress] = useState(0);
  const directProgressRef = useRef(0);

  const setDirectProgressBoth = useCallback((next: number) => {
    const clamped = clamp01(next);
    directProgressRef.current = clamped;
    setDirectProgress(clamped);
  }, []);

  const getDirectProgress = useCallback(() => directProgressRef.current, []);

  // ─── InputController attachment ───────────────────────────────────────
  useEffect(() => {
    if (!inputMap || mode === 'scroll') {
      if (!inputMap || inputMap.keys === false) return;

      const handler = {
        onScroll: (delta: number) => {
          const next = clamp01(getGlobalProgressStable() + delta);
          scrollToProgressStable(next);
        },
        onJumpToScene: (index: number) => {
          const progress = sceneCount > 1 ? index / (sceneCount - 1) : 0;
          scrollToProgressStable(progress);
        },
        getProgress: getGlobalProgressStable,
        getSceneCount: () => sceneCount,
      };

      // In scroll mode: keyboard only. Wheel is handled by the browser + useEngineScroll.
      // The wheelGuard is applied at the InputController level via shouldHandleWheel.
      const scrollModeMap: SceneNavInputMap = {
        mode: 'scroll',
        wheel: false,
        drag: false,
        swipe: false,
        keys: inputMap.keys,
      };

      const ctrl = new InputController(window, scrollModeMap, handler);
      ctrl.attach();
      return () => ctrl.detach();
    }

    // Direct mode: attach to canvas (preferred) or window
    // Keyboard events attach to the scrollRegionRef element (which has tabIndex=-1).
    // See EngineInputRegion for why tabIndex is needed.
    const attachTarget = canvasRef?.current ?? window;

    const handler = {
      onScroll: (delta: number) => {
        // Respect wheelGuard: if camera-controls claims the wheel, do not advance scene
        if (wheelGuard?.()) return;
        const next = clamp01(directProgressRef.current + delta);
        setDirectProgressBoth(next);
      },
      onJumpToScene: (index: number) => {
        const progress = sceneCount > 1 ? index / (sceneCount - 1) : 0;
        setDirectProgressBoth(progress);
      },
      getProgress: getDirectProgress,
      getSceneCount: () => sceneCount,
    };

    const ctrl = new InputController(attachTarget, inputMap, handler);
    ctrl.attach();
    return () => ctrl.detach();
  }, [
    // Stable references only — no object literals that change every render
    inputMap, mode, sceneCount, canvasRef,
    scrollToProgressStable, getGlobalProgressStable,
    setDirectProgressBoth, getDirectProgress, wheelGuard,
  ]);

  // ─── Return appropriate interface ─────────────────────────────────────
  if (mode === 'direct') {
    return {
      progress: directProgress,
      scrollToProgress: setDirectProgressBoth,
      getGlobalProgress: getDirectProgress,
    };
  }

  return scrollResult;
};
```

### 6.2 Integration into `useSceneEngine`

**File:** `packages/core/src/player/useSceneEngine.ts` — changes required

**Add to `UseSceneEngineOptions`:**
```typescript
inputMap?: SceneNavInputMap;
```

**Add to `UseSceneEngineResult`:**
```typescript
/** Total number of scenes in the scene group. Used by TimelineWidget and useEngineInput. */
sceneCount: number;
```

**Add to the return value:**
```typescript
sceneCount: options.sceneGroup.scenes.length,
```

**Replace `useEngineScroll` call with `useEngineInput`:**
```typescript
// New internal ref alongside existing canvas state:
const canvasElementRef = useRef<HTMLCanvasElement | null>(null);

const setCanvasRef = useCallback((next: HTMLCanvasElement | null) => {
  setCanvas(next);
  canvasElementRef.current = next;
}, []);

// wheelGuard: reads isWheelClaimedByInteraction from CameraWidget if registered.
// This prevents scene navigation advancing while camera dolly is active.
const wheelGuard = useCallback((): boolean => {
  const cameraWidget = options.widgetRegistry.get('camera') as { isWheelClaimedByInteraction?: () => boolean } | undefined;
  return cameraWidget?.isWheelClaimedByInteraction?.() ?? false;
}, [options.widgetRegistry]);

const { progress, scrollToProgress, getGlobalProgress } = useEngineInput({
  scrollRegionRef,
  scrollRegionHeightPx,
  sceneCount: options.sceneGroup.scenes.length,
  canvasRef: canvasElementRef,
  inputMap: options.inputMap,
  wheelGuard,
});
```

**`scrollRegionHeightPx` guard for direct mode:**
```typescript
const scrollRegionHeightPx = useMemo(() => {
  if (options.inputMap?.mode === 'direct') return Math.max(1, viewportHeight);
  // ... existing logic unchanged
}, [options.inputMap?.mode, options.pixelsPerScene, ...]);
```

**Store renderer in `scene.userData` (alongside existing camera line):**
```typescript
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
camera.position.set(0, 0, 100);
scene.userData['__brewsite_camera'] = camera;
scene.userData['__brewsite_renderer'] = rendererRef.current; // NEW — enables CameraWidget lazy-init
```

### 6.3 `EngineInputRegion`

**File:** `packages/core/src/player/EngineInputRegion.tsx`

A drop-in replacement for `EngineScrollRegion` with direct-mode awareness. In scroll mode it renders identically to `EngineScrollRegion`. In direct mode it skips the tall spacer div and renders a fixed 100vh container.

```typescript
// packages/core/src/player/EngineInputRegion.tsx
// Viewport container for the scene engine. Supports scroll and direct input modes.

import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { UseSceneEngineResult } from './useSceneEngine';
import type { SceneNavInputMap } from '../input/types';

export type EngineInputRegionProps = {
  engine: UseSceneEngineResult;
  inputMap?: SceneNavInputMap;
  className?: string;
  children?: ReactNode;
};

export const EngineInputRegion = ({
  engine,
  inputMap,
  className,
  children,
}: EngineInputRegionProps): ReactElement => {
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const mode = inputMap?.mode ?? 'scroll';

  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      engine.setViewportSize(rect.width, rect.height);
    };
    update();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => update());
      observer.observe(el);
    }
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [engine.setViewportSize]);

  const innerContent = (
    <div
      ref={stickyRef}
      // tabIndex={-1}: makes the container programmatically focusable so that
      // keyboard events (including the camera reset shortcut 'r') can be
      // received when the element or canvas is clicked. Without this, keydown
      // events attached to this HTMLElement never fire.
      tabIndex={-1}
      style={{
        position: mode === 'scroll' ? 'sticky' : 'relative',
        top: 0,
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        outline: 'none', // suppress focus ring on the container
      }}
    >
      <div
        ref={engine.setBackgroundRef}
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundPosition: 'center', backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat', pointerEvents: 'none',
        }}
      />
      <canvas
        ref={engine.setCanvasRef}
        style={{ width: '100%', height: '100%', display: 'block', position: 'relative', zIndex: 1 }}
      />
      {children && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
          {children}
        </div>
      )}
    </div>
  );

  if (mode === 'direct') {
    return (
      <div className={className} style={{ position: 'relative', height: '100vh' }}>
        {innerContent}
      </div>
    );
  }

  // Scroll mode: tall spacer creates the scrollable space
  return (
    <div
      ref={engine.scrollRegionRef}
      className={className}
      style={{ position: 'relative', height: engine.scrollRegionHeightPx, overscrollBehavior: 'none' }}
    >
      {innerContent}
    </div>
  );
};
```

---

## 7. Area 4 — Timeline Widget

### 7.1 Types

**File:** `packages/core/src/player/TimelineWidgetTypes.ts`

```typescript
// packages/core/src/player/TimelineWidgetTypes.ts
// TimelineWidget prop types. No Three.js or compile pipeline imports.

import type { UseSceneEngineResult } from './useSceneEngine';

export type TimelineTickStyle = 'scene' | 'frame' | 'none';

export type TimelineTheme = 'light' | 'dark';

export type TimelineWidgetProps = {
  /** Required: the engine instance to connect to. */
  engine: UseSceneEngineResult;

  /**
   * Scene definitions, used to render scene name labels.
   * If omitted, numeric scene indices are shown.
   */
  scenes?: ReadonlyArray<{ id: string; meta?: Record<string, unknown> }>;

  /** Widget orientation. Default 'horizontal'. */
  orientation?: 'horizontal' | 'vertical';

  /**
   * Position relative to the viewport.
   * The widget should be placed inside the HUD overlay with absolute positioning.
   * Default 'bottom'.
   */
  position?: 'top' | 'bottom' | 'left' | 'right';

  /** Color theme. Default 'dark'. */
  theme?: TimelineTheme;

  /**
   * Height of the timeline bar in pixels (horizontal) or width (vertical).
   * Default 48.
   */
  thickness?: number;

  /**
   * Major tick style (at scene boundaries). Default 'scene'.
   * 'scene' = one tick per scene.
   * 'frame' = one tick per compiled frame.
   * 'none' = no major ticks.
   */
  majorTicks?: TimelineTickStyle;

  /**
   * Number of minor ticks between each pair of major ticks.
   * Default 0 (no minor ticks).
   */
  minorTicksPerScene?: number;

  /** Whether to show scene labels above/beside major ticks. Default true. */
  showSceneLabels?: boolean;

  /** Whether to render the numeric progress readout. Default false. */
  showProgress?: boolean;

  /** Whether the scrub handle is draggable. Default true. */
  scrubEnabled?: boolean;

  /** CSS class name for the outer container. */
  className?: string;

  /** Inline style for the outer container. */
  style?: React.CSSProperties;

  /** Called when the user seeks to a new progress value. */
  onSeek?: (progress: number) => void;
};
```

### 7.2 `TimelineWidget` Component

**File:** `packages/core/src/player/TimelineWidget.tsx`

```typescript
// packages/core/src/player/TimelineWidget.tsx
// HUD timeline scrubber widget — pure React, no Three.js.

import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import type { TimelineWidgetProps } from './TimelineWidgetTypes';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const THEMES = {
  dark: {
    track: 'rgba(255,255,255,0.15)',
    fill: 'rgba(255,255,255,0.7)',
    handle: '#ffffff',
    handleBorder: 'rgba(0,0,0,0.3)',
    tickMajor: 'rgba(255,255,255,0.6)',
    tickMinor: 'rgba(255,255,255,0.25)',
    label: 'rgba(255,255,255,0.7)',
    progress: 'rgba(255,255,255,0.5)',
    background: 'rgba(0,0,0,0.35)',
  },
  light: {
    track: 'rgba(0,0,0,0.15)',
    fill: 'rgba(0,0,0,0.6)',
    handle: '#333333',
    handleBorder: 'rgba(255,255,255,0.5)',
    tickMajor: 'rgba(0,0,0,0.55)',
    tickMinor: 'rgba(0,0,0,0.2)',
    label: 'rgba(0,0,0,0.6)',
    progress: 'rgba(0,0,0,0.4)',
    background: 'rgba(255,255,255,0.3)',
  },
};

export const TimelineWidget = ({
  engine,
  scenes,
  orientation = 'horizontal',
  position = 'bottom',
  theme = 'dark',
  thickness = 48,
  majorTicks = 'scene',
  minorTicksPerScene = 0,
  showSceneLabels = true,
  showProgress = false,
  scrubEnabled = true,
  className,
  style,
  onSeek,
}: TimelineWidgetProps): ReactElement => {
  const colors = THEMES[theme];
  const isHorizontal = orientation === 'horizontal';
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubProgressRef = useRef(engine.progress);

  // Progress: use scrub override during drag, else engine progress
  const displayProgress = isScrubbing ? scrubProgressRef.current : engine.progress;

  // engine.sceneCount is the number of scenes (new field added to UseSceneEngineResult — see §6.2).
  // scenes?.length is preferred when provided; it also gives us scene labels.
  // Do NOT use engine.debug.sceneTrackTicks as a fallback — that is the total
  // number of pre-baked ticks (potentially 100+), not the scene count.
  const sceneCount = scenes?.length ?? engine.sceneCount ?? 1;
  const totalTicks = engine.debug?.sceneTrackTicks ?? 1;

  // ─── Seek logic ─────────────────────────────────────────────────────────

  const seekTo = useCallback((progress: number): void => {
    const clamped = clamp01(progress);
    scrubProgressRef.current = clamped;
    engine.scrollToProgress(clamped);
    onSeek?.(clamped);
  }, [engine, onSeek]);

  const progressFromPointer = useCallback((e: PointerEvent | React.PointerEvent<HTMLDivElement>): number => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (isHorizontal) {
      return clamp01((e.clientX - rect.left) / rect.width);
    } else {
      return clamp01((e.clientY - rect.top) / rect.height);
    }
  }, [isHorizontal]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    if (!scrubEnabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsScrubbing(true);
    const p = progressFromPointer(e);
    scrubProgressRef.current = p;
    seekTo(p);
  }, [scrubEnabled, progressFromPointer, seekTo]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isScrubbing) return;
    const p = progressFromPointer(e);
    scrubProgressRef.current = p;
    seekTo(p);
  }, [isScrubbing, progressFromPointer, seekTo]);

  const handlePointerUp = useCallback((): void => {
    setIsScrubbing(false);
  }, []);

  // ─── Tick mark generation ────────────────────────────────────────────────

  const tickMarks: Array<{ progress: number; isMajor: boolean; label?: string }> = [];

  if (majorTicks === 'scene' && sceneCount > 1) {
    for (let i = 0; i < sceneCount; i++) {
      const p = i / (sceneCount - 1);
      const label = scenes?.[i]?.id ?? `Scene ${i + 1}`;
      tickMarks.push({ progress: p, isMajor: true, label });

      // Minor ticks
      if (minorTicksPerScene > 0 && i < sceneCount - 1) {
        for (let m = 1; m <= minorTicksPerScene; m++) {
          const mp = p + (m / (minorTicksPerScene + 1)) / (sceneCount - 1);
          tickMarks.push({ progress: mp, isMajor: false });
        }
      }
    }
  } else if (majorTicks === 'frame' && totalTicks > 1) {
    for (let i = 0; i < totalTicks; i++) {
      tickMarks.push({ progress: i / (totalTicks - 1), isMajor: true });
    }
  }

  // ─── Layout constants ────────────────────────────────────────────────────

  const trackPad = 16;   // px padding on each end of track
  const handleSize = 14; // px diameter of scrub handle
  const tickAreaHeight = showSceneLabels ? 20 : 0; // px above/beside track for labels
  const trackHeight = 4; // px height of the track bar itself

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    [position]: 0,
    left: isHorizontal ? 0 : undefined,
    right: isHorizontal ? 0 : undefined,
    top: !isHorizontal ? 0 : undefined,
    bottom: !isHorizontal ? 0 : undefined,
    width: isHorizontal ? '100%' : thickness,
    height: isHorizontal ? thickness : '100%',
    background: colors.background,
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: isHorizontal ? 'column' : 'row',
    alignItems: 'center',
    padding: `${trackPad}px`,
    boxSizing: 'border-box',
    userSelect: 'none',
    cursor: scrubEnabled ? 'pointer' : 'default',
    // CRITICAL: the HUD overlay parent has pointerEvents:'none'. We must re-enable
    // pointer events here so the scrub handle and track are actually interactive.
    pointerEvents: 'auto',
    ...style,
  };

  const trackStyle: React.CSSProperties = {
    position: 'relative',
    width: isHorizontal ? '100%' : trackHeight,
    height: isHorizontal ? trackHeight : '100%',
    background: colors.track,
    borderRadius: trackHeight / 2,
    flexShrink: 0,
  };

  const fillStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: isHorizontal ? `${displayProgress * 100}%` : '100%',
    height: isHorizontal ? '100%' : `${displayProgress * 100}%`,
    background: colors.fill,
    borderRadius: trackHeight / 2,
    pointerEvents: 'none',
  };

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: handleSize,
    height: handleSize,
    borderRadius: '50%',
    background: colors.handle,
    border: `2px solid ${colors.handleBorder}`,
    boxSizing: 'border-box',
    transform: 'translate(-50%, -50%)',
    top: isHorizontal ? '50%' : `${displayProgress * 100}%`,
    left: isHorizontal ? `${displayProgress * 100}%` : '50%',
    cursor: 'grab',
    pointerEvents: 'none',
    transition: isScrubbing ? 'none' : 'left 0.05s, top 0.05s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
  };

  return (
    <div className={className} style={containerStyle}>
      {/* Progress readout */}
      {showProgress && (
        <div style={{ fontSize: 11, color: colors.progress, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
          {(displayProgress * 100).toFixed(1)}%
        </div>
      )}

      {/* Track area */}
      <div
        ref={trackRef}
        style={{ ...trackStyle, position: 'relative', flex: 1 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(displayProgress * 100)}
        aria-label="Scene progress"
        tabIndex={0}
      >
        {/* Fill */}
        <div style={fillStyle} />

        {/* Tick marks */}
        {tickMarks.map((tick, i) => {
          const pct = `${tick.progress * 100}%`;
          const tickStyle: React.CSSProperties = {
            position: 'absolute',
            [isHorizontal ? 'left' : 'top']: pct,
            [isHorizontal ? 'top' : 'left']: '50%',
            transform: isHorizontal ? 'translateX(-50%)' : 'translateY(-50%)',
            width: isHorizontal ? (tick.isMajor ? 2 : 1) : (tick.isMajor ? 10 : 6),
            height: isHorizontal ? (tick.isMajor ? 10 : 6) : (tick.isMajor ? 2 : 1),
            background: tick.isMajor ? colors.tickMajor : colors.tickMinor,
            pointerEvents: 'none',
          };
          return (
            <div key={i} style={tickStyle}>
              {tick.isMajor && showSceneLabels && tick.label && (
                <div style={{
                  position: 'absolute',
                  [isHorizontal ? 'bottom' : 'left']: '100%',
                  [isHorizontal ? 'left' : 'top']: '50%',
                  transform: isHorizontal ? 'translateX(-50%)' : 'translateY(-50%)',
                  fontSize: 9,
                  color: colors.label,
                  whiteSpace: 'nowrap',
                  marginBottom: isHorizontal ? 4 : 0,
                  marginLeft: !isHorizontal ? 4 : 0,
                  pointerEvents: 'none',
                  maxWidth: 60,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {tick.label}
                </div>
              )}
            </div>
          );
        })}

        {/* Scrub handle */}
        {scrubEnabled && <div style={handleStyle} />}
      </div>
    </div>
  );
};
```

---

## 8. ScenePlayer Integration

**File:** `packages/core/src/player/ScenePlayer.tsx` — extend `ScenePlayerProps`

Add `inputMap`, `timelineWidget`, and use `EngineInputRegion` in place of `EngineScrollRegion`.

```typescript
export type ScenePlayerProps = {
  // ... existing fields unchanged ...

  /** Input configuration for scene navigation. */
  inputMap?: SceneNavInputMap;

  /**
   * Whether to render the built-in timeline widget at the bottom.
   * Pass `true` for defaults, or a `TimelineWidgetProps` subset to configure it.
   */
  timeline?: boolean | Omit<TimelineWidgetProps, 'engine' | 'scenes'>;
};
```

In the render:
```tsx
<EngineInputRegion key={hmrVersion} engine={engine} inputMap={props.inputMap}>
  <>
    <HudOverlay items={engine.frameState.tick?.hudPrimitives ?? []} />
    {labels.map((label) => (
      <LabelItem key={label.id} label={label} />
    ))}
    {props.timeline && (
      <TimelineWidget
        engine={engine}
        scenes={props.sceneGroup.scenes}
        {...(typeof props.timeline === 'object' ? props.timeline : {})}
      />
    )}
    {props.children}
  </>
</EngineInputRegion>
```

Pass `inputMap` into `useSceneEngine`:
```typescript
const engine = useSceneEngine({
  // ... existing ...
  inputMap: props.inputMap,
});
```

---

## 9. Backward Compatibility

| Existing API | Status | Notes |
|---|---|---|
| `useEngineScroll` | **Unchanged** | Stays exported. Not deprecated. |
| `EngineScrollRegion` | **Unchanged** | Stays exported. Not deprecated. |
| `SceneCamera` with `mode: 'fitBotHeight'` | **Fully compat** | DSL still works. Type is now `CameraProps` with no `mode` or `mode='fitBotHeight'`. |
| `SceneCamera` with `mode: 'fitFloorDepth'` | **Fully compat** | Preserved as union member. |
| `CameraProps` flat spread | **Breaking change — migration required** | Old `CameraProps = Partial<SceneCamera>` becomes structured. See §9.1. |
| `cameraTransitionSpec` (ElementTransitionSpec) | **Soft-deprecated** | `functionalCameraTransitionSpec` is the default. Old spec still works. |
| `DofConfig` (type) | **Reserved, `never` placeholder** | Type exists but is `never` in Phase 1. Phase 2 will replace with real type. |
| `UseSceneEngineResult.sceneCount` | **New field** | Additive. Existing destructuring unaffected. |
| Bezier/path/orbit `transitionIn` on auto-framing cameras | **Silently degrades** | Falls back to midpoint switch. Documented in JSDoc on `transitionIn`. |

### 9.1 Camera DSL Migration

**Before (v1):**
```tsx
<Camera
  enabled
  mode="fitBotHeight"
  targetId="robot"
  targetHeight={1.8}
  framingHeightPct={0.6}
  fov={35}
/>
```

**After (v2 — identical semantics, backward compat handled by custom node handler):**
```tsx
<Camera
  targetId="robot"
  targetHeight={1.8}
  framingHeightPct={0.6}
  fov={35}
/>
```
The `mode` prop defaults to `fitBotHeight` when omitted. The custom node handler in `CameraWidget.ts` maps this flat structure to the new nested `SceneCamera` type transparently.

**New world-space syntax:**
```tsx
<Camera
  mode="world"
  position={[5, 3, 10]}
  target={[0, 0.5, 0]}
  fov={40}
  focalLength={50}
  filmGauge={35}
  exposure={1.2}
  transitionIn={{ type: 'bezier', cp1: [2, 4, 8], cp2: [4, 3, 5] }}
  interaction={{
    enabled: true,
    orbit: { pointer: 'left' },
    dolly: { wheel: true, pinch: true },
    damping: true,
    minDistance: 2,
    maxDistance: 40,
  }}
/>
```

**Orbital syntax:**
```tsx
<Camera
  mode="orbit"
  target={[0, 0, 0]}
  azimuth={Math.PI / 4}
  polar={Math.PI / 6}
  distance={15}
  transitionIn={{ type: 'orbit', ease: 'easeInOut' }}
/>
```

---

## 10. Complete File Map

### New Files

| Path | Responsibility |
|---|---|
| `packages/core/src/input/types.ts` | Input system type contracts |
| `packages/core/src/input/InputController.ts` | DOM event → action dispatch |
| `packages/core/src/input/index.ts` | Public exports |
| `packages/core/src/player/useEngineInput.ts` | Extended input hook |
| `packages/core/src/player/EngineInputRegion.tsx` | Viewport container with input support |
| `packages/core/src/player/TimelineWidget.tsx` | HUD timeline scrubber |
| `packages/core/src/player/TimelineWidgetTypes.ts` | TimelineWidget prop types |

### Modified Files

| Path | Changes |
|---|---|
| `packages/core/src/elements/camera/types.ts` | Full rewrite — discriminated union, physical props, interaction config |
| `packages/core/src/elements/camera/dsl.tsx` | Extended CameraProps with new positioning modes |
| `packages/core/src/elements/camera/compile.ts` | Full rewrite — new interpolation logic, bezier/orbit/path, easing |
| `packages/core/src/elements/camera/render.ts` | Add world/orbit modes, camera-controls factory |
| `packages/core/src/elements/camera/CameraWidget.ts` | Custom node handler, camera-controls lifecycle |
| `packages/core/src/player/useSceneEngine.ts` | Add `inputMap` option, use `useEngineInput` internally |
| `packages/core/src/player/ScenePlayer.tsx` | Add `inputMap`, `timeline` props; use `EngineInputRegion` |
| `packages/core/src/player/index.ts` | Export new public symbols |
| `packages/core/package.json` | Add `camera-controls: ^3.1.2` |

### Untouched Files (explicit)

These files must not change:
- `packages/core/src/player/useEngineScroll.ts`
- `packages/core/src/player/EngineScrollRegion.tsx`
- `packages/core/src/compiler/` (entire directory)
- `packages/core/src/runtime/` (entire directory)
- `packages/core/src/timeline/` (entire directory)
- `packages/core/src/widget/` (entire directory)

---

## 11. Test Strategy

All tests follow the project's interface-based stateful pattern. No `vi.fn()` mocks of internals.

### 11.1 Camera Compile Tests

**File:** `packages/core/src/elements/camera/__tests__/compile.test.ts`

```typescript
// Test: interpolateCameraDescriptor
describe('interpolateCameraDescriptor', () => {
  it('linearly interpolates world-space positions', () => {
    const from: SceneCamera = { enabled: true, descriptor: { mode: 'world', position: [0,0,0], target: [0,0,0] } };
    const to: SceneCamera = { enabled: true, descriptor: { mode: 'world', position: [10,0,0], target: [5,0,0] } };
    const result = interpolateCameraDescriptor(from, to, 0.5);
    expect(result.mode).toBe('world');
    if (result.mode === 'world') expect(result.position).toEqual([5, 0, 0]);
  });

  it('interpolates orbit azimuth with shortest-path', () => {
    const from: SceneCamera = { enabled: true, descriptor: { mode: 'orbit', target: [0,0,0], azimuth: 0, polar: 0, distance: 10 }, transitionIn: { type: 'orbit' } };
    const to: SceneCamera = { enabled: true, descriptor: { mode: 'orbit', target: [0,0,0], azimuth: Math.PI * 1.9, polar: 0, distance: 10 }, transitionIn: { type: 'orbit' } };
    // 1.9π from 0: shortest path should go backward (-0.1π), not forward (+1.9π)
    const result = interpolateCameraDescriptor(from, to, 0.5);
    expect(result.mode).toBe('orbit');
    if (result.mode === 'orbit') {
      expect(result.azimuth).toBeCloseTo(-Math.PI * 0.05, 3);
    }
  });

  it('follows bezier control points', () => {
    const from: SceneCamera = { enabled: true, descriptor: { mode: 'world', position: [0,0,0], target: [0,0,0] }, transitionIn: { type: 'bezier', cp1: [0,10,0], cp2: [10,10,0] } };
    const to: SceneCamera = { enabled: true, descriptor: { mode: 'world', position: [10,0,0], target: [5,0,0] }, transitionIn: { type: 'bezier', cp1: [0,10,0], cp2: [10,10,0] } };
    const mid = interpolateCameraDescriptor(from, to, 0.5);
    // At t=0.5 of cubic bezier with symmetric control points, Y should be elevated
    if (mid.mode === 'world') expect(mid.position[1]).toBeGreaterThan(0);
  });
});
```

### 11.2 InputController Tests

**File:** `packages/core/src/input/__tests__/InputController.test.ts`

Use a real `InputController` instance attached to a `jsdom` element. Fire synthetic events and assert on handler calls via stateful doubles (counter objects, not mocks).

```typescript
describe('InputController', () => {
  it('fires onJumpToScene(0) when Home key pressed', () => {
    const calls: number[] = [];
    const handler: InputNavigationHandler = {
      onScroll: () => {},
      onJumpToScene: (i) => calls.push(i),
      getProgress: () => 0.5,
      getSceneCount: () => 4,
    };
    const el = document.createElement('div');
    const ctrl = new InputController(el, { mode: 'direct', keys: {} }, handler);
    ctrl.attach();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(calls).toEqual([0]);
    ctrl.detach();
  });

  it('fires onJumpToScene(3) when End key pressed with 4 scenes', () => { ... });

  it('fires onScroll with positive delta when ArrowRight pressed', () => { ... });

  it('does not fire when modifiers are required but not held', () => { ... });

  it('handles wheel events in direct mode', () => { ... });

  it('does not prevent wheel events in scroll mode', () => { ... });
});
```

### 11.3 Timeline Widget Tests

**File:** `packages/core/src/player/__tests__/TimelineWidget.test.tsx`

Use React Testing Library with a real `UseSceneEngineResult` double (implements the interface with controlled progress values).

```typescript
describe('TimelineWidget', () => {
  it('renders at the correct progress position', () => {
    const engineDouble = makeEngineDouble({ progress: 0.5 });
    render(<TimelineWidget engine={engineDouble} />);
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuenow')).toBe('50');
  });

  it('calls scrollToProgress when scrubbing', () => { ... });
  it('renders scene labels for each provided scene', () => { ... });
  it('applies dark theme colors', () => { ... });
  it('respects scrubEnabled=false', () => { ... });
});
```

### 11.4 Camera Render Tests

These are integration tests — they verify `applyCamera` correctly sets Three.js camera state.

**File:** `packages/core/src/elements/camera/__tests__/render.test.ts`

```typescript
describe('applyCamera', () => {
  it('sets camera position for world mode', () => {
    const camera = new THREE.PerspectiveCamera();
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [1, 2, 3], target: [0, 0, 0] },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });
    expect(camera.position.x).toBeCloseTo(1);
    expect(camera.position.y).toBeCloseTo(2);
    expect(camera.position.z).toBeCloseTo(3);
  });

  it('converts orbit coords to world position', () => { ... });
  it('does nothing when enabled=false', () => { ... });
  it('applies focalLength via setFocalLength', () => { ... });
});
```

---

## 12. Usage Examples

### Scene with world-space camera and interactive control

```tsx
// In a scene file
const myScene: SceneDefinition = {
  id: 'diagram-view',
  index: 0,
  getFrame: () => (
    <Scene>
      <Camera
        mode="world"
        position={[0, 5, 20]}
        target={[0, 0, 0]}
        fov={45}
        exposure={1.1}
        interaction={{
          enabled: true,
          orbit: { pointer: 'left' },
          pan: { pointer: 'right' },
          dolly: { wheel: true, pinch: true },
          damping: true,
          minDistance: 5,
          maxDistance: 50,
          reset: { key: 'r' },
        }}
      />
      {/* ... other elements */}
    </Scene>
  ),
};
```

### ScenePlayer with keyboard navigation and timeline

```tsx
<ScenePlayer
  sceneGroup={mySceneGroup}
  manifestUrl="/assets/manifest.json"
  widgetSetup={(manifest) => createWidgetRegistry(manifest)}
  inputMap={{
    mode: 'scroll',   // page-scroll still drives transitions
    keys: {
      nextScene: { key: 'ArrowRight' },
      prevScene: { key: 'ArrowLeft' },
      home:      { key: 'Home' },
      end:       { key: 'End' },
    },
  }}
  timeline={{
    position: 'bottom',
    theme: 'dark',
    showSceneLabels: true,
    minorTicksPerScene: 4,
  }}
/>
```

### Camera orbital transition between scenes

```tsx
// Scene A
<Camera
  mode="orbit"
  target={[0, 0, 0]}
  azimuth={0}
  polar={Math.PI / 8}
  distance={20}
/>

// Scene B
<Camera
  mode="orbit"
  target={[0, 0, 0]}
  azimuth={Math.PI / 2}       // 90° rotation
  polar={Math.PI / 4}
  distance={15}
  transitionIn={{ type: 'orbit', ease: 'easeInOut' }}
/>
```

### Camera following a bezier arc

```tsx
// Scene B overrides how the camera arrives
<Camera
  mode="world"
  position={[10, 3, 0]}
  target={[0, 0, 0]}
  transitionIn={{
    type: 'bezier',
    cp1: [0, 8, 10],      // rises up
    cp2: [10, 8, 5],      // swoops down
    ease: 'easeInOut',
  }}
/>
```

---

## 13. Export Lists

Every public symbol must be wired explicitly. A coding bot must not guess.

### `packages/core/src/input/index.ts`

```typescript
export type {
  SceneNavInputMap,
  WheelConfig,
  DragConfig,
  SwipeConfig,
  SceneNavKeys,
  KeyCombo,
  ModifierKey,
  InputNavigationHandler,
  MouseButton,
} from './types';

export { InputController } from './InputController';
```

### `packages/core/src/player/index.ts` — additions only

```typescript
// Existing exports stay. Add:
export { useEngineInput } from './useEngineInput';
export type { UseEngineInputOptions, UseEngineInputResult } from './useEngineInput';
export { EngineInputRegion } from './EngineInputRegion';
export type { EngineInputRegionProps } from './EngineInputRegion';
export { TimelineWidget } from './TimelineWidget';
export type { TimelineWidgetProps, TimelineTickStyle, TimelineTheme } from './TimelineWidgetTypes';
```

### `packages/core/src/index.ts` — additions only

```typescript
// Existing exports stay. Add:
export type {
  SceneNavInputMap,
  WheelConfig,
  DragConfig,
  SwipeConfig,
  SceneNavKeys,
  KeyCombo,
  ModifierKey,
  InputNavigationHandler,
} from './input';
export { InputController } from './input';

export { useEngineInput, EngineInputRegion, TimelineWidget } from './player';
export type {
  UseEngineInputOptions,
  UseEngineInputResult,
  EngineInputRegionProps,
  TimelineWidgetProps,
  TimelineTickStyle,
  TimelineTheme,
} from './player';
```

### `packages/core/src/elements/camera/index.ts` — additions only

```typescript
// Existing exports stay. Add:
export type {
  Vec3,
  WorldSpaceCamera,
  OrbitCamera,
  FitBotHeightCamera,
  FitFloorDepthCamera,
  CameraPositionDescriptor,
  CameraLens,
  CameraPost,
  CameraInteractionConfig,
  CameraTransitionInterpolation,
  EaseFnName,
  PointerAction,
  SceneCamera,
} from './types';

export {
  DEFAULT_CAMERA,
  DEFAULT_CAMERA_DESCRIPTOR,
  interpolateCameraDescriptor,
  extractWorldPosFromDescriptor,
  functionalCameraTransitionSpec,
} from './compile';

export type { CameraProps, WorldCameraProps, OrbitCameraProps } from './dsl';
export { Camera } from './dsl';
export { CameraWidget, CUSTOM_NODE_HANDLER } from './CameraWidget';
```

---

## 14. Implementation Order

Implement in this sequence to avoid forward dependencies:

1. **`packages/core/package.json`** — `pnpm --filter @brewsite/core add camera-controls`. Verify types are bundled (`camera-controls` ships its own `.d.ts`).
2. **`packages/core/src/elements/camera/types.ts`** — foundation; all else depends on it.
3. **`packages/core/src/elements/camera/compile.ts`** — pure functions, no Three.js.
4. **`packages/core/src/elements/camera/dsl.tsx`** — thin authoring surface.
5. **`packages/core/src/elements/camera/render.ts`** — Three.js + `camera-controls`. Note: `CameraControls.install({ THREE })` is idempotent; safe to call at module load.
6. **`packages/core/src/elements/camera/CameraWidget.ts`** — wires all camera pieces; lazy-inits from `scene.userData`.
7. **`packages/core/src/elements/camera/index.ts`** — add new exports per §13.
8. **`packages/core/src/input/types.ts`** — input type contracts.
9. **`packages/core/src/input/InputController.ts`** — DOM event handler.
10. **`packages/core/src/input/index.ts`** — barrel per §13.
11. **`packages/core/src/player/TimelineWidgetTypes.ts`** — prop types (no dependencies).
12. **`packages/core/src/player/useEngineInput.ts`** — depends on `useEngineScroll` and `InputController`.
13. **`packages/core/src/player/EngineInputRegion.tsx`** — depends on `useSceneEngine` types.
14. **`packages/core/src/player/TimelineWidget.tsx`** — depends on `TimelineWidgetTypes` and `UseSceneEngineResult`.
15. **`packages/core/src/player/useSceneEngine.ts`** — add `inputMap`, `sceneCount`, `__brewsite_renderer`, `wheelGuard`.
16. **`packages/core/src/player/ScenePlayer.tsx`** — wire `inputMap`, `timeline`, switch to `EngineInputRegion`.
17. **`packages/core/src/player/index.ts`** — add exports per §13.
18. **`packages/core/src/index.ts`** — add exports per §13.
19. **Write tests** — camera compile, InputController, TimelineWidget, applyCamera.
20. **`pnpm --filter @brewsite/core typecheck`** — must pass clean.
21. **`pnpm --filter @brewsite/core test`** — must pass clean.
