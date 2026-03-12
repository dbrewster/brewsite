// Regression tests for resolveGroupBoundsMap — verifies stable output after unionBounds refactor.

import { describe, it, expect } from 'vitest';
import { resolveGroupBoundsMap } from '../groupCompiler';
import type { DiagramGroupDSL } from '../../types';
import type { ResolvedLayout } from '../layoutResolver';
import { DEFAULT_GROUP_PADDING, DEFAULT_TITLE_GAP } from '../diagramLayoutConstants';

// Minimal ResolvedLayout conforming object for tests.
const makeGridLayout = (
  overrides: Partial<{ groupPadding: readonly [number, number, number, number]; titleGap: number }> = {},
): ResolvedLayout =>
  ({
    kind: 'grid',
    columns: 2,
    nodeWidth: 2,
    nodeHeight: 1,
    hGap: 1,
    vGap: 1,
    groupPadding: overrides.groupPadding ?? DEFAULT_GROUP_PADDING,
    titleGap: overrides.titleGap ?? DEFAULT_TITLE_GAP,
  } as ResolvedLayout);

describe('resolveGroupBoundsMap', () => {
  it('returns an empty map for an empty groups array', () => {
    const result = resolveGroupBoundsMap([], new Map(), new Map(), new Map());
    expect(result.size).toBe(0);
  });

  it('returns padded zero-area bounds for a group with no nodes and no children', () => {
    // No nodes, no children, no layout override → base {0,0,0,0} + DEFAULT_GROUP_PADDING [1.5,1.5,1.5,1.5]
    const groups: DiagramGroupDSL[] = [{ id: 'g1', nodeIds: [] }];
    const result = resolveGroupBoundsMap(groups, new Map(), new Map(), new Map());
    const bounds = result.get('g1');
    expect(bounds).toBeDefined();
    // Padding is always applied: x = 0 - pl, y = 0 - pb, w = 0 + pl+pr, h = 0 + pb+pt
    const [pt, pr, pb, pl] = DEFAULT_GROUP_PADDING;
    expect(bounds!.x).toBeCloseTo(-pl);
    expect(bounds!.y).toBeCloseTo(-pb);
    expect(bounds!.w).toBeCloseTo(pl + pr);
    expect(bounds!.h).toBeCloseTo(pb + pt);
    expect(bounds!.padding).toEqual(DEFAULT_GROUP_PADDING);
    expect(bounds!.titleGap).toBe(DEFAULT_TITLE_GAP);
  });

  it('wraps a single node with group padding', () => {
    const groups: DiagramGroupDSL[] = [{ id: 'g1', nodeIds: ['n1'] }];
    const positions = new Map([['n1', [0, 0, 0] as const]]);
    const sizes = new Map([['n1', [4, 2] as const]]);
    const layouts = new Map([['g1', makeGridLayout()]]);

    const result = resolveGroupBoundsMap(groups, positions, sizes, layouts);
    const bounds = result.get('g1')!;

    // node at (0,0) with size (4,2): raw x=-2, y=-1, w=4, h=2
    // padding [1.5, 1.5, 1.5, 1.5]: x -= pl=1.5, y -= pb=1.5, w += pl+pr=3, h += pb+pt=3
    expect(bounds.x).toBeCloseTo(-3.5);
    expect(bounds.y).toBeCloseTo(-2.5);
    expect(bounds.w).toBeCloseTo(7);
    expect(bounds.h).toBeCloseTo(5);
    expect(bounds.padding).toEqual(DEFAULT_GROUP_PADDING);
    expect(bounds.titleGap).toBe(DEFAULT_TITLE_GAP);
  });

  it('wraps two nodes whose bounding rect spans both', () => {
    // n1 at (-3, 0) size (2,2): raw x=-4...-2
    // n2 at ( 3, 0) size (2,2): raw x=2...4
    // combined raw: x=-4, y=-1, w=8, h=2
    const groups: DiagramGroupDSL[] = [{ id: 'g1', nodeIds: ['n1', 'n2'] }];
    const positions = new Map<string, readonly [number, number, number]>([
      ['n1', [-3, 0, 0]],
      ['n2', [3, 0, 0]],
    ]);
    const sizes = new Map<string, readonly [number, number]>([
      ['n1', [2, 2]],
      ['n2', [2, 2]],
    ]);
    const layouts = new Map([['g1', makeGridLayout()]]);

    const result = resolveGroupBoundsMap(groups, positions, sizes, layouts);
    const bounds = result.get('g1')!;

    expect(bounds.x).toBeCloseTo(-5.5);   // -4 - 1.5 (pl)
    expect(bounds.y).toBeCloseTo(-2.5);   // -1 - 1.5 (pb)
    expect(bounds.w).toBeCloseTo(11);     // 8 + 1.5 + 1.5
    expect(bounds.h).toBeCloseTo(5);      // 2 + 1.5 + 1.5
  });

  it('uses custom groupPadding and titleGap from resolved layout', () => {
    const groups: DiagramGroupDSL[] = [{ id: 'g1', nodeIds: ['n1'] }];
    const positions = new Map([['n1', [0, 0, 0] as const]]);
    const sizes = new Map([['n1', [2, 2] as const]]);
    const customPadding: readonly [number, number, number, number] = [0.5, 0.5, 0.5, 0.5];
    const layouts = new Map([['g1', makeGridLayout({ groupPadding: customPadding, titleGap: 0.2 })]]);

    const result = resolveGroupBoundsMap(groups, positions, sizes, layouts);
    const bounds = result.get('g1')!;

    // node raw: x=-1, y=-1, w=2, h=2
    // padding 0.5 each side
    expect(bounds.x).toBeCloseTo(-1.5);
    expect(bounds.y).toBeCloseTo(-1.5);
    expect(bounds.w).toBeCloseTo(3);
    expect(bounds.h).toBeCloseTo(3);
    expect(bounds.padding).toEqual(customPadding);
    expect(bounds.titleGap).toBe(0.2);
  });

  it('computes nested group bounds by unioning child group bounds into parent', () => {
    // child group g2 contains n1 at (0, 0) size (2,2)
    // parent group g1 has childGroupIds: ['g2'], no direct nodes
    const groups: DiagramGroupDSL[] = [
      { id: 'g1', nodeIds: [], childGroupIds: ['g2'] },
      { id: 'g2', nodeIds: ['n1'] },
    ];
    const positions = new Map([['n1', [0, 0, 0] as const]]);
    const sizes = new Map([['n1', [2, 2] as const]]);
    const padding: readonly [number, number, number, number] = [1, 1, 1, 1];
    const layouts = new Map([
      ['g1', makeGridLayout({ groupPadding: padding })],
      ['g2', makeGridLayout({ groupPadding: padding })],
    ]);

    const result = resolveGroupBoundsMap(groups, positions, sizes, layouts);
    const g2 = result.get('g2')!;
    const g1 = result.get('g1')!;

    // g2: node raw x=-1,y=-1,w=2,h=2 + pad [1,1,1,1]
    // g2.x=-2, g2.y=-2, g2.w=4, g2.h=4
    expect(g2.x).toBeCloseTo(-2);
    expect(g2.y).toBeCloseTo(-2);
    expect(g2.w).toBeCloseTo(4);
    expect(g2.h).toBeCloseTo(4);

    // g1 has no direct nodes; it unions g2's bounds into itself
    // combined = g2 bounds, then padded by [1,1,1,1]
    // g1.x = -2 - 1 = -3, g1.y = -2 - 1 = -3, g1.w = 4+2=6, g1.h = 4+2=6
    expect(g1.x).toBeCloseTo(-3);
    expect(g1.y).toBeCloseTo(-3);
    expect(g1.w).toBeCloseTo(6);
    expect(g1.h).toBeCloseTo(6);
  });

  it('handles a group whose nodeIds reference unknown nodes gracefully', () => {
    // Unknown node → computeBounds returns zero-area bounds → padding still applied
    const groups: DiagramGroupDSL[] = [{ id: 'g1', nodeIds: ['missing'] }];
    const result = resolveGroupBoundsMap(groups, new Map(), new Map(), new Map());
    const bounds = result.get('g1')!;
    const [, pr, pb, pl] = DEFAULT_GROUP_PADDING;
    // base is zero; after padding: x=-pl, y=-pb, w=pl+pr
    expect(bounds.x).toBeCloseTo(-pl);
    expect(bounds.y).toBeCloseTo(-pb);
    expect(bounds.w).toBeCloseTo(pl + pr);
    expect(bounds.padding).toEqual(DEFAULT_GROUP_PADDING);
  });

  it('returns stable identical output on repeated calls with same inputs (regression guard)', () => {
    const groups: DiagramGroupDSL[] = [
      { id: 'parent', nodeIds: ['n1'], childGroupIds: ['child'] },
      { id: 'child', nodeIds: ['n2'] },
    ];
    const positions = new Map<string, readonly [number, number, number]>([
      ['n1', [0, 0, 0]],
      ['n2', [5, 3, 0]],
    ]);
    const sizes = new Map<string, readonly [number, number]>([
      ['n1', [2, 2]],
      ['n2', [2, 2]],
    ]);
    const layouts = new Map([
      ['parent', makeGridLayout()],
      ['child', makeGridLayout()],
    ]);

    const r1 = resolveGroupBoundsMap(groups, positions, sizes, layouts);
    const r2 = resolveGroupBoundsMap(groups, positions, sizes, layouts);

    for (const [id, b1] of r1) {
      const b2 = r2.get(id)!;
      expect(b2.x).toBeCloseTo(b1.x);
      expect(b2.y).toBeCloseTo(b1.y);
      expect(b2.w).toBeCloseTo(b1.w);
      expect(b2.h).toBeCloseTo(b1.h);
    }
  });
});
