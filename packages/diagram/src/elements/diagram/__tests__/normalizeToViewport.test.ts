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
    // bbox: minX=-1, maxX=1, minY=-1, maxY=1 → spanX=2, spanY=2 → square → centered at 0.5
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

  it('single node size fraction equals full span fraction (square bbox)', () => {
    // node size [2,2], bbox [-1,1] x [-1,1], safeSpan=2 → size = [1.0, 1.0]
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [2, 2] as const }];
    const result = normalizeToViewport(nodes, new Map(), 0);
    const sz = result.normalizedSizes.get('a')!;
    expect(sz[0]).toBeCloseTo(1.0, 5);
    expect(sz[1]).toBeCloseTo(1.0, 5);
  });
});

// ─── Uniform scaling ─────────────────────────────────────────────────────────

describe('normalizeToViewport — uniform scaling', () => {
  it('wide bounding box: Y axis centered, X fills [0..1]', () => {
    // Two nodes at x=-4 and x=+4, each size [2,2] → spanX=10, spanY=2.
    // safeSpan=10. X fills [0..1]. Y centered.
    const nodes = [
      { id: 'l', position: [-4, 0, 0] as const, size: [2, 2] as const },
      { id: 'r', position: [4, 0, 0] as const, size: [2, 2] as const },
    ];
    const result = normalizeToViewport(nodes, new Map(), 0);
    const l = result.normalizedPositions.get('l')!;
    const r = result.normalizedPositions.get('r')!;
    // X positions should be symmetric around 0.5
    expect(l[0]).toBeLessThan(0.5);
    expect(r[0]).toBeGreaterThan(0.5);
    // Y should be centered at 0.5 (both nodes at same Cartesian Y)
    expect(l[1]).toBeCloseTo(r[1], 5);
    expect(l[1]).toBeCloseTo(0.5, 3);
  });

  it('tall bounding box: X axis centered, Y fills [0..1]', () => {
    // Two nodes at y=-4 and y=+4, each size [2,2] → spanX=2, spanY=10.
    // safeSpan=10. Y fills [0..1]. X centered.
    const nodes = [
      { id: 'b', position: [0, -4, 0] as const, size: [2, 2] as const },
      { id: 't', position: [0, 4, 0] as const, size: [2, 2] as const },
    ];
    const result = normalizeToViewport(nodes, new Map(), 0);
    const t = result.normalizedPositions.get('t')!;
    const b = result.normalizedPositions.get('b')!;
    // Y should span: top node has smaller NVS y (Y-flip)
    expect(t[1]).toBeLessThan(b[1]);
    // X should be centered at 0.5
    expect(t[0]).toBeCloseTo(0.5, 3);
    expect(b[0]).toBeCloseTo(0.5, 3);
  });

  it('rectangular bounding box: each axis fills [0..1] independently', () => {
    // Node at origin with size [4, 2]. spanX=4, spanY=2.
    // Non-uniform: sizeX = 4/4 = 1.0, sizeY = 2/2 = 1.0 — each axis fills fully.
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [4, 2] as const }];
    const result = normalizeToViewport(nodes, new Map(), 0);
    const sz = result.normalizedSizes.get('a')!;
    expect(sz[0]).toBeCloseTo(1.0, 5);
    expect(sz[1]).toBeCloseTo(1.0, 5);
  });
});

// ─── Y-axis flip ──────────────────────────────────────────────────────────────

describe('normalizeToViewport — Y-axis flip', () => {
  it('node at Cartesian y=+2 (top) maps to NVS y < 0.5 (top half)', () => {
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
    const nodes = [{ id: 'n', position: [0, 0, 0] as const, size: [1, 1] as const }];
    const groups = new Map([['g', makeGroup(5, 5, 1, 1)]]);

    const withoutGroup = normalizeToViewport(nodes, new Map(), 0);
    const withGroup = normalizeToViewport(nodes, groups, 0);

    const nxWithout = withoutGroup.normalizedPositions.get('n')![0];
    const nxWith = withGroup.normalizedPositions.get('n')![0];

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
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [2, 2] as const }];

    const noPad = normalizeToViewport(nodes, new Map(), 0);
    const withPad = normalizeToViewport(nodes, new Map(), 1);

    const szNoPad = noPad.normalizedSizes.get('a')![0];
    const szWithPad = withPad.normalizedSizes.get('a')![0];

    expect(szWithPad).toBeLessThan(szNoPad);
  });

  it('padding keeps a symmetric single node centered at NVS [0.5, 0.5]', () => {
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [2, 2] as const }];
    const result = normalizeToViewport(nodes, new Map(), 2);
    const pos = result.normalizedPositions.get('a')!;
    expect(pos[0]).toBeCloseTo(0.5, 5);
    expect(pos[1]).toBeCloseTo(0.5, 5);
  });

  it('two nodes: with padding they are pulled inward from the NVS edges', () => {
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

    expect(lxWithPad).toBeGreaterThan(lxNoPad);
    expect(rxWithPad).toBeLessThan(rxNoPad);
  });
});

// ─── Group bounds Y-flip ──────────────────────────────────────────────────────

describe('normalizeToViewport — group bounds Y-flip', () => {
  it('Cartesian group top edge (y+h) becomes NVS top edge (group.y in output)', () => {
    // Group at Cartesian: x=-1, y=0, w=2, h=2 → square bbox → safeSpan=2.
    const nodes = [{ id: 'n', position: [0, 1, 0] as const, size: [0, 0] as const }];
    const groups = new Map([['g', makeGroup(-1, 0, 2, 2)]]);
    const result = normalizeToViewport(nodes, groups, 0);

    const g = result.normalizedGroups.get('g')!;
    expect(g.y).toBeCloseTo(0, 5);
    expect(g.y + g.h).toBeCloseTo(1, 5);
  });

  it('group with Cartesian top > center: NVS top of group < 0.5', () => {
    const nodes: never[] = [];
    const groups = new Map([
      ['top', makeGroup(-0.5, 1, 1, 1)],
      ['bot', makeGroup(-0.5, 0, 1, 1)],
    ]);
    const result = normalizeToViewport(nodes, groups, 0);

    const topGroup = result.normalizedGroups.get('top')!;
    const botGroup = result.normalizedGroups.get('bot')!;
    expect(topGroup.y).toBeLessThan(botGroup.y);
  });

  it('group padding is normalized uniformly by safeSpan', () => {
    // Group with padding=[1,1,1,1], spanning 4x4 → safeSpan=4.
    // All padding values normalized by safeSpan → 1/4 = 0.25.
    const nodes: never[] = [];
    const groups = new Map([['g', { x: 0, y: 0, w: 4, h: 4, padding: [1, 1, 1, 1] as [number, number, number, number], titleGap: 0 }]]);
    const result = normalizeToViewport(nodes, groups, 0);

    const g = result.normalizedGroups.get('g')!;
    expect(g.padding[0]).toBeCloseTo(0.25, 5);
    expect(g.padding[1]).toBeCloseTo(0.25, 5);
    expect(g.padding[2]).toBeCloseTo(0.25, 5);
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

// ─── safeSpan ────────────────────────────────────────────────────────────────

describe('normalizeToViewport — safeSpan', () => {
  it('returns safeSpan=1 when nodes is empty', () => {
    const result = normalizeToViewport([], new Map(), 0);
    expect(result.safeSpan).toBe(1);
  });

  it('returns safeSpan equal to the larger of the two content spans', () => {
    // Two nodes at x=-3 and x=+3, each with size [2, 2].
    // Outer edges: x=[-4, 4] → spanX=8, y=[-1, 1] → spanY=2. safeSpan=8.
    const nodes = [
      { id: 'l', position: [-3, 0, 0] as const, size: [2, 2] as const },
      { id: 'r', position: [3, 0, 0] as const, size: [2, 2] as const },
    ];
    const result = normalizeToViewport(nodes, new Map(), 0);
    expect(result.safeSpan).toBeCloseTo(8, 5);
  });

  it('safeSpan includes padding on both sides', () => {
    // Single node at origin, size [4, 4] → square bbox, span=4, padding=1.
    // safeSpan = 4 + 2*1 = 6.
    const nodes = [{ id: 'a', position: [0, 0, 0] as const, size: [4, 4] as const }];
    const result = normalizeToViewport(nodes, new Map(), 1);
    expect(result.safeSpan).toBeCloseTo(6, 5);
  });

  it('safeSpan expands to include group bounds', () => {
    // Node at origin with size [2,2] → spanX=2, spanY=2.
    // Group at x=3, w=2 → extends to x=5 → spanX = 5-(-1) = 6, spanY stays 2.
    // safeSpan = max(6, 2) = 6.
    const nodes = [{ id: 'n', position: [0, 0, 0] as const, size: [2, 2] as const }];
    const groups = new Map([['g', makeGroup(3, 0, 2, 2)]]);
    const result = normalizeToViewport(nodes, groups, 0);
    expect(result.safeSpan).toBeCloseTo(6, 5);
  });

  it('returns safeSpan equal to spanY when diagram is taller than wide', () => {
    // Two nodes stacked vertically: y=-4 and y=+4, each size [2,2].
    // Outer edges: x=[-1, 1] → spanX=2, y=[-5, 5] → spanY=10. safeSpan = max(2, 10) = 10.
    const nodes = [
      { id: 't', position: [0, 4, 0] as const, size: [2, 2] as const },
      { id: 'b', position: [0, -4, 0] as const, size: [2, 2] as const },
    ];
    const result = normalizeToViewport(nodes, new Map(), 0);
    expect(result.safeSpan).toBeCloseTo(10, 5);
  });

  it('returns safeSpan equal to spanY when tall group dominates', () => {
    // Node at origin with size [2,2] → spanX=2, spanY=2.
    // Group at y=0, h=10 → extends to y=10 → spanY = 10-(-1) = 11, spanX = 2.
    // safeSpan = max(2, 11) = 11.
    const nodes = [{ id: 'n', position: [0, 0, 0] as const, size: [2, 2] as const }];
    const groups = new Map([['g', makeGroup(-1, 0, 2, 10)]]);
    const result = normalizeToViewport(nodes, groups, 0);
    expect(result.safeSpan).toBeCloseTo(11, 5);
  });
});
