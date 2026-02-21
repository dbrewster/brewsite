import { describe, it, expect } from 'vitest';
import {
  blendNumber,
  blendDistance,
  blendOpacity,
  blendVec3,
  blendColor,
  blendAxisRotation,
  blendAxisTranslation,
  mergeCssOpacity,
  blendStyleValues,
  blendStyleValuesPartial,
  resolveTransitionOpacity,
  resolveEnabledByOpacity,
} from '../transitions/transitionTypes';

describe('transitionTypes blend helpers', () => {
  it('blendNumber handles undefined inputs and interpolation', () => {
    expect(blendNumber(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendNumber(undefined, 2, 0.5)).toBe(2);
    expect(blendNumber(2, undefined, 0.5)).toBe(2);
    expect(blendNumber(0, 10, 0.5)).toBe(5);
  });

  it('blendDistance handles finite and infinite values', () => {
    expect(blendDistance(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendDistance(1, 3, 0.5)).toBe(2);
    expect(blendDistance(Infinity, 10, 0.25)).toBe(Infinity);
    expect(blendDistance(Infinity, 10, 0.75)).toBe(10);
    expect(blendDistance(-Infinity, Infinity, 0.1)).toBe(-Infinity);
  });

  it('blendOpacity treats undefined as 0', () => {
    expect(blendOpacity(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendOpacity(undefined, 1, 0.5)).toBe(0.5);
    expect(blendOpacity(1, undefined, 0.5)).toBe(0.5);
  });

  it('blendVec3 returns interpolated vectors', () => {
    expect(blendVec3(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendVec3([0, 0, 0], undefined, 0.5)).toEqual([0, 0, 0]);
    expect(blendVec3(undefined, [1, 2, 3], 0.5)).toEqual([1, 2, 3]);
    expect(blendVec3([0, 0, 0], [2, 4, 6], 0.5)).toEqual([1, 2, 3]);
  });

  it('blendColor returns interpolated hex when valid, otherwise picks defined', () => {
    expect(blendColor(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendColor('#ff0000', '#00ff00', 0.5)).toBe('#808000');
    expect(blendColor('#abc', '#def', 0.5)).toBe('#c4d5e6');
    expect(blendColor('#ff0000', undefined, 0.5)).toBe('#ff0000');
    expect(blendColor('bad', '#00ff00', 0.5)).toBe('#00ff00');
    expect(blendColor('#ff0000', '#00ff00', undefined)).toBe('#00ff00');
  });

  it('blendAxisRotation and blendAxisTranslation interpolate per-axis', () => {
    expect(blendAxisRotation(undefined, undefined, 0.5)).toBeUndefined();
    expect(blendAxisRotation({ yawPct: 0 }, { yawPct: 1 }, 0.5)).toEqual({ yawPct: 0.5, pitchPct: undefined, rollPct: undefined });
    expect(blendAxisTranslation({ xPct: 0 }, { xPct: 1, yPct: 2 }, 0.25)).toEqual({ xPct: 0.25, yPct: 2, zPct: undefined });
  });

  it('mergeCssOpacity adds opacity when provided', () => {
    expect(mergeCssOpacity(undefined, undefined)).toBeUndefined();
    expect(mergeCssOpacity({ color: 'red' }, undefined)).toEqual({ color: 'red' });
    expect(mergeCssOpacity({ color: 'red' }, 0.5)).toEqual({ color: 'red', opacity: 0.5 });
  });

  it('blendStyleValues interpolates numbers and colors', () => {
    const from = { size: 10, color: '#ff0000', keep: 'a' };
    const to = { size: 20, color: '#00ff00', keep: 'b' };
    const result = blendStyleValues(from, to, 0.5);
    expect(result?.size).toBe(15);
    expect(result?.color).toBe('#808000');
    expect(result?.keep).toBe('b');
  });

  it('blendStyleValuesPartial only includes keys from target', () => {
    const from = { size: 10, color: '#ff0000' };
    const to = { size: 20, color: '#00ff00' };
    const result = blendStyleValuesPartial(from, to, 0.5);
    expect(result).toEqual({ size: 15, color: '#808000' });
  });

  it('resolveTransitionOpacity prefers explicit opacity and enabled flag', () => {
    expect(resolveTransitionOpacity(0.2, true)).toBe(0.2);
    expect(resolveTransitionOpacity(undefined, false)).toBe(0);
    expect(resolveTransitionOpacity(undefined, true)).toBe(1);
  });

  it('resolveEnabledByOpacity respects explicit opacity', () => {
    expect(resolveEnabledByOpacity(undefined)).toBe(true);
    expect(resolveEnabledByOpacity(0)).toBe(false);
    expect(resolveEnabledByOpacity(0.1)).toBe(true);
    expect(resolveEnabledByOpacity(undefined, false)).toBe(false);
  });
});
