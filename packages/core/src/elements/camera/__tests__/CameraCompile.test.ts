import { describe, it, expect } from 'vitest';
import { Camera } from '../dsl';
import { DEFAULT_CAMERA, functionalCameraTransitionSpec } from '../compile';
import type { SceneCamera } from '../types';

describe('camera compile', () => {
  it('defaults are disabled with fitBotHeight mode', () => {
    expect(DEFAULT_CAMERA.enabled).toBe(false);
    expect(DEFAULT_CAMERA.mode).toBe('fitBotHeight');
  });

  it('functional transitionSpec.exit at t=0 returns fromState', () => {
    const from: SceneCamera = { ...DEFAULT_CAMERA, enabled: true, mode: 'fitBotHeight' };
    const fn = functionalCameraTransitionSpec.exitFn(from);
    const result = fn(0);
    expect(result.enabled).toBe(true);
    expect(result.mode).toBe('fitBotHeight');
  });

  it('functional transitionSpec.exit at t=1 disables camera', () => {
    const from: SceneCamera = { ...DEFAULT_CAMERA, enabled: true, mode: 'fitBotHeight' };
    const fn = functionalCameraTransitionSpec.exitFn(from);
    const result = fn(1);
    expect(result.enabled).toBe(false);
  });

  it('functional transitionSpec.enter at t=0 remains disabled', () => {
    const to: SceneCamera = { ...DEFAULT_CAMERA, enabled: true, mode: 'fitBotHeight' };
    const fn = functionalCameraTransitionSpec.enterFn(to);
    const result = fn(0);
    expect(result.enabled).toBe(false);
  });

  it('functional transitionSpec.enter at t=1 enables camera', () => {
    const to: SceneCamera = { ...DEFAULT_CAMERA, enabled: true, mode: 'fitBotHeight' };
    const fn = functionalCameraTransitionSpec.enterFn(to);
    const result = fn(1);
    expect(result.enabled).toBe(true);
  });

  it('functional transitionSpec.interpolate at t=0 returns fromState', () => {
    const from: SceneCamera = { ...DEFAULT_CAMERA, enabled: true, mode: 'fitBotHeight' };
    const to: SceneCamera = { ...DEFAULT_CAMERA, enabled: true, mode: 'fitFloorDepth' };
    const fn = functionalCameraTransitionSpec.interpolateFn(from, to);
    const result = fn(0);
    expect(result.mode).toBe('fitBotHeight');
  });

  it('functional transitionSpec.interpolate at t=1 returns toState', () => {
    const from: SceneCamera = { ...DEFAULT_CAMERA, enabled: true, mode: 'fitBotHeight' };
    const to: SceneCamera = { ...DEFAULT_CAMERA, enabled: true, mode: 'fitFloorDepth' };
    const fn = functionalCameraTransitionSpec.interpolateFn(from, to);
    const result = fn(1);
    expect(result.mode).toBe('fitFloorDepth');
  });

  it('functional transitionSpec.interpolate at t=0.5 switches at midpoint', () => {
    const from: SceneCamera = { ...DEFAULT_CAMERA, enabled: true, mode: 'fitBotHeight' };
    const to: SceneCamera = { ...DEFAULT_CAMERA, enabled: true, mode: 'fitFloorDepth' };
    const fn = functionalCameraTransitionSpec.interpolateFn(from, to);
    const result = fn(0.5);
    expect(result.mode).toBe('fitFloorDepth');
  });

  it('functional transitionSpec.interpolate blends camera X/Y and lookAtZ', () => {
    const from: SceneCamera = {
      ...DEFAULT_CAMERA,
      enabled: true,
      mode: 'fitFloorDepth',
      cameraX: 0,
      cameraY: 1,
      lookAtZ: -2,
    };
    const to: SceneCamera = {
      ...DEFAULT_CAMERA,
      enabled: true,
      mode: 'fitFloorDepth',
      cameraX: 10,
      cameraY: 5,
      lookAtZ: 2,
    };
    const fn = functionalCameraTransitionSpec.interpolateFn(from, to);
    const result = fn(0.5);
    expect(result.cameraX).toBeCloseTo(5);
    expect(result.cameraY).toBeCloseTo(3);
    expect(result.lookAtZ).toBeCloseTo(0);
  });

  it('functional transitionSpec.interpolate blends numeric camera fields', () => {
    const from: SceneCamera = {
      ...DEFAULT_CAMERA,
      enabled: true,
      mode: 'fitBotHeight',
      fov: 40,
      targetHeight: 1,
      framingHeightPct: 0.2,
      heightOffset: 0,
      distanceOffset: 0,
      floorY: 0,
      floorZMin: -10,
      floorZMax: 10,
    };
    const to: SceneCamera = {
      ...DEFAULT_CAMERA,
      enabled: true,
      mode: 'fitFloorDepth',
      fov: 60,
      targetHeight: 3,
      framingHeightPct: 0.6,
      heightOffset: 2,
      distanceOffset: 5,
      floorY: 4,
      floorZMin: -2,
      floorZMax: 20,
    };
    const fn = functionalCameraTransitionSpec.interpolateFn(from, to);
    const result = fn(0.5);
    expect(result.fov).toBeCloseTo(50);
    expect(result.targetHeight).toBeCloseTo(2);
    expect(result.framingHeightPct).toBeCloseTo(0.4);
    expect(result.heightOffset).toBeCloseTo(1);
    expect(result.distanceOffset).toBeCloseTo(2.5);
    expect(result.floorY).toBeCloseTo(2);
    expect(result.floorZMin).toBeCloseTo(-6);
    expect(result.floorZMax).toBeCloseTo(15);
  });

  it('Camera DSL component renders null and has displayName', () => {
    expect(Camera.displayName).toBe('Camera');
    expect(Camera({})).toBeNull();
  });
});
