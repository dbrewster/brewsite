import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveLayout,
  computeBounds,
  routeEdges,
  compileDiagram,
} from '../compile';
import type { DiagramDSL, DiagramNodeDSL, DiagramEdgeDSL } from '../types';

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

  it('hierarchical: places source nodes above target nodes on Y axis', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    const positions = resolveLayout(nodes, edges, 'hierarchical', [2, 2]);
    const yA = positions.get('a')![1];
    const yB = positions.get('b')![1];
    expect(yA).toBeGreaterThan(yB);
  });

  it('manual: throws when a node has no explicit position', () => {
    const nodes = [makeNode('a')];
    expect(() => resolveLayout(nodes, [], 'manual', [2, 2])).toThrow();
  });

  it('grid: respects layoutSpacing parameter', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const positions = resolveLayout(nodes, [], 'grid', [10, 10]);
    const posA = positions.get('a')!;
    const posB = positions.get('b')!;
    expect(Math.abs(posA[0] - posB[0])).toBeGreaterThanOrEqual(10);
  });
});

describe('computeBounds', () => {
  it('computes correct bounding box for a 2x2 grid of nodes', () => {
    const positions = new Map<string, readonly [number, number, number]>([
      ['a', [0, 0, 0]],
      ['b', [4, 0, 0]],
      ['c', [0, -4, 0]],
      ['d', [4, -4, 0]],
    ]);
    const sizes = new Map<string, readonly [number, number]>([
      ['a', [2, 2]],
      ['b', [2, 2]],
      ['c', [2, 2]],
      ['d', [2, 2]],
    ]);
    const bounds = computeBounds(['a', 'b', 'c', 'd'], positions, sizes);
    expect(bounds.x).toBe(-1);
    expect(bounds.y).toBe(-5);
    expect(bounds.w).toBe(6);
    expect(bounds.h).toBe(6);
  });

  it('handles a single node', () => {
    const positions = new Map([['a', [2, 3, 1] as const]]);
    const sizes = new Map([['a', [4, 2] as const]]);
    const bounds = computeBounds(['a'], positions, sizes);
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(2);
    expect(bounds.w).toBe(4);
    expect(bounds.h).toBe(2);
  });

  it('handles nodes at negative coordinates', () => {
    const positions = new Map([['a', [-4, -2, -1] as const]]);
    const sizes = new Map([['a', [2, 2] as const]]);
    const bounds = computeBounds(['a'], positions, sizes);
    expect(bounds.x).toBe(-5);
    expect(bounds.y).toBe(-3);
  });

  it('includes node size in bounds (not just center point)', () => {
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const sizes = new Map([['a', [6, 4] as const]]);
    const bounds = computeBounds(['a'], positions, sizes);
    expect(bounds.w).toBe(6);
    expect(bounds.h).toBe(4);
  });
});

describe('routeEdges', () => {
  it('produces at least 2 control points per edge', () => {
    const positions = new Map([
      ['a', [0, 0, 0] as const],
      ['b', [5, 0, 0] as const],
    ]);
    const sizes = new Map([
      ['a', [4, 2, 1] as const],
      ['b', [4, 2, 1] as const],
    ]);
    const points = routeEdges([makeEdge('a', 'b')], positions, sizes);
    expect(points.get('a-b-0')!.length).toBeGreaterThanOrEqual(2);
  });

  it('start point is on the source node face surface (z-offset from face center)', () => {
    const positions = new Map([
      ['a', [0, 0, 0] as const],
      ['b', [10, 0, 0] as const],
    ]);
    const sizes = new Map([
      ['a', [4, 2, 1] as const],
      ['b', [4, 2, 1] as const],
    ]);
    const points = routeEdges([makeEdge('a', 'b')], positions, sizes).get('a-b-0')!;
    expect(points[0][0]).toBeCloseTo(2.1, 5);
  });

  it('end point is on the destination node face surface', () => {
    const positions = new Map([
      ['a', [0, 0, 0] as const],
      ['b', [10, 0, 0] as const],
    ]);
    const sizes = new Map([
      ['a', [4, 2, 1] as const],
      ['b', [4, 2, 1] as const],
    ]);
    const points = routeEdges([makeEdge('a', 'b')], positions, sizes).get('a-b-0')!;
    expect(points[points.length - 1][0]).toBeCloseTo(7.9, 5);
  });

  it('handles self-loops gracefully (from === to): returns empty control points array', () => {
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const sizes = new Map([['a', [4, 2, 1] as const]]);
    const points = routeEdges([makeEdge('a', 'a')], positions, sizes);
    expect(points.get('a-a-0')).toEqual([]);
  });

  it('handles missing node IDs gracefully: logs warning, returns straight line', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const sizes = new Map([['a', [4, 2, 1] as const]]);
    const points = routeEdges([makeEdge('a', 'b')], positions, sizes).get('a-b-0')!;
    expect(warnSpy).toHaveBeenCalled();
    expect(points.length).toBe(2);
    warnSpy.mockRestore();
  });
});

describe('compileDiagram', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies NODE_DEFAULTS to nodes with no explicit values', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    const node = state.nodes[0]!;
    expect(node.size).toEqual([4, 2]);
    expect(node.depth).toBe(0.6);
    expect(node.color).toBe('#2a2d3e');
  });

  it('resolves iconUrl from iconRegistry for aws:ec2 shape', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [makeNode('a', { shape: 'aws:ec2' })],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.nodes[0]!.iconUrl).toBe('/assets/shapes/aws/ec2.svg');
  });

  it('does not set iconUrl for flow:rect shape', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [makeNode('a', { shape: 'flow:rect' })],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.nodes[0]!.iconUrl).toBeUndefined();
  });

  it('compiles a 3-node, 2-edge diagram without throwing', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
      edges: [makeEdge('a', 'b'), makeEdge('b', 'c')],
      groups: [],
    };
    expect(() => compileDiagram(dsl)).not.toThrow();
  });

  it('groups have computed bounds that contain all member nodes', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [
        makeNode('a', { position: [0, 0, 0] }),
        makeNode('b', { position: [4, 0, 0] }),
      ],
      edges: [],
      groups: [
        {
          id: 'group-1',
          label: 'Group',
          nodeIds: ['a', 'b'],
        },
      ],
    };
    const state = compileDiagram(dsl);
    const group = state.groups[0]!;
    expect(group.bounds.w).toBeGreaterThan(4);
    expect(group.bounds.h).toBeGreaterThan(0);
  });

  it('edges in compiled output reference valid fromId/toId from nodes list', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [makeNode('a'), makeNode('b')],
      edges: [makeEdge('a', 'b')],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.edges[0]!.fromId).toBe('a');
    expect(state.edges[0]!.toId).toBe('b');
  });

  it('auto-generates edge id from from-to when id prop is omitted', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [makeNode('a'), makeNode('b')],
      edges: [makeEdge('a', 'b')],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.edges[0]!.id).toBe('a-b-0');
  });
});

describe('pivot offset', () => {
  it("'center' pivot: bounds center maps to [0, 0]", () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'manual',
      layoutSpacing: [2, 2],
      pivot: 'center',
      nodes: [
        makeNode('a', { position: [0, 0, 0] }),
        makeNode('b', { position: [10, 0, 0] }),
      ],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.bounds.x + state.bounds.w / 2).toBeCloseTo(0);
    expect(state.bounds.y + state.bounds.h / 2).toBeCloseTo(0);
  });

  it("'top-left' pivot: top-left corner maps to [0, 0]", () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'manual',
      layoutSpacing: [2, 2],
      pivot: 'top-left',
      nodes: [
        makeNode('a', { position: [0, 0, 0] }),
        makeNode('b', { position: [10, -10, 0] }),
      ],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.bounds.x).toBeCloseTo(0);
    expect(state.bounds.y + state.bounds.h).toBeCloseTo(0);
  });

  it('pivot offset is applied before edge routing', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'manual',
      layoutSpacing: [2, 2],
      pivot: 'center',
      nodes: [
        makeNode('a', { position: [0, 0, 0] }),
        makeNode('b', { position: [10, 0, 0] }),
      ],
      edges: [makeEdge('a', 'b')],
      groups: [],
    };
    const state = compileDiagram(dsl);
    const startX = state.edges[0]!.controlPoints[0]![0];
    expect(startX).toBeCloseTo(-2.9, 2);
  });
});

describe('exit / enter config compilation', () => {
  it('compileExitConfig returns null when no <Exit> in DSL', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.exit).toBeNull();
  });

  it('compileExitConfig applies defaults (fade=true, easing=ease)', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
      exit: {},
    };
    const state = compileDiagram(dsl);
    expect(state.exit?.fade).toBe(true);
    expect(state.exit?.easing).toBe('ease');
  });

  it('compileEnterConfig applies defaults (fade=true, easing=ease)', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
      enter: {},
    };
    const state = compileDiagram(dsl);
    expect(state.enter?.fade).toBe(true);
    expect(state.enter?.easing).toBe('ease');
  });
});

describe('DiagramState transform fields', () => {
  it('position defaults to [0,0,0]', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.position).toEqual([0, 0, 0]);
  });

  it('scale defaults to 1', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.scale).toBe(1);
  });

  it('position/rotation/scale from DSL are passed through unchanged', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: 'grid',
      layoutSpacing: [2, 2],
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      scale: 2,
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.position).toEqual([1, 2, 3]);
    expect(state.rotation).toEqual([0.1, 0.2, 0.3]);
    expect(state.scale).toBe(2);
  });
});
