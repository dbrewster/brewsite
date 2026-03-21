// vi.mock is appropriate here: these hooks are pure math (progress → output).
// No engine fixture needed. Do not cargo-cult this pattern into tests where
// a real engine fixture would be better.

import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockProgress = 0;
vi.mock('@brewsite/core', () => ({
  useSceneProgress: () => mockProgress,
}));

import { useCountUp } from '../useCountUp';
import { useStaggeredReveal } from '../useStaggeredReveal';
import { useProgressWindow } from '../useProgressWindow';
import { useEntrance } from '../useEntrance';

function setProgress(p: number): void {
  mockProgress = p;
}

// ─── useCountUp ──────────────────────────────────────────────────────────────

describe('useCountUp', () => {
  beforeEach(() => setProgress(0));

  it('returns start value at progress=0', () => {
    setProgress(0);
    expect(useCountUp(100)).toBe(0);
  });

  it('returns target at progress=1', () => {
    setProgress(1);
    expect(useCountUp(100)).toBe(100);
  });

  it('returns intermediate eased value at progress=0.3', () => {
    setProgress(0.3);
    const result = useCountUp(100);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });

  it('respects delay option', () => {
    setProgress(0.3);
    expect(useCountUp(100, { delay: 0.5 })).toBe(0);
  });

  it('returns target after delay+duration', () => {
    setProgress(1);
    expect(useCountUp(100, { delay: 0.2, duration: 0.6 })).toBe(100);
  });

  it('rounds to specified decimals', () => {
    setProgress(0.3);
    const result = useCountUp(99.999, { decimals: 2 });
    const str = result.toString();
    const decimalPart = str.includes('.') ? str.split('.')[1] : '';
    expect(decimalPart.length).toBeLessThanOrEqual(2);
  });

  it('uses custom start value', () => {
    setProgress(0);
    expect(useCountUp(100, { start: 50 })).toBe(50);
  });
});

// ─── useStaggeredReveal ──────────────────────────────────────────────────────

describe('useStaggeredReveal', () => {
  beforeEach(() => setProgress(0));

  it('returns opacity 0 at progress=0 for first item', () => {
    setProgress(0);
    const result = useStaggeredReveal(0, 5);
    // First item starts at progress=0 (itemStart=0), so it's at the start of fade-in.
    expect(result.visible).toBe(true);
    expect(result.style.opacity).toBe(0);
  });

  it('returns fully visible at progress=1', () => {
    setProgress(1);
    const result = useStaggeredReveal(0, 5);
    expect(result.visible).toBe(true);
    expect(result.style.opacity).toBe(1);
  });

  it('later items appear later', () => {
    setProgress(0.1);
    const first = useStaggeredReveal(0, 5);
    const last = useStaggeredReveal(4, 5);
    expect(first.style.opacity).toBeGreaterThanOrEqual((last.style.opacity as number));
  });

  it('respects startAfter option', () => {
    setProgress(0.1);
    const result = useStaggeredReveal(0, 3, { startAfter: 0.2 });
    expect(result.visible).toBe(false);
    expect(result.style.opacity).toBe(0);
  });

  it('handles total=1 without division by zero', () => {
    setProgress(0.5);
    const result = useStaggeredReveal(0, 1);
    expect(result.visible).toBe(true);
  });
});

// ─── useProgressWindow ───────────────────────────────────────────────────────

describe('useProgressWindow', () => {
  beforeEach(() => setProgress(0));

  it('returns 0 when progress < start', () => {
    setProgress(0.1);
    expect(useProgressWindow(0.3, 0.8)).toBe(0);
  });

  it('returns 1 when progress > end', () => {
    setProgress(0.9);
    expect(useProgressWindow(0.2, 0.7)).toBe(1);
  });

  it('returns interpolated value in range', () => {
    setProgress(0.5);
    const result = useProgressWindow(0.0, 1.0);
    expect(result).toBeCloseTo(0.5);
  });

  it('returns correct midpoint for sub-window', () => {
    setProgress(0.5);
    const result = useProgressWindow(0.25, 0.75);
    expect(result).toBeCloseTo(0.5);
  });

  it('applies custom easing', () => {
    setProgress(0.5);
    const square = (t: number) => t * t;
    const result = useProgressWindow(0.0, 1.0, { easing: square });
    expect(result).toBeCloseTo(0.25);
  });
});

// ─── useEntrance ─────────────────────────────────────────────────────────────

describe('useEntrance', () => {
  beforeEach(() => setProgress(0));

  it('returns empty object for type "none"', () => {
    setProgress(0);
    expect(useEntrance('none')).toEqual({});
  });

  it('returns opacity 0 for fadeIn at progress=0', () => {
    setProgress(0);
    const result = useEntrance('fadeIn');
    expect(result.opacity).toBe(0);
  });

  it('returns empty object for fadeIn at progress=1 (fully visible)', () => {
    setProgress(1);
    expect(useEntrance('fadeIn')).toEqual({});
  });

  it('returns translateY for slideUp at progress=0', () => {
    setProgress(0);
    const result = useEntrance('slideUp');
    expect(result.opacity).toBe(0);
    expect(result.transform).toBe('translateY(24px)');
  });

  it('returns translateX for slideLeft at progress=0', () => {
    setProgress(0);
    const result = useEntrance('slideLeft');
    expect(result.opacity).toBe(0);
    expect(result.transform).toBe('translateX(24px)');
  });

  it('returns scale for grow at progress=0', () => {
    setProgress(0);
    const result = useEntrance('grow');
    expect(result.opacity).toBe(0);
    expect(result.transform).toBe('scale(0.8)');
  });

  it('respects delay option', () => {
    setProgress(0.1);
    const result = useEntrance('fadeIn', { delay: 0.5 });
    expect(result.opacity).toBe(0);
  });

  it('returns empty when past delay+duration', () => {
    setProgress(0.8);
    const result = useEntrance('fadeIn', { delay: 0, duration: 0.3 });
    expect(result).toEqual({});
  });
});
