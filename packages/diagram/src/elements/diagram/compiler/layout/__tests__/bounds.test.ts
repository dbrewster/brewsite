import { describe, it, expect } from 'vitest';
import { computeBounds } from '../bounds';

describe('computeBounds', () => {
  it('returns zero bounds for empty node list', () => {
    const result = computeBounds([], new Map(), new Map());
    expect(result).toEqual({ x: 0, y: 0, w: 0, h: 0, minZ: 0, maxZ: 0 });
  });

  it('computes bounds for a single node centered at origin', () => {
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const sizes = new Map([['a', [4, 2] as const]]);
    const result = computeBounds(['a'], positions, sizes);
    expect(result.x).toBeCloseTo(-2);
    expect(result.y).toBeCloseTo(-1);
    expect(result.w).toBeCloseTo(4);
    expect(result.h).toBeCloseTo(2);
  });

  it('computes bounds for two side-by-side nodes', () => {
    const positions = new Map<string, readonly [number, number, number]>([
      ['a', [-3, 0, 0]],
      ['b', [3, 0, 0]],
    ]);
    const sizes = new Map<string, readonly [number, number]>([
      ['a', [2, 2]],
      ['b', [2, 2]],
    ]);
    const result = computeBounds(['a', 'b'], positions, sizes);
    expect(result.x).toBeCloseTo(-4);
    expect(result.y).toBeCloseTo(-1);
    expect(result.w).toBeCloseTo(8);
    expect(result.h).toBeCloseTo(2);
  });

  it('computes min/max Z when nodes have Z positions', () => {
    const positions = new Map<string, readonly [number, number, number]>([
      ['a', [0, 0, -1]],
      ['b', [0, 0, 2]],
    ]);
    const sizes = new Map<string, readonly [number, number, number]>([
      ['a', [2, 2, 0]],
      ['b', [2, 2, 0]],
    ]);
    const result = computeBounds(['a', 'b'], positions, sizes);
    expect(result.minZ).toBeCloseTo(-1);
    expect(result.maxZ).toBeCloseTo(2);
  });

  it('skips nodes missing from positions or sizes', () => {
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const sizes = new Map([['a', [4, 2] as const]]);
    // 'b' is in nodeIds but has no position or size
    const result = computeBounds(['a', 'b'], positions, sizes);
    expect(result.w).toBeCloseTo(4);
    expect(result.h).toBeCloseTo(2);
  });

  it('returns zero bounds when all nodes lack positions', () => {
    const result = computeBounds(['a', 'b'], new Map(), new Map());
    expect(result).toEqual({ x: 0, y: 0, w: 0, h: 0, minZ: 0, maxZ: 0 });
  });

  it('handles offset node center correctly', () => {
    const positions = new Map([['a', [10, 5, 0] as const]]);
    const sizes = new Map([['a', [2, 2] as const]]);
    const result = computeBounds(['a'], positions, sizes);
    expect(result.x).toBeCloseTo(9);
    expect(result.y).toBeCloseTo(4);
    expect(result.w).toBeCloseTo(2);
    expect(result.h).toBeCloseTo(2);
  });
});
