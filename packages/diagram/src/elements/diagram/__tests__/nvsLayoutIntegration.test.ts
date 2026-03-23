// End-to-end integration tests verifying compileDiagram() produces correct NVS output.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compileDiagram } from '../compile';
import type { DiagramDSL, DiagramNodeDSL, DiagramEdgeDSL } from '../types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

describe('NVS layout integration', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grid layout produces centered NVS positions within [0..1]', () => {
    const dsl: DiagramDSL = {
      id: 'grid-nvs',
      layout: { kind: 'grid', columns: 2, spacing: ['6%', '6%'] },
      nodes: [
        makeNode('a'),
        makeNode('b'),
        makeNode('c'),
        makeNode('d'),
      ],
      edges: [],
      groups: [],
    };

    const state = compileDiagram(dsl);
    expect(state.nodes).toHaveLength(4);

    for (const node of state.nodes) {
      expect(node.position[0]).toBeGreaterThanOrEqual(0);
      expect(node.position[0]).toBeLessThanOrEqual(1);
      expect(node.position[1]).toBeGreaterThanOrEqual(0);
      expect(node.position[1]).toBeLessThanOrEqual(1);
    }

    // Sizes should be approximately theme default [0.15, 0.08]
    for (const node of state.nodes) {
      expect(node.size[0]).toBeCloseTo(0.15, 1);
      expect(node.size[1]).toBeCloseTo(0.08, 1);
    }
  });

  it('hierarchical layout produces correct level spacing in NVS', () => {
    const dsl: DiagramDSL = {
      id: 'hier-nvs',
      layout: { kind: 'hierarchical', direction: 'top-down', spacing: ['4.5%', '4.5%'] },
      nodes: [
        makeNode('root'),
        makeNode('child1'),
        makeNode('child2'),
        makeNode('grandchild'),
      ],
      edges: [
        makeEdge('root', 'child1'),
        makeEdge('root', 'child2'),
        makeEdge('child1', 'grandchild'),
      ],
      groups: [],
    };

    const state = compileDiagram(dsl);
    expect(state.nodes).toHaveLength(4);

    // NVS Y-down: root should have smaller Y than children, children smaller than grandchild
    const byId = new Map(state.nodes.map((n) => [n.id, n]));
    const root = byId.get('root')!;
    const child1 = byId.get('child1')!;
    const child2 = byId.get('child2')!;
    const grandchild = byId.get('grandchild')!;

    expect(root.position[1]).toBeLessThan(child1.position[1]);
    expect(root.position[1]).toBeLessThan(child2.position[1]);
    expect(child1.position[1]).toBeLessThan(grandchild.position[1]);

    // Verify inter-level Y gaps are consistent
    const gap1 = child1.position[1] - root.position[1];
    const gap2 = grandchild.position[1] - child1.position[1];
    expect(gap1).toBeCloseTo(gap2, 1);
  });

  it('flow layout produces sequential NVS positions', () => {
    const dsl: DiagramDSL = {
      id: 'flow-nvs',
      layout: { kind: 'flow', direction: 'top-down', gap: '5%' },
      childrenOrder: ['a', 'b', 'c'],
      nodes: [
        makeNode('a'),
        makeNode('b'),
        makeNode('c'),
      ],
      edges: [
        makeEdge('a', 'b'),
        makeEdge('b', 'c'),
      ],
      groups: [],
    };

    const state = compileDiagram(dsl);

    // NVS Y-down: positions should increase monotonically
    const byId = new Map(state.nodes.map((n) => [n.id, n]));
    const a = byId.get('a')!;
    const b = byId.get('b')!;
    const c = byId.get('c')!;

    expect(a.position[1]).toBeLessThan(b.position[1]);
    expect(b.position[1]).toBeLessThan(c.position[1]);

    // All within [0..1]
    for (const node of state.nodes) {
      expect(node.position[0]).toBeGreaterThanOrEqual(0);
      expect(node.position[0]).toBeLessThanOrEqual(1);
      expect(node.position[1]).toBeGreaterThanOrEqual(0);
      expect(node.position[1]).toBeLessThanOrEqual(1);
    }
  });

  it('manual layout preserves explicit NVS positions', () => {
    const dsl: DiagramDSL = {
      id: 'manual-nvs',
      layout: { kind: 'manual' },
      nodes: [
        makeNode('a', { position: ['30%', '70%', '0%'] }),
        makeNode('b', { position: ['60%', '20%', '0%'] }),
      ],
      edges: [],
      groups: [],
    };

    const state = compileDiagram(dsl);
    const byId = new Map(state.nodes.map((n) => [n.id, n]));

    // Manual positions are centered and Y-flipped by normalizeToViewport,
    // but with only 2 nodes fitting within [0..1], scaling is 1.0.
    // The relative positioning and centering should keep them within [0..1].
    const a = byId.get('a')!;
    const b = byId.get('b')!;

    expect(a.position[0]).toBeGreaterThanOrEqual(0);
    expect(a.position[0]).toBeLessThanOrEqual(1);
    expect(b.position[0]).toBeGreaterThanOrEqual(0);
    expect(b.position[0]).toBeLessThanOrEqual(1);

    // b should be to the right of a (preserving relative X order)
    expect(b.position[0]).toBeGreaterThan(a.position[0]);
  });

  it('thickness uses scaleFactor directly (no max(defaultSize) multiplier)', () => {
    const dsl: DiagramDSL = {
      id: 'thickness-nvs',
      layout: { kind: 'grid', columns: 1 },
      nodes: [
        makeNode('a', { thickness: '7.5%' }),
      ],
      edges: [],
      groups: [],
    };

    const state = compileDiagram(dsl);
    const node = state.nodes.find((n) => n.id === 'a')!;

    // scaleFactor = 1.0 for single node → compiled = authored NVS value.
    expect(node.thickness).toBeCloseTo(0.075, 3);
  });

  it('dense grid triggers uniform scale-to-fit', () => {
    // 12 nodes in a 4×3 grid — with default sizes and spacing, this may
    // exceed [0..1] and trigger scale-to-fit.
    const nodes = Array.from({ length: 12 }, (_, i) => makeNode(`n${i}`));
    const dsl: DiagramDSL = {
      id: 'dense-nvs',
      layout: { kind: 'grid', columns: 4, spacing: ['6%', '6%'] },
      nodes,
      edges: [],
      groups: [],
    };

    const state = compileDiagram(dsl);
    expect(state.nodes).toHaveLength(12);

    // All positions within [0..1] (with small tolerance for centering)
    for (const node of state.nodes) {
      expect(node.position[0]).toBeGreaterThanOrEqual(-0.01);
      expect(node.position[0]).toBeLessThanOrEqual(1.01);
      expect(node.position[1]).toBeGreaterThanOrEqual(-0.01);
      expect(node.position[1]).toBeLessThanOrEqual(1.01);
    }

    // All sizes should be uniform (same scale factor applied to all)
    const sizes = state.nodes.map((n) => n.size);
    const firstW = sizes[0]![0];
    const firstH = sizes[0]![1];
    for (const sz of sizes) {
      expect(sz[0]).toBeCloseTo(firstW, 5);
      expect(sz[1]).toBeCloseTo(firstH, 5);
    }

    // Aspect ratio preserved: w/h should match default 0.10/0.10 = 1.0 (uniform u units)
    expect(firstW / firstH).toBeCloseTo(0.10 / 0.10, 2);
  });

  it('edge anchors align with node surfaces (no aspect distortion)', () => {
    const dsl: DiagramDSL = {
      id: 'edge-anchor-nvs',
      layout: { kind: 'flow', direction: 'top-down', gap: '5%' },
      childrenOrder: ['src', 'dst'],
      nodes: [
        makeNode('src'),
        makeNode('dst'),
      ],
      edges: [
        makeEdge('src', 'dst'),
      ],
      groups: [],
    };

    const state = compileDiagram(dsl);
    const byId = new Map(state.nodes.map((n) => [n.id, n]));
    const src = byId.get('src')!;
    const dst = byId.get('dst')!;
    const edge = state.edges[0]!;

    expect(edge.path.commands.length).toBeGreaterThanOrEqual(1);

    // First point should be near source node bottom face
    const firstCmd = edge.path.commands[0]!;
    const startPt = firstCmd.kind === 'line' ? firstCmd.from : firstCmd.p0;
    expect(startPt[0]).toBeCloseTo(src.position[0], 1);
    // Y should be at or past the bottom edge of src
    expect(startPt[1]).toBeGreaterThanOrEqual(src.position[1]);

    // Last point should be near destination node top face
    const lastCmd = edge.path.commands[edge.path.commands.length - 1]!;
    const endPt = lastCmd.kind === 'line' ? lastCmd.to : lastCmd.p3;
    expect(endPt[0]).toBeCloseTo(dst.position[0], 1);
    // Y should be at or before the top edge of dst
    expect(endPt[1]).toBeLessThanOrEqual(dst.position[1] + 0.01);
  });

  it('scale-to-fit adjusts scaleFactor proportionally', () => {
    // Create a wide single-row layout that will trigger scale-to-fit
    const nodes = Array.from({ length: 8 }, (_, i) => makeNode(`n${i}`, { thickness: '6%' }));
    const dsl: DiagramDSL = {
      id: 'scale-thickness-nvs',
      layout: { kind: 'grid', columns: 8, spacing: ['6%', '6%'] },
      nodes,
      edges: [],
      groups: [],
    };

    const state = compileDiagram(dsl);

    // When scale-to-fit activates (scaleFactor < 1), sizes are reduced.
    // compiled thickness = authored * scaleFactor.
    const node = state.nodes[0]!;

    // If scale-to-fit is active, thickness should be proportionally smaller
    if (node.size[0] < 0.10) {
      const scaleFactor = node.size[0] / 0.10;
      const expectedThickness = 0.060 * scaleFactor;
      expect(node.thickness).toBeCloseTo(expectedThickness, 3);
    } else {
      // No scale-to-fit — scaleFactor = 1.0 → compiled = authored.
      expect(node.thickness).toBeCloseTo(0.060, 3);
    }
  });
});
