// Tests for shader surface default state and transition spec.

import { describe, it, expect } from 'vitest';
import { DEFAULT_SHADER_SURFACE_STATE, shaderSurfaceTransitionSpec } from '../compile';
import { resolveToNVS } from '@brewsite/core/units/resolve';
import type { TransitionContext } from '@brewsite/core/compiler/transitions/transitionTypes';

const ctx = (t: number): TransitionContext => ({
  t,
  bp: t,
  channel: () => t,
});

describe('DEFAULT_SHADER_SURFACE_STATE', () => {
  it('has all number values for spatial fields', () => {
    expect(typeof DEFAULT_SHADER_SURFACE_STATE.x).toBe('number');
    expect(typeof DEFAULT_SHADER_SURFACE_STATE.y).toBe('number');
    expect(typeof DEFAULT_SHADER_SURFACE_STATE.w).toBe('number');
    expect(typeof DEFAULT_SHADER_SURFACE_STATE.h).toBe('number');
    expect(typeof DEFAULT_SHADER_SURFACE_STATE.z).toBe('number');
  });

  it('starts disabled', () => {
    expect(DEFAULT_SHADER_SURFACE_STATE.enabled).toBe(false);
  });

  it('has sensible defaults', () => {
    expect(DEFAULT_SHADER_SURFACE_STATE.kind).toBe('plane');
    expect(DEFAULT_SHADER_SURFACE_STATE.opacity).toBe(0.4);
    expect(DEFAULT_SHADER_SURFACE_STATE.palette).toBe('hero');
    expect(DEFAULT_SHADER_SURFACE_STATE.reveal).toBe(1);
  });
});

describe('unit resolution for ShaderSurface DSL props', () => {
  it('resolves "20%" to 0.2 NVS fraction', () => {
    expect(resolveToNVS('20%')).toBe(0.2);
  });

  it('resolves "30%" to 0.3 NVS fraction', () => {
    expect(resolveToNVS('30%')).toBe(0.3);
  });

  it('resolves "60%" to 0.6 NVS fraction', () => {
    expect(resolveToNVS('60%')).toBe(0.6);
  });

  it('resolves "40%" to 0.4 NVS fraction', () => {
    expect(resolveToNVS('40%')).toBe(0.4);
  });

  it('resolves 0 to 0', () => {
    expect(resolveToNVS(0)).toBe(0);
  });

  it('resolves "100%" to 1.0 NVS fraction', () => {
    expect(resolveToNVS('100%')).toBe(1.0);
  });
});

describe('shaderSurfaceTransitionSpec', () => {
  describe('exitFn', () => {
    const state = { ...DEFAULT_SHADER_SURFACE_STATE, enabled: true, opacity: 0.6, reveal: 1 };
    const fn = shaderSurfaceTransitionSpec.exitFn(state);

    it('preserves state at t=0', () => {
      const result = fn(ctx(0));
      expect(result.opacity).toBeCloseTo(0.6);
      expect(result.reveal).toBeCloseTo(1);
      expect(result.enabled).toBe(true);
    });

    it('fades opacity and reveal to 0 at t=1', () => {
      const result = fn(ctx(1));
      expect(result.opacity).toBeCloseTo(0);
      expect(result.reveal).toBeCloseTo(0);
      expect(result.enabled).toBe(false);
    });

    it('blends at t=0.5', () => {
      const result = fn(ctx(0.5));
      expect(result.opacity).toBeCloseTo(0.3);
      expect(result.reveal).toBeCloseTo(0.5);
    });
  });

  describe('enterFn', () => {
    const state = { ...DEFAULT_SHADER_SURFACE_STATE, enabled: true, opacity: 0.4, reveal: 1 };
    const fn = shaderSurfaceTransitionSpec.enterFn(state);

    it('starts from zero at t=0', () => {
      const result = fn(ctx(0));
      expect(result.opacity).toBeCloseTo(0);
      expect(result.reveal).toBeCloseTo(0);
      expect(result.enabled).toBe(false);
    });

    it('reaches target at t=1', () => {
      const result = fn(ctx(1));
      expect(result.opacity).toBeCloseTo(0.4);
      expect(result.reveal).toBeCloseTo(1);
      expect(result.enabled).toBe(true);
    });
  });

  describe('interpolateFn', () => {
    const from = {
      ...DEFAULT_SHADER_SURFACE_STATE,
      enabled: true,
      x: 0.1,
      opacity: 0.3,
      edgeGlow: 0.1,
    };
    const to = {
      ...DEFAULT_SHADER_SURFACE_STATE,
      enabled: true,
      x: 0.5,
      opacity: 0.7,
      edgeGlow: 0.5,
    };
    const fn = shaderSurfaceTransitionSpec.interpolateFn(from, to);

    it('matches from state at t=0', () => {
      const result = fn(ctx(0));
      expect(result.x).toBeCloseTo(0.1);
      expect(result.opacity).toBeCloseTo(0.3);
      expect(result.edgeGlow).toBeCloseTo(0.1);
    });

    it('matches to state at t=1', () => {
      const result = fn(ctx(1));
      expect(result.x).toBeCloseTo(0.5);
      expect(result.opacity).toBeCloseTo(0.7);
      expect(result.edgeGlow).toBeCloseTo(0.5);
    });

    it('blends continuous values at t=0.5', () => {
      const result = fn(ctx(0.5));
      expect(result.x).toBeCloseTo(0.3);
      expect(result.opacity).toBeCloseTo(0.5);
      expect(result.edgeGlow).toBeCloseTo(0.3);
    });

    it('snaps discrete values at t=0.5 boundary', () => {
      const from2 = { ...DEFAULT_SHADER_SURFACE_STATE, kind: 'plane' as const };
      const to2 = { ...DEFAULT_SHADER_SURFACE_STATE, kind: 'ribbon' as const };
      const fn2 = shaderSurfaceTransitionSpec.interpolateFn(from2, to2);

      expect(fn2(ctx(0.3)).kind).toBe('plane');
      expect(fn2(ctx(0.7)).kind).toBe('ribbon');
    });

    it('blends distortion values', () => {
      const from3 = { ...DEFAULT_SHADER_SURFACE_STATE, distortion: 0 };
      const to3 = { ...DEFAULT_SHADER_SURFACE_STATE, distortion: 1 };
      const fn3 = shaderSurfaceTransitionSpec.interpolateFn(from3, to3);

      expect(fn3(ctx(0.5)).distortion).toBeCloseTo(0.5);
    });

    it('blends scanStrength values', () => {
      const from3 = { ...DEFAULT_SHADER_SURFACE_STATE, scanStrength: 0 };
      const to3 = { ...DEFAULT_SHADER_SURFACE_STATE, scanStrength: 0.8 };
      const fn3 = shaderSurfaceTransitionSpec.interpolateFn(from3, to3);

      expect(fn3(ctx(0.5)).scanStrength).toBeCloseTo(0.4);
    });
  });
});
