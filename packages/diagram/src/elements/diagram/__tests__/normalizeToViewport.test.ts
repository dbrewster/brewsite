// Tests for the normalizeToViewport pure function.
// Calls the function directly with real inputs to verify NVS coordinate mapping,
// Y-axis flip, group bounds normalization, padding, and degenerate cases.

import { describe, it, expect } from 'vitest';
import { normalizeToViewport } from '../compiler/normalizeToViewport';
import type { GroupBounds } from '../compiler/groupCompiler';

/** Helper: build a minimal GroupBounds in diagram-unit Cartesian space (y = bottom edge, Y-up). */
function makeGroup(x: number, y: number, w: number, h: number): GroupBounds {
  return { x, y, w, h, padding: [0, 0, 0, 0], titleGap: 0 };
}

// ─── Degenerate / empty ───────────────────────────────────────────────────────

describe('normalizeToViewport — empty inputs', () => {
  it('returns contentAspect=1.0 and empty maps when nodes is empty and no groups', () => {
    const result = normalizeToViewport([], new Map(), 0);
    expect(result.contentAspect).toBe(1.0);
    expect(result.normalizedPositions.size).toBe(0);
    expect(result.normalizedSizes.size).toBe(0);
    expect(result.normalizedGroups.size).toBe(0);
  });

  it('returns contentAspect=1.0 even when groups map is empty', () => {
    const result = normalizeToViewport([], new Map(), 5);
    expect(result.contentAspect).toBe(1.0);
  });
});

// ─── Single node normalization ────────────────────────────────────────────────

describe('normalizeToViewport — single node', () => {
  it('single node at Cartesian origin with size [2,2] maps to NVS [0.5, 0.5, 0]', () => {
    // bbox: minX=-1, maxX=1, minY=-1, maxY=1 → spanX=2, spanY=2 → nx=ny=0.5
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [2, 2] as const }];
    const result = normalizeToViewport(nodes, new Map(), 0);
    const pos = result.normalizedPositions.get('a')!;
    expect(pos[0]).toBeCloseTo(0.5, 5);
    expect(pos[1]).toBeCloseTo(0.5, 5);
    expect(pos[2]).toBe(0);
  });

  it('single node preserves Z coordinate unchanged', () => {
    const nodes = [{ id: 'a', position: [0, 0, 3.5] as const, size: [2, 2] as const }];
    const result = normalizeToViewport(nodes, new Map(), 0);
    expect(result.normalizedPositions.get('a')![2]).toBe(3.5);
  });

  it('single node size fraction equals full span fraction', () => {
    // node size [2,2], bbox [-1,1] x [-1,1], spanX=2, spanY=2 → size = [1.0, 1.0]
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [2, 2] as const }];
    const result = normalizeToViewport(nodes, new Map(), 0);
    const sz = result.normalizedSizes.get('a')!;
    expect(sz[0]).toBeCloseTo(1.0, 5);
    expect(sz[1]).toBeCloseTo(1.0, 5);
  });
});

// ─── Y-axis flip ──────────────────────────────────────────────────────────────

describe('normalizeToViewport — Y-axis flip', () => {
  it('node at Cartesian y=+2 (top) maps to NVS y < 0.5 (top half)', () => {
    // Two nodes: a at y=+2 (Cartesian top), b at y=0 (Cartesian bottom).
    // After Y-flip, a should be in NVS top half (y < 0.5), b in bottom half (y > 0.5).
    const nodes = [
      { id: 'a', position: [0, 2, 0] as const, size: [1, 1] as const },
      { id: 'b', position: [0, 0, 0] as const, size: [1, 1] as const },
    ];
    const result = normalizeToViewport(nodes, new Map(), 0);
    const a = result.normalizedPositions.get('a')!;
    const b = result.normalizedPositions.get('b')!;
    expect(a[1]).toBeLessThan(0.5);
    expect(b[1]).toBeGreaterThan(0.5);
  });

  it('node at Cartesian y=+2 has smaller NVS y than node at y=0 (top-has-lower-y)', () => {
    const nodes = [
      { id: 'top', position: [0, 2, 0] as const, size: [1, 1] as const },
      { id: 'bot', position: [0, 0, 0] as const, size: [1, 1] as const },
    ];
    const result = normalizeToViewport(nodes, new Map(), 0);
    const topY = result.normalizedPositions.get('top')![1];
    const botY = result.normalizedPositions.get('bot')![1];
    expect(topY).toBeLessThan(botY);
  });
});

// ─── Group bounds expand the bounding box ─────────────────────────────────────

describe('normalizeToViewport — group bounds expansion', () => {
  it('a far-away group shifts the node away from NVS center', () => {
    // Without the group, the single node maps to [0.5, 0.5].
    // A group at x=5, y=5, w=1, h=1 expands the bounding box, pushing the node away from center.
    const nodes = [{ id: 'n', position: [0, 0, 0] as const, size: [1, 1] as const }];
    const groups = new Map([['g', makeGroup(5, 5, 1, 1)]]);

    const withoutGroup = normalizeToViewport(nodes, new Map(), 0);
    const withGroup = normalizeToViewport(nodes, groups, 0);

    const nxWithout = withoutGroup.normalizedPositions.get('n')![0];
    const nxWith = withGroup.normalizedPositions.get('n')![0];

    // The far group pushes the node's NVS x closer to 0 (toward the left edge)
    expect(nxWith).toBeLessThan(nxWithout);
  });

  it('group bounds appear in normalizedGroups output', () => {
    const nodes = [{ id: 'n', position: [0, 1, 0] as const, size: [0, 0] as const }];
    const groups = new Map([['g', makeGroup(-1, 0, 2, 2)]]);
    const result = normalizeToViewport(nodes, groups, 0);
    expect(result.normalizedGroups.has('g')).toBe(true);
  });
});

// ─── Padding expands the bounding box ─────────────────────────────────────────

describe('normalizeToViewport — padding', () => {
  it('padding reduces node size fractions (more space around nodes)', () => {
    // Single node at origin, size=[2,2]. Without padding: sizeFraction=[1,1].
    // With padding=1: spanX = 2 + 2 = 4 → sizeFraction = 2/4 = 0.5.
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [2, 2] as const }];

    const noPad = normalizeToViewport(nodes, new Map(), 0);
    const withPad = normalizeToViewport(nodes, new Map(), 1);

    const szNoPad = noPad.normalizedSizes.get('a')![0];
    const szWithPad = withPad.normalizedSizes.get('a')![0];

    expect(szWithPad).toBeLessThan(szNoPad);
  });

  it('padding keeps a symmetric single node centered at NVS [0.5, 0.5]', () => {
    // Symmetric expansion means the node stays at the center regardless of padding.
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [2, 2] as const }];
    const result = normalizeToViewport(nodes, new Map(), 2);
    const pos = result.normalizedPositions.get('a')!;
    expect(pos[0]).toBeCloseTo(0.5, 5);
    expect(pos[1]).toBeCloseTo(0.5, 5);
  });

  it('two nodes: with padding they are pulled inward from the NVS edges', () => {
    // Two nodes at x=-1 and x=+1, size=[0.5, 0.5], no Y separation.
    // Without padding: left node NVS x ≈ 0 (at edge), right ≈ 1 (at edge).
    // With padding=0.5: nodes are no longer at the edges.
    const nodes = [
      { id: 'l', position: [-1, 0, 0] as const, size: [0.5, 0.5] as const },
      { id: 'r', position: [1, 0, 0] as const, size: [0.5, 0.5] as const },
    ];
    const noPad = normalizeToViewport(nodes, new Map(), 0);
    const withPad = normalizeToViewport(nodes, new Map(), 0.5);

    const lxNoPad = noPad.normalizedPositions.get('l')![0];
    const lxWithPad = withPad.normalizedPositions.get('l')![0];
    const rxNoPad = noPad.normalizedPositions.get('r')![0];
    const rxWithPad = withPad.normalizedPositions.get('r')![0];

    // With padding, left node shifts right (away from edge 0)
    expect(lxWithPad).toBeGreaterThan(lxNoPad);
    // With padding, right node shifts left (away from edge 1)
    expect(rxWithPad).toBeLessThan(rxNoPad);
  });
});

// ─── Group bounds Y-flip ──────────────────────────────────────────────────────

describe('normalizeToViewport — group bounds Y-flip', () => {
  it('Cartesian group top edge (y+h) becomes NVS top edge (group.y in output)', () => {
    // Group at Cartesian: x=-1, y=0 (bottom), w=2, h=2 → Cartesian top = 2.
    // Node at [0,1,0] size=[0,0] (point node, Cartesian center of group).
    // After normalization: group.y (NVS top) should be at 0 (top of viewport).
    const nodes = [{ id: 'n', position: [0, 1, 0] as const, size: [0, 0] as const }];
    const groups = new Map([['g', makeGroup(-1, 0, 2, 2)]]);
    const result = normalizeToViewport(nodes, groups, 0);

    // Group expanded bbox to fill the full viewport → NVS group covers [0..1] x [0..1]
    const g = result.normalizedGroups.get('g')!;
    expect(g.y).toBeCloseTo(0, 5);           // NVS top = top of viewport
    expect(g.y + g.h).toBeCloseTo(1, 5);     // NVS bottom = bottom of viewport
  });

  it('group with Cartesian top > center: NVS top of group < 0.5', () => {
    // Group occupying the top half of diagram space: Cartesian y=1 (bottom), h=1 → top=2.
    // Another group occupying the bottom half: Cartesian y=0 (bottom), h=1 → top=1.
    // Both have x=-0.5, w=1.
    // Combined bbox: x=[-0.5, 0.5], y=[0, 2], spanX=1, spanY=2.
    // Top group: NVS top = 1 - (2-0)/2 = 0  → spans [0, 0.5]
    // Bottom group: NVS top = 1 - (1-0)/2 = 0.5 → spans [0.5, 1.0]
    const nodes: never[] = [];
    const groups = new Map([
      ['top', makeGroup(-0.5, 1, 1, 1)],    // Cartesian y=1 (bottom), top=2
      ['bot', makeGroup(-0.5, 0, 1, 1)],    // Cartesian y=0 (bottom), top=1
    ]);
    const result = normalizeToViewport(nodes, groups, 0);

    const topGroup = result.normalizedGroups.get('top')!;
    const botGroup = result.normalizedGroups.get('bot')!;
    // 'top' group (Cartesian top-half): NVS y (top edge) should be less than 'bot' group's NVS y
    expect(topGroup.y).toBeLessThan(botGroup.y);
    // The top group sits in the NVS top half (y + h ≤ 0.5)
    expect(topGroup.y + topGroup.h).toBeCloseTo(0.5, 5);
  });

  it('group padding is normalized proportionally to span', () => {
    // Group with padding=[1,1,1,1] in diagram units, spanning a total of 4 units in each axis.
    const nodes: never[] = [];
    const groups = new Map([['g', { x: 0, y: 0, w: 4, h: 4, padding: [1, 1, 1, 1] as [number, number, number, number], titleGap: 0 }]]);
    const result = normalizeToViewport(nodes, groups, 0);

    const g = result.normalizedGroups.get('g')!;
    // padding[0] (top) and padding[2] (bottom) are divided by safeSpanY=4 → 0.25
    expect(g.padding[0]).toBeCloseTo(0.25, 5);
    expect(g.padding[2]).toBeCloseTo(0.25, 5);
    // padding[1] (right) and padding[3] (left) are divided by safeSpanX=4 → 0.25
    expect(g.padding[1]).toBeCloseTo(0.25, 5);
    expect(g.padding[3]).toBeCloseTo(0.25, 5);
  });
});

// ─── contentAspect ────────────────────────────────────────────────────────────

describe('normalizeToViewport — contentAspect', () => {
  it('square bounding box produces contentAspect=1.0', () => {
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [2, 2] as const }];
    const result = normalizeToViewport(nodes, new Map(), 0);
    expect(result.contentAspect).toBeCloseTo(1.0, 5);
  });

  it('wide bounding box produces contentAspect > 1.0', () => {
    // Two nodes 4 units apart horizontally, 0 units apart vertically (same size).
    // spanX >> spanY → contentAspect > 1.
    const nodes = [
      { id: 'l', position: [-2, 0, 0] as const, size: [0.5, 0.5] as const },
      { id: 'r', position: [2, 0, 0] as const, size: [0.5, 0.5] as const },
    ];
    const result = normalizeToViewport(nodes, new Map(), 0);
    expect(result.contentAspect).toBeGreaterThan(1.0);
  });

  it('tall bounding box produces contentAspect < 1.0', () => {
    const nodes = [
      { id: 't', position: [0, 2, 0] as const, size: [0.5, 0.5] as const },
      { id: 'b', position: [0, -2, 0] as const, size: [0.5, 0.5] as const },
    ];
    const result = normalizeToViewport(nodes, new Map(), 0);
    expect(result.contentAspect).toBeLessThan(1.0);
  });
});

// ─── safeSpanX ───────────────────────────────────────────────────────────────

describe('normalizeToViewport — safeSpanX', () => {
  it('returns safeSpanX=1 when nodes is empty', () => {
    const result = normalizeToViewport([], new Map(), 0);
    expect(result.safeSpanX).toBe(1);
  });

  it('returns safeSpanX equal to the horizontal content span (no padding)', () => {
    // Two nodes at x=-3 and x=+3, each with size [2, 2].
    // Outer edges: -3 - 1 = -4 and +3 + 1 = +4. spanX = 8.
    const nodes = [
      { id: 'l', position: [-3, 0, 0] as const, size: [2, 2] as const },
      { id: 'r', position: [3, 0, 0] as const, size: [2, 2] as const },
    ];
    const result = normalizeToViewport(nodes, new Map(), 0);
    expect(result.safeSpanX).toBeCloseTo(8, 5);
  });

  it('safeSpanX includes padding on both sides', () => {
    // Single node at origin, size [4, 2]. spanX = 4, padding = 1.
    // safeSpanX = 4 + 2 * 1 = 6.
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [4, 2] as const }];
    const result = normalizeToViewport(nodes, new Map(), 1);
    expect(result.safeSpanX).toBeCloseTo(6, 5);
  });

  it('safeSpanX is consistent with contentAspect (safeSpanX / safeSpanY)', () => {
    // Two nodes creating a rectangular bounding box.
    const nodes = [
      { id: 'a', position: [-2, -1, 0] as const, size: [1, 1] as const },
      { id: 'b', position: [2, 1, 0] as const, size: [1, 1] as const },
    ];
    const result = normalizeToViewport(nodes, new Map(), 0);
    // spanX = (2+0.5) - (-2-0.5) = 5, spanY = (1+0.5) - (-1-0.5) = 3
    // contentAspect = 5/3, safeSpanX = 5
    const safeSpanY = result.safeSpanX / result.contentAspect;
    expect(result.safeSpanX).toBeCloseTo(5, 5);
    expect(safeSpanY).toBeCloseTo(3, 5);
  });

  it('safeSpanX expands to include group bounds', () => {
    // Node at origin with size [2,2] → spanX = 2.
    // Group at x=3, w=2 → extends to x=5 → spanX = 5 - (-1) = 6.
    const nodes = [{ id: 'n', position: [0, 0, 0] as const, size: [2, 2] as const }];
    const groups = new Map([['g', makeGroup(3, 0, 2, 2)]]);
    const result = normalizeToViewport(nodes, groups, 0);
    expect(result.safeSpanX).toBeCloseTo(6, 5);
  });
});
