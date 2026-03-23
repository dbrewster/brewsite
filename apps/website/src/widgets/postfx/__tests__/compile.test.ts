// Tests for PostFX default state and transition spec.

import { describe, it, expect } from 'vitest';
import { DEFAULT_POST_FX_STATE, postFxTransitionSpec } from '../compile';
import type { TransitionContext } from '@brewsite/core/compiler/transitions/transitionTypes';

const ctx = (t: number): TransitionContext => ({
  t,
  bp: t,
  channel: () => t,
});

describe('DEFAULT_POST_FX_STATE', () => {
  it('starts disabled', () => {
    expect(DEFAULT_POST_FX_STATE.enabled).toBe(false);
  });

  it('has all number values for effect parameters', () => {
    expect(typeof DEFAULT_POST_FX_STATE.bloomStrength).toBe('number');
    expect(typeof DEFAULT_POST_FX_STATE.bloomRadius).toBe('number');
    expect(typeof DEFAULT_POST_FX_STATE.bloomThreshold).toBe('number');
    expect(typeof DEFAULT_POST_FX_STATE.vignetteStrength).toBe('number');
    expect(typeof DEFAULT_POST_FX_STATE.gradeMix).toBe('number');
  });

  it('has sensible bloom defaults', () => {
    expect(DEFAULT_POST_FX_STATE.bloomStrength).toBe(0.3);
    expect(DEFAULT_POST_FX_STATE.bloomRadius).toBe(0.4);
    expect(DEFAULT_POST_FX_STATE.bloomThreshold).toBe(0.85);
  });

  it('has sensible vignette default', () => {
    expect(DEFAULT_POST_FX_STATE.vignetteStrength).toBe(0.3);
  });

  it('starts with zero grade mix', () => {
    expect(DEFAULT_POST_FX_STATE.gradeMix).toBe(0);
  });

  it('defaults to high quality', () => {
    expect(DEFAULT_POST_FX_STATE.quality).toBe('high');
  });
});

describe('postFxTransitionSpec', () => {
  describe('exitFn', () => {
    const state = {
      ...DEFAULT_POST_FX_STATE,
      enabled: true,
      bloomStrength: 0.5,
      vignetteStrength: 0.4,
      gradeMix: 0.2,
    };
    const fn = postFxTransitionSpec.exitFn(state);

    it('preserves state at t=0', () => {
      const result = fn(ctx(0));
      expect(result.bloomStrength).toBeCloseTo(0.5);
      expect(result.vignetteStrength).toBeCloseTo(0.4);
      expect(result.gradeMix).toBeCloseTo(0.2);
      expect(result.enabled).toBe(true);
    });

    it('fades effects to zero at t=1', () => {
      const result = fn(ctx(1));
      expect(result.bloomStrength).toBeCloseTo(0);
      expect(result.vignetteStrength).toBeCloseTo(0);
      expect(result.gradeMix).toBeCloseTo(0);
      expect(result.enabled).toBe(false);
    });

    it('blends at t=0.5', () => {
      const result = fn(ctx(0.5));
      expect(result.bloomStrength).toBeCloseTo(0.25);
      expect(result.vignetteStrength).toBeCloseTo(0.2);
      expect(result.gradeMix).toBeCloseTo(0.1);
      expect(result.enabled).toBe(true);
    });
  });

  describe('enterFn', () => {
    const state = {
      ...DEFAULT_POST_FX_STATE,
      enabled: true,
      bloomStrength: 0.6,
      vignetteStrength: 0.3,
      gradeMix: 0.15,
    };
    const fn = postFxTransitionSpec.enterFn(state);

    it('starts from zero at t=0', () => {
      const result = fn(ctx(0));
      expect(result.bloomStrength).toBeCloseTo(0);
      expect(result.vignetteStrength).toBeCloseTo(0);
      expect(result.gradeMix).toBeCloseTo(0);
      expect(result.enabled).toBe(false);
    });

    it('reaches target at t=1', () => {
      const result = fn(ctx(1));
      expect(result.bloomStrength).toBeCloseTo(0.6);
      expect(result.vignetteStrength).toBeCloseTo(0.3);
      expect(result.gradeMix).toBeCloseTo(0.15);
      expect(result.enabled).toBe(true);
    });

    it('blends at t=0.5', () => {
      const result = fn(ctx(0.5));
      expect(result.bloomStrength).toBeCloseTo(0.3);
      expect(result.vignetteStrength).toBeCloseTo(0.15);
      expect(result.gradeMix).toBeCloseTo(0.075);
    });
  });

  describe('interpolateFn', () => {
    const from = {
      ...DEFAULT_POST_FX_STATE,
      enabled: true,
      bloomStrength: 0.2,
      bloomRadius: 0.3,
      bloomThreshold: 0.9,
      vignetteStrength: 0.1,
      gradeMix: 0.0,
      quality: 'high' as const,
    };
    const to = {
      ...DEFAULT_POST_FX_STATE,
      enabled: true,
      bloomStrength: 0.8,
      bloomRadius: 0.5,
      bloomThreshold: 0.7,
      vignetteStrength: 0.5,
      gradeMix: 0.4,
      quality: 'medium' as const,
    };
    const fn = postFxTransitionSpec.interpolateFn(from, to);

    it('matches from state at t=0', () => {
      const result = fn(ctx(0));
      expect(result.bloomStrength).toBeCloseTo(0.2);
      expect(result.bloomRadius).toBeCloseTo(0.3);
      expect(result.bloomThreshold).toBeCloseTo(0.9);
      expect(result.vignetteStrength).toBeCloseTo(0.1);
      expect(result.gradeMix).toBeCloseTo(0.0);
    });

    it('matches to state at t=1', () => {
      const result = fn(ctx(1));
      expect(result.bloomStrength).toBeCloseTo(0.8);
      expect(result.bloomRadius).toBeCloseTo(0.5);
      expect(result.bloomThreshold).toBeCloseTo(0.7);
      expect(result.vignetteStrength).toBeCloseTo(0.5);
      expect(result.gradeMix).toBeCloseTo(0.4);
    });

    it('blends continuous values at t=0.5', () => {
      const result = fn(ctx(0.5));
      expect(result.bloomStrength).toBeCloseTo(0.5);
      expect(result.bloomRadius).toBeCloseTo(0.4);
      expect(result.bloomThreshold).toBeCloseTo(0.8);
      expect(result.vignetteStrength).toBeCloseTo(0.3);
      expect(result.gradeMix).toBeCloseTo(0.2);
    });

    it('snaps quality at t=0.5 boundary', () => {
      expect(fn(ctx(0.3)).quality).toBe('high');
      expect(fn(ctx(0.7)).quality).toBe('medium');
    });

    it('snaps enabled at t=0.5 boundary', () => {
      const fromDisabled = { ...from, enabled: false };
      const toEnabled = { ...to, enabled: true };
      const fn2 = postFxTransitionSpec.interpolateFn(fromDisabled, toEnabled);
      expect(fn2(ctx(0.3)).enabled).toBe(false);
      expect(fn2(ctx(0.7)).enabled).toBe(true);
    });
  });
});
