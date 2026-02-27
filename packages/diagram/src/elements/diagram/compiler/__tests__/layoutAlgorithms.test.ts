import { describe, it, expect } from 'vitest';
import { resolveLayout, computeBounds } from '../layoutAlgorithms';
import type { DiagramNodeDSL, DiagramEdgeDSL } from '../../types';

const makeNode = (id: string, overrides: Partial<DiagramNodeDSL> = {}): DiagramNodeDSL => ({
  id,
  label: id,
  ...overrides,
});

const makeEdge = (from: string, to: string, overrides: Partial<DiagramEdgeDSL> = {}): DiagramEdgeDSL => ({
  from,
  to,
  ...overrides,
});

describe('resolveLayout', () => {
  it('grid: assigns non-overlapping positions to 4 nodes with no explicit positions', () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id) => makeNode(id));
    const positions = resolveLayout(nodes, [], 'grid', [2, 2]);
    const uniquePositions = new Set(
      nodes.map((node) => JSON.stringify(positions.get(node.id))),
    );
    expect(uniquePositions.size).toBe(4);
  });

  it('grid: respects explicit positions, only auto-assigns missing ones', () => {
    const nodes = [
      makeNode('a', { position: [10, 10, 0] }),
      makeNode('b'),
    ];
    const positions = resolveLayout(nodes, [], 'grid', [2, 2]);
    expect(positions.get('a')).toEqual([10, 10, 0]);
    expect(positions.get('b')).toBeDefined();
  });

  it('hierarchical: places downstream nodes at lower Y levels', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];
    const positions = resolveLayout(nodes, edges, 'hierarchical', [2, 2]);
    const yA = positions.get('a')![1];
    const yB = positions.get('b')![1];
    const yC = positions.get('c')![1];
    expect(yB).toBeLessThan(yA);
    expect(yC).toBeLessThan(yB);
  });

  it('manual: throws when non-ghost nodes missing positions', () => {
    const nodes = [makeNode('a')];
    expect(() => resolveLayout(nodes, [], 'manual', [2, 2])).toThrow();
  });

  it('manual: allows ghost nodes without positions', () => {
    const nodes = [makeNode('a', { label: '' })];
    expect(() => resolveLayout(nodes, [], 'manual', [2, 2])).not.toThrow();
  });

  it('grid: uses layout spacing for position deltas', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const positions = resolveLayout(nodes, [], 'grid', [10, 10]);
    const posA = positions.get('a')!;
    const posB = positions.get('b')!;
    expect(Math.abs(posA[0] - posB[0])).toBeGreaterThanOrEqual(10);
  });
});

describe('computeBounds', () => {
  it('computes bounding box from node positions and sizes', () => {
    const positions = new Map([
      ['a', [0, 0, 0] as const],
      ['b', [4, 0, 0] as const],
      ['c', [0, 4, 0] as const],
      ['d', [4, 4, 0] as const],
    ]);
    const sizes = new Map([
      ['a', [2, 2] as const],
      ['b', [2, 2] as const],
      ['c', [2, 2] as const],
      ['d', [2, 2] as const],
    ]);
    const bounds = computeBounds(['a', 'b', 'c', 'd'], positions, sizes);
    expect(bounds.x).toBe(-1);
    expect(bounds.y).toBe(-1);
    expect(bounds.w).toBe(6);
    expect(bounds.h).toBe(6);
  });

  it('returns zero bounds when no nodes are provided', () => {
    const bounds = computeBounds([], new Map(), new Map());
    expect(bounds).toEqual({ x: 0, y: 0, w: 0, h: 0, minZ: 0, maxZ: 0 });
  });

  it('accounts for node sizes in min/max', () => {
    const positions = new Map([['a', [5, 5, 0] as const]]);
    const sizes = new Map([['a', [2, 6] as const]]);
    const bounds = computeBounds(['a'], positions, sizes);
    expect(bounds.x).toBe(4);
    expect(bounds.y).toBe(2);
    expect(bounds.w).toBe(2);
    expect(bounds.h).toBe(6);
  });

  it('handles missing position or size gracefully', () => {
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const sizes = new Map<string, readonly [number, number]>();
    const bounds = computeBounds(['a'], positions, sizes);
    expect(bounds).toEqual({ x: 0, y: 0, w: 0, h: 0, minZ: 0, maxZ: 0 });
  });

  it('uses depth to compute minZ/maxZ when provided', () => {
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const sizes = new Map([['a', [2, 2, 1] as const]]);
    const bounds = computeBounds(['a'], positions, sizes);
    expect(bounds.minZ).toBeCloseTo(-0.5);
    expect(bounds.maxZ).toBeCloseTo(0.5);
  });
});
