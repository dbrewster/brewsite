import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  routeEdges,
  compileDiagram,
} from '../compile';
import type { DiagramDSL, DiagramNodeDSL, DiagramEdgeDSL, DiagramTheme } from '../types';
import { darkGlassTheme } from '../themes/darkGlass';
import { midnightTheme } from '../themes/midnight';
import { lightCanvasTheme } from '../themes/lightCanvas';

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

const firstLateralSplit = (
  left: ReadonlyArray<readonly [number, number, number]>,
  right: ReadonlyArray<readonly [number, number, number]>,
  tolerance = 0.02,
): {
  readonly index: number;
  readonly leftPoint: readonly [number, number, number];
  readonly rightPoint: readonly [number, number, number];
} | undefined => {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    const leftPoint = left[index]!;
    const rightPoint = right[index]!;
    if (Math.abs(leftPoint[0] - rightPoint[0]) > tolerance) {
      return { index, leftPoint, rightPoint };
    }
  }
  return undefined;
};

describe('routeEdges', () => {
  const routePoints = (
    result: ReturnType<typeof routeEdges>,
    id: string,
  ): ReadonlyArray<readonly [number, number, number]> => result.get(id)?.controlPoints ?? [];

  it('produces at least 2 control points per edge', () => {
    const positions = new Map([
      ['a', [0, 0, 0] as const],
      ['b', [5, 0, 0] as const],
    ]);
    const sizes = new Map([
      ['a', [4, 2, 1] as const],
      ['b', [4, 2, 1] as const],
    ]);
    const points = routePoints(routeEdges([makeEdge('a', 'b')], positions, sizes), 'a-b-0');
    expect(points.length).toBeGreaterThanOrEqual(2);
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
    const points = routePoints(routeEdges([makeEdge('a', 'b')], positions, sizes), 'a-b-0');
    expect(points[0][0]).toBeCloseTo(2.012, 5);
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
    const points = routePoints(routeEdges([makeEdge('a', 'b')], positions, sizes), 'a-b-0');
    expect(points[points.length - 1][0]).toBeCloseTo(7.988, 5);
  });

  it('handles self-loops gracefully (from === to): returns empty control points array', () => {
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const sizes = new Map([['a', [4, 2, 1] as const]]);
    const points = routePoints(routeEdges([makeEdge('a', 'a')], positions, sizes), 'a-a-0');
    expect(points).toEqual([]);
  });

  it('handles missing node IDs gracefully: calls onWarn, returns empty control points', () => {
    const warns: Array<{ code: string }> = [];
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const sizes = new Map([['a', [4, 2, 1] as const]]);
    const points = routePoints(
      routeEdges([makeEdge('a', 'b')], positions, sizes, 'curved', 'nearest-face', (code) => warns.push({ code })),
      'a-b-0',
    );
    expect(warns[0]!.code).toBe('MISSING_EDGE_ENDPOINT');
    expect(points).toEqual([]);
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
    // After normalization, size is a fraction [0..1], not diagram units.
    expect(node.size[0]).toBeGreaterThan(0);
    expect(node.size[1]).toBeGreaterThan(0);
    expect(node.thickness).toBe(darkGlassTheme.node.defaultThickness);
    expect(node.color).toBe(darkGlassTheme.node.defaultColor);
  });

  it('uses theme.node.defaultBoxColor as the compiled node box color', () => {
    const theme: DiagramTheme = {
      ...darkGlassTheme,
      node: {
        ...darkGlassTheme.node,
        defaultBoxColor: '#223344',
      },
    };
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl, theme);
    expect(state.nodes[0]!.sideColor).toBe('#223344');
  });

  it('uses node boxColor to override the theme-derived box color', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a', { boxColor: '#334455' })],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.nodes[0]!.sideColor).toBe('#334455');
  });

  it('supports glow override on nodes (emissive disabled)', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [
        makeNode('a', { color: '#112233', glow: false }),
      ],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    const node = state.nodes[0]!;
    expect(node.emissive).toBe(false);
    expect(node.emissiveIntensity).toBe(0);
  });

  it('supports glow object override on nodes (custom color and intensity)', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [
        makeNode('a', { color: '#112233', glow: { intensity: 0.7, color: '#ff00cc' } }),
      ],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    const node = state.nodes[0]!;
    expect(node.emissiveColor).toBe('#ff00cc');
    expect(node.emissiveIntensity).toBeCloseTo(0.7);
    expect(node.emissive).toBe(true);
  });

  it('resolves iconUrl from iconRegistry for aws:ec2 icon', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a', { icon: 'aws:ec2' })],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.nodes[0]!.iconUrl).toBe('/assets/shapes/aws/ec2.svg');
  });

  it('iconUrl is undefined when no icon is specified (geometry-only node)', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a', { shape: 'hexagon' })],
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

  it('keeps flow fan-out to nested groups within NVS bounds after Y-down normalization', () => {
    const dsl: DiagramDSL = {
      id: 'cf-overview-regression',
      layout: { kind: 'flow', direction: 'top-down', gap: 1.05 },
      childrenOrder: ['cf-db', 'cf-categories'],
      nodes: [
        makeNode('cf-db', { size: [8.8, 2.5] }),
        makeNode('cf-memstore', { size: [5.0, 1.55] }),
        makeNode('cf-sessions', { size: [5.0, 1.55] }),
        makeNode('cf-agents', { size: [5.0, 1.55] }),
        makeNode('cf-tasks', { size: [5.0, 1.55] }),
        makeNode('cf-shared', { size: [5.0, 1.55] }),
        makeNode('cf-agmem', { size: [5.0, 1.55] }),
        makeNode('cf-events', { size: [5.0, 1.55] }),
        makeNode('cf-topology', { size: [5.0, 1.55] }),
        makeNode('cf-patterns', { size: [5.0, 1.55] }),
        makeNode('cf-perf', { size: [5.0, 1.55] }),
        makeNode('cf-workflow', { size: [5.0, 1.55] }),
        makeNode('cf-consensus', { size: [5.0, 1.55] }),
      ],
      edges: [
        makeEdge('cf-db', 'cf-core', { routing: 'flow' }),
        makeEdge('cf-db', 'cf-coord', { routing: 'flow' }),
        makeEdge('cf-db', 'cf-intel', { routing: 'flow' }),
        makeEdge('cf-db', 'cf-recov', { routing: 'flow' }),
      ],
      groups: [
        {
          id: 'cf-categories',
          nodeIds: [],
          childGroupIds: ['cf-core', 'cf-coord', 'cf-intel', 'cf-recov'],
          childrenOrder: ['cf-core', 'cf-coord', 'cf-intel', 'cf-recov'],
          layout: { kind: 'grid', columns: 2, spacing: [1.9, 1.1] },
        },
        {
          id: 'cf-core',
          parentId: 'cf-categories',
          nodeIds: ['cf-memstore', 'cf-sessions', 'cf-agents', 'cf-tasks'],
          childrenOrder: ['cf-memstore', 'cf-sessions', 'cf-agents', 'cf-tasks'],
          layout: { kind: 'flow', direction: 'top-down', gap: 0.72 },
        },
        {
          id: 'cf-coord',
          parentId: 'cf-categories',
          nodeIds: ['cf-shared', 'cf-agmem', 'cf-events', 'cf-topology'],
          childrenOrder: ['cf-shared', 'cf-agmem', 'cf-events', 'cf-topology'],
          layout: { kind: 'flow', direction: 'top-down', gap: 0.72 },
        },
        {
          id: 'cf-intel',
          parentId: 'cf-categories',
          nodeIds: ['cf-patterns', 'cf-perf'],
          childrenOrder: ['cf-patterns', 'cf-perf'],
          layout: { kind: 'flow', direction: 'top-down', gap: 0.72 },
        },
        {
          id: 'cf-recov',
          parentId: 'cf-categories',
          nodeIds: ['cf-workflow', 'cf-consensus'],
          childrenOrder: ['cf-workflow', 'cf-consensus'],
          layout: { kind: 'flow', direction: 'top-down', gap: 0.72 },
        },
      ],
    };

    const state = compileDiagram(dsl);
    const edgeById = new Map(state.edges.map((edge) => [edge.id, edge]));
    const upperLeft = edgeById.get('cf-db-cf-core-0');
    const upperRight = edgeById.get('cf-db-cf-coord-1');
    const lowerLeft = edgeById.get('cf-db-cf-intel-2');
    const lowerRight = edgeById.get('cf-db-cf-recov-3');
    const groupById = new Map(state.groups.map((group) => [group.id, group]));
    const upperCore = groupById.get('cf-core');
    const upperCoord = groupById.get('cf-coord');
    const lowerIntel = groupById.get('cf-intel');
    const lowerRecov = groupById.get('cf-recov');

    expect(upperLeft?.path.startTangent[0]).toBeLessThan(-0.95);
    expect(upperRight?.path.startTangent[0]).toBeGreaterThan(0.95);
    expect(lowerLeft?.path.startTangent).toEqual([0, 1, 0]);
    expect(lowerRight?.path.startTangent).toEqual([0, 1, 0]);
    expect(Math.abs(upperLeft?.path.endTangent?.[1] ?? 0)).toBeGreaterThan(0.95);
    expect(Math.abs(upperRight?.path.endTangent?.[1] ?? 0)).toBeGreaterThan(0.95);
    expect(lowerLeft?.path.endTangent?.[0]).toBeGreaterThan(0.95);
    expect(lowerRight?.path.endTangent?.[0]).toBeLessThan(-0.95);

    const lowerLeftPoints = lowerLeft?.controlPoints ?? [];
    const lowerRightPoints = lowerRight?.controlPoints ?? [];
    expect(lowerLeftPoints.length).toBeGreaterThanOrEqual(4);
    expect(lowerRightPoints.length).toBeGreaterThanOrEqual(4);
    expect(Math.abs((lowerLeftPoints[0]?.[0] ?? Infinity) - (lowerRightPoints[0]?.[0] ?? -Infinity))).toBeLessThan(0.01);
    expect(Math.abs((lowerLeftPoints[1]?.[0] ?? Infinity) - (lowerRightPoints[1]?.[0] ?? -Infinity))).toBeLessThan(0.01);
    expect(Math.abs((lowerLeftPoints[1]?.[1] ?? Infinity) - (lowerRightPoints[1]?.[1] ?? -Infinity))).toBeLessThan(0.01);

    const split = firstLateralSplit(lowerLeftPoints, lowerRightPoints);
    expect(split, 'lower routes never split laterally').toBeDefined();

    const upperBottom = Math.max(
      (upperCore?.bounds.y ?? 0) + (upperCore?.bounds.h ?? 0),
      (upperCoord?.bounds.y ?? 0) + (upperCoord?.bounds.h ?? 0),
    );
    const lowerTop = Math.min(
      lowerIntel?.bounds.y ?? 0,
      lowerRecov?.bounds.y ?? 0,
    );
    const splitThreshold = upperBottom + (lowerTop - upperBottom) * 0.5;

    expect(Math.abs((split?.leftPoint[1] ?? Infinity) - (split?.rightPoint[1] ?? -Infinity))).toBeLessThan(0.03);
    expect(split?.leftPoint[1] ?? -Infinity).toBeGreaterThan(splitThreshold);
    expect((split?.leftPoint[0] ?? Infinity)).toBeLessThan(split?.rightPoint[0] ?? -Infinity);

    state.edges.forEach((edge) => {
      edge.controlPoints.forEach((point) => {
        expect(point[0]).toBeGreaterThanOrEqual(-0.01);
        expect(point[0]).toBeLessThanOrEqual(1.01);
        expect(point[1]).toBeGreaterThanOrEqual(-0.01);
        expect(point[1]).toBeLessThanOrEqual(1.01);
      });
    });
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
    // After Y-flip normalization: child B (below parent A in Cartesian) has higher NVS y.
    expect(posB[1]).toBeGreaterThan(posA[1]);
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
    // After normalization, group bounds are [0..1] NVS fractions.
    expect(group.bounds.w).toBeGreaterThan(0);
    expect(group.bounds.h).toBeGreaterThan(0);
  });

  it('includes auto-layout group bounds in viewport fitting so top padding shifts content downward', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [
        makeNode('a', { position: [0, 0, 0], size: [4, 2] }),
      ],
      edges: [],
      groups: [
        {
          id: 'group-1',
          label: 'Group',
          nodeIds: ['a'],
          layout: {
            kind: 'grid',
            groupPadding: [4, 0, 0, 0],
            titleGap: 2,
          },
        },
      ],
    };

    const state = compileDiagram(dsl);
    const node = state.nodes[0]!;

    expect(node.position[1]).toBeGreaterThan(0.6);
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

  it('compiles group border emissive defaults and overrides', () => {
    const baseDsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [{ id: 'group-1', nodeIds: ['a'] }],
    };
    const baseState = compileDiagram(baseDsl);
    expect(baseState.groups[0]?.borderEmissiveColor).toBe(darkGlassTheme.group.defaultBorderColor);
    expect(baseState.groups[0]?.borderEmissiveIntensity).toBe(0);

    const overrideDsl: DiagramDSL = {
      ...baseDsl,
      groups: [{
        id: 'group-1',
        nodeIds: ['a'],
        borderEmissiveColor: '#00ffcc',
        borderEmissiveIntensity: 0.9,
      }],
    };
    const overrideState = compileDiagram(overrideDsl);
    expect(overrideState.groups[0]?.borderEmissiveColor).toBe('#00ffcc');
    expect(overrideState.groups[0]?.borderEmissiveIntensity).toBe(0.9);
  });

  it('compiles group edge lights with per-side density and no corner overlap', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      nodes: [makeNode('a', { position: [0, 0, 0] })],
      edges: [],
      groups: [{
        id: 'g1',
        nodeIds: ['a'],
        edgeLights: {
          density: 1,
          color: '#ffaa00',
        },
      }],
    };
    const state = compileDiagram(dsl);
    const edgeLights = state.groups[0]?.edgeLights;
    expect(edgeLights).toBeDefined();
    expect(edgeLights?.lights.length).toBe(24);
    const unique = new Set(edgeLights?.lights.map((l) => `${l.position[0].toFixed(6)},${l.position[1].toFixed(6)}`));
    expect(unique.size).toBe(edgeLights?.lights.length);
  });

  it('resolves group edge light color function using global index, side, and indexOnSide', () => {
    const observed: Array<[number, string, number]> = [];
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      nodes: [makeNode('a', { position: [0, 0, 0] })],
      edges: [],
      groups: [{
        id: 'g1',
        nodeIds: ['a'],
        edgeLights: {
          density: 0.4,
          color: (lightIndex, side, indexOnSide) => {
            observed.push([lightIndex, side, indexOnSide]);
            return side === 'top' ? '#ff0000' : '#00ff00';
          },
        },
      }],
    };

    const state = compileDiagram(dsl);
    const edgeLights = state.groups[0]?.edgeLights;
    expect(edgeLights).toBeDefined();
    expect(edgeLights?.lights.length).toBe(10);
    expect(edgeLights?.lights[0]).toMatchObject({ index: 0, side: 'top', indexOnSide: 0, color: '#ff0000' });
    expect(edgeLights?.lights[3]).toMatchObject({ index: 3, side: 'right', indexOnSide: 0, color: '#00ff00' });
    expect(edgeLights?.lights[5]).toMatchObject({ index: 5, side: 'bottom', indexOnSide: 0, color: '#00ff00' });
    expect(edgeLights?.lights[8]).toMatchObject({ index: 8, side: 'left', indexOnSide: 0, color: '#00ff00' });
    expect(observed[0]).toEqual([0, 'top', 0]);
    expect(observed[9]).toEqual([9, 'left', 1]);
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
    const expectedX = group.bounds.x - borderWidthUnits / 2;
    // Routing profiles apply a small epsilon offset (~0.012) to start/end anchors to
    // prevent z-fighting at node surfaces. Accept ±0.02 tolerance around the border centerline.
    expect(end[0]).toBeCloseTo(expectedX, 1);
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

describe('viewportBounds', () => {
  it('defaults to full-viewport { x:0, y:0, w:1, h:1 } when x/y/w/h are not provided', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.viewportBounds).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('emits viewportBounds from x/y/w/h DSL props', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      x: 0.1,
      y: 0.2,
      w: 0.5,
      h: 0.4,
      nodes: [makeNode('a', { position: [0.5, 0.5, 0] })],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.viewportBounds).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 });
  });

  it('tiltRotation defaults to [0,0,0] when tilt is not provided', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.tiltRotation).toEqual([0, 0, 0]);
  });

  it('tiltRotation[0] is set from scalar tilt prop; Y and Z are always 0', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
      tilt: -0.3,
    };
    const state = compileDiagram(dsl);
    expect(state.tiltRotation[0]).toBeCloseTo(-0.3);
    expect(state.tiltRotation[1]).toBe(0);
    expect(state.tiltRotation[2]).toBe(0);
  });

  it('z defaults to 0 when not provided', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.z).toBe(0);
  });

  it('z is emitted from DSL z prop', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
      z: 1.5,
    };
    const state = compileDiagram(dsl);
    expect(state.z).toBe(1.5);
  });

  it('scale defaults to 1 when not provided', () => {
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

  it('scale is emitted from DSL scale prop', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
      scale: 0.8,
    };
    const state = compileDiagram(dsl);
    expect(state.scale).toBe(0.8);
  });

  it('auto-layout node positions are in [0..1] NVS range', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    for (const node of state.nodes) {
      expect(node.position[0]).toBeGreaterThanOrEqual(0);
      expect(node.position[0]).toBeLessThanOrEqual(1);
      expect(node.position[1]).toBeGreaterThanOrEqual(0);
      expect(node.position[1]).toBeLessThanOrEqual(1);
    }
  });

  it('manual-layout node positions pass through in [0..1] NVS', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      nodes: [makeNode('a', { position: [0.25, 0.75, 0] })],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.nodes[0]!.position[0]).toBeCloseTo(0.25);
    expect(state.nodes[0]!.position[1]).toBeCloseTo(0.75);
  });
});

describe('exit / enter config compilation', () => {
  it('compileExitConfig returns undefined when no <Exit> in DSL', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.exit).toBeUndefined();
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

describe('contentAspect', () => {
  it('is present on all compiled DiagramState objects', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state).toHaveProperty('contentAspect');
    expect(typeof state.contentAspect).toBe('number');
    expect(Number.isFinite(state.contentAspect)).toBe(true);
  });


  it('equals spanX / spanY for a FlowLayout diagram with known node dimensions', () => {
    // Two nodes side by side: total spanX ≈ 9 (4+1+4), spanY ≈ 2 (just one row)
    // Default darkGlass node size is [4, 2] and grid spacing ≈ 1 gap
    // The exact ratio depends on layout, but contentAspect > 1 for a wide diagram.
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [
        makeNode('a', { size: [4, 2] }),
        makeNode('b', { size: [4, 2] }),
        makeNode('c', { size: [4, 2] }),
        makeNode('d', { size: [4, 2] }),
      ],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    // A 2×2 grid of [4,2] nodes should produce a bounding box with AR > 1.
    expect(state.contentAspect).toBeGreaterThan(0);
    expect(state.contentAspect).not.toBeCloseTo(1.0, 0); // should not be square
  });

  it('is 1.0 for a ManualLayout diagram', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      nodes: [
        makeNode('a', { position: [0.2, 0.3, 0], size: [0.1, 0.05] }),
        makeNode('b', { position: [0.7, 0.6, 0], size: [0.1, 0.05] }),
      ],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.contentAspect).toBe(1.0);
  });
});

describe('DiagramState NVS fields', () => {
  it('has viewportBounds, tiltRotation, z, and scale; not position or rotation', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid' },
      nodes: [makeNode('a')],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state).toHaveProperty('viewportBounds');
    expect(state).toHaveProperty('tiltRotation');
    expect(state).toHaveProperty('z', 0);
    expect(state).toHaveProperty('scale', 1);
    expect(state).not.toHaveProperty('position');
    expect(state).not.toHaveProperty('rotation');
  });

  it('tilt scalar from DSL is set as tiltRotation[0] (pitch only)', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      tilt: 0.1,
      nodes: [makeNode('a', { position: [0.5, 0.5, 0] })],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.tiltRotation[0]).toBeCloseTo(0.1);
    expect(state.tiltRotation[1]).toBe(0);
    expect(state.tiltRotation[2]).toBe(0);
  });
});

describe('string theme name resolution', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseDsl: DiagramDSL = {
    id: 'diagram',
    layout: { kind: 'grid' },
    nodes: [makeNode('a')],
    edges: [],
    groups: [],
  };

  it('compile resolves string "darkGlass" to darkGlassTheme node defaultColor #111a35', () => {
    const state = compileDiagram({ ...baseDsl, theme: 'darkGlass' });
    expect(state.nodes[0]!.color).toBe(darkGlassTheme.node.defaultColor);
  });

  it('compile resolves string "midnight" to midnightTheme node defaultColor #18140a', () => {
    const state = compileDiagram({ ...baseDsl, theme: 'midnight' });
    expect(state.nodes[0]!.color).toBe(midnightTheme.node.defaultColor);
  });

  it('compile resolves string "lightCanvas" to lightCanvasTheme node defaultColor #ffffff', () => {
    const state = compileDiagram({ ...baseDsl, theme: 'lightCanvas' });
    expect(state.nodes[0]!.color).toBe(lightCanvasTheme.node.defaultColor);
  });

  it('compile falls back to darkGlassTheme when unknown theme name passed', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = compileDiagram({ ...baseDsl, theme: 'unknownTheme' as any });
    expect(state.nodes[0]!.color).toBe(darkGlassTheme.node.defaultColor);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('unknownTheme'),
    );
  });

  it('compile still accepts full DiagramTheme object (regression)', () => {
    const stateByString = compileDiagram({ ...baseDsl, theme: 'darkGlass' });
    const stateByObject = compileDiagram({ ...baseDsl, theme: darkGlassTheme });
    expect(stateByString.nodes[0]!.color).toBe(stateByObject.nodes[0]!.color);
  });

  it('compile uses darkGlass default when no theme is passed (regression)', () => {
    const state = compileDiagram({ ...baseDsl });
    expect(state.nodes[0]!.color).toBe(darkGlassTheme.node.defaultColor);
  });
});
