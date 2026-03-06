// Canonical NVS ↔ Three.js world-space bridge utilities.
// Pure math functions for use in compile.ts files (analytic),
// and Three.js-aware functions for use in render.ts / widget files.

import type { Vec3 } from '../math';
import type { NVSPosition } from './types';

/**
 * Converts NVS (x ∈ [0,1], y ∈ [0,1], origin top-left) to Three.js world-space
 * analytically (no camera object needed). Assumes a camera looking straight
 * down -Z at a look-at center, with the given parameters.
 *
 * Formula:
 *   h = 2 * distance * tan(vFovDeg * PI / 360)
 *   w = h * aspectRatio
 *   worldX = cx + (nvsX - 0.5) * w
 *   worldY = cy - (nvsY - 0.5) * h   // Y-flip: NVS y=0 is top, world +Y is up
 *
 * @param nvsX        NVS x in [0, 1]
 * @param nvsY        NVS y in [0, 1]
 * @param cx          World X of the camera look-at center (default 0)
 * @param cy          World Y of the camera look-at center (default 0)
 * @param distance    Camera distance from the look-at plane (world units)
 * @param vFovDeg     Vertical FOV in degrees (default 45)
 * @param aspectRatio Width/height ratio (default 16/9)
 * @param targetZ     World Z of the output point (default 0 = look-at plane)
 * @returns           World-space [x, y, z]
 */
export function nvsToWorldAnalytic(
  nvsX: number,
  nvsY: number,
  cx: number = 0,
  cy: number = 0,
  distance: number,
  vFovDeg: number = 45,
  aspectRatio: number = 16 / 9,
  targetZ: number = 0,
): Vec3 {
  const h = 2 * distance * Math.tan((vFovDeg * Math.PI) / 360);
  const w = h * aspectRatio;
  return [
    cx + (nvsX - 0.5) * w,
    cy - (nvsY - 0.5) * h,
    targetZ,
  ];
}

/**
 * Converts world-space to NVS analytically (inverse of nvsToWorldAnalytic).
 * Returns NVS position. Values outside [0,1] indicate off-screen.
 */
export function worldToNvsAnalytic(
  worldX: number,
  worldY: number,
  cx: number = 0,
  cy: number = 0,
  distance: number,
  vFovDeg: number = 45,
  aspectRatio: number = 16 / 9,
): NVSPosition {
  const h = 2 * distance * Math.tan((vFovDeg * Math.PI) / 360);
  const w = h * aspectRatio;
  return {
    x: (worldX - cx) / w + 0.5,
    y: -(worldY - cy) / h + 0.5,
  };
}

/**
 * Computes visible world dimensions at a given camera setup.
 * Returns { worldWidth, worldHeight } at the look-at plane.
 */
export function computeWorldDimensions(
  distance: number,
  vFovDeg: number = 45,
  aspectRatio: number = 16 / 9,
): { worldWidth: number; worldHeight: number } {
  const worldHeight = 2 * distance * Math.tan((vFovDeg * Math.PI) / 360);
  return { worldWidth: worldHeight * aspectRatio, worldHeight };
}

/**
 * Converts NVS position to world-space using a live Three.js PerspectiveCamera.
 * Assumes the camera looks along -Z from its current position.
 * Uses the camera's actual fov, aspect, and position for the conversion.
 *
 * Import THREE separately in render.ts files that use this function.
 *
 * @param nvsX      NVS x in [0, 1]
 * @param nvsY      NVS y in [0, 1]
 * @param camera    THREE.PerspectiveCamera with correct matrix
 * @param targetZ   World Z of the output point (default 0)
 * @returns         World-space [x, y, z]
 */
export function nvsToWorldWithCamera(
  nvsX: number,
  nvsY: number,
  camera: { fov: number; aspect: number; position: { x: number; y: number; z: number } },
  targetZ: number = 0,
): Vec3 {
  const d = camera.position.z - targetZ;
  return nvsToWorldAnalytic(
    nvsX,
    nvsY,
    camera.position.x,
    camera.position.y,
    d,
    camera.fov,
    camera.aspect,
    targetZ,
  );
}

/**
 * Computes visible world dimensions at a given camera position and target Z plane.
 * Convenience wrapper around computeWorldDimensions for use in widget layers
 * where a live camera object is available.
 *
 * @param camera   THREE.PerspectiveCamera (or compatible object) with fov, aspect, position.z
 * @param targetZ  World Z of the target plane (default 0)
 * @returns        { worldWidth, worldHeight } at the target Z plane
 */
export function computeWorldDimensionsFromCamera(
  camera: { fov: number; aspect: number; position: { z: number } },
  targetZ: number = 0,
): { worldWidth: number; worldHeight: number } {
  const d = camera.position.z - targetZ;
  return computeWorldDimensions(d, camera.fov, camera.aspect);
}

/**
 * Projects a world-space point to NVS using a live Three.js PerspectiveCamera.
 * Points behind the camera or outside the frustum return values outside [0, 1].
 */
export function worldToNvsWithCamera(
  worldX: number,
  worldY: number,
  worldZ: number,
  camera: { fov: number; aspect: number; position: { x: number; y: number; z: number } },
): NVSPosition {
  const d = camera.position.z - worldZ;
  return worldToNvsAnalytic(
    worldX,
    worldY,
    camera.position.x,
    camera.position.y,
    d,
    camera.fov,
    camera.aspect,
  );
}
