import { describe, it, expect } from 'vitest';
import {
  normalizePadding,
  applyPaddingToRect,
  resolveRegion,
  composeBoundsIntoParent,
  unionBounds,
} from '../regionNormalize';
import type { NVSRect } from '../types';

describe('normalizePadding', () => {
  it('converts uniform number to 4-tuple', () => {
    expect(normalizePadding(0.1)).toEqual([0.1, 0.1, 0.1, 0.1]);
  });

  it('converts [v, h] pair to [v, h, v, h]', () => {
    expect(normalizePadding([0.05, 0.1])).toEqual([0.05, 0.1, 0.05, 0.1]);
  });

  it('passes through [t, r, b, l] tuple unchanged', () => {
    expect(normalizePadding([0.1, 0.2, 0.3, 0.4])).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it('returns [0, 0, 0, 0] for 0', () => {
    expect(normalizePadding(0)).toEqual([0, 0, 0, 0]);
  });
});

describe('applyPaddingToRect', () => {
  it('applies padding insets to the full viewport rect', () => {
    const rect: NVSRect = { x: 0, y: 0, w: 1, h: 1 };
    const padding = [0.1, 0.2, 0.1, 0.2] as const;
    const result = applyPaddingToRect(rect, padding);
    expect(result.x).toBeCloseTo(0.2);
    expect(result.y).toBeCloseTo(0.1);
    expect(result.w).toBeCloseTo(0.6);
    expect(result.h).toBeCloseTo(0.8);
  });

  it('clamps to zero width and height when padding exceeds rect dimensions', () => {
    const rect: NVSRect = { x: 0, y: 0, w: 0.1, h: 0.1 };
    const padding = [0.1, 0.1, 0.1, 0.1] as const;
    const result = applyPaddingToRect(rect, padding);
    expect(result.w).toBe(0);
    expect(result.h).toBe(0);
  });

  it('returns original rect unchanged for zero padding', () => {
    const rect: NVSRect = { x: 0.1, y: 0.2, w: 0.5, h: 0.4 };
    const padding = [0, 0, 0, 0] as const;
    const result = applyPaddingToRect(rect, padding);
    expect(result).toEqual(rect);
  });
});

describe('resolveRegion', () => {
  it('combines normalizePadding and applyPaddingToRect correctly', () => {
    const contract = {
      bounds: { x: 0, y: 0, w: 1, h: 1 },
      padding: [0.1, 0.2, 0.1, 0.2] as const,
    };
    const result = resolveRegion(contract);
    expect(result.outerBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    expect(result.contentBounds.x).toBeCloseTo(0.2);
    expect(result.contentBounds.y).toBeCloseTo(0.1);
    expect(result.contentBounds.w).toBeCloseTo(0.6);
    expect(result.contentBounds.h).toBeCloseTo(0.8);
    expect(result.padding).toEqual([0.1, 0.2, 0.1, 0.2]);
  });

  it('defaults layer to 0', () => {
    const contract = {
      bounds: { x: 0, y: 0, w: 1, h: 1 },
      padding: 0,
    };
    const result = resolveRegion(contract);
    expect(result.layer).toBe(0);
  });
});

describe('composeBoundsIntoParent', () => {
  it('fullscreen child in any parent equals parent bounds', () => {
    const parent: NVSRect = { x: 0.1, y: 0.2, w: 0.6, h: 0.5 };
    const local: NVSRect = { x: 0, y: 0, w: 1, h: 1 };
    expect(composeBoundsIntoParent(local, parent)).toEqual(parent);
  });

  it('maps child local coords into parent sub-rect correctly', () => {
    const parent: NVSRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    const local: NVSRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    const result = composeBoundsIntoParent(local, parent);
    expect(result.x).toBeCloseTo(0.3);
    expect(result.y).toBeCloseTo(0.3);
    expect(result.w).toBeCloseTo(0.4);
    expect(result.h).toBeCloseTo(0.4);
  });

  it('identity parent returns localRect unchanged', () => {
    const identity: NVSRect = { x: 0, y: 0, w: 1, h: 1 };
    const local: NVSRect = { x: 0.2, y: 0.3, w: 0.4, h: 0.5 };
    expect(composeBoundsIntoParent(local, identity)).toEqual(local);
  });

  it('handles nested composition correctly', () => {
    // First composition: local in parent1
    const parent1: NVSRect = { x: 0, y: 0, w: 0.5, h: 1 };
    const local1: NVSRect = { x: 0, y: 0, w: 0.5, h: 1 };
    const composed1 = composeBoundsIntoParent(local1, parent1);
    // composed1 = { x: 0, y: 0, w: 0.25, h: 1 }

    // Second composition: composed1 used as parent for another child
    const local2: NVSRect = { x: 0.5, y: 0, w: 0.5, h: 0.5 };
    const composed2 = composeBoundsIntoParent(local2, composed1);
    // composed2.x = 0 + 0.5 * 0.25 = 0.125
    // composed2.y = 0 + 0 * 1 = 0
    // composed2.w = 0.5 * 0.25 = 0.125
    // composed2.h = 0.5 * 1 = 0.5
    expect(composed2.x).toBeCloseTo(0.125);
    expect(composed2.y).toBeCloseTo(0);
    expect(composed2.w).toBeCloseTo(0.125);
    expect(composed2.h).toBeCloseTo(0.5);
  });
});

describe('unionBounds', () => {
  it('returns enclosing rect for non-overlapping rects', () => {
    const a: NVSRect = { x: 0, y: 0, w: 0.3, h: 0.3 };
    const b: NVSRect = { x: 0.7, y: 0.7, w: 0.3, h: 0.3 };
    const result = unionBounds(a, b);
    expect(result).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('returns smallest enclosing rect for overlapping rects', () => {
    const a: NVSRect = { x: 0, y: 0, w: 0.6, h: 0.6 };
    const b: NVSRect = { x: 0.4, y: 0.4, w: 0.6, h: 0.6 };
    const result = unionBounds(a, b);
    expect(result).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('returns outer rect when one rect is fully inside the other', () => {
    const outer: NVSRect = { x: 0, y: 0, w: 1, h: 1 };
    const inner: NVSRect = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 };
    const result = unionBounds(outer, inner);
    expect(result).toEqual(outer);
  });

  it('returns the same rect for identical inputs', () => {
    const rect: NVSRect = { x: 0.1, y: 0.2, w: 0.4, h: 0.3 };
    const result = unionBounds(rect, rect);
    expect(result).toEqual(rect);
  });
});
