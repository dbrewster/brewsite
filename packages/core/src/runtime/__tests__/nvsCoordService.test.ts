// Tests for NVS coordinate service: verifies NVS→world coordinate math
// and resolveNVSParamsFromCameraState extraction from compiled camera states.

import { describe, it, expect } from 'vitest';
import { createNVSCoordService, resolveNVSParamsFromCameraState } from '../../layout/nvsCoordService';
import type { NVSCameraParams } from '../../layout/nvsCoordService';
import type { SceneCamera } from '../../elements/camera/types';

/**
 * Reference setup: camera at distance=12.07 with fov=45.
 * visibleWorldHeight = 2 * 12.07 * tan(22.5°) ≈ 10
 * visibleWorldWidth  = 10 * (16/9) ≈ 17.78
 */
const defaultCamera: NVSCameraParams = { distance: 12.07, fovDeg: 45 };

describe('createNVSCoordService', () => {
  it('toWorld(0.5, 0.5, 0) maps NVS center to world origin', () => {
    const svc = createNVSCoordService(defaultCamera, 1920, 1080);
    const [wx, wy, wz] = svc.toWorld(0.5, 0.5, 0);
    expect(wx).toBeCloseTo(0, 2);
    expect(wy).toBeCloseTo(0, 2);
    expect(wz).toBe(0);
  });

  it('toWorld(0, 0, 0) maps top-left to approximately [-8.89, 5, 0]', () => {
    const svc = createNVSCoordService(defaultCamera, 1920, 1080);
    const [wx, wy, wz] = svc.toWorld(0, 0, 0);
    expect(wx).toBeCloseTo(-8.89, 1);
    expect(wy).toBeCloseTo(5, 1);
    expect(wz).toBe(0);
  });

  it('toWorld(1, 1, 0) maps bottom-right to approximately [8.89, -5, 0]', () => {
    const svc = createNVSCoordService(defaultCamera, 1920, 1080);
    const [wx, wy, wz] = svc.toWorld(1, 1, 0);
    expect(wx).toBeCloseTo(8.89, 1);
    expect(wy).toBeCloseTo(-5, 1);
    expect(wz).toBe(0);
  });

  it('toWorld passes z through unchanged', () => {
    const svc = createNVSCoordService(defaultCamera, 1920, 1080);
    const [, , wz] = svc.toWorld(0.5, 0.5, 3.5);
    expect(wz).toBe(3.5);
  });

  it('toWorld uses z=0 as default', () => {
    const svc = createNVSCoordService(defaultCamera, 1920, 1080);
    const [, , wz] = svc.toWorld(0.5, 0.5);
    expect(wz).toBe(0);
  });

  it('toWorldSize(1, 1) returns approximately [17.78, 10]', () => {
    const svc = createNVSCoordService(defaultCamera, 1920, 1080);
    const [ww, wh] = svc.toWorldSize(1, 1);
    expect(ww).toBeCloseTo(17.78, 1);
    expect(wh).toBeCloseTo(10, 1);
  });

  it('toWorldSize(0.5, 0.5) returns half the visible world size', () => {
    const svc = createNVSCoordService(defaultCamera, 1920, 1080);
    const [ww, wh] = svc.toWorldSize(0.5, 0.5);
    expect(ww).toBeCloseTo(8.89, 1);
    expect(wh).toBeCloseTo(5, 1);
  });

  it('visibleWorldHeight is approximately 10', () => {
    const svc = createNVSCoordService(defaultCamera, 1920, 1080);
    expect(svc.visibleWorldHeight).toBeCloseTo(10, 1);
  });

  it('visibleWorldWidth is approximately 17.78 at 16:9', () => {
    const svc = createNVSCoordService(defaultCamera, 1920, 1080);
    expect(svc.visibleWorldWidth).toBeCloseTo(17.78, 1);
  });

  it('canvasAspect reflects the viewport dimensions', () => {
    const svc = createNVSCoordService(defaultCamera, 1920, 1080);
    expect(svc.canvasAspect).toBeCloseTo(16 / 9, 4);
  });

  it('viewportWidth and viewportHeight are stored as provided', () => {
    const svc = createNVSCoordService(defaultCamera, 1280, 720);
    expect(svc.viewportWidth).toBe(1280);
    expect(svc.viewportHeight).toBe(720);
  });

  it('handles a 1:1 square viewport correctly', () => {
    const svc = createNVSCoordService(defaultCamera, 512, 512);
    expect(svc.canvasAspect).toBeCloseTo(1, 4);
    expect(svc.visibleWorldWidth).toBeCloseTo(svc.visibleWorldHeight, 4);
  });

  it('guards against zero-height viewport (no division by zero)', () => {
    const svc = createNVSCoordService(defaultCamera, 1920, 0);
    expect(Number.isFinite(svc.canvasAspect)).toBe(true);
    expect(svc.canvasAspect).toBeGreaterThan(0);
  });

  // ── Non-origin camera center ──────────────────────────────────────────────

  it('centers NVS on the camera target when centerX/centerY are provided', () => {
    const cam: NVSCameraParams = { distance: 12.07, fovDeg: 45, centerX: 5, centerY: 3 };
    const svc = createNVSCoordService(cam, 1920, 1080);
    const [wx, wy, wz] = svc.toWorld(0.5, 0.5, 0);
    expect(wx).toBeCloseTo(5, 2);
    expect(wy).toBeCloseTo(3, 2);
    expect(wz).toBe(0);
  });

  it('toWorld corners are offset by the camera center', () => {
    const cam: NVSCameraParams = { distance: 12.07, fovDeg: 45, centerX: 2, centerY: 1 };
    const svc = createNVSCoordService(cam, 1920, 1080);
    // Top-left should be center + original offset
    const [wx, wy] = svc.toWorld(0, 0, 0);
    expect(wx).toBeCloseTo(2 - 8.89, 1);
    expect(wy).toBeCloseTo(1 + 5, 1);
  });
});

describe('resolveNVSParamsFromCameraState', () => {
  it('extracts distance and FOV from world-mode camera', () => {
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 0, 12.07], target: [0, 0, 0] },
      lens: { fov: 45 },
    };
    const params = resolveNVSParamsFromCameraState(state);
    expect(params).not.toBeNull();
    expect(params!.distance).toBeCloseTo(12.07, 2);
    expect(params!.fovDeg).toBe(45);
    expect(params!.centerX).toBe(0);
    expect(params!.centerY).toBe(0);
  });

  it('uses 3D distance for world-mode camera not on Z axis', () => {
    // Camera at [3, 4, 0] looking at [0, 0, 0] → distance = 5
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [3, 4, 0], target: [0, 0, 0] },
      lens: { fov: 45 },
    };
    const params = resolveNVSParamsFromCameraState(state);
    expect(params).not.toBeNull();
    expect(params!.distance).toBeCloseTo(5, 4);
  });

  it('extracts center from world-mode camera target', () => {
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [5, 3, 10], target: [5, 0, 0] },
      lens: { fov: 42 },
    };
    const params = resolveNVSParamsFromCameraState(state);
    expect(params).not.toBeNull();
    expect(params!.centerX).toBe(5);
    expect(params!.centerY).toBe(0);
    expect(params!.fovDeg).toBe(42);
  });

  it('extracts orbital distance for orbit-mode camera', () => {
    const state: SceneCamera = {
      enabled: true,
      descriptor: {
        mode: 'orbit',
        target: [0, 0, 0],
        azimuth: Math.PI / 2, // camera on the X axis
        polar: 0,
        distance: 8,
      },
      lens: { fov: 45 },
    };
    const params = resolveNVSParamsFromCameraState(state);
    expect(params).not.toBeNull();
    // Distance should be the orbital distance (8), not the camera's Z position (~0)
    expect(params!.distance).toBeCloseTo(8, 2);
  });

  it('defaults FOV to 45 when lens is absent', () => {
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 0, 10], target: [0, 0, 0] },
    };
    const params = resolveNVSParamsFromCameraState(state);
    expect(params).not.toBeNull();
    expect(params!.fovDeg).toBe(45);
  });

  it('returns null for fitBotHeight mode', () => {
    const state: SceneCamera = {
      enabled: true,
      descriptor: {
        mode: 'fitBotHeight',
        targetId: 'bot',
        targetHeight: 1,
      },
    };
    const params = resolveNVSParamsFromCameraState(state);
    expect(params).toBeNull();
  });

  it('returns null for fitFloorDepth mode', () => {
    const state: SceneCamera = {
      enabled: true,
      descriptor: {
        mode: 'fitFloorDepth',
        floorY: 0,
        floorZMin: -5,
        floorZMax: 5,
      },
    };
    const params = resolveNVSParamsFromCameraState(state);
    expect(params).toBeNull();
  });
});
