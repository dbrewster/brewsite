import { describe, it, expect } from 'vitest';
import { clamp01, invLerp, rangeProgress, smoothstep, createRangeTransition, createFadeTransition } from '../math';

describe('timeline math', () => {
  it('clamps values with clamp01', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
  });

  it('invLerp handles zero-length ranges', () => {
    expect(invLerp(0.5, 1, 1)).toBe(0);
    expect(invLerp(2, 1, 1)).toBe(1);
  });

  it('rangeProgress clamps', () => {
    expect(rangeProgress(-1, 0, 1)).toBe(0);
    expect(rangeProgress(0.5, 0, 1)).toBe(0.5);
    expect(rangeProgress(2, 0, 1)).toBe(1);
  });

  it('smoothstep eases', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
  });

  it('createRangeTransition applies ease and range', () => {
    const transition = createRangeTransition({ start: 0, end: 1, from: 10, to: 20, ease: (t) => t * t });
    expect(transition(0)).toBe(10);
    expect(transition(1)).toBe(20);
    expect(transition(0.5)).toBeCloseTo(12.5);
  });

  it('createFadeTransition handles in/out segments', () => {
    const fade = createFadeTransition({ inStart: 0.1, inEnd: 0.2, outStart: 0.8, outEnd: 0.9 });
    expect(fade(0)).toBe(0);
    expect(fade(0.15)).toBeGreaterThan(0);
    expect(fade(0.5)).toBe(1);
    expect(fade(0.85)).toBeLessThan(1);
    expect(fade(1)).toBe(0);
  });
});
