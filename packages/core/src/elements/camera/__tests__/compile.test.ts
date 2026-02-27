import { describe, it, expect } from 'vitest';
import type { SceneCamera } from '../types';
import {
  extractWorldPosFromDescriptor,
  interpolateCameraDescriptor,
  cameraTransitionSpec,
} from '../compile';

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

  it('falls back to descriptor switch when auto-framing is involved', () => {
    const from: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'fitBotHeight', targetId: 'bot', targetHeight: 1, framingHeightPct: 0.4, heightOffset: 0, distanceOffset: 0 },
    };
    const to: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [10, 0, 0], target: [0, 0, 0] },
    };
    const result = interpolateCameraDescriptor(from, to, 0.25);
    expect(result.mode).toBe('fitBotHeight');
  });

  it('supports path interpolation', () => {
    const from: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 0, 0], target: [0, 0, 0] },
      transitionIn: { type: 'path', waypoints: [[0, 5, 0], [5, 5, 0]] },
    };
    const to: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [10, 0, 0], target: [0, 0, 0] },
      transitionIn: { type: 'path', waypoints: [[0, 5, 0], [5, 5, 0]] },
    };
    const result = interpolateCameraDescriptor(from, to, 0.5);
    expect(result.mode).toBe('world');
    if (result.mode === 'world') expect(result.position[1]).toBeGreaterThan(0);
  });

  it('supports eased interpolation', () => {
    const from: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [0, 0, 0], target: [0, 0, 0] },
      transitionIn: { type: 'eased', ease: 'easeInOut' },
    };
    const to: SceneCamera = {
      enabled: true,
      descriptor: { mode: 'world', position: [10, 0, 0], target: [0, 0, 0] },
      transitionIn: { type: 'eased', ease: 'easeInOut' },
    };
    const result = interpolateCameraDescriptor(from, to, 0.25);
    expect(result.mode).toBe('world');
  });
});

describe('extractWorldPosFromDescriptor', () => {
  it('resolves world mode directly', () => {
    const res = extractWorldPosFromDescriptor({ mode: 'world', position: [1, 2, 3], target: [0, 0, 0] });
    expect(res?.position).toEqual([1, 2, 3]);
  });

  it('resolves orbit mode to cartesian', () => {
    const res = extractWorldPosFromDescriptor({ mode: 'orbit', target: [0, 0, 0], azimuth: 0, polar: 0, distance: 10 });
    expect(res?.position[2]).toBeCloseTo(10);
  });

  it('returns null for auto-framing modes', () => {
    const res = extractWorldPosFromDescriptor({ mode: 'fitFloorDepth', floorY: 0, floorZMin: -1, floorZMax: 1 });
    expect(res).toBeNull();
  });
});

describe('cameraTransitionSpec', () => {
  it('writes enter frames with enabled = true at end', () => {
    const frames = Array.from({ length: 3 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const to = { enabled: true, descriptor: { mode: 'world', position: [0, 0, 0], target: [0, 0, 0] } } as SceneCamera;
    cameraTransitionSpec.enter(frames, 'camera', to);
    expect((frames[2]!.state.widgets['camera'] as SceneCamera).enabled).toBe(true);
  });

  it('writes exit frames with enabled = false at end', () => {
    const frames = Array.from({ length: 3 }, () => ({ state: { widgets: {} as Record<string, unknown> } }));
    const from = { enabled: true, descriptor: { mode: 'world', position: [0, 0, 0], target: [0, 0, 0] } } as SceneCamera;
    cameraTransitionSpec.exit(frames, 'camera', from);
    expect((frames[2]!.state.widgets['camera'] as SceneCamera).enabled).toBe(false);
  });
});
