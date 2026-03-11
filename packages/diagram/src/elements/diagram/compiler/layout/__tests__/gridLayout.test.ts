import { describe, it, expect } from 'vitest';
import { resolveGridLayout } from '../gridLayout';
import type { DiagramNodeDSL, DiagramEdgeDSL } from '../../../types';
import { DEFAULT_RESOLVED_GRID } from '../../layoutResolver';
import type { ResolvedGridLayout } from '../../layoutResolver';

const makeNode = (id: string, overrides: Partial<DiagramNodeDSL> = {}): DiagramNodeDSL => ({
  id,
  label: id,
  ...overrides,
});

const makeEdge = (from: string, to: string): DiagramEdgeDSL => ({ from, to });

const grid = (overrides: Partial<ResolvedGridLayout> = {}): ResolvedGridLayout =>
  ({ ...DEFAULT_RESOLVED_GRID, ...overrides });

describe('resolveGridLayout', () => {
  it('places single node with y=0 and z=0', () => {
    const nodes = [makeNode('a')];
    const result = resolveGridLayout(nodes, [], grid({ columns: 1 }), [4, 2]);
    const pos = result.get('a')!;
    // Grid places first node at x = nodeWidth/2 (center of leftmost slot), y=0, z=0
    expect(pos[1]).toBeCloseTo(0);
    expect(pos[2]).toBeCloseTo(0);
  });

  it('places two nodes in a single row with spacing', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const spacing: [number, number] = [2, 2];
    const result = resolveGridLayout(nodes, [], grid({ columns: 2, spacing }), [4, 2]);
    const a = result.get('a')!;
    const b = result.get('b')!;
    // a is left, b is right; b.x > a.x
    expect(b[0]).toBeGreaterThan(a[0]);
    // gap between centers = w + spacing = 4 + 2 = 6
    expect(b[0] - a[0]).toBeCloseTo(4 + 2);
  });

  it('wraps to a second row with a 1-column layout', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const result = resolveGridLayout(nodes, [], grid({ columns: 1, spacing: [2, 2] }), [4, 2]);
    const a = result.get('a')!;
    const b = result.get('b')!;
    const c = result.get('c')!;
    // Top row y=0, each subsequent row lower
    expect(a[1]).toBeGreaterThan(b[1]);
    expect(b[1]).toBeGreaterThan(c[1]);
  });

  it('places auto-columns (4) when columns=auto', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => makeNode(`n${i}`));
    const result = resolveGridLayout(nodes, [], grid({ columns: 'auto' }), [4, 2]);
    // With 4 auto columns, n4 wraps to second row (y < 0)
    const n4 = result.get('n4')!;
    const n0 = result.get('n0')!;
    expect(n4[1]).toBeLessThan(n0[1]);
  });

  it('preserves explicit positions', () => {
    const nodes = [
      makeNode('a', { position: [100, 100, 5] }),
      makeNode('b'),
    ];
    const result = resolveGridLayout(nodes, [], grid(), [4, 2]);
    expect(result.get('a')).toEqual([100, 100, 5]);
  });

  it('returns only explicit positions when all nodes have positions', () => {
    const nodes = [
      makeNode('a', { position: [1, 2, 0] }),
      makeNode('b', { position: [3, 4, 0] }),
    ];
    const result = resolveGridLayout(nodes, [], grid(), [4, 2]);
    expect(result.get('a')).toEqual([1, 2, 0]);
    expect(result.get('b')).toEqual([3, 4, 0]);
  });

  it('places disconnected nodes after connected ones when disconnected=after', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('a', 'b')]; // c is disconnected
    const result = resolveGridLayout(
      nodes,
      edges,
      grid({ columns: 3, disconnected: 'after' }),
      [4, 2],
    );
    // a and b should be in the same row (x-order), c at the end
    const a = result.get('a')!;
    const b = result.get('b')!;
    const c = result.get('c')!;
    // a and b are connected so placed first; c.x > b.x (all on same row with 3 cols)
    expect(c[0]).toBeGreaterThan(b[0]);
    expect(b[0]).toBeGreaterThan(a[0]);
  });

  it('respects center alignment', () => {
    // Two rows, first row has 2 nodes, second has 1 — with center alignment they offset
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const result = resolveGridLayout(nodes, [], grid({ columns: 2, alignment: 'center' }), [4, 2]);
    // With center alignment, c (lone node on row 2) should be horizontally centered
    // relative to the widest row. Just assert it's not at x=0 raw (left).
    const c = result.get('c')!;
    const a = result.get('a')!;
    // c's x should be between a[0] and b[0]
    const b = result.get('b')!;
    expect(c[0]).toBeGreaterThan(a[0]);
    expect(c[0]).toBeLessThan(b[0] + 0.1);
  });
});
