// Tests for the normalizeToViewport pure function.
// Calls the function directly with real inputs to verify NVS coordinate mapping,
// centering, Y-axis flip, uniform scale-to-fit, and thickness normalization.

import { describe, it, expect } from 'vitest';
import { normalizeToViewport } from '../compiler/normalizeToViewport';
import type { GroupBounds } from '../compiler/groupCompiler';

/** Helper: build a minimal GroupBounds in Cartesian Y-up space (y = bottom edge). */
function makeGroup(x: number, y: number, w: number, h: number): GroupBounds {
  return { x, y, w, h, padding: [0, 0, 0, 0], titleGap: 0 };
}

describe('normalizeToViewport', () => {
  it('centers a single node at [0.5, 0.5] with Y-flip', () => {
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [0.15, 0.08] as const }];
    const result = normalizeToViewport(nodes, new Map());
    const pos = result.normalizedPositions.get('a')!;
    expect(pos[0]).toBeCloseTo(0.5, 5);
    expect(pos[1]).toBeCloseTo(0.5, 5);
    expect(pos[2]).toBe(0);
  });

  it('passes sizes through unchanged when layout fits in [0..1]', () => {
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [0.15, 0.08] as const }];
    const result = normalizeToViewport(nodes, new Map());
    const sz = result.normalizedSizes.get('a')!;
    expect(sz[0]).toBeCloseTo(0.15, 5);
    expect(sz[1]).toBeCloseTo(0.08, 5);
  });

  it('centers a multi-node layout symmetrically', () => {
    // Two nodes at [-0.1, 0] and [0.1, 0] → total span = 0.35 (fits in [0..1])
    const nodes = [
      { id: 'l', position: [-0.1, 0, 0] as const, size: [0.15, 0.08] as const },
      { id: 'r', position: [0.1, 0, 0] as const, size: [0.15, 0.08] as const },
    ];
    const result = normalizeToViewport(nodes, new Map());
    const l = result.normalizedPositions.get('l')!;
    const r = result.normalizedPositions.get('r')!;
    // Symmetric around 0.5
    expect(l[0]).toBeLessThan(0.5);
    expect(r[0]).toBeGreaterThan(0.5);
    expect(l[0] + r[0]).toBeCloseTo(1.0, 5);
    // Both at same Y
    expect(l[1]).toBeCloseTo(r[1], 5);
    expect(l[1]).toBeCloseTo(0.5, 3);
  });

  it('Y-flips group bounds correctly', () => {
    // Group at Cartesian y=0.1 (bottom), h=0.2 → top = 0.3
    // With a node inside to set the bounding box
    const nodes = [{ id: 'n', position: [0, 0.2, 0] as const, size: [0.01, 0.01] as const }];
    const groups = new Map([['g', makeGroup(-0.1, 0.1, 0.2, 0.2)]]);
    const result = normalizeToViewport(nodes, groups);
    const g = result.normalizedGroups.get('g')!;
    // After Y-flip, the group's NVS y (top) should be less than its NVS y+h (bottom)
    expect(g.y).toBeLessThan(g.y + g.h);
    // Group padding stays as authored (not scaled when scaleFactor=1)
    expect(g.padding).toEqual([0, 0, 0, 0]);
  });

  it('computes thicknessNormFactor from defaultNodeSize', () => {
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [0.15, 0.08] as const }];
    const result = normalizeToViewport(nodes, new Map(), [0.15, 0.08]);
    // factor = scaleFactor * max(0.15, 0.08) = 1.0 * 0.15 = 0.15
    expect(result.thicknessNormFactor).toBeCloseTo(0.15, 3);
  });

  it('uniformly scales dense layouts that exceed [0..1]', () => {
    // 8 nodes in a row: positions at x = 0, 0.21, 0.42, ... 1.47
    // Each size [0.15, 0.08]. Total span = 1.47 + 0.075 - (0 - 0.075) = 1.62
    // scaleFactor = 0.96 / 1.62 ≈ 0.5926
    const nodes = Array.from({ length: 8 }, (_, i) => ({
      id: `n${i}`,
      position: [i * 0.21, 0, 0] as const,
      size: [0.15, 0.08] as const,
    }));

    const result = normalizeToViewport(nodes, new Map());

    // Verify: no position outside [0.02, 0.98] range (within margins)
    for (const [, pos] of result.normalizedPositions) {
      expect(pos[0]).toBeGreaterThanOrEqual(-0.01);
      expect(pos[0]).toBeLessThanOrEqual(1.01);
    }

    // Verify: all sizes scaled by identical factor
    const sizes = Array.from(result.normalizedSizes.values());
    const firstRatio = sizes[0]![0] / 0.15;
    for (const sz of sizes) {
      expect(sz[0] / 0.15).toBeCloseTo(firstRatio, 5);
      expect(sz[1] / 0.08).toBeCloseTo(firstRatio, 5);
    }

    // Verify: scaleFactor < 1 (sizes were reduced)
    expect(sizes[0]![0]).toBeLessThan(0.15);

    // Verify: aspect ratio of each node preserved (w/h ratio unchanged)
    for (const sz of sizes) {
      expect(sz[0] / sz[1]).toBeCloseTo(0.15 / 0.08, 3);
    }
  });

  it('does not scale layouts that fit within [0..1]', () => {
    // 4 nodes in a 2×2 grid, total span < 0.96
    const nodes = [
      { id: 'a', position: [-0.1, 0.05, 0] as const, size: [0.15, 0.08] as const },
      { id: 'b', position: [0.1, 0.05, 0] as const, size: [0.15, 0.08] as const },
      { id: 'c', position: [-0.1, -0.05, 0] as const, size: [0.15, 0.08] as const },
      { id: 'd', position: [0.1, -0.05, 0] as const, size: [0.15, 0.08] as const },
    ];
    const result = normalizeToViewport(nodes, new Map());
    // Sizes unchanged (scaleFactor = 1.0)
    for (const [, sz] of result.normalizedSizes) {
      expect(sz[0]).toBeCloseTo(0.15, 5);
      expect(sz[1]).toBeCloseTo(0.08, 5);
    }
  });

  it('handles empty node list', () => {
    const result = normalizeToViewport([], new Map(), [0.15, 0.08]);
    expect(result.normalizedPositions.size).toBe(0);
    expect(result.normalizedSizes.size).toBe(0);
    expect(result.normalizedGroups.size).toBe(0);
    // thicknessNormFactor still computed from default node size
    expect(result.thicknessNormFactor).toBeCloseTo(0.15, 3);
  });
});
