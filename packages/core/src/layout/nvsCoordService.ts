// NVS coordinate service factory — constructs a per-frame NVS→world converter.
// Use in RuntimeDriverImpl.tick() and in unit tests that need a real NVSCoordService.

import * as THREE from 'three';
import type { NVSCoordService } from '../widget/types';

/**
 * Constructs a real NVSCoordService from a PerspectiveCamera and viewport dimensions.
 *
 * Use in RuntimeDriverImpl.tick() to build the per-frame service, and in unit tests
 * to build a service without bootstrapping a full runtime.
 *
 * @param camera         The scene's live PerspectiveCamera.
 * @param viewportWidth  Canvas width in CSS pixels.
 * @param viewportHeight Canvas height in CSS pixels.
 */
export function createNVSCoordService(
  camera: THREE.PerspectiveCamera,
  viewportWidth: number,
  viewportHeight: number,
): NVSCoordService {
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const cameraDistance = camera.position.z; // assumes target z=0
  const visibleWorldHeight = 2 * cameraDistance * Math.tan(fovRad / 2);
  const canvasAspect = viewportWidth / Math.max(1, viewportHeight);
  const visibleWorldWidth = visibleWorldHeight * canvasAspect;

  return {
    toWorld(nvsX: number, nvsY: number, z: number = 0): readonly [number, number, number] {
      const worldX = (nvsX - 0.5) * visibleWorldWidth;
      const worldY = -(nvsY - 0.5) * visibleWorldHeight; // Y-flip: NVS 0=top, world Y+ up
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
