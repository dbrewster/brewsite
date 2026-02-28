import { describe, it, expect } from 'vitest';
import { resolveLayout, resolveLayoutWithGroups, computeBounds } from '../layoutAlgorithms';
import {
  DEFAULT_RESOLVED_GRID,
  DEFAULT_RESOLVED_HIERARCHICAL,
  DEFAULT_RESOLVED_MANUAL,
  resolveEffectiveLayout,
  resolveGroupLayouts,
  resolveThemeLayoutDefaults,
} from '../layoutResolver';
import type {
  ResolvedGridLayout,
  ResolvedHierarchicalLayout,
  ResolvedManualLayout,
} from '../layoutResolver';
import type { DiagramNodeDSL, DiagramEdgeDSL, DiagramGroupDSL } from '../../types';
import type { DiagramThemeLayoutConfig } from '../../types';
import { resolveGroupBoundsMap } from '../groupCompiler';

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

const grid = (overrides: Partial<ResolvedGridLayout> = {}): ResolvedGridLayout =>
  ({ ...DEFAULT_RESOLVED_GRID, ...overrides });

const hierarchical = (overrides: Partial<ResolvedHierarchicalLayout> = {}): ResolvedHierarchicalLayout =>
  ({ ...DEFAULT_RESOLVED_HIERARCHICAL, ...overrides });

const manual = (): ResolvedManualLayout => ({ ...DEFAULT_RESOLVED_MANUAL });

describe('resolveEffectiveLayout', () => {
  it('absent own → inherits parent as-is', () => {
    const parent = hierarchical({ spacing: [5, 5] });
    expect(resolveEffectiveLayout(undefined, parent)).toEqual(parent);
  });

  it('absent own, absent parent → returns default grid', () => {
    expect(resolveEffectiveLayout(undefined, undefined)).toEqual(DEFAULT_RESOLVED_GRID);
  });

  it('grid parent + grid child → merges: child columns win, parent spacing inherited', () => {
    const parent = grid({ spacing: [3, 4] });
    const child = { kind: 'grid', columns: 2 } as const;
    const resolved = resolveEffectiveLayout(child, parent);
    expect(resolved.kind).toBe('grid');
    expect((resolved as ResolvedGridLayout).columns).toBe(2);
    expect(resolved.spacing).toEqual([3, 4]);
  });

  it('hierarchical parent + hierarchical child → merges specified props only', () => {
    const parent = hierarchical({ direction: 'left-right', alignment: 'right' });
    const child = { kind: 'hierarchical', spacing: [1, 1] } as const;
    const resolved = resolveEffectiveLayout(child, parent) as ResolvedHierarchicalLayout;
    expect(resolved.direction).toBe('left-right');
    expect(resolved.alignment).toBe('right');
    expect(resolved.spacing).toEqual([1, 1]);
  });

  it('grid parent + hierarchical child → uses hierarchical defaults (no inheritance)', () => {
    const parent = grid({ spacing: [9, 9] });
    const child = { kind: 'hierarchical' } as const;
    const resolved = resolveEffectiveLayout(child, parent);
    expect(resolved.kind).toBe('hierarchical');
    expect(resolved.spacing).toEqual(DEFAULT_RESOLVED_HIERARCHICAL.spacing);
  });

  it('hierarchical parent + grid child → uses grid defaults (no inheritance)', () => {
    const parent = hierarchical({ spacing: [9, 9] });
    const child = { kind: 'grid' } as const;
    const resolved = resolveEffectiveLayout(child, parent);
    expect(resolved.kind).toBe('grid');
    expect(resolved.spacing).toEqual(DEFAULT_RESOLVED_GRID.spacing);
  });

  it('manual layout → groupPadding and titleGap from child, rest not applicable', () => {
    const resolved = resolveEffectiveLayout({ kind: 'manual', titleGap: 1, groupPadding: 2 }, undefined);
    expect(resolved.kind).toBe('manual');
    expect(resolved.titleGap).toBe(1);
    expect(resolved.groupPadding).toEqual([2, 2, 2, 2]);
  });

  it('undefined prop in child does not override parent value', () => {
    const parent = grid({ alignment: 'right' });
    const child = { kind: 'grid', alignment: undefined } as const;
    const resolved = resolveEffectiveLayout(child, parent);
    expect(resolved.alignment).toBe('right');
  });

  it('uses theme root default kind when own and parent are absent', () => {
    const themeLayout: DiagramThemeLayoutConfig = {
      defaultKind: 'hierarchical',
      hierarchical: { spacing: [7, 8] },
    };
    const defaults = resolveThemeLayoutDefaults(themeLayout);
    const resolved = resolveEffectiveLayout(undefined, undefined, defaults);
    expect(resolved.kind).toBe('hierarchical');
    expect((resolved as ResolvedHierarchicalLayout).spacing).toEqual([7, 8]);
  });

  it('uses same-kind theme defaults when own kind differs from parent kind', () => {
    const defaults = resolveThemeLayoutDefaults({
      grid: { spacing: [6, 6], margin: [1, 2] },
    });
    const parent = hierarchical();
    const resolved = resolveEffectiveLayout({ kind: 'grid' }, parent, defaults) as ResolvedGridLayout;
    expect(resolved.spacing).toEqual([6, 6]);
    expect(resolved.margin).toEqual([1, 2]);
  });
});

describe('resolveGroupLayouts', () => {
  it('top-level group without own layout → inherits root', () => {
    const groups = [{ id: 'g1' }];
    const root = hierarchical({ spacing: [3, 3] });
    const layouts = resolveGroupLayouts(groups, root);
    expect(layouts.get('g1')).toEqual(root);
  });

  it('top-level group with same-kind layout → merges', () => {
    const groups = [{ id: 'g1', layout: { kind: 'grid', columns: 2 } }];
    const root = grid({ spacing: [4, 4] });
    const layouts = resolveGroupLayouts(groups, root);
    const resolved = layouts.get('g1') as ResolvedGridLayout;
    expect(resolved.columns).toBe(2);
    expect(resolved.spacing).toEqual([4, 4]);
  });

  it('nested group inherits through parent chain (3 levels)', () => {
    const groups = [
      { id: 'g1', layout: { kind: 'grid', columns: 3 } },
      { id: 'g2', parentId: 'g1' },
      { id: 'g3', parentId: 'g2' },
    ];
    const root = grid({ spacing: [2, 2] });
    const layouts = resolveGroupLayouts(groups, root);
    const resolved = layouts.get('g3') as ResolvedGridLayout;
    expect(resolved.columns).toBe(3);
  });

  it('different-kind at nested level breaks chain — grandchild inherits from parent not grandparent', () => {
    const groups = [
      { id: 'g1', layout: { kind: 'grid', columns: 3 } },
      { id: 'g2', parentId: 'g1', layout: { kind: 'hierarchical' } },
      { id: 'g3', parentId: 'g2' },
    ];
    const root = grid();
    const layouts = resolveGroupLayouts(groups, root);
    const resolved = layouts.get('g3') as ResolvedHierarchicalLayout;
    expect(resolved.kind).toBe('hierarchical');
    expect(resolved.spacing).toEqual(DEFAULT_RESOLVED_HIERARCHICAL.spacing);
  });

  it('different-kind nested group uses theme defaults for that kind', () => {
    const groups = [
      { id: 'g1' },
      { id: 'g2', parentId: 'g1', layout: { kind: 'hierarchical' } },
    ];
    const root = grid();
    const defaults = resolveThemeLayoutDefaults({
      hierarchical: { spacing: [9, 9], alignment: 'right' },
    });
    const layouts = resolveGroupLayouts(groups, root, defaults);
    const resolved = layouts.get('g2') as ResolvedHierarchicalLayout;
    expect(resolved.spacing).toEqual([9, 9]);
    expect(resolved.alignment).toBe('right');
  });
});

describe('resolveLayout', () => {
  it('grid: assigns non-overlapping positions to 4 nodes with no explicit positions', () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id) => makeNode(id));
    const positions = resolveLayout(nodes, [], grid());
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
    const positions = resolveLayout(nodes, [], grid());
    expect(positions.get('a')).toEqual([10, 10, 0]);
    expect(positions.get('b')).toBeDefined();
  });

  it('hierarchical: places downstream nodes at lower Y levels', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];
    const positions = resolveLayout(nodes, edges, hierarchical());
    const yA = positions.get('a')![1];
    const yB = positions.get('b')![1];
    const yC = positions.get('c')![1];
    expect(yB).toBeLessThan(yA);
    expect(yC).toBeLessThan(yB);
  });

  it('manual: throws when non-ghost nodes missing positions', () => {
    const nodes = [makeNode('a')];
    expect(() => resolveLayout(nodes, [], manual())).toThrow();
  });

  it('manual: allows ghost nodes without positions', () => {
    const nodes = [makeNode('a', { label: '' })];
    expect(() => resolveLayout(nodes, [], manual())).not.toThrow();
  });

  it('grid: uses layout spacing for position deltas', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const positions = resolveLayout(nodes, [], grid({ spacing: [10, 10] }));
    const posA = positions.get('a')!;
    const posB = positions.get('b')!;
    expect(Math.abs(posA[0] - posB[0])).toBeGreaterThanOrEqual(10);
  });

  it('hierarchical: gap between adjacent levels equals spacing[1] regardless of height differences', () => {
    // A tall node (h=20) drives a short node (h=2).
    // The vertical gap between the bottom of the tall node and the top of the short node
    // must equal exactly spacing[1] = 3, not the current behaviour where it is dominated
    // by globalMaxHeight and becomes (20 - 2) / 2 + spacing = 11 instead of 3.
    const nodes = [
      makeNode('tall', { size: [4, 20] }),
      makeNode('short', { size: [4, 2] }),
    ];
    const edges = [makeEdge('tall', 'short')];
    const spacing: [number, number] = [2, 3];

    const positions = resolveLayout(nodes, edges, hierarchical({ spacing }));

    const yTall = positions.get('tall')![1];
    const yShort = positions.get('short')![1];

    // In Y-up space, "downstream" means smaller Y.
    // tall occupies [yTall - 10, yTall + 10]; short occupies [yShort - 1, yShort + 1].
    const tallBottom = yTall - 20 / 2;
    const shortTop  = yShort + 2 / 2;

    // The gap must be exactly spacing[1]. tallBottom > shortTop because Y decreases downstream.
    const gap = tallBottom - shortTop;
    expect(gap).toBeCloseTo(spacing[1]);
  });

  it('hierarchical: anchors auto layout to explicit node Y at the same level', () => {
    // Explicit node at level 0 should anchor the auto-placed level 0 node.
    const nodes = [
      makeNode('explicit', { position: [0, 8, 0] as [number, number, number] }),
      makeNode('auto-1'),
      makeNode('auto-2'),
    ];
    const edges = [makeEdge('auto-1', 'auto-2')];
    const positions = resolveLayout(nodes, edges, hierarchical());
    const yExplicit = positions.get('explicit')![1];
    const yAuto1 = positions.get('auto-1')![1];
    expect(yAuto1).toBeCloseTo(yExplicit);
  });
});

describe('resolveLayout — grid', () => {
  it('columns: 2 → 2-column grid', () => {
    const nodes = ['a', 'b', 'c'].map((id) => makeNode(id));
    const positions = resolveLayout(nodes, [], grid({ columns: 2 }));
    expect(positions.get('c')![1]).toBeLessThan(positions.get('a')![1]);
  });

  it('columns: auto → 4-column grid (current default)', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e'].map((id) => makeNode(id));
    const positions = resolveLayout(nodes, [], grid({ columns: 'auto' }));
    expect(positions.get('e')![1]).toBeLessThan(positions.get('a')![1]);
  });

  it('margin: [1, 0] → nodes offset by margin on X axis', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const positions = resolveLayout(nodes, [], grid({ margin: [1, 0] }));
    const dx = Math.abs(positions.get('a')![0] - positions.get('b')![0]);
    expect(dx).toBeGreaterThan(6);
  });

  it('alignment: center → rows centered around widest row', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e'].map((id) => makeNode(id));
    const positions = resolveLayout(nodes, [], grid({ alignment: 'center', columns: 4 }));
    expect(positions.get('e')![0]).toBeGreaterThan(0);
  });

  it('alignment: right → rows right-aligned', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e'].map((id) => makeNode(id));
    const positions = resolveLayout(nodes, [], grid({ alignment: 'right', columns: 4 }));
    expect(positions.get('e')![0]).toBeGreaterThan(positions.get('a')![0]);
  });

  it('alignment: fill → nodes spread to widest row width', () => {
    const nodes = ['a', 'b', 'c'].map((id) => makeNode(id));
    const positions = resolveLayout(nodes, [], grid({ alignment: 'fill', columns: 3 }));
    const xs = nodes.map((n) => positions.get(n.id)![0]);
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeGreaterThan(0);
  });

  it('alignment: fill with single node per row → node centered', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e'].map((id) => makeNode(id));
    const positions = resolveLayout(nodes, [], grid({ alignment: 'fill', columns: 4 }));
    expect(positions.get('e')![0]).toBeGreaterThan(0);
  });

  it('disconnected: after → connected nodes first, disconnected appended', () => {
    const nodes = [makeNode('a'), makeNode('c'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    const positions = resolveLayout(nodes, edges, grid({ disconnected: 'after' }));
    expect(positions.get('b')![0]).toBeLessThan(positions.get('c')![0]);
  });

  it('disconnected: next-to → declaration order preserved', () => {
    const nodes = [makeNode('a'), makeNode('c'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    const positions = resolveLayout(nodes, edges, grid({ disconnected: 'next-to' }));
    expect(positions.get('c')![0]).toBeLessThan(positions.get('b')![0]);
  });
});

describe('resolveLayout — hierarchical', () => {
  it('direction: left-right → depth on X axis, levels on Y axis', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    const positions = resolveLayout(nodes, edges, hierarchical({ direction: 'left-right' }));
    expect(positions.get('b')![0]).toBeGreaterThan(positions.get('a')![0]);
  });

  it('alignment: left → all levels left-aligned', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const positions = resolveLayout(nodes, [], hierarchical({ alignment: 'left' }));
    expect(Math.min(positions.get('a')![0], positions.get('b')![0])).toBeLessThan(0);
  });

  it('alignment: right → all levels right-aligned', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const positions = resolveLayout(nodes, [], hierarchical({ alignment: 'right' }));
    expect(Math.max(positions.get('a')![0], positions.get('b')![0])).toBeGreaterThan(0);
  });

  it('alignment: fill → nodes spread to widest level', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const positions = resolveLayout(nodes, [], hierarchical({ alignment: 'fill' }));
    const xs = nodes.map((n) => positions.get(n.id)![0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0);
  });

  it('disconnected: after → disconnected nodes at maxLevel + 1', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('a', 'b')];
    const positions = resolveLayout(nodes, edges, hierarchical({ disconnected: 'after' }));
    expect(positions.get('c')![1]).toBeLessThan(positions.get('b')![1]);
  });

  it('disconnected: next-to → disconnected nodes at level 0 (current behavior)', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('a', 'b')];
    const positions = resolveLayout(nodes, edges, hierarchical({ disconnected: 'next-to' }));
    expect(positions.get('c')![1]).toBeCloseTo(positions.get('a')![1]);
  });

  it('margin: [0.5, 0.5] → level spacing accounts for margin', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    const positions = resolveLayout(nodes, edges, hierarchical({ margin: [0.5, 0.5] }));
    const dy = Math.abs(positions.get('a')![1] - positions.get('b')![1]);
    expect(dy).toBeGreaterThan(2);
  });
});

const makeGroup = (id: string, nodeIds: string[], overrides: Partial<DiagramGroupDSL> = {}): DiagramGroupDSL => ({
  id,
  label: id,
  nodeIds,
  ...overrides,
});

const makeSize = (nodes: DiagramNodeDSL[], w = 4, h = 2): Map<string, readonly [number, number]> =>
  new Map(nodes.map((n) => [n.id, [w, h] as const]));

const resolveWithGroups = (
  nodes: DiagramNodeDSL[],
  edges: DiagramEdgeDSL[],
  groups: DiagramGroupDSL[],
  rootLayout: ResolvedGridLayout | ResolvedHierarchicalLayout | ResolvedManualLayout,
  sizes: Map<string, readonly [number, number] | readonly [number, number, number]>,
): Map<string, readonly [number, number, number]> => {
  const groupLayouts = resolveGroupLayouts(groups, rootLayout);
  return resolveLayoutWithGroups(nodes, edges, groups, rootLayout, groupLayouts, sizes);
};

describe('resolveLayoutWithGroups', () => {
  it('treats auto groups as top-level layout blocks', () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id) => makeNode(id));
    const groups = [
      makeGroup('g1', ['a', 'b']),
      makeGroup('g2', ['c', 'd']),
    ];
    const sizes = makeSize(nodes);
    const positions = resolveWithGroups(nodes, [], groups, grid(), sizes);
    const bounds1 = computeBounds(groups[0].nodeIds, positions, sizes);
    const bounds2 = computeBounds(groups[1].nodeIds, positions, sizes);
    expect(bounds2.x).toBeGreaterThan(bounds1.x + bounds1.w);
  });

  it('positions all nodes — including nodes in nested groups', () => {
    // Parent group g1 contains child group g1a (with nodes a, b) and direct node c.
    // All three nodes should receive computed positions.
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const sizes = makeSize(nodes);
    const groups = [
      makeGroup('g1', ['c'], { childGroupIds: ['g1a'] }),
      makeGroup('g1a', ['a', 'b'], { parentId: 'g1' }),
    ];
    const positions = resolveWithGroups(nodes, [], groups, grid(), sizes);
    expect(positions.has('a')).toBe(true);
    expect(positions.has('b')).toBe(true);
    expect(positions.has('c')).toBe(true);
  });

  it('keeps nested group nodes inside their parent group bounds', () => {
    // g1 contains g1a (nodes a, b) and g1b (nodes c, d).
    // g2 contains nodes e, f.
    // After layout, all of a,b,c,d should be inside g1's bounding box,
    // and e,f should be inside g2's bounding box.
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => makeNode(id));
    const sizes = makeSize(nodes);
    const groups = [
      makeGroup('g1', [], { childGroupIds: ['g1a', 'g1b'] }),
      makeGroup('g1a', ['a', 'b'], { parentId: 'g1' }),
      makeGroup('g1b', ['c', 'd'], { parentId: 'g1' }),
      makeGroup('g2', ['e', 'f']),
    ];
    const positions = resolveWithGroups(nodes, [], groups, grid(), sizes);

    const g1Bounds = computeBounds(['a', 'b', 'c', 'd'], positions, sizes);
    const g2Bounds = computeBounds(['e', 'f'], positions, sizes);

    // The two top-level groups should not overlap.
    const g1Right = g1Bounds.x + g1Bounds.w;
    const g2Right = g2Bounds.x + g2Bounds.w;
    const overlapX =
      Math.min(g1Right, g2Right) - Math.max(g1Bounds.x, g2Bounds.x);
    expect(overlapX).toBeLessThanOrEqual(0);
  });

  it('preserves explicit node positions inside nested groups', () => {
    const explicitPos: [number, number, number] = [99, 55, 0];
    const nodes = [makeNode('a', { position: explicitPos }), makeNode('b')];
    const sizes = makeSize(nodes);
    const groups = [
      makeGroup('g1', [], { childGroupIds: ['g1a'] }),
      makeGroup('g1a', ['a', 'b'], { parentId: 'g1' }),
    ];
    const positions = resolveWithGroups(nodes, [], groups, grid(), sizes);
    expect(positions.get('a')).toEqual(explicitPos);
    expect(positions.get('b')).toBeDefined();
  });

  it('per-group layout: grid group places nodes in a grid regardless of diagram-level hierarchical', () => {
    // Diagram layout is hierarchical. Group g1 overrides to grid.
    // With grid layout, nodes are placed in rows; in hierarchical they'd be placed
    // on Y-level bands driven by edges. Grid should place both nodes on the SAME row (Y=0).
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    const sizes = makeSize(nodes);
    const groups = [makeGroup('g1', ['a', 'b'], { layout: { kind: 'grid' } })];
    const positions = resolveWithGroups(nodes, edges, groups, hierarchical(), sizes);
    const yA = positions.get('a')![1];
    const yB = positions.get('b')![1];
    // Grid layout puts both in row 0; hierarchical would give different Y levels.
    expect(yA).toBeCloseTo(yB);
  });

  it('per-group hierarchical layout: downstream nodes are placed below upstream nodes', () => {
    // Diagram layout is grid. Group g1 overrides to hierarchical.
    // Edge a→b means b should have a lower Y than a.
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];
    const sizes = makeSize(nodes);
    const groups = [makeGroup('g1', ['a', 'b', 'c'], { layout: { kind: 'hierarchical' } })];
    const positions = resolveWithGroups(nodes, edges, groups, grid(), sizes);
    const yA = positions.get('a')![1];
    const yB = positions.get('b')![1];
    const yC = positions.get('c')![1];
    expect(yB).toBeLessThan(yA);
    expect(yC).toBeLessThan(yB);
  });

  it('per-group layoutSpacing: larger spacing produces wider node separation inside a group', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const sizes = makeSize(nodes);

    const groupsTight = [makeGroup('g1', ['a', 'b'], { layout: { kind: 'grid', spacing: [1, 1] } })];
    const groupsWide = [makeGroup('g1', ['a', 'b'], { layout: { kind: 'grid', spacing: [20, 20] } })];

    const positionsTight = resolveWithGroups(nodes, [], groupsTight, grid(), sizes);
    const positionsWide = resolveWithGroups(nodes, [], groupsWide, grid(), sizes);

    const dxTight = Math.abs(positionsTight.get('a')![0] - positionsTight.get('b')![0]);
    const dxWide = Math.abs(positionsWide.get('a')![0] - positionsWide.get('b')![0]);
    expect(dxWide).toBeGreaterThan(dxTight);
  });

  it('cross-group edges do not affect internal group layout', () => {
    // Edge from a (in g1) to c (in g2) should not influence g1's internal layout.
    // g1 has nodes a and b with an intra-group edge a→b (hierarchical should apply).
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [
      makeEdge('a', 'b'), // intra-group: should drive hierarchical layout inside g1
      makeEdge('a', 'c'), // cross-group: must NOT affect g1's internal layout
    ];
    const sizes = makeSize(nodes);
    const groups = [
      makeGroup('g1', ['a', 'b'], { layout: { kind: 'hierarchical' } }),
      makeGroup('g2', ['c']),
    ];
    const positions = resolveWithGroups(nodes, edges, groups, grid(), sizes);
    // Hierarchical inside g1: b should be below a because of the a→b edge.
    expect(positions.get('b')![1]).toBeLessThan(positions.get('a')![1]);
  });

  it('two levels of nesting: grandparent > parent > leaf nodes all receive positions', () => {
    const nodes = ['x', 'y', 'z', 'w'].map((id) => makeNode(id));
    const sizes = makeSize(nodes);
    const groups = [
      makeGroup('grandparent', [], { childGroupIds: ['parent'] }),
      makeGroup('parent', ['z', 'w'], { parentId: 'grandparent', childGroupIds: ['leaf'] }),
      makeGroup('leaf', ['x', 'y'], { parentId: 'parent' }),
    ];
    const positions = resolveWithGroups(nodes, [], groups, grid(), sizes);
    ['x', 'y', 'z', 'w'].forEach((id) => {
      expect(positions.has(id)).toBe(true);
    });
    // All four nodes should have unique positions.
    const posStrings = new Set(
      ['x', 'y', 'z', 'w'].map((id) => JSON.stringify(positions.get(id))),
    );
    expect(posStrings.size).toBe(4);
  });

  it('all-explicit: preserves exact diagram-space positions through nested groups', () => {
    // This mirrors the scene_llm_filter pattern: a parent container group (filters)
    // with child groups (console, input-filters, output-filters) where every node
    // has an explicit position. The final positions must be identical to the input
    // positions — no coordinate system shift should occur.
    const consoleNodes = [
      makeNode('con-a', { position: [-20, -6.5, 0] as [number, number, number] }),
      makeNode('con-b', { position: [-15, -6.5, 0] as [number, number, number] }),
    ];
    const filterNodes = [
      makeNode('if-a', { position: [0, -6.5, 0] as [number, number, number] }),
      makeNode('if-b', { position: [5, -6.5, 0] as [number, number, number] }),
    ];
    const allNodes = [...consoleNodes, ...filterNodes];
    const sizes = makeSize(allNodes);

    const groups = [
      makeGroup('filters', [], { childGroupIds: ['console', 'input-filters'] }),
      makeGroup('console', ['con-a', 'con-b'], { parentId: 'filters' }),
      makeGroup('input-filters', ['if-a', 'if-b'], { parentId: 'filters' }),
    ];

    const positions = resolveWithGroups(allNodes, [], groups, hierarchical(), sizes);

    // Every node must land at its declared explicit position.
    expect(positions.get('con-a')).toEqual([-20, -6.5, 0]);
    expect(positions.get('con-b')).toEqual([-15, -6.5, 0]);
    expect(positions.get('if-a')).toEqual([0, -6.5, 0]);
    expect(positions.get('if-b')).toEqual([5, -6.5, 0]);
  });

  it('all-explicit: ungrouped explicit nodes retain their positions alongside grouped nodes', () => {
    // Some nodes are in groups (explicit positions), others are ungrouped (also explicit).
    // All should keep their declared positions.
    const nodes = [
      makeNode('a', { position: [-10, 0, 0] as [number, number, number] }),
      makeNode('b', { position: [-5, 0, 0] as [number, number, number] }),
      makeNode('api', { position: [0, -3, 0] as [number, number, number] }), // ungrouped
    ];
    const sizes = makeSize(nodes);
    const groups = [makeGroup('g1', ['a', 'b'])];

    const positions = resolveWithGroups(nodes, [], groups, hierarchical(), sizes);
    expect(positions.get('a')).toEqual([-10, 0, 0]);
    expect(positions.get('b')).toEqual([-5, 0, 0]);
    expect(positions.get('api')).toEqual([0, -3, 0]);
  });

  it('ungrouped nodes and grouped nodes coexist without collision', () => {
    // Nodes a,b are in a group. Node c is ungrouped.
    // After layout, the group block and node c should not overlap.
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const sizes = makeSize(nodes);
    const groups = [makeGroup('g1', ['a', 'b'])];
    const positions = resolveWithGroups(nodes, [], groups, grid(), sizes);

    const groupBounds = computeBounds(['a', 'b'], positions, sizes);
    const posC = positions.get('c')!;
    const nodeW = 4;
    const nodeH = 2;
    const cLeft = posC[0] - nodeW / 2;
    const cRight = posC[0] + nodeW / 2;
    const overlapX =
      Math.min(groupBounds.x + groupBounds.w, cRight) -
      Math.max(groupBounds.x, cLeft);
    expect(overlapX).toBeLessThanOrEqual(0);
  });

  // ── Group IDs as edge endpoints ─────────────────────────────────────────────

  it('edge from ungrouped node to group ID places group below source node in hierarchical', () => {
    // Edge from="src" to="g1" where g1 is a top-level group id, not a node id.
    // In hierarchical layout the group synthetic block should be placed at a lower Y
    // than the source node (lower Y = further downstream).
    const nodes = [makeNode('src'), makeNode('a'), makeNode('b')];
    const sizes = makeSize(nodes);
    const groups = [makeGroup('g1', ['a', 'b'])];
    const edges = [makeEdge('src', 'g1')];
    const positions = resolveWithGroups(nodes, edges, groups, hierarchical(), sizes);

    const ySrc = positions.get('src')![1];
    // The group g1 center is the mean of its members' Y values.
    const yA = positions.get('a')![1];
    const yB = positions.get('b')![1];
    const yG1 = (yA + yB) / 2;
    // g1 must be at a strictly lower Y level than src.
    expect(yG1).toBeLessThan(ySrc);
  });

  it('edge from group ID to group ID drives hierarchical ordering between groups', () => {
    // Edge from="g1" to="g2": g2 (and all its members) must be placed below g1.
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const sizes = makeSize(nodes);
    const groups = [
      makeGroup('g1', ['a', 'b']),
      makeGroup('g2', ['c', 'd']),
    ];
    const edges = [makeEdge('g1', 'g2')];
    const positions = resolveWithGroups(nodes, edges, groups, hierarchical(), sizes);

    const yG1 = ((positions.get('a')![1] + positions.get('b')![1]) / 2);
    const yG2 = ((positions.get('c')![1] + positions.get('d')![1]) / 2);
    // g2 is downstream of g1 so it must have a lower Y.
    expect(yG2).toBeLessThan(yG1);
  });

  it('edge from ungrouped node to a nested group id routes through the top-level group', () => {
    // inner-group is a nested child of outer-group.
    // Edge from="src" to="inner-group" should route to outer-group's synthetic block
    // and place outer-group below src in hierarchical layout.
    const nodes = [makeNode('src'), makeNode('a'), makeNode('b')];
    const sizes = makeSize(nodes);
    const groups = [
      makeGroup('outer-group', [], { childGroupIds: ['inner-group'] }),
      makeGroup('inner-group', ['a', 'b'], { parentId: 'outer-group' }),
    ];
    const edges = [makeEdge('src', 'inner-group')];
    const positions = resolveWithGroups(nodes, edges, groups, hierarchical(), sizes);

    const ySrc = positions.get('src')![1];
    const yA = positions.get('a')![1];
    const yB = positions.get('b')![1];
    const yGroup = (yA + yB) / 2;
    // outer-group (and its nested nodes) should be placed below src.
    expect(yGroup).toBeLessThan(ySrc);
  });

  it('chain of edges through group IDs produces correct hierarchical ordering', () => {
    // src → g1 → g2 → sink: groups should be placed in depth order.
    const nodes = [makeNode('src'), makeNode('sink'), makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const sizes = makeSize(nodes);
    const groups = [
      makeGroup('g1', ['a', 'b']),
      makeGroup('g2', ['c', 'd']),
    ];
    const edges = [
      makeEdge('src', 'g1'),
      makeEdge('g1', 'g2'),
      makeEdge('g2', 'sink'),
    ];
    const positions = resolveWithGroups(nodes, edges, groups, hierarchical(), sizes);

    const ySrc = positions.get('src')![1];
    const yG1 = (positions.get('a')![1] + positions.get('b')![1]) / 2;
    const yG2 = (positions.get('c')![1] + positions.get('d')![1]) / 2;
    const ySink = positions.get('sink')![1];

    // Hierarchical order: src > g1 > g2 > sink (decreasing Y).
    expect(yG1).toBeLessThan(ySrc);
    expect(yG2).toBeLessThan(yG1);
    expect(ySink).toBeLessThan(yG2);
  });
});

describe('resolveGroupBoundsMap', () => {
  it('groupPadding: 2 → uniform 2 on all sides', () => {
    const nodes = [makeNode('a', { position: [0, 0, 0] })];
    const sizes = makeSize(nodes);
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const groups = [makeGroup('g1', ['a'], { layout: { kind: 'grid', groupPadding: 2 } })];
    const groupLayouts = resolveGroupLayouts(groups, grid());
    const bounds = resolveGroupBoundsMap(groups, positions, sizes, groupLayouts).get('g1')!;
    expect(bounds.padding).toEqual([2, 2, 2, 2]);
    expect(bounds.x).toBe(-4);
    expect(bounds.y).toBe(-3);
    expect(bounds.w).toBe(8);
    expect(bounds.h).toBe(6);
  });

  it('groupPadding: [1, 2] → top/bottom=1, left/right=2', () => {
    const nodes = [makeNode('a', { position: [0, 0, 0] })];
    const sizes = makeSize(nodes);
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const groups = [makeGroup('g1', ['a'], { layout: { kind: 'grid', groupPadding: [1, 2] } })];
    const groupLayouts = resolveGroupLayouts(groups, grid());
    const bounds = resolveGroupBoundsMap(groups, positions, sizes, groupLayouts).get('g1')!;
    expect(bounds.padding).toEqual([1, 2, 1, 2]);
    expect(bounds.x).toBe(-4);
    expect(bounds.y).toBe(-2);
    expect(bounds.w).toBe(8);
    expect(bounds.h).toBe(4);
  });

  it('groupPadding: [1, 2, 3, 4] → explicit per-side padding', () => {
    const nodes = [makeNode('a', { position: [0, 0, 0] })];
    const sizes = makeSize(nodes);
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const groups = [makeGroup('g1', ['a'], { layout: { kind: 'grid', groupPadding: [1, 2, 3, 4] } })];
    const groupLayouts = resolveGroupLayouts(groups, grid());
    const bounds = resolveGroupBoundsMap(groups, positions, sizes, groupLayouts).get('g1')!;
    expect(bounds.padding).toEqual([1, 2, 3, 4]);
    expect(bounds.x).toBe(-6);
    expect(bounds.y).toBe(-4);
    expect(bounds.w).toBe(10);
    expect(bounds.h).toBe(6);
  });

  it('titleGap propagates to GroupBounds.titleGap', () => {
    const nodes = [makeNode('a', { position: [0, 0, 0] })];
    const sizes = makeSize(nodes);
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const groups = [makeGroup('g1', ['a'], { layout: { kind: 'grid', titleGap: 0.9 } })];
    const groupLayouts = resolveGroupLayouts(groups, grid());
    const bounds = resolveGroupBoundsMap(groups, positions, sizes, groupLayouts).get('g1')!;
    expect(bounds.titleGap).toBe(0.9);
  });

  it('bounds.padding is [top, right, bottom, left] tuple', () => {
    const nodes = [makeNode('a', { position: [0, 0, 0] })];
    const sizes = makeSize(nodes);
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const groups = [makeGroup('g1', ['a'], { layout: { kind: 'grid', groupPadding: [1, 2, 3, 4] } })];
    const groupLayouts = resolveGroupLayouts(groups, grid());
    const bounds = resolveGroupBoundsMap(groups, positions, sizes, groupLayouts).get('g1')!;
    expect(bounds.padding).toEqual([1, 2, 3, 4]);
  });
});

describe('resolveLayoutWithGroups — connection affinity', () => {
  it('ungrouped node A connecting to sub-nodes B+C inside group G is centered over B+C centroid, not G center', () => {
    const nodes = [
      makeNode('a'),
      makeNode('b', { position: [0, 0, 0] as [number, number, number] }),
      makeNode('c', { position: [1, 0, 0] as [number, number, number] }),
      makeNode('d', { position: [4, 0, 0] as [number, number, number] }),
    ];
    const sizes = makeSize(nodes);
    const groups = [makeGroup('g1', ['b', 'c', 'd'])];
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c')];

    const positions = resolveWithGroups(nodes, edges, groups, hierarchical(), sizes);
    const groupBounds = computeBounds(['b', 'c', 'd'], positions, sizes);
    const groupCenterX = groupBounds.x + groupBounds.w / 2;
    const expected = (positions.get('b')![0] + positions.get('c')![0]) / 2;

    expect(positions.get('a')![0]).toBeCloseTo(expected);
    expect(positions.get('a')![0]).not.toBeCloseTo(groupCenterX);
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
