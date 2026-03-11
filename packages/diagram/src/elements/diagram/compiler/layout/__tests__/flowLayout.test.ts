import { describe, it, expect } from 'vitest';
import { resolveFlowLayout } from '../flowLayout';
import type { DiagramNodeDSL } from '../../../types';
import { DEFAULT_RESOLVED_FLOW } from '../../layoutResolver';
import type { ResolvedFlowLayout } from '../../layoutResolver';

const makeNode = (id: string, overrides: Partial<DiagramNodeDSL> = {}): DiagramNodeDSL => ({
  id,
  label: id,
  ...overrides,
});

const flow = (overrides: Partial<ResolvedFlowLayout> = {}): ResolvedFlowLayout =>
  ({ ...DEFAULT_RESOLVED_FLOW, ...overrides });

describe('resolveFlowLayout', () => {
  it('places single node at origin for top-down', () => {
    const nodes = [makeNode('a')];
    const result = resolveFlowLayout(nodes, flow({ direction: 'top-down' }), ['a'], [4, 2]);
    expect(result.get('a')).toEqual([0, 0, 0]);
  });

  it('places single node at origin for left-right', () => {
    const nodes = [makeNode('a')];
    const result = resolveFlowLayout(nodes, flow({ direction: 'left-right' }), ['a'], [4, 2]);
    expect(result.get('a')).toEqual([0, 0, 0]);
  });

  it('places two nodes top-down with gap', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const gap = 1;
    const result = resolveFlowLayout(nodes, flow({ direction: 'top-down', gap }), ['a', 'b'], [4, 2]);
    const a = result.get('a')!;
    const b = result.get('b')!;
    // a at origin
    expect(a[0]).toBeCloseTo(0);
    expect(a[1]).toBeCloseTo(0);
    // b is below a: y = 0 - h/2 - gap - h/2 = -h - gap
    expect(b[0]).toBeCloseTo(0);
    expect(b[1]).toBeCloseTo(-2 - gap);
  });

  it('places two nodes left-right with gap', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const gap = 2;
    const result = resolveFlowLayout(nodes, flow({ direction: 'left-right', gap }), ['a', 'b'], [4, 2]);
    const a = result.get('a')!;
    const b = result.get('b')!;
    expect(a[0]).toBeCloseTo(0);
    expect(b[0]).toBeCloseTo(4 + gap);
  });

  it('preserves explicit positions', () => {
    const nodes = [
      makeNode('a', { position: [10, 10, 0] }),
      makeNode('b'),
    ];
    const result = resolveFlowLayout(nodes, flow({ direction: 'top-down' }), ['a', 'b'], [4, 2]);
    expect(result.get('a')).toEqual([10, 10, 0]);
    // b is auto-placed (not at a's position)
    expect(result.get('b')).not.toEqual([10, 10, 0]);
  });

  it('respects childrenOrder for placement sequence', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const resultABC = resolveFlowLayout(nodes, flow({ direction: 'top-down' }), ['a', 'b', 'c'], [4, 2]);
    const resultCBA = resolveFlowLayout(nodes, flow({ direction: 'top-down' }), ['c', 'b', 'a'], [4, 2]);
    // When order is reversed, positions should differ
    expect(resultABC.get('a')![1]).toBeGreaterThan(resultABC.get('c')![1]);
    expect(resultCBA.get('c')![1]).toBeGreaterThan(resultCBA.get('a')![1]);
  });

  it('defensively appends nodes missing from childrenOrder', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    // 'c' is missing from childrenOrder
    const result = resolveFlowLayout(nodes, flow({ direction: 'top-down' }), ['a', 'b'], [4, 2]);
    // All three nodes should still get positions
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
    expect(result.has('c')).toBe(true);
  });

  it('uses node-specific size for spacing', () => {
    const nodes = [
      makeNode('a', { size: [4, 4] }),
      makeNode('b', { size: [4, 2] }),
    ];
    const gap = 1;
    const result = resolveFlowLayout(nodes, flow({ direction: 'top-down', gap }), ['a', 'b'], [4, 2]);
    const a = result.get('a')!;
    const b = result.get('b')!;
    // a: center y=0, bottom edge = -2
    // b: center y = -2 - gap - 1 = -4
    expect(a[1]).toBeCloseTo(0);
    expect(b[1]).toBeCloseTo(-2 - gap - 1);
  });
});
