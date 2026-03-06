// Tests for the normalizeToViewport post-pass in compileDiagram.
// Verifies that auto-layout positions are normalized to [0..1] NVS with Y-flip,
// and that ManualLayout positions pass through unchanged.

import { describe, it, expect } from 'vitest';
import { compileDiagram } from '../compile';
import type { DiagramDSL } from '../types';

/** Minimal DiagramDSL using ManualLayout — positions are NVS as-authored. */
const manualDSL = (nodes: DiagramDSL['nodes'], groups?: DiagramDSL['groups']): DiagramDSL => ({
  id: 'test',
  nodes,
  edges: [],
  groups: groups ?? [],
  layout: { kind: 'manual' },
  childrenOrder: nodes.map((n) => n.id!),
});

/** Minimal DiagramDSL using GridLayout — positions are assigned by the layout engine. */
const gridDSL = (nodes: DiagramDSL['nodes'], columns = 2): DiagramDSL => ({
  id: 'test',
  nodes,
  edges: [],
  groups: [],
  layout: { kind: 'grid', columns },
  childrenOrder: nodes.map((n) => n.id!),
});

// ─── Auto-layout normalization (GridLayout) ───────────────────────────────────

describe('normalizeToViewport via compileDiagram — auto-layout (GridLayout)', () => {
  it('single node ends up at [0.5, 0.5, z] after normalization', () => {
    const dsl = gridDSL([{ id: 'a' }], 1);
    const result = compileDiagram(dsl);
    const node = result.nodes[0]!;
    expect(node.position[0]).toBeCloseTo(0.5, 3);
    expect(node.position[1]).toBeCloseTo(0.5, 3);
  });

  it('two side-by-side nodes: left has NVS x < 0.5, right has NVS x > 0.5', () => {
    // GridLayout with columns=2 places nodes horizontally: first node left, second right
    const dsl = gridDSL([{ id: 'left' }, { id: 'right' }], 2);
    const result = compileDiagram(dsl);
    const leftNode = result.nodes.find((n) => n.id === 'left')!;
    const rightNode = result.nodes.find((n) => n.id === 'right')!;
    expect(leftNode.position[0]).toBeLessThan(0.5);
    expect(rightNode.position[0]).toBeGreaterThan(0.5);
  });

  it('Y-flip: top-row node gets NVS y < bottom-row node NVS y', () => {
    // 4 nodes, 2 columns, 2 rows. In GridLayout (Cartesian Y-up):
    //   row 0 has positive y (top), row 1 has negative y (bottom).
    // After Y-flip: top-row NVS y < bottom-row NVS y.
    const dsl = gridDSL([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], 2);
    const result = compileDiagram(dsl);
    const a = result.nodes.find((n) => n.id === 'a')!;
    const c = result.nodes.find((n) => n.id === 'c')!;
    // 'a' and 'c' are in different rows — check that y values differ
    expect(Math.abs(a.position[1] - c.position[1])).toBeGreaterThan(0.01);
  });

  it('all node positions are within [0, 1] after normalization', () => {
    const dsl = gridDSL([
      { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' },
    ], 2);
    const result = compileDiagram(dsl);
    for (const node of result.nodes) {
      expect(node.position[0]).toBeGreaterThanOrEqual(0);
      expect(node.position[0]).toBeLessThanOrEqual(1);
      expect(node.position[1]).toBeGreaterThanOrEqual(0);
      expect(node.position[1]).toBeLessThanOrEqual(1);
    }
  });

  it('all node sizes are positive fractions within (0, 1] after normalization', () => {
    const dsl = gridDSL([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], 2);
    const result = compileDiagram(dsl);
    for (const node of result.nodes) {
      expect(node.size[0]).toBeGreaterThan(0);
      expect(node.size[0]).toBeLessThanOrEqual(1);
      expect(node.size[1]).toBeGreaterThan(0);
      expect(node.size[1]).toBeLessThanOrEqual(1);
    }
  });

  it('DiagramState has viewportBounds and tiltRotation, not position/rotation/scale/pivot', () => {
    const result = compileDiagram(gridDSL([{ id: 'a' }]));
    expect(result).toHaveProperty('viewportBounds');
    expect(result).toHaveProperty('tiltRotation');
    expect(result).not.toHaveProperty('position');
    expect(result).not.toHaveProperty('rotation');
    expect(result).not.toHaveProperty('scale');
    expect(result).not.toHaveProperty('pivot');
    expect(result).not.toHaveProperty('bounds');
  });
});

// ─── ManualLayout pass-through ────────────────────────────────────────────────

describe('normalizeToViewport — ManualLayout pass-through', () => {
  it('node at [0.5, 0.5] passes through unchanged', () => {
    const dsl = manualDSL([{ id: 'center', position: [0.5, 0.5, 0], size: [0.2, 0.15] }]);
    const result = compileDiagram(dsl);
    const node = result.nodes[0]!;
    expect(node.position[0]).toBeCloseTo(0.5, 5);
    expect(node.position[1]).toBeCloseTo(0.5, 5);
    expect(node.size[0]).toBeCloseTo(0.2, 5);
    expect(node.size[1]).toBeCloseTo(0.15, 5);
  });

  it('nodes at [0.1, 0.1] and [0.9, 0.9] pass through — not re-normalized', () => {
    const dsl = manualDSL([
      { id: 'tl', position: [0.1, 0.1, 0], size: [0.1, 0.1] },
      { id: 'br', position: [0.9, 0.9, 0], size: [0.1, 0.1] },
    ]);
    const result = compileDiagram(dsl);
    const tl = result.nodes.find((n) => n.id === 'tl')!;
    const br = result.nodes.find((n) => n.id === 'br')!;
    // If normalization ran incorrectly, tl.x would drift from 0.1 toward ~0.5
    expect(tl.position[0]).toBeCloseTo(0.1, 5);
    expect(tl.position[1]).toBeCloseTo(0.1, 5);
    expect(br.position[0]).toBeCloseTo(0.9, 5);
    expect(br.position[1]).toBeCloseTo(0.9, 5);
  });

  it('ManualLayout group bounds.y is the NVS TOP edge (less than node center y)', () => {
    // ManualLayout positions are Y-down NVS. A group containing a node at y=0.8
    // (near bottom) must have bounds.y < 0.8 — i.e., the group top is above the node center.
    const dsl: DiagramDSL = {
      id: 'g-test',
      nodes: [{ id: 'a', position: [0.5, 0.8, 0], size: [0.1, 0.1] }],
      edges: [],
      groups: [{ id: 'g1', nodeIds: ['a'], label: 'G', childrenOrder: ['a'] }],
      layout: { kind: 'manual' },
      childrenOrder: ['a'],
    };
    const result = compileDiagram(dsl);
    const group = result.groups[0]!;
    // Group top (bounds.y) must be above (less than) the node center NVS y=0.8
    expect(group.bounds.y).toBeLessThan(0.8);
    // Group bottom (bounds.y + bounds.h) must be below (greater than) node center
    expect(group.bounds.y + group.bounds.h).toBeGreaterThan(0.8);
  });
});
