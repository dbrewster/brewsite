import { describe, it, expect } from 'vitest';
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
});
