// Camera element renderer — Three.js camera control.
// ONLY file in the camera module that may import Three.js.

import * as THREE from 'three';
import CameraControls from 'camera-controls';
import type { SceneTrackTick } from '../../compiler/sceneTrackTypes';
import type { SceneModelInstanceState } from '../model/types';
import type { SceneCamera, CameraInteractionConfig } from './types';

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
