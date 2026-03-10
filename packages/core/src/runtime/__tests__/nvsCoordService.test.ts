// Tests for createNVSCoordService: verifies NVS→world coordinate math.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNVSCoordService } from '../../layout/nvsCoordService';

/**
 * Reference setup: camera at [0, 0, 12.07] with fov=45.
 * visibleWorldHeight = 2 * 12.07 * tan(22.5°) ≈ 10
 * visibleWorldWidth  = 10 * (16/9) ≈ 17.78
 */
const makeTestCamera = () => {
  const cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.01, 100);
  cam.position.set(0, 0, 12.07);
  return cam;
};

describe('createNVSCoordService', () => {
  it('toWorld(0.5, 0.5, 0) maps NVS center to world origin', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1920, 1080);
    const [wx, wy, wz] = svc.toWorld(0.5, 0.5, 0);
    expect(wx).toBeCloseTo(0, 2);
    expect(wy).toBeCloseTo(0, 2);
    expect(wz).toBe(0);
  });

  it('toWorld(0, 0, 0) maps top-left to approximately [-8.89, 5, 0]', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1920, 1080);
    const [wx, wy, wz] = svc.toWorld(0, 0, 0);
    expect(wx).toBeCloseTo(-8.89, 1);
    expect(wy).toBeCloseTo(5, 1);
    expect(wz).toBe(0);
  });

  it('toWorld(1, 1, 0) maps bottom-right to approximately [8.89, -5, 0]', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1920, 1080);
    const [wx, wy, wz] = svc.toWorld(1, 1, 0);
    expect(wx).toBeCloseTo(8.89, 1);
    expect(wy).toBeCloseTo(-5, 1);
    expect(wz).toBe(0);
  });

  it('toWorld passes z through unchanged', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1920, 1080);
    const [, , wz] = svc.toWorld(0.5, 0.5, 3.5);
    expect(wz).toBe(3.5);
  });

  it('toWorld uses z=0 as default', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1920, 1080);
    const [, , wz] = svc.toWorld(0.5, 0.5);
    expect(wz).toBe(0);
  });

  it('toWorldSize(1, 1) returns approximately [17.78, 10]', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1920, 1080);
    const [ww, wh] = svc.toWorldSize(1, 1);
    expect(ww).toBeCloseTo(17.78, 1);
    expect(wh).toBeCloseTo(10, 1);
  });

  it('toWorldSize(0.5, 0.5) returns half the visible world size', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1920, 1080);
    const [ww, wh] = svc.toWorldSize(0.5, 0.5);
    expect(ww).toBeCloseTo(8.89, 1);
    expect(wh).toBeCloseTo(5, 1);
  });

  it('visibleWorldHeight is approximately 10', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1920, 1080);
    expect(svc.visibleWorldHeight).toBeCloseTo(10, 1);
  });

  it('visibleWorldWidth is approximately 17.78 at 16:9', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1920, 1080);
    expect(svc.visibleWorldWidth).toBeCloseTo(17.78, 1);
  });

  it('canvasAspect reflects the viewport dimensions', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1920, 1080);
    expect(svc.canvasAspect).toBeCloseTo(16 / 9, 4);
  });

  it('viewportWidth and viewportHeight are stored as provided', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1280, 720);
    expect(svc.viewportWidth).toBe(1280);
    expect(svc.viewportHeight).toBe(720);
  });

  it('handles a 1:1 square viewport correctly', () => {
    const cam = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    cam.position.set(0, 0, 12.07);
    const svc = createNVSCoordService(cam, 512, 512);
    expect(svc.canvasAspect).toBeCloseTo(1, 4);
    expect(svc.visibleWorldWidth).toBeCloseTo(svc.visibleWorldHeight, 4);
  });

  it('guards against zero-height viewport (no division by zero)', () => {
    const cam = makeTestCamera();
    const svc = createNVSCoordService(cam, 1920, 0);
    // viewportHeight=0 should produce a valid aspect (using max(1, height) fallback)
    expect(Number.isFinite(svc.canvasAspect)).toBe(true);
    expect(svc.canvasAspect).toBeGreaterThan(0);
  });
});
