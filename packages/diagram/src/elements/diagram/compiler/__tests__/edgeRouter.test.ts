import { describe, it, expect } from 'vitest';
import {
  nearestFace,
  routeEdgeCurved,
  routeEdgeOrthogonal,
} from '../edgeRouter';
import type { NodeDimensions } from '../edgeRouter';

describe('nearestFace', () => {
  it('selects bottom when target is below-left at ~39° from horizontal', () => {
    expect(nearestFace([0, -4, 0], [-5, -8, 0])).toBe('bottom');
  });

  it('selects top when target is above-left at ~39°', () => {
    expect(nearestFace([0, -4, 0], [-5, 0, 0])).toBe('top');
  });

  it('selects left when target is directly left', () => {
    expect(nearestFace([0, 0, 0], [-5, 0, 0])).toBe('left');
  });

  it('selects top/bottom for steep diagonals (>45°)', () => {
    expect(nearestFace([0, 0, 0], [-3, -5, 0])).toBe('bottom');
  });
});

describe('routeEdgeCurved — anti-parallel arc fix', () => {
  it('returns 3 points for left→right face connection (anti-parallel)', () => {
    const pts = routeEdgeCurved(
      [0, -4, 0], [4, 2, 0.4] as NodeDimensions, 'left',
      [-5, -8, 0], [4, 2, 0.4] as NodeDimensions, 'right',
    );
    expect(pts).toHaveLength(3);
    const [start, arc, end] = pts;
    const directMidX = (start[0] + end[0]) / 2;
    const directMidY = (start[1] + end[1]) / 2;
    expect(Math.abs(arc[0] - directMidX) + Math.abs(arc[1] - directMidY)).toBeGreaterThan(0.1);
  });

  it('returns 3 points for convergent faces (bottom→top, anti-parallel)', () => {
    const pts = routeEdgeCurved(
      [0, 2, 0], [4, 2, 0.4] as NodeDimensions, 'bottom',
      [0, -1, 0], [4, 2, 0.4] as NodeDimensions, 'top',
    );
    expect(pts).toHaveLength(3);
  });

  it('returns 4 points for same-side connection (left→left, dot=+1)', () => {
    const pts = routeEdgeCurved(
      [0, 0, 0], [4, 2, 0.4] as NodeDimensions, 'left',
      [-8, 0, 0], [4, 2, 0.4] as NodeDimensions, 'left',
    );
    expect(pts).toHaveLength(4);
  });
});

describe('routeEdgeOrthogonal', () => {
  it('routes H→H as Z-shape via midY', () => {
    const pts = routeEdgeOrthogonal(
      [0, 0, 0], [4, 2, 0.4] as NodeDimensions, 'right',
      [6, 4, 0], [4, 2, 0.4] as NodeDimensions, 'left',
    );
    expect(pts.length).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < pts.length - 1; i += 1) {
      const dx = Math.abs(pts[i + 1][0] - pts[i][0]);
      const dy = Math.abs(pts[i + 1][1] - pts[i][1]);
      expect(Math.min(dx, dy)).toBeLessThan(0.01);
    }
  });
});
