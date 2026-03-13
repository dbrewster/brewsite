// Camera element compilation — pure functions. No Three.js. No React.

import type {
  SceneCamera,
  CameraPositionDescriptor,
  CameraTransitionInterpolation,
  Vec3,
  CameraLens,
  CameraPost,
} from './types';
import type {
  ElementTransitionSpec,
  FunctionalTransitionSpec,
} from '../../compiler/transitions/transitionTypes';
import { transitionT } from '../../compiler/transitions/transitionTypes';
import { makeSimpleContext } from '../../compiler/transitions/transitionResolver';
import { smoothstep } from '../../timeline/math';
import { lerpVec3 } from '../../math';

// tan(22.5°): used to derive camera distance from worldScale at fov=45.
// cameraZ = worldScale / (2 * TAN_22_5) ≈ worldScale * 1.2071
const TAN_22_5 = Math.tan(Math.PI / 8); // ≈ 0.41421356

// ─── nvsViewport camera compilation ─────────────────────────────────────────

/**
 * Compiles `mode="nvsViewport"` DSL props to a SceneCamera with `mode="world"`.
 *
 * The nvsViewport mode is fully resolved at compile time — no runtime handling
 * is needed. The resulting SceneCamera is identical in shape to a world-mode state.
 *
 * Derivation (fov fixed at 45°):
 *   cameraZ = worldScale / (2 × tan(22.5°)) ≈ worldScale × 1.2071
 *   near    = max(0.01, cameraZ − zRange / 2)
 *   far     = cameraZ + zRange / 2
 *   position = [0, 0, cameraZ]
 *   target   = [0, 0, 0]
 *
 * @param worldScale  NVS [0..1] height in world units. Default: 10.
 * @param zRange      Total visible Z depth, centered on z=0. Default: worldScale / 2.
 */
export function compileNvsViewportCamera(
  worldScaleIn: number | undefined,
  zRangeIn: number | undefined,
): SceneCamera {
  let worldScale = worldScaleIn ?? 10;
  if (!Number.isFinite(worldScale) || worldScale <= 0) {
    // DEBT: Use structured warning/return instead of console.error in pure function
    console.error(
      `[Camera mode="nvsViewport"] worldScale must be a positive finite number, ` +
      `got ${worldScale}. Falling back to default worldScale=10.`,
    );
    worldScale = 10;
  }

  const cameraZ = worldScale / (2 * TAN_22_5);
  let resolvedZRange = zRangeIn ?? worldScale / 2;

  if (!Number.isFinite(resolvedZRange) || resolvedZRange <= 0) {
    console.error(
      `[Camera mode="nvsViewport"] zRange must be a positive finite number, ` +
      `got ${resolvedZRange}. Falling back to zRange=worldScale/2.`,
    );
    resolvedZRange = worldScale / 2;
  }

  if (resolvedZRange > 2 * cameraZ) {
    console.warn(
      `[Camera mode="nvsViewport"] zRange=${resolvedZRange} exceeds 2 × cameraZ ` +
      `(${(2 * cameraZ).toFixed(2)}). near will be clamped to 0.01; ` +
      `front geometry (z > ${(cameraZ - 0.01).toFixed(2)}) will be clipped.`,
    );
  }

  const near = Math.max(0.01, cameraZ - resolvedZRange / 2);
  const far = cameraZ + resolvedZRange / 2;

  return {
    enabled: true,
    descriptor: {
      mode: 'world',
      position: [0, 0, cameraZ],
      target: [0, 0, 0],
    },
    lens: {
      fov: 45,
      near,
      far,
    },
  };
}

// ─── Defaults ─────────────────────────────────────────────────────────────

export const DEFAULT_CAMERA_DESCRIPTOR: CameraPositionDescriptor = {
  mode: 'orbit',
  target: [0, 0, 0],
  // 3/4 product-style default view.
  azimuth: Math.PI / 4,
  polar: 0.55,
  distance: 4.5,
};

export const DEFAULT_CAMERA: SceneCamera = {
  enabled: true,
  descriptor: DEFAULT_CAMERA_DESCRIPTOR,
  // near: 0.01 — eliminates near-clip pop during close-focus transitions in 1-unit worlds.
  // far: 100  — recovers ~20× depth-buffer precision vs. the previous far=2000 default.
  //             Objects at z=0 in a 3.5-unit camera distance occupy >3% of the depth range
  //             (vs. <0.005% with far=2000). No visual impact for content within 100 units.
  lens: { fov: 45, near: 0.01, far: 100 },
};

// ─── Interpolation helpers ────────────────────────────────────────────────

const lerpNum = (a: number | undefined, b: number | undefined, t: number): number | undefined => {
  if (a === undefined || b === undefined) return t < 0.5 ? a : b;
  return a + (b - a) * t;
};

// ─── Easing functions ─────────────────────────────────────────────────────

const EASE_FNS: Record<string, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
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
    0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * segT + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * segT + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
    0.5 * ((2 * p1[2]) + (-p0[2] + p2[2]) * segT + (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 + (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3),
  ];
};

// ─── Descriptor position extraction helpers ──────────────────────────────

/**
 * Extracts a world-space [position, target] pair from a descriptor, if possible.
 * Returns null for auto-framing modes (those are resolved at render time).
 */
export const extractWorldPosFromDescriptor = (
  d: CameraPositionDescriptor,
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
): CameraPositionDescriptor => {
  const interp: CameraTransitionInterpolation = to.transitionIn ?? { type: 'linear' };
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
): CameraLens | undefined => {
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
): CameraPost | undefined => {
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
  exitFn: (from) => (ctx) => ({ ...from, enabled: from.enabled && ctx.t < 1 }),

  enterFn: (to) => (ctx) => ({ ...to, enabled: to.enabled && ctx.t > 0 }),

  interpolateFn: (from, to) => (ctx) => ({
    enabled: (from.enabled && ctx.t < 1) || (to.enabled && ctx.t > 0),
    descriptor: interpolateCameraDescriptor(from, to, ctx.t),
    lens: interpolateLens(from, to, ctx.t),
    post: interpolatePost(from, to, ctx.t),
    // Interaction follows the "from" scene in the first half, then the "to" scene.
    // This keeps interaction available on scene 0 even if scene 1 has no camera.
    interaction: ctx.t < 0.5 ? from.interaction : to.interaction,
    transitionIn: to.transitionIn,
  }),
};

// ─── Discrete transition spec (compat) ─────────────────────────────────────
// The discrete spec delegates to the functional spec using makeSimpleContext so
// that both paths share the same interpolation logic.

export const cameraTransitionSpec: ElementTransitionSpec<SceneCamera> = {
  exit: (frames, widgetId, fromState) => {
    const fn = functionalCameraTransitionSpec.exitFn(fromState);
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = fn(makeSimpleContext(t));
    }
  },
  enter: (frames, widgetId, toState) => {
    const fn = functionalCameraTransitionSpec.enterFn(toState);
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = fn(makeSimpleContext(t));
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    const fn = functionalCameraTransitionSpec.interpolateFn(fromState, toState);
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = fn(makeSimpleContext(t));
    }
  },
};
