// Tests for resolveToNVS, isUniformUnit, resolveAngle, and unitContextFromCoords.

import { describe, expect, it } from 'vitest';
import type { NVSCoordService } from '../../widget/types';
import { isUniformUnit, resolveAngle, resolveToNVS, unitContextFromCoords } from '../resolve';

describe('resolveToNVS', () => {
  it('resolves "15u" → 0.15', () => {
    expect(resolveToNVS('15u')).toBeCloseTo(0.15);
  });

  it('resolves "50%" → 0.50', () => {
    expect(resolveToNVS('50%')).toBeCloseTo(0.50);
  });

  it('resolves "15vw" → 0.15', () => {
    expect(resolveToNVS('15vw')).toBeCloseTo(0.15);
  });

  it('resolves "15vh" → 0.15', () => {
    expect(resolveToNVS('15vh')).toBeCloseTo(0.15);
  });

  it('resolves 0 → 0', () => {
    expect(resolveToNVS(0)).toBe(0);
  });

  it('resolves "100%" → 1.0', () => {
    expect(resolveToNVS('100%')).toBeCloseTo(1.0);
  });

  it('resolves "-25%" → -0.25', () => {
    expect(resolveToNVS('-25%')).toBeCloseTo(-0.25);
  });
});

describe('isUniformUnit', () => {
  it('returns true for "15u"', () => {
    expect(isUniformUnit('15u')).toBe(true);
  });

  it('returns true for "0.5u"', () => {
    expect(isUniformUnit('0.5u')).toBe(true);
  });

  it('returns false for "15%"', () => {
    expect(isUniformUnit('15%')).toBe(false);
  });

  it('returns false for "15vw"', () => {
    expect(isUniformUnit('15vw')).toBe(false);
  });

  it('returns false for "15vh"', () => {
    expect(isUniformUnit('15vh')).toBe(false);
  });

  it('returns false for 0', () => {
    expect(isUniformUnit(0)).toBe(false);
  });
});

describe('resolveAngle', () => {
  it('resolves "45deg" → Math.PI / 4', () => {
    expect(resolveAngle('45deg')).toBeCloseTo(Math.PI / 4);
  });

  it('resolves "90deg" → Math.PI / 2', () => {
    expect(resolveAngle('90deg')).toBeCloseTo(Math.PI / 2);
  });

  it('resolves "180deg" → Math.PI', () => {
    expect(resolveAngle('180deg')).toBeCloseTo(Math.PI);
  });

  it('resolves "0.78rad" → 0.78', () => {
    expect(resolveAngle('0.78rad')).toBeCloseTo(0.78);
  });

  it('resolves 0 → 0', () => {
    expect(resolveAngle(0)).toBe(0);
  });

  it('resolves "-45deg" → -Math.PI / 4', () => {
    expect(resolveAngle('-45deg')).toBeCloseTo(-Math.PI / 4);
  });
});

describe('unitContextFromCoords', () => {
  it('produces correct uniformScale = min(W, H) for landscape viewport', () => {
    const coords = createTestCoordService(16, 9);
    const ctx = unitContextFromCoords(coords);

    expect(ctx.uniformScale).toBe(9);
    expect(ctx.visibleWorldWidth).toBe(16);
    expect(ctx.visibleWorldHeight).toBe(9);
  });

  it('produces correct uniformScale = min(W, H) for portrait viewport', () => {
    const coords = createTestCoordService(9, 16);
    const ctx = unitContextFromCoords(coords);

    expect(ctx.uniformScale).toBe(9);
    expect(ctx.visibleWorldWidth).toBe(9);
    expect(ctx.visibleWorldHeight).toBe(16);
  });

  it('produces correct uniformScale for square viewport', () => {
    const coords = createTestCoordService(10, 10);
    const ctx = unitContextFromCoords(coords);

    expect(ctx.uniformScale).toBe(10);
  });
});

/**
 * Creates a minimal NVSCoordService test double with the specified world dimensions.
 * Implements the interface contract without mocking.
 */
function createTestCoordService(worldWidth: number, worldHeight: number): NVSCoordService {
  return {
    toWorld(nvsX: number, nvsY: number, z = 0): readonly [number, number, number] {
      const x = (nvsX - 0.5) * worldWidth;
      const y = (0.5 - nvsY) * worldHeight;
      return [x, y, z] as const;
    },
    toWorldSize(nvsW: number, nvsH: number): readonly [number, number] {
      return [nvsW * worldWidth, nvsH * worldHeight] as const;
    },
    canvasAspect: worldWidth / worldHeight,
    visibleWorldHeight: worldHeight,
    visibleWorldWidth: worldWidth,
    viewportWidth: worldWidth * 100,
    viewportHeight: worldHeight * 100,
  };
}
