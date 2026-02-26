import { describe, it, expect } from 'vitest';
import type { SceneCamera } from '../types';
import { interpolateCameraDescriptor } from '../compile';

describe('interpolateCameraDescriptor', () => {
  it('linearly interpolates world-space positions', () => {
    const from: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 0, 0], target: [0, 0, 0] },
    };
    const to: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [10, 0, 0], target: [5, 0, 0] },
    };
    const result = interpolateCameraDescriptor(from, to, 0.5);
    expect(result.mode).toBe('world');
    if (result.mode === 'world') expect(result.position).toEqual([5, 0, 0]);
  });

  it('interpolates orbit azimuth with shortest-path', () => {
    const from: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'orbit', target: [0, 0, 0], azimuth: 0, polar: 0, distance: 10 },
      transitionIn: { type: 'orbit' },
    };
    const to: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'orbit', target: [0, 0, 0], azimuth: Math.PI * 1.9, polar: 0, distance: 10 },
      transitionIn: { type: 'orbit' },
    };
    // 1.9π from 0: shortest path should go backward (-0.1π), not forward (+1.9π)
    const result = interpolateCameraDescriptor(from, to, 0.5);
    expect(result.mode).toBe('orbit');
    if (result.mode === 'orbit') {
      expect(result.azimuth).toBeCloseTo(-Math.PI * 0.05, 3);
    }
  });

  it('follows bezier control points', () => {
    const from: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 0, 0], target: [0, 0, 0] },
      transitionIn: { type: 'bezier', cp1: [0, 10, 0], cp2: [10, 10, 0] },
    };
    const to: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [10, 0, 0], target: [5, 0, 0] },
      transitionIn: { type: 'bezier', cp1: [0, 10, 0], cp2: [10, 10, 0] },
    };
    const mid = interpolateCameraDescriptor(from, to, 0.5);
    // At t=0.5 of cubic bezier with symmetric control points, Y should be elevated
    if (mid.mode === 'world') expect(mid.position[1]).toBeGreaterThan(0);
  });
});
