import {describe, expect, it} from 'vitest';
import {clamp01, createFadeTransition, createRangeTransition, invLerp, rangeProgress, smoothstep} from '../robotTimelineMath';

describe('robotTimelineMath', () => {
  it('handles inverse lerp with zero range', () => {
    expect(invLerp(1, 2, 2)).toBe(0);
    expect(invLerp(2, 2, 2)).toBe(1);
  });

  it('computes range progress', () => {
    expect(rangeProgress(0.5, 0, 1)).toBeCloseTo(0.5, 5);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });

  it('creates range transition with easing', () => {
    const transition = createRangeTransition({ start: 0, end: 1, from: 0, to: 10, ease: smoothstep });
    expect(transition(0)).toBe(0);
    expect(transition(1)).toBe(10);
  });

  it('creates fade transition with all branches', () => {
    const fade = createFadeTransition({ inStart: 0.1, inEnd: 0.2, outStart: 0.6, outEnd: 0.8 });
    expect(fade(0)).toBe(0);
    expect(fade(0.15)).toBeGreaterThan(0);
    expect(fade(0.5)).toBe(1);
    expect(fade(0.7)).toBeLessThan(1);
    expect(fade(0.9)).toBe(0);
  });
});
