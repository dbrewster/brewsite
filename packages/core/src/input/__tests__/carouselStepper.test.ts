// Tests for pure carousel index computation.

import { describe, it, expect } from 'vitest';
import { computeCarouselStep, type CarouselStepInput } from '../carouselStepper';

describe('computeCarouselStep', () => {
  // --- Empty carousel ---
  it('returns null for an empty carousel', () => {
    const result = computeCarouselStep({
      currentIndex: 0, direction: 1, step: 1, childCount: 0, loop: false,
    });
    expect(result).toBeNull();
  });

  // --- Non-loop mode ---
  it('steps forward by 1 in non-loop mode', () => {
    const result = computeCarouselStep({
      currentIndex: 0, direction: 1, step: 1, childCount: 5, loop: false,
    });
    expect(result).toBe(1);
  });

  it('steps backward by 1 in non-loop mode', () => {
    const result = computeCarouselStep({
      currentIndex: 3, direction: -1, step: 1, childCount: 5, loop: false,
    });
    expect(result).toBe(2);
  });

  it('clamps at upper boundary in non-loop mode', () => {
    const result = computeCarouselStep({
      currentIndex: 4, direction: 1, step: 1, childCount: 5, loop: false,
    });
    expect(result).toBeNull();
  });

  it('clamps at lower boundary in non-loop mode', () => {
    const result = computeCarouselStep({
      currentIndex: 0, direction: -1, step: 1, childCount: 5, loop: false,
    });
    expect(result).toBeNull();
  });

  it('steps forward by 2 in non-loop mode', () => {
    const result = computeCarouselStep({
      currentIndex: 1, direction: 1, step: 2, childCount: 5, loop: false,
    });
    expect(result).toBe(3);
  });

  it('clamps when step overshoots the upper boundary', () => {
    const result = computeCarouselStep({
      currentIndex: 3, direction: 1, step: 3, childCount: 5, loop: false,
    });
    expect(result).toBe(4);
  });

  it('clamps when step overshoots the lower boundary', () => {
    const result = computeCarouselStep({
      currentIndex: 1, direction: -1, step: 3, childCount: 5, loop: false,
    });
    expect(result).toBe(0);
  });

  // --- Loop mode ---
  it('wraps forward in loop mode', () => {
    const result = computeCarouselStep({
      currentIndex: 4, direction: 1, step: 1, childCount: 5, loop: true,
    });
    expect(result).toBe(0);
  });

  it('wraps backward in loop mode', () => {
    const result = computeCarouselStep({
      currentIndex: 0, direction: -1, step: 1, childCount: 5, loop: true,
    });
    expect(result).toBe(4);
  });

  it('wraps forward by step > 1 in loop mode', () => {
    const result = computeCarouselStep({
      currentIndex: 3, direction: 1, step: 3, childCount: 5, loop: true,
    });
    expect(result).toBe(1);
  });

  it('returns null when loop wraps to the same index', () => {
    // Single-element carousel: any step loops back to 0
    const result = computeCarouselStep({
      currentIndex: 0, direction: 1, step: 1, childCount: 1, loop: true,
    });
    expect(result).toBeNull();
  });
});
