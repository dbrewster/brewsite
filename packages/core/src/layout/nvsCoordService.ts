// NVS coordinate service factory — constructs a per-frame NVS→world converter.
// Pure math — no Three.js dependency. Uses compiled camera state, not the live camera.

import type { NVSCoordService } from '../widget/types';
import type { SceneCamera, CameraPositionDescriptor } from '../elements/camera/types';

/**
 * Plain-data camera parameters for NVS→world coordinate conversion.
 * Derived from the compiled SceneCamera state by resolveNVSParamsFromCameraState().
 * Test code can construct these directly without Three.js.
 */
export type NVSCameraParams = {
  /** Distance from camera to target in world units. */
  distance: number;
  /** Vertical field of view in degrees. */
  fovDeg: number;
  /** World-space X of the viewport center (camera look-at X). Default: 0. */
  centerX?: number;
  /** World-space Y of the viewport center (camera look-at Y). Default: 0. */
  centerY?: number;
};

/**
 * Extracts NVS camera parameters from a compiled SceneCamera state.
 *
 * Uses the scene author's intended camera geometry (position, target, FOV)
 * — NOT the live Three.js camera. This makes the NVS mapping stable under
 * user camera interaction (orbit, dolly, pan).
 *
 * Returns null for legacy auto-framing modes (fitBotHeight, fitFloorDepth)
 * that cannot be resolved without the Three.js solver.
 *
 * @param state  Compiled SceneCamera from the SceneTrackTick.
 */
export function resolveNVSParamsFromCameraState(state: SceneCamera): NVSCameraParams | null {
  const pos = extractCameraGeometry(state.descriptor);
  if (!pos) return null;

  const dx = pos.position[0] - pos.target[0];
  const dy = pos.position[1] - pos.target[1];
  const dz = pos.position[2] - pos.target[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  return {
    distance,
    fovDeg: state.lens?.fov ?? 45,
    centerX: pos.target[0],
    centerY: pos.target[1],
  };
}

/**
 * Constructs an NVSCoordService from plain camera parameters and viewport dimensions.
 *
 * The canonical usage is in RuntimeDriverImpl.tick():
 *   1. Resolve the compiled camera state from the SceneTrackTick
 *   2. Call resolveNVSParamsFromCameraState() to extract plain params
 *   3. Pass to this function with the viewport dimensions
 *
 * Test code can call this directly with hand-crafted NVSCameraParams.
 *
 * @param camera         Plain camera parameters (distance, fov, optional center).
 * @param viewportWidth  Canvas width in CSS pixels.
 * @param viewportHeight Canvas height in CSS pixels.
 */
export function createNVSCoordService(
  camera: NVSCameraParams,
  viewportWidth: number,
  viewportHeight: number,
): NVSCoordService {
  const fovRad = camera.fovDeg * Math.PI / 180;
  const visibleWorldHeight = 2 * camera.distance * Math.tan(fovRad / 2);
  const canvasAspect = viewportWidth / Math.max(1, viewportHeight);
  const visibleWorldWidth = visibleWorldHeight * canvasAspect;
  const cx = camera.centerX ?? 0;
  const cy = camera.centerY ?? 0;

  return {
    toWorld(nvsX: number, nvsY: number, z: number = 0): readonly [number, number, number] {
      const worldX = cx + (nvsX - 0.5) * visibleWorldWidth;
      const worldY = cy - (nvsY - 0.5) * visibleWorldHeight; // Y-flip: NVS 0=top, world Y+ up
      return [worldX, worldY, z];
    },
    toWorldSize(nvsW: number, nvsH: number): readonly [number, number] {
      return [nvsW * visibleWorldWidth, nvsH * visibleWorldHeight];
    },
    canvasAspect,
    visibleWorldHeight,
    visibleWorldWidth,
    viewportWidth,
    viewportHeight,
  };
}

// ─── Internal: camera geometry extraction ────────────────────────────────

/**
 * Extracts world-space position and target from a camera descriptor.
 * Returns null for auto-framing modes (fitBotHeight, fitFloorDepth).
 *
 * Intentionally duplicates the math from elements/camera/compile.ts
 * (extractWorldPosFromDescriptor) to avoid a layout→elements/camera/compile
 * runtime import dependency. The function is 10 lines of trig.
 */
function extractCameraGeometry(
  desc: CameraPositionDescriptor,
): { position: readonly [number, number, number]; target: readonly [number, number, number] } | null {
  if (desc.mode === 'world') {
    return { position: desc.position, target: desc.target };
  }
  if (desc.mode === 'orbit') {
    const { target, azimuth, polar, distance } = desc;
    const x = target[0] + distance * Math.cos(polar) * Math.sin(azimuth);
    const y = target[1] + distance * Math.sin(polar);
    const z = target[2] + distance * Math.cos(polar) * Math.cos(azimuth);
    return { position: [x, y, z], target };
  }
  return null;
}
