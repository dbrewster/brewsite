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
import { smoothstep } from '../../timeline/math';

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
  exitFn: (from) => (t) => ({ ...from, enabled: from.enabled && t < 1 }),

  enterFn: (to) => (t) => ({ ...to, enabled: to.enabled && t > 0 }),

  interpolateFn: (from, to) => (t) => ({
    enabled: (from.enabled && t < 1) || (to.enabled && t > 0),
    descriptor: interpolateCameraDescriptor(from, to, t),
    lens: interpolateLens(from, to, t),
    post: interpolatePost(from, to, t),
    // Interaction follows the "from" scene in the first half, then the "to" scene.
    // This keeps interaction available on scene 0 even if scene 1 has no camera.
    interaction: t < 0.5 ? from.interaction : to.interaction,
    transitionIn: to.transitionIn,
  }),
};

// ─── Discrete transition spec (compat) ─────────────────────────────────────

export const cameraTransitionSpec: ElementTransitionSpec<SceneCamera> = {
  exit: (frames, widgetId, fromState) => {
    const fn = functionalCameraTransitionSpec.exitFn(fromState);
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = fn(t);
    }
  },
  enter: (frames, widgetId, toState) => {
    const fn = functionalCameraTransitionSpec.enterFn(toState);
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = fn(t);
    }
  },
  interpolate: (frames, widgetId, fromState, toState) => {
    const fn = functionalCameraTransitionSpec.interpolateFn(fromState, toState);
    for (let i = 0; i < frames.length; i++) {
      const t = transitionT(i, frames.length);
      frames[i]!.state.widgets[widgetId] = fn(t);
    }
  },
};
