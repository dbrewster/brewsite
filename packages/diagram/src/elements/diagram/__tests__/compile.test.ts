import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  routeEdges,
  compileDiagram,
} from '../compile';
import type { DiagramDSL, DiagramNodeDSL, DiagramEdgeDSL, DiagramTheme } from '../types';
import { darkGlassTheme } from '../themes/darkGlass';

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
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    const node = state.nodes[0]!;
    expect(node.size).toEqual([4, 2]);
    expect(node.depth).toBe(darkGlassTheme.node.defaultDepth);
    expect(node.color).toBe(darkGlassTheme.node.defaultColor);
  });

  it('resolves iconUrl from iconRegistry for aws:ec2 shape', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
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
      layout: { kind: 'grid' },
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
      layout: { kind: 'grid' },
      nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
      edges: [makeEdge('a', 'b'), makeEdge('b', 'c')],
      groups: [],
    };
    expect(() => compileDiagram(dsl)).not.toThrow();
  });

  it('uses theme layout defaults when diagram DSL omits layout', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      layout: {
        ...darkGlassTheme.layout,
        defaultKind: 'hierarchical',
        hierarchical: {
          ...darkGlassTheme.layout?.hierarchical,
          spacing: [4, 4],
        },
      },
    };
    const dsl: DiagramDSL = {
      id: 'diagram',
      nodes: [makeNode('a'), makeNode('b')],
      edges: [makeEdge('a', 'b')],
      groups: [],
    };
    const state = compileDiagram(dsl, theme);
    const posA = state.nodes.find((n) => n.id === 'a')!.position;
    const posB = state.nodes.find((n) => n.id === 'b')!.position;
    expect(posB[1]).toBeLessThan(posA[1]);
  });

  it('groups have computed bounds that contain all member nodes', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
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

  it('applies group border width default from theme', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [{ id: 'group-1', nodeIds: ['a'] }],
    };
    const state = compileDiagram(dsl);
    expect(state.groups[0]?.borderWidth).toBe(darkGlassTheme.group.defaultBorderWidth);
    expect(state.groups[0]?.borderHeight).toBe(darkGlassTheme.group.defaultBorderHeight);
  });

  it('routes edges to the group border centerline (not inner fill or outer edge)', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      nodes: [
        makeNode('src', { position: [-20, 0, 0], size: [2, 2] }),
        makeNode('a', { position: [0, 0, 0], size: [4, 2] }),
      ],
      edges: [makeEdge('src', 'g1')],
      groups: [{ id: 'g1', nodeIds: ['a'] }],
    };
    const state = compileDiagram(dsl);
    const group = state.groups.find((g) => g.id === 'g1')!;
    const edge = state.edges[0]!;
    const end = edge.controlPoints[edge.controlPoints.length - 1]!;

    const borderWidthUnits = darkGlassTheme.group.defaultBorderWidth * 0.4;
    const expectedX = group.bounds.x - borderWidthUnits / 2 - 0.1; // left border-centerline + EDGE_EPSILON outwards
    expect(end[0]).toBeCloseTo(expectedX, 3);
  });

  it('edges in compiled output reference valid fromId/toId from nodes list', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
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
      layout: { kind: 'grid' },
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
      layout: { kind: 'manual' },
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
      layout: { kind: 'manual' },
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
      layout: { kind: 'manual' },
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
      layout: { kind: 'grid' },
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
      layout: { kind: 'grid' },
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
      layout: { kind: 'grid' },
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
      layout: { kind: 'grid' },
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
      layout: { kind: 'grid' },
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
      layout: { kind: 'grid' },
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
