// Tests for signal field default state and transition spec.

import { describe, it, expect } from 'vitest';
import { DEFAULT_SIGNAL_FIELD_STATE, signalFieldTransitionSpec } from '../compile';
import { resolveToNVS } from '@brewsite/core/units/resolve';
import type { TransitionContext } from '@brewsite/core/compiler/transitions/transitionTypes';

const ctx = (t: number): TransitionContext => ({
  t,
  bp: t,
  channel: () => t,
});

describe('DEFAULT_SIGNAL_FIELD_STATE', () => {
  it('has all number values for spatial fields', () => {
    expect(typeof DEFAULT_SIGNAL_FIELD_STATE.x).toBe('number');
    expect(typeof DEFAULT_SIGNAL_FIELD_STATE.y).toBe('number');
    expect(typeof DEFAULT_SIGNAL_FIELD_STATE.w).toBe('number');
    expect(typeof DEFAULT_SIGNAL_FIELD_STATE.h).toBe('number');
    expect(typeof DEFAULT_SIGNAL_FIELD_STATE.z).toBe('number');
    expect(typeof DEFAULT_SIGNAL_FIELD_STATE.size).toBe('number');
    expect(typeof DEFAULT_SIGNAL_FIELD_STATE.depth).toBe('number');
    expect(typeof DEFAULT_SIGNAL_FIELD_STATE.spread).toBe('number');
  });

  it('starts disabled', () => {
    expect(DEFAULT_SIGNAL_FIELD_STATE.enabled).toBe(false);
  });

  it('has sensible defaults', () => {
    expect(DEFAULT_SIGNAL_FIELD_STATE.count).toBe(200);
    expect(DEFAULT_SIGNAL_FIELD_STATE.opacity).toBe(0.6);
    expect(DEFAULT_SIGNAL_FIELD_STATE.flow).toBe('orbit');
    expect(DEFAULT_SIGNAL_FIELD_STATE.palette).toBe('hero');
  });
});

describe('unit resolution for SignalField DSL props', () => {
  it('resolves "50%" to 0.5 NVS fraction', () => {
    expect(resolveToNVS('50%')).toBe(0.5);
  });

  it('resolves "10%" to 0.1 NVS fraction', () => {
    expect(resolveToNVS('10%')).toBe(0.1);
  });

  it('resolves "80%" to 0.8 NVS fraction', () => {
    expect(resolveToNVS('80%')).toBe(0.8);
  });

  it('resolves "15u" to 0.15 NVS fraction', () => {
    expect(resolveToNVS('15u')).toBe(0.15);
  });

  it('resolves "2u" to 0.02 NVS fraction', () => {
    expect(resolveToNVS('2u')).toBe(0.02);
  });

  it('resolves "5u" to 0.05 NVS fraction', () => {
    expect(resolveToNVS('5u')).toBe(0.05);
  });

  it('resolves 0 to 0', () => {
    expect(resolveToNVS(0)).toBe(0);
  });
});

describe('signalFieldTransitionSpec', () => {
  describe('exitFn', () => {
    const state = { ...DEFAULT_SIGNAL_FIELD_STATE, enabled: true, opacity: 0.8 };
    const fn = signalFieldTransitionSpec.exitFn(state);

    it('preserves state at t=0', () => {
      const result = fn(ctx(0));
      expect(result.opacity).toBeCloseTo(0.8);
      expect(result.enabled).toBe(true);
    });

    it('fades opacity to 0 at t=1', () => {
      const result = fn(ctx(1));
      expect(result.opacity).toBeCloseTo(0);
      expect(result.enabled).toBe(false);
    });

    it('blends opacity at t=0.5', () => {
      const result = fn(ctx(0.5));
      expect(result.opacity).toBeCloseTo(0.4);
      expect(result.enabled).toBe(true);
    });
  });

  describe('enterFn', () => {
    const state = { ...DEFAULT_SIGNAL_FIELD_STATE, enabled: true, opacity: 0.6 };
    const fn = signalFieldTransitionSpec.enterFn(state);

    it('starts from zero opacity at t=0', () => {
      const result = fn(ctx(0));
      expect(result.opacity).toBeCloseTo(0);
      expect(result.enabled).toBe(false);
    });

    it('reaches target opacity at t=1', () => {
      const result = fn(ctx(1));
      expect(result.opacity).toBeCloseTo(0.6);
      expect(result.enabled).toBe(true);
    });

    it('blends opacity at t=0.5', () => {
      const result = fn(ctx(0.5));
      expect(result.opacity).toBeCloseTo(0.3);
    });
  });

  describe('interpolateFn', () => {
    const from = { ...DEFAULT_SIGNAL_FIELD_STATE, enabled: true, x: 0.1, opacity: 0.4 };
    const to = { ...DEFAULT_SIGNAL_FIELD_STATE, enabled: true, x: 0.9, opacity: 0.8 };
    const fn = signalFieldTransitionSpec.interpolateFn(from, to);

    it('matches from state at t=0', () => {
      const result = fn(ctx(0));
      expect(result.x).toBeCloseTo(0.1);
      expect(result.opacity).toBeCloseTo(0.4);
    });

    it('matches to state at t=1', () => {
      const result = fn(ctx(1));
      expect(result.x).toBeCloseTo(0.9);
      expect(result.opacity).toBeCloseTo(0.8);
    });

    it('blends continuous values at t=0.5', () => {
      const result = fn(ctx(0.5));
      expect(result.x).toBeCloseTo(0.5);
      expect(result.opacity).toBeCloseTo(0.6);
    });

    it('snaps discrete values at t=0.5 boundary', () => {
      const from2 = { ...DEFAULT_SIGNAL_FIELD_STATE, flow: 'orbit' as const };
      const to2 = { ...DEFAULT_SIGNAL_FIELD_STATE, flow: 'stream' as const };
      const fn2 = signalFieldTransitionSpec.interpolateFn(from2, to2);

      expect(fn2(ctx(0.3)).flow).toBe('orbit');
      expect(fn2(ctx(0.7)).flow).toBe('stream');
    });
  });
});
