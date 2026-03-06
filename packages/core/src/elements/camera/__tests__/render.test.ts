import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import type { SceneCamera } from '../types';
import type { SceneTrackTick } from '../../../compiler/sceneTrackTypes';
import { applyCamera } from '../render';

const makeTickDouble = (): SceneTrackTick => ({
  index: 0,
  progress: 0,
  sceneId: 's1',
  sceneIndex: 0,
  blockProgress: 0,
  state: { id: 's1', scrollProgress: 0, widgets: {} },
  deltaForward: {},
  deltaBackward: {},
});

describe('applyCamera', () => {
  it('sets camera position for world mode', () => {
    const camera = new THREE.PerspectiveCamera();
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [1, 2, 3], target: [0, 0, 0] },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });
    expect(camera.position.x).toBeCloseTo(1);
    expect(camera.position.y).toBeCloseTo(2);
    expect(camera.position.z).toBeCloseTo(3);
  });

  it('converts orbit coords to world position', () => {
    const camera = new THREE.PerspectiveCamera();
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'orbit', target: [0, 0, 0], azimuth: 0, polar: 0, distance: 10 },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });
    expect(camera.position.x).toBeCloseTo(0);
    expect(camera.position.y).toBeCloseTo(0);
    expect(camera.position.z).toBeCloseTo(10);
  });

  it('does nothing when enabled=false', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 5, 5);
    const state: SceneCamera = {
      enabled: false,
      descriptor: { mode: 'world', position: [1, 2, 3], target: [0, 0, 0] },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });
    expect(camera.position.x).toBeCloseTo(5);
    expect(camera.position.y).toBeCloseTo(5);
    expect(camera.position.z).toBeCloseTo(5);
  });

  it('warns when fitBotHeight target is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const camera = new THREE.PerspectiveCamera();
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'fitBotHeight', targetId: 'bot', targetHeight: 2 },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('bot'));
    warnSpy.mockRestore();
  });

  it('applies focalLength via setFocalLength', () => {
    const camera = new THREE.PerspectiveCamera();
    const spy = camera.setFocalLength;
    const state: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 0, 5], target: [0, 0, 0] },
      lens: { focalLength: 50 },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });
    expect(typeof spy).toBe('function');
    expect(camera.getFocalLength()).toBeCloseTo(50);
  });

  it('applies up vector before lookAt so orientation resets correctly', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.up.set(0, 0, 1);

    const state: SceneCamera = {
      enabled: true,
      descriptor: {
        mode: 'world',
        position: [10, 5, 20],
        target: [0, 0, 0],
        up: [0, 1, 0],
      },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });

    const expected = new THREE.PerspectiveCamera();
    expected.position.set(10, 5, 20);
    expected.up.set(0, 1, 0);
    expected.lookAt(0, 0, 0);

    expect(camera.quaternion.x).toBeCloseTo(expected.quaternion.x, 6);
    expect(camera.quaternion.y).toBeCloseTo(expected.quaternion.y, 6);
    expect(camera.quaternion.z).toBeCloseTo(expected.quaternion.z, 6);
    expect(camera.quaternion.w).toBeCloseTo(expected.quaternion.w, 6);
  });
});

describe('applyCamera nvsTarget', () => {
  it('world mode: nvsTarget=[0.5,0.5] points camera at viewport center (world origin)', () => {
    // Camera at z=10, fov=50°, aspect=1. nvsTarget center = world (0,0,0).
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    const state: SceneCamera = {
      enabled: true,
      descriptor: {
        mode: 'world',
        position: [0, 0, 10],
        // target has large off-center values — nvsTarget should override X,Y lookAt
        target: [999, 999, 0],
        nvsTarget: [0.5, 0.5],
      },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });

    // A camera at [0,0,10] looking at [0,0,0] should face -Z
    const expected = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    expected.position.set(0, 0, 10);
    expected.lookAt(0, 0, 0);

    expect(camera.quaternion.x).toBeCloseTo(expected.quaternion.x, 4);
    expect(camera.quaternion.y).toBeCloseTo(expected.quaternion.y, 4);
    expect(camera.quaternion.z).toBeCloseTo(expected.quaternion.z, 4);
    expect(camera.quaternion.w).toBeCloseTo(expected.quaternion.w, 4);
  });

  it('world mode: nvsTarget overrides lookAt X,Y but preserves target Z', () => {
    // Camera at [0,10,10], target Z=5. nvsTarget=[0.5,0.5] → world center at Z=5 = (0,0,5) approx.
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    const targetZ = 5;
    const state: SceneCamera = {
      enabled: true,
      descriptor: {
        mode: 'world',
        position: [0, 0, 10],
        target: [99, 99, targetZ],
        nvsTarget: [0.5, 0.5],
      },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });

    // nvsTarget center should produce worldX≈0, worldY≈0, with targetZ=5
    const expected = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    expected.position.set(0, 0, 10);
    expected.lookAt(0, 0, targetZ);

    expect(camera.quaternion.x).toBeCloseTo(expected.quaternion.x, 4);
    expect(camera.quaternion.y).toBeCloseTo(expected.quaternion.y, 4);
    expect(camera.quaternion.z).toBeCloseTo(expected.quaternion.z, 4);
    expect(camera.quaternion.w).toBeCloseTo(expected.quaternion.w, 4);
  });

  it('orbit mode: nvsTarget=[0.5,0.5] keeps orbit center at world origin', () => {
    // With nvsTarget center (0.5,0.5) the orbit center X,Y should map to (0,0).
    // Camera azimuth=0, polar=0, distance=10, targetZ=0 → camera at (0,0,10).
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    const state: SceneCamera = {
      enabled: true,
      descriptor: {
        mode: 'orbit',
        target: [99, 99, 0],  // large off-center target — nvsTarget overrides X,Y
        azimuth: 0,
        polar: 0,
        distance: 10,
        nvsTarget: [0.5, 0.5],
      },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });

    // Orbit with center (0,0,0), azimuth=0, polar=0, distance=10 → camera at (0,0,10)
    expect(camera.position.x).toBeCloseTo(0, 3);
    expect(camera.position.y).toBeCloseTo(0, 3);
    expect(camera.position.z).toBeCloseTo(10, 3);
  });

  it('orbit mode: nvsTarget preserves target Z from target[2]', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    const state: SceneCamera = {
      enabled: true,
      descriptor: {
        mode: 'orbit',
        target: [0, 0, 5],  // target Z=5 should be preserved
        azimuth: 0,
        polar: 0,
        distance: 10,
        nvsTarget: [0.5, 0.5],
      },
    };
    applyCamera(state, { camera, tick: makeTickDouble() });

    // With center (0,0,5), polar=0 (equator), distance=10: camera at (0,0,15)
    expect(camera.position.x).toBeCloseTo(0, 3);
    expect(camera.position.y).toBeCloseTo(0, 3);
    expect(camera.position.z).toBeCloseTo(15, 3);
  });
});
