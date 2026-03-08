// Camera element renderer — Three.js camera control.
// ONLY file in the camera module that may import Three.js.
// CameraControlsDriver is consumed by CameraWidget; this file does not re-export it.

import * as THREE from 'three';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';
/** Minimal model state shape used for camera target resolution. Full type lives in @brewsite/model. */
type SceneModelInstanceState = {
  model: { position: [number, number, number]; scale?: number };
};
import type { SceneCamera } from './types';
import { nvsToWorldAnalytic } from '../../layout/nvsWorldBridge';

export type CameraRenderContext = {
  camera: THREE.PerspectiveCamera;
  tick: SceneTrackTick;
  /** Renderer reference, used for exposure application. Injected via WidgetInitContext. */
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
  // Scale the search upper bound with scene Z extent rather than a fixed 5000-unit constant.
  // For a 1-unit world (zMax≈1, zMin≈0):  hi = 1 + max(10, 20)   = 21.
  // For a 100-unit world (zMax≈100, zMin≈-100): hi = 100 + max(10, 4000) = 4100.
  // The bisection converges in 30 iterations regardless of range; the fix prevents
  // the solver from returning a camera position thousands of units out for small worlds.
  let hi = zMax + Math.max(10, (zMax - zMin) * 20);
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
    if (desc.up) camera.up.set(...desc.up);
    if (desc.nvsTarget) {
      // Override look-at X,Y using NVS viewport fraction.
      const targetZ = desc.target[2];
      const dist = Math.abs(camera.position.z - targetZ);
      const fov = lens?.fov ?? camera.fov;
      const worldXY = nvsToWorldAnalytic(desc.nvsTarget[0], desc.nvsTarget[1], 0, 0, dist, fov, camera.aspect, targetZ);
      camera.lookAt(worldXY[0], worldXY[1], targetZ);
    } else {
      camera.lookAt(...desc.target);
    }
    return;
  }

  // Orbit mode — convert spherical to Cartesian
  if (desc.mode === 'orbit') {
    const { azimuth, polar, distance } = desc;
    let target = desc.target;
    if (desc.nvsTarget) {
      // Override orbit center X,Y using NVS viewport fraction.
      const targetZ = desc.target[2];
      const fov = lens?.fov ?? camera.fov;
      const worldXY = nvsToWorldAnalytic(desc.nvsTarget[0], desc.nvsTarget[1], 0, 0, distance, fov, camera.aspect, targetZ);
      target = [worldXY[0], worldXY[1], targetZ];
    }
    const x = target[0] + distance * Math.cos(polar) * Math.sin(azimuth);
    const y = target[1] + distance * Math.sin(polar);
    const z = target[2] + distance * Math.cos(polar) * Math.cos(azimuth);
    camera.position.set(x, y, z);
    if (desc.up) camera.up.set(...desc.up);
    camera.lookAt(...target);
    return;
  }

  // fitBotHeight mode (v1 preserved)
  if (desc.mode === 'fitBotHeight') {
    if (!desc.targetId || typeof desc.targetHeight !== 'number') return;
    const target = getTargetState(tick, desc.targetId);
    if (!target) {
      console.warn(
        `[CameraWidget] fitBotHeight camera could not find target widget "${desc.targetId}". ` +
        `Ensure a ModelWidget with widgetId="${desc.targetId}" is registered in widgetSetup.ts. ` +
        `Camera will hold its last position.`,
      );
      return;
    }
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
    // LEGACY: The old `+ 50` constant was calibrated for 100+ unit worlds (v1). For a
    // 1-unit world (floorY=0), that placed the camera 50 units above the floor — 50×
    // the expected scene scale, making content appear far below the horizon.
    // New default: derive from the floor Z extent, matching how solveCameraZForFloor
    // scales its search domain. Always supply `cameraY` explicitly for predictable results.
    const cameraY = desc.cameraY ?? (desc.floorY + (desc.floorZMax - desc.floorZMin) * 0.4);
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
