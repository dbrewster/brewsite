// Tests for neon sign default state and transition spec.

import { describe, it, expect } from 'vitest';
import { DEFAULT_NEON_SIGN_STATE, neonSignTransitionSpec } from '../compile';
import { resolveToNVS, resolveAngle } from '@brewsite/core/units/resolve';
import type { TransitionContext } from '@brewsite/core/compiler/transitions/transitionTypes';

const ctx = (t: number): TransitionContext => ({
  t,
  bp: t,
  channel: () => t,
});

describe('DEFAULT_NEON_SIGN_STATE', () => {
  it('has all number values for spatial fields', () => {
    expect(typeof DEFAULT_NEON_SIGN_STATE.x).toBe('number');
    expect(typeof DEFAULT_NEON_SIGN_STATE.y).toBe('number');
    expect(typeof DEFAULT_NEON_SIGN_STATE.w).toBe('number');
    expect(typeof DEFAULT_NEON_SIGN_STATE.h).toBe('number');
    expect(typeof DEFAULT_NEON_SIGN_STATE.z).toBe('number');
    expect(typeof DEFAULT_NEON_SIGN_STATE.tilt).toBe('number');
    expect(typeof DEFAULT_NEON_SIGN_STATE.yRotation).toBe('number');
  });

  it('starts disabled', () => {
    expect(DEFAULT_NEON_SIGN_STATE.enabled).toBe(false);
  });

  it('has sensible defaults', () => {
    expect(DEFAULT_NEON_SIGN_STATE.opacity).toBe(1);
    expect(DEFAULT_NEON_SIGN_STATE.intensity).toBe(1);
    expect(DEFAULT_NEON_SIGN_STATE.text).toBe('BrewSite');
    expect(DEFAULT_NEON_SIGN_STATE.color).toBe('#00f5ff');
    expect(DEFAULT_NEON_SIGN_STATE.emissiveColor).toBe('#00d8ff');
    expect(DEFAULT_NEON_SIGN_STATE.x).toBe(0.5);
    expect(DEFAULT_NEON_SIGN_STATE.y).toBe(0.5);
    expect(DEFAULT_NEON_SIGN_STATE.w).toBe(0.6);
    expect(DEFAULT_NEON_SIGN_STATE.h).toBe(0.3);
    expect(DEFAULT_NEON_SIGN_STATE.z).toBe(0);
    expect(DEFAULT_NEON_SIGN_STATE.tilt).toBe(0);
    expect(DEFAULT_NEON_SIGN_STATE.yRotation).toBe(0);
  });
});

describe('unit resolution for NeonSign DSL props', () => {
  describe('SceneLength → NVS fraction', () => {
    it('resolves "50%" to 0.5', () => {
      expect(resolveToNVS('50%')).toBe(0.5);
    });

    it('resolves "25%" to 0.25', () => {
      expect(resolveToNVS('25%')).toBe(0.25);
    });

    it('resolves "80%" to 0.8', () => {
      expect(resolveToNVS('80%')).toBe(0.8);
    });

    it('resolves "60%" to 0.6', () => {
      expect(resolveToNVS('60%')).toBe(0.6);
    });
  });

  describe('SceneAngle → radians', () => {
    it('resolves "90deg" to π/2', () => {
      expect(resolveAngle('90deg')).toBeCloseTo(Math.PI / 2);
    });

    it('resolves "180deg" to π', () => {
      expect(resolveAngle('180deg')).toBeCloseTo(Math.PI);
    });

    it('resolves "0.5rad" to 0.5', () => {
      expect(resolveAngle('0.5rad')).toBe(0.5);
    });
  });

  it('resolves 0 to 0 (NVS)', () => {
    expect(resolveToNVS(0)).toBe(0);
  });

  it('resolves 0 to 0 (angle)', () => {
    expect(resolveAngle(0)).toBe(0);
  });
});

describe('neonSignTransitionSpec', () => {
  describe('exitFn', () => {
    const state = { ...DEFAULT_NEON_SIGN_STATE, enabled: true, opacity: 0.8, intensity: 1.5 };
    const fn = neonSignTransitionSpec.exitFn(state);

    it('preserves state at t=0', () => {
      const result = fn(ctx(0));
      expect(result.opacity).toBeCloseTo(0.8);
      expect(result.intensity).toBeCloseTo(1.5);
      expect(result.enabled).toBe(true);
    });

    it('fades opacity and intensity to 0 at t=1', () => {
      const result = fn(ctx(1));
      expect(result.opacity).toBeCloseTo(0);
      expect(result.intensity).toBeCloseTo(0);
      expect(result.enabled).toBe(false);
    });

    it('blends opacity and intensity at t=0.5', () => {
      const result = fn(ctx(0.5));
      expect(result.opacity).toBeCloseTo(0.4);
      expect(result.intensity).toBeCloseTo(0.75);
      expect(result.enabled).toBe(true);
    });
  });

  describe('enterFn', () => {
    const state = { ...DEFAULT_NEON_SIGN_STATE, enabled: true, opacity: 0.6, intensity: 2 };
    const fn = neonSignTransitionSpec.enterFn(state);

    it('starts from zero opacity and intensity at t=0', () => {
      const result = fn(ctx(0));
      expect(result.opacity).toBeCloseTo(0);
      expect(result.intensity).toBeCloseTo(0);
      expect(result.enabled).toBe(false);
    });

    it('reaches target opacity and intensity at t=1', () => {
      const result = fn(ctx(1));
      expect(result.opacity).toBeCloseTo(0.6);
      expect(result.intensity).toBeCloseTo(2);
      expect(result.enabled).toBe(true);
    });

    it('blends opacity and intensity at t=0.5', () => {
      const result = fn(ctx(0.5));
      expect(result.opacity).toBeCloseTo(0.3);
      expect(result.intensity).toBeCloseTo(1);
      expect(result.enabled).toBe(true);
    });
  });

  describe('interpolateFn', () => {
    const from = {
      ...DEFAULT_NEON_SIGN_STATE,
      enabled: true,
      x: 0.1,
      y: 0.2,
      opacity: 0.4,
      intensity: 1,
      tilt: 0,
      yRotation: 0,
    };
    const to = {
      ...DEFAULT_NEON_SIGN_STATE,
      enabled: true,
      x: 0.9,
      y: 0.8,
      opacity: 0.8,
      intensity: 2,
      tilt: Math.PI / 2,
      yRotation: Math.PI,
    };
    const fn = neonSignTransitionSpec.interpolateFn(from, to);

    it('matches from state at t=0', () => {
      const result = fn(ctx(0));
      expect(result.x).toBeCloseTo(0.1);
      expect(result.y).toBeCloseTo(0.2);
      expect(result.opacity).toBeCloseTo(0.4);
      expect(result.intensity).toBeCloseTo(1);
      expect(result.tilt).toBeCloseTo(0);
      expect(result.yRotation).toBeCloseTo(0);
    });

    it('matches to state at t=1', () => {
      const result = fn(ctx(1));
      expect(result.x).toBeCloseTo(0.9);
      expect(result.y).toBeCloseTo(0.8);
      expect(result.opacity).toBeCloseTo(0.8);
      expect(result.intensity).toBeCloseTo(2);
      expect(result.tilt).toBeCloseTo(Math.PI / 2);
      expect(result.yRotation).toBeCloseTo(Math.PI);
    });

    it('blends continuous numeric values at t=0.5', () => {
      const result = fn(ctx(0.5));
      expect(result.x).toBeCloseTo(0.5);
      expect(result.y).toBeCloseTo(0.5);
      expect(result.opacity).toBeCloseTo(0.6);
      expect(result.intensity).toBeCloseTo(1.5);
      expect(result.tilt).toBeCloseTo(Math.PI / 4);
      expect(result.yRotation).toBeCloseTo(Math.PI / 2);
    });

    it('snaps discrete values at t=0.5 boundary', () => {
      const from2 = { ...DEFAULT_NEON_SIGN_STATE, text: 'Hello', color: '#ff0000' };
      const to2 = { ...DEFAULT_NEON_SIGN_STATE, text: 'World', color: '#00ff00' };
      const fn2 = neonSignTransitionSpec.interpolateFn(from2, to2);

      expect(fn2(ctx(0.3)).text).toBe('Hello');
      expect(fn2(ctx(0.3)).color).toBe('#ff0000');
      expect(fn2(ctx(0.7)).text).toBe('World');
      expect(fn2(ctx(0.7)).color).toBe('#00ff00');
    });

    it('snaps enabled at t=0.5 boundary', () => {
      const from2 = { ...DEFAULT_NEON_SIGN_STATE, enabled: true };
      const to2 = { ...DEFAULT_NEON_SIGN_STATE, enabled: false };
      const fn2 = neonSignTransitionSpec.interpolateFn(from2, to2);

      expect(fn2(ctx(0.3)).enabled).toBe(true);
      expect(fn2(ctx(0.7)).enabled).toBe(false);
    });
  });
});
