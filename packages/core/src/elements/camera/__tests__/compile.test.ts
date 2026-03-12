import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import type { SceneCamera } from '../types';
import {
  DEFAULT_CAMERA,
  DEFAULT_CAMERA_DESCRIPTOR,
  extractWorldPosFromDescriptor,
  interpolateCameraDescriptor,
  cameraTransitionSpec,
  compileNvsViewportCamera,
} from '../compile';

describe('camera defaults', () => {
  it('uses enabled 3/4 orbit default camera', () => {
    expect(DEFAULT_CAMERA.enabled).toBe(true);
    expect(DEFAULT_CAMERA_DESCRIPTOR.mode).toBe('orbit');
    if (DEFAULT_CAMERA_DESCRIPTOR.mode === 'orbit') {
      expect(DEFAULT_CAMERA_DESCRIPTOR.azimuth).toBeCloseTo(Math.PI / 4, 6);
      expect(DEFAULT_CAMERA_DESCRIPTOR.polar).toBeCloseTo(0.55, 6);
      expect(DEFAULT_CAMERA_DESCRIPTOR.distance).toBeCloseTo(4.5, 6);
    }
  });
});

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

describe('compileNvsViewportCamera', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('worldScale=10 zRange=5: outputs mode="world" with correct values', () => {
    const result = compileNvsViewportCamera(10, 5);
    expect(result.enabled).toBe(true);
    // Compiled nvsViewport always outputs mode='world' descriptor
    expect(result.descriptor.mode).toBe('world');
    if (result.descriptor.mode === 'world') {
      expect(result.descriptor.position[0]).toBeCloseTo(0, 4);
      expect(result.descriptor.position[1]).toBeCloseTo(0, 4);
      expect(result.descriptor.position[2]).toBeCloseTo(12.07, 1);
      expect(result.descriptor.target).toEqual([0, 0, 0]);
    }
    expect(result.lens?.fov).toBe(45);
    expect(result.lens?.near).toBeCloseTo(9.57, 1);
    expect(result.lens?.far).toBeCloseTo(14.57, 1);
  });

  it('worldScale=5 zRange=2: cameraZ≈6.035, near≈5.035, far≈7.035', () => {
    const result = compileNvsViewportCamera(5, 2);
    if (result.descriptor.mode === 'world') {
      expect(result.descriptor.position[2]).toBeCloseTo(6.035, 1);
    }
    expect(result.lens?.near).toBeCloseTo(5.035, 1);
    expect(result.lens?.far).toBeCloseTo(7.035, 1);
  });

  it('uses defaults when worldScale and zRange are undefined', () => {
    const result = compileNvsViewportCamera(undefined, undefined);
    expect(result.descriptor.mode).toBe('world');
    if (result.descriptor.mode === 'world') {
      expect(result.descriptor.position[2]).toBeCloseTo(12.07, 1);
    }
    expect(result.lens?.fov).toBe(45);
    // Default zRange = worldScale/2 = 5
    expect(result.lens?.near).toBeCloseTo(9.57, 1);
    expect(result.lens?.far).toBeCloseTo(14.57, 1);
  });

  it('near is clamped to 0.01 minimum', () => {
    const result = compileNvsViewportCamera(10, 5);
    // near = max(0.01, 12.07 - 2.5) = 9.57 — above clamp already
    expect(result.lens!.near!).toBeGreaterThanOrEqual(0.01);
  });

  it('worldScale=0: logs console.error and falls back to worldScale=10', () => {
    const result = compileNvsViewportCamera(0, 5);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]![0]).toContain('worldScale');
    // Fallback to worldScale=10
    if (result.descriptor.mode === 'world') {
      expect(result.descriptor.position[2]).toBeCloseTo(12.07, 1);
    }
    expect(Number.isFinite(result.lens?.near)).toBe(true);
    expect(Number.isFinite(result.lens?.far)).toBe(true);
  });

  it('worldScale=-5: logs console.error and falls back to worldScale=10', () => {
    const result = compileNvsViewportCamera(-5, 5);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]![0]).toContain('worldScale');
    if (result.descriptor.mode === 'world') {
      expect(result.descriptor.position[2]).toBeCloseTo(12.07, 1);
    }
  });

  it('zRange > 2 * cameraZ: logs console.warn about clipping', () => {
    // cameraZ ≈ 12.07 for worldScale=10; 2*cameraZ ≈ 24.14
    const result = compileNvsViewportCamera(10, 30);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain('clipped');
    // near is clamped to 0.01
    expect(result.lens?.near).toBeCloseTo(0.01, 4);
    // far = cameraZ + zRange/2 ≈ 12.07 + 15 = 27.07
    expect(result.lens?.far).toBeCloseTo(27.07, 1);
  });

  it('worldScale=Infinity: logs console.error and falls back to valid state', () => {
    const result = compileNvsViewportCamera(Infinity, 5);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(Number.isFinite(result.lens?.near)).toBe(true);
    expect(Number.isFinite(result.lens?.far)).toBe(true);
    if (result.descriptor.mode === 'world') {
      expect(result.descriptor.position.every(Number.isFinite)).toBe(true);
    }
  });

  it('worldScale=0.001: extremely small but positive — produces valid (finite) CameraState', () => {
    const result = compileNvsViewportCamera(0.001, undefined);
    // Does NOT trigger worldScale guard (0.001 > 0 and is finite)
    expect(errorSpy).not.toHaveBeenCalled();
    expect(Number.isFinite(result.lens?.near)).toBe(true);
    expect(Number.isFinite(result.lens?.far)).toBe(true);
    if (result.descriptor.mode === 'world') {
      expect(result.descriptor.position.every(Number.isFinite)).toBe(true);
    }
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
