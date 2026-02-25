/**
 * Camera element renderer (Three.js camera control).
 */

import * as THREE from 'three';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { SceneModelInstanceState } from '../model/types';
import type { SceneCamera } from './types';

export type CameraRenderContext = {
  camera: THREE.PerspectiveCamera;
  tick: SceneTrackTick;
};

const degToRad = (deg: number) => (deg * Math.PI) / 180;

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

const solveCameraZForFloor = (camera: THREE.PerspectiveCamera, params: {
  floorY: number;
  floorZMin: number;
  floorZMax: number;
  lookAtZ: number;
  cameraX: number;
  cameraY: number;
}): number | null => {
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
      if (err < bestErr) {
        bestErr = err;
        bestZ = z;
        bestIdx = c;
      }
    }

    const center = candidates[bestIdx] as number;
    lo = Math.max(zMax + 1, center - step);
    hi = center + step;
  }

  return Number.isFinite(bestZ) ? bestZ : null;
};

export function applyCamera(state: SceneCamera, ctx: CameraRenderContext): void {
  if (!state.enabled) return;

  const camera = ctx.camera;
  if (typeof state.fov === 'number') {
    camera.fov = state.fov;
    camera.updateProjectionMatrix();
  }

  if (state.mode === 'fitBotHeight') {
    if (!state.targetId || typeof state.targetHeight !== 'number') return;
    const target = getTargetState(ctx.tick, state.targetId);
    if (!target) return;

    const targetPos = target.model.position;
    const targetScale = target.model.scale ?? 1;
    const framing = typeof state.framingHeightPct === 'number' ? state.framingHeightPct : 0.4;
    if (framing <= 0) return;

    const fovRad = degToRad(state.fov ?? camera.fov ?? 45);
    const targetHeight = state.targetHeight * targetScale;
    const distance = (targetHeight / framing) / (2 * Math.tan(fovRad / 2));
    const yOffset = state.heightOffset ?? 0;
    const zOffset = state.distanceOffset ?? 0;

    camera.position.set(targetPos[0], targetPos[1] + yOffset, targetPos[2] + distance + zOffset);
    camera.lookAt(targetPos[0], targetPos[1], targetPos[2]);
    return;
  }

  if (state.mode === 'fitFloorDepth') {
    if (
      typeof state.floorY !== 'number' ||
      typeof state.floorZMin !== 'number' ||
      typeof state.floorZMax !== 'number'
    ) {
      return;
    }

    const lookAtZ = typeof state.lookAtZ === 'number'
      ? state.lookAtZ
      : (state.floorZMin + state.floorZMax) / 2;
    const cameraX = typeof state.cameraX === 'number' ? state.cameraX : 0;
    const cameraY = typeof state.cameraY === 'number' ? state.cameraY : state.floorY + 50;

    const solvedZ = solveCameraZForFloor(camera, {
      floorY: state.floorY,
      floorZMin: state.floorZMin,
      floorZMax: state.floorZMax,
      lookAtZ,
      cameraX,
      cameraY,
    });
    if (typeof solvedZ !== 'number') return;

    camera.position.set(cameraX, cameraY, solvedZ);
    camera.lookAt(cameraX, state.floorY, lookAtZ);
  }
}
