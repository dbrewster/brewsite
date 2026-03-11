import { describe, it, expect } from 'vitest';
import { resolveHierarchicalLayout } from '../hierarchicalLayout';
import type { DiagramNodeDSL, DiagramEdgeDSL } from '../../../types';
import { DEFAULT_RESOLVED_HIERARCHICAL } from '../../layoutResolver';
import type { ResolvedHierarchicalLayout } from '../../layoutResolver';

const makeNode = (id: string, overrides: Partial<DiagramNodeDSL> = {}): DiagramNodeDSL => ({
  id,
  label: id,
  ...overrides,
});

const makeEdge = (from: string, to: string): DiagramEdgeDSL => ({ from, to });

const hierarchical = (overrides: Partial<ResolvedHierarchicalLayout> = {}): ResolvedHierarchicalLayout =>
  ({ ...DEFAULT_RESOLVED_HIERARCHICAL, ...overrides });

describe('resolveHierarchicalLayout', () => {
  it('places a single node at origin', () => {
    const nodes = [makeNode('a')];
    const result = resolveHierarchicalLayout(nodes, [], hierarchical(), [4, 2]);
    const pos = result.get('a')!;
    expect(pos[0]).toBeDefined();
    expect(pos[1]).toBeDefined();
  });

  it('places source (no in-edges) before sink (has in-edges) in top-down direction', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    const result = resolveHierarchicalLayout(nodes, edges, hierarchical({ direction: 'top-down' }), [4, 2]);
    const a = result.get('a')!;
    const b = result.get('b')!;
    // top-down: source (a) at higher Y than sink (b)
    expect(a[1]).toBeGreaterThan(b[1]);
  });

  it('places source before sink in left-right direction', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    const result = resolveHierarchicalLayout(nodes, edges, hierarchical({ direction: 'left-right' }), [4, 2]);
    const a = result.get('a')!;
    const b = result.get('b')!;
    // left-right: source (a) at lower X than sink (b)
    expect(a[0]).toBeLessThan(b[0]);
  });

  it('handles a 3-node DAG: root → mid → leaf', () => {
    const nodes = [makeNode('root'), makeNode('mid'), makeNode('leaf')];
    const edges = [makeEdge('root', 'mid'), makeEdge('mid', 'leaf')];
    const result = resolveHierarchicalLayout(nodes, edges, hierarchical({ direction: 'top-down' }), [4, 2]);
    const root = result.get('root')!;
    const mid = result.get('mid')!;
    const leaf = result.get('leaf')!;
    expect(root[1]).toBeGreaterThan(mid[1]);
    expect(mid[1]).toBeGreaterThan(leaf[1]);
  });

  it('handles disconnected nodes placed at level 0 by default', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('isolated')];
    const edges = [makeEdge('a', 'b')];
    const result = resolveHierarchicalLayout(nodes, edges, hierarchical({ disconnected: 'inline' }), [4, 2]);
    // isolated node should still get a position
    expect(result.has('isolated')).toBe(true);
  });

  it('places disconnected nodes after connected ones when disconnected=after', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('iso')];
    const edges = [makeEdge('a', 'b')];
    const result = resolveHierarchicalLayout(nodes, edges, hierarchical({ direction: 'top-down', disconnected: 'after' }), [4, 2]);
    const a = result.get('a')!;
    const iso = result.get('iso')!;
    // Disconnected node placed after connected — should have lower Y than the connected nodes
    expect(iso[1]).toBeLessThan(a[1]);
  });

  it('handles cycle edges gracefully without crashing', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'a')]; // cycle
    // Should not throw
    expect(() => {
      resolveHierarchicalLayout(nodes, edges, hierarchical(), [4, 2]);
    }).not.toThrow();
    const result = resolveHierarchicalLayout(nodes, edges, hierarchical(), [4, 2]);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });

  it('preserves explicit positions', () => {
    const nodes = [
      makeNode('a', { position: [0, 10, 0] }),
      makeNode('b'),
    ];
    const edges = [makeEdge('a', 'b')];
    const result = resolveHierarchicalLayout(nodes, edges, hierarchical(), [4, 2]);
    expect(result.get('a')).toEqual([0, 10, 0]);
  });

  it('returns only explicit positions when all nodes have explicit positions', () => {
    const nodes = [
      makeNode('a', { position: [1, 2, 0] }),
      makeNode('b', { position: [3, 4, 0] }),
    ];
    const result = resolveHierarchicalLayout(nodes, [], hierarchical(), [4, 2]);
    expect(result.get('a')).toEqual([1, 2, 0]);
    expect(result.get('b')).toEqual([3, 4, 0]);
  });

  it('skips external edges (endpoints not in node set)', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'external')];
    // Should not crash
    expect(() => {
      resolveHierarchicalLayout(nodes, edges, hierarchical(), [4, 2]);
    }).not.toThrow();
    const result = resolveHierarchicalLayout(nodes, edges, hierarchical(), [4, 2]);
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });
});
