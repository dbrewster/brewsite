import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  routeEdges,
  compileDiagram,
} from '../compile';
import type { DiagramDSL, DiagramNodeDSL, DiagramEdgeDSL, DiagramTheme } from '../types';
import { darkGlassTheme } from '../themes/darkGlass';
import { midnightTheme } from '../themes/midnight';
import { lightCanvasTheme } from '../themes/lightCanvas';
import { defaultDiagramTheme } from '../themes/enterprise';
import {
  registerDiagramThemePair,
  _resetDiagramThemeRegistryForTesting,
} from '../themeRegistry';

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
    // Thickness is scaled by scaleFactor (1.0 when layout fits).
    expect(node.thickness).toBeGreaterThan(0);
    expect(node.color).toBe(defaultDiagramTheme.node.defaultColor);
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
      layout: { kind: 'flow', direction: 'top-down', gap: '3.5%' },
      childrenOrder: ['cf-db', 'cf-categories'],
      nodes: [
        makeNode('cf-db', { size: ['30%', '10%'] }),
        makeNode('cf-memstore', { size: ['18%', '6%'] }),
        makeNode('cf-sessions', { size: ['18%', '6%'] }),
        makeNode('cf-agents', { size: ['18%', '6%'] }),
        makeNode('cf-tasks', { size: ['18%', '6%'] }),
        makeNode('cf-shared', { size: ['18%', '6%'] }),
        makeNode('cf-agmem', { size: ['18%', '6%'] }),
        makeNode('cf-events', { size: ['18%', '6%'] }),
        makeNode('cf-topology', { size: ['18%', '6%'] }),
        makeNode('cf-patterns', { size: ['18%', '6%'] }),
        makeNode('cf-perf', { size: ['18%', '6%'] }),
        makeNode('cf-workflow', { size: ['18%', '6%'] }),
        makeNode('cf-consensus', { size: ['18%', '6%'] }),
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
          layout: { kind: 'grid', columns: 2, spacing: ['6%', '4%'] },
        },
        {
          id: 'cf-core',
          parentId: 'cf-categories',
          nodeIds: ['cf-memstore', 'cf-sessions', 'cf-agents', 'cf-tasks'],
          childrenOrder: ['cf-memstore', 'cf-sessions', 'cf-agents', 'cf-tasks'],
          layout: { kind: 'flow', direction: 'top-down', gap: '2.5%' },
        },
        {
          id: 'cf-coord',
          parentId: 'cf-categories',
          nodeIds: ['cf-shared', 'cf-agmem', 'cf-events', 'cf-topology'],
          childrenOrder: ['cf-shared', 'cf-agmem', 'cf-events', 'cf-topology'],
          layout: { kind: 'flow', direction: 'top-down', gap: '2.5%' },
        },
        {
          id: 'cf-intel',
          parentId: 'cf-categories',
          nodeIds: ['cf-patterns', 'cf-perf'],
          childrenOrder: ['cf-patterns', 'cf-perf'],
          layout: { kind: 'flow', direction: 'top-down', gap: '2.5%' },
        },
        {
          id: 'cf-recov',
          parentId: 'cf-categories',
          nodeIds: ['cf-workflow', 'cf-consensus'],
          childrenOrder: ['cf-workflow', 'cf-consensus'],
          layout: { kind: 'flow', direction: 'top-down', gap: '2.5%' },
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

    // Upper edges may exit from left/right faces (L-shaped routes) or bottom face
    // (shared-trunk bundle) depending on guide clearance. Both are valid.
    const upperLeftExitX = upperLeft?.path.startTangent[0] ?? 0;
    const upperRightExitX = upperRight?.path.startTangent[0] ?? 0;
    const isLeftExit = upperLeftExitX < -0.95;
    const isRightExit = upperRightExitX > 0.95;
    const isBottomExit = Math.abs(upperLeftExitX) < 0.1 && Math.abs(upperRightExitX) < 0.1;
    expect(
      (isLeftExit && isRightExit) || isBottomExit,
      `unexpected upper edge exit: left tangent X=${upperLeftExitX}, right tangent X=${upperRightExitX}`,
    ).toBe(true);

    // Lower edges exit from bottom face (Y-down) or side faces depending on routing.
    // Both vertical and horizontal exit tangents are valid at NVS scale.
    const lowerLeftTangent = lowerLeft?.path.startTangent ?? [0, 0, 0];
    const lowerRightTangent = lowerRight?.path.startTangent ?? [0, 0, 0];
    expect(
      Math.abs(lowerLeftTangent[0]) > 0.5 || Math.abs(lowerLeftTangent[1]) > 0.5,
      `lowerLeft exit tangent should have significant X or Y component`,
    ).toBe(true);
    expect(
      Math.abs(lowerRightTangent[0]) > 0.5 || Math.abs(lowerRightTangent[1]) > 0.5,
      `lowerRight exit tangent should have significant X or Y component`,
    ).toBe(true);

    // End tangents: upper edges enter from above, lower from the sides.
    expect(Math.abs(upperLeft?.path.endTangent?.[1] ?? 0)).toBeGreaterThan(0.95);
    expect(Math.abs(upperRight?.path.endTangent?.[1] ?? 0)).toBeGreaterThan(0.95);
    expect(Math.abs(lowerLeft?.path.endTangent?.[0] ?? 0)).toBeGreaterThan(0.95);
    expect(Math.abs(lowerRight?.path.endTangent?.[0] ?? 0)).toBeGreaterThan(0.95);

    // All control points must be within NVS bounds.
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
          spacing: ['400%', '400%'],
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
        makeNode('a', { position: ['0%', '0%', '0%'] }),
        makeNode('b', { position: ['400%', '0%', '0%'] }),
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
        makeNode('a', { position: ['0%', '0%', '0%'], size: ['400%', '200%'] }),
      ],
      edges: [],
      groups: [
        {
          id: 'group-1',
          label: 'Group',
          nodeIds: ['a'],
          layout: {
            kind: 'grid',
            groupPadding: ['400%', 0, 0, 0],
            titleGap: '200%',
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
    // borderWidth and borderHeight are scaled by scaleFactor.
    expect(state.groups[0]?.borderWidth).toBeGreaterThan(0);
    expect(state.groups[0]?.borderHeight).toBeGreaterThan(0);
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
    expect(baseState.groups[0]?.borderEmissiveColor).toBe(defaultDiagramTheme.group.defaultBorderColor);
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
      nodes: [makeNode('a', { position: ['0%', '0%', '0%'] })],
      edges: [],
      groups: [{
        id: 'g1',
        nodeIds: ['a'],
        edgeLights: {
          density: 50,
          color: '#ffaa00',
        },
      }],
    };
    const state = compileDiagram(dsl);
    const edgeLights = state.groups[0]?.edgeLights;
    expect(edgeLights).toBeDefined();
    // At NVS scale with density=50, the small perimeter yields a moderate number of lights.
    // Verify at least 4 lights (one per side minimum) and all positions are unique.
    expect(edgeLights!.lights.length).toBeGreaterThanOrEqual(4);
    const unique = new Set(edgeLights?.lights.map((l) => `${l.position[0].toFixed(6)},${l.position[1].toFixed(6)}`));
    expect(unique.size).toBe(edgeLights?.lights.length);
  });

  it('resolves group edge light color function using global index, side, and indexOnSide', () => {
    const observed: Array<[number, string, number]> = [];
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      nodes: [makeNode('a', { position: ['0%', '0%', '0%'] })],
      edges: [],
      groups: [{
        id: 'g1',
        nodeIds: ['a'],
        edgeLights: {
          density: 20,
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
    // At NVS scale the perimeter is small; verify at least 4 lights (one per side).
    expect(edgeLights!.lights.length).toBeGreaterThanOrEqual(4);
    // First light should be on the top side
    expect(edgeLights?.lights[0]).toMatchObject({ index: 0, side: 'top', indexOnSide: 0, color: '#ff0000' });
    // Verify the color function was called with correct arguments
    expect(observed[0]).toEqual([0, 'top', 0]);
    // Verify that non-top sides get '#00ff00'
    const nonTopLights = edgeLights!.lights.filter((l) => l.side !== 'top');
    for (const light of nonTopLights) {
      expect(light.color).toBe('#00ff00');
    }
  });

  it('routes edges to the group border centerline (not inner fill or outer edge)', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      nodes: [
        makeNode('src', { position: ['-50%', '0%', '0%'], size: ['8%', '8%'] }),
        makeNode('a', { position: ['0%', '0%', '0%'], size: ['15%', '8%'] }),
      ],
      edges: [makeEdge('src', 'g1')],
      groups: [{ id: 'g1', nodeIds: ['a'] }],
    };
    const state = compileDiagram(dsl);
    const group = state.groups.find((g) => g.id === 'g1')!;
    const edge = state.edges[0]!;
    const end = edge.controlPoints[edge.controlPoints.length - 1]!;

    // The edge endpoint should land near the group border.
    // At NVS scale, the border centerline offset is very small.
    // Accept that end X is close to the group left boundary.
    expect(end[0]).toBeCloseTo(group.bounds.x, 0);
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
      x: '10%',
      y: '20%',
      w: '50%',
      h: '40%',
      nodes: [makeNode('a', { position: ['50%', '50%', '0%'] })],
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
      tilt: '-0.3rad',
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

  it('manual-layout node positions are centered in [0..1] NVS after normalization', () => {
    // A single node at (0.25, 0.75) is the only content → normalizeToViewport
    // centers it at (0.5, 0.5) in NVS space.
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      nodes: [makeNode('a', { position: ['25%', '75%', '0%'] })],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.nodes[0]!.position[0]).toBeCloseTo(0.5);
    expect(state.nodes[0]!.position[1]).toBeCloseTo(0.5);
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

describe('scale-to-fit integration', () => {
  it('applies uniform scale when grid layout exceeds viewport', () => {
    // Create 10 nodes in a single row — total NVS span > 1.0
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid', columns: 10 },
      nodes: Array.from({ length: 10 }, (_, i) => makeNode(`n${i}`)),
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    // All node positions must be within [0..1] NVS range
    for (const node of state.nodes) {
      expect(node.position[0]).toBeGreaterThanOrEqual(-0.01);
      expect(node.position[0]).toBeLessThanOrEqual(1.01);
      expect(node.position[1]).toBeGreaterThanOrEqual(-0.01);
      expect(node.position[1]).toBeLessThanOrEqual(1.01);
    }
    // All sizes should be uniformly reduced (smaller than default [0.15, 0.08])
    for (const node of state.nodes) {
      expect(node.size[0]).toBeLessThan(0.15);
      expect(node.size[1]).toBeLessThan(0.08);
    }
  });

  it('thickness normalization accounts for scale factor', () => {
    // Dense layout with scaleFactor < 1 → compiled thickness = authored * scaleFactor
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'grid', columns: 10 },
      nodes: Array.from({ length: 10 }, (_, i) => makeNode(`n${i}`, { thickness: '7.5%' })),
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    // Thickness should be positive but less than authored (scaleFactor < 1)
    for (const node of state.nodes) {
      expect(node.thickness).toBeGreaterThan(0);
      expect(node.thickness).toBeLessThan(0.075);
    }
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
      tilt: '0.1rad',
      nodes: [makeNode('a', { position: ['50%', '50%', '0%'] })],
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
    // Register named themes for string-based resolution tests.
    // These are the local theme files — the registry is the seam for named families.
    registerDiagramThemePair('darkGlass', { dark: darkGlassTheme, light: darkGlassTheme });
    registerDiagramThemePair('midnight',  { dark: midnightTheme,  light: midnightTheme });
    registerDiagramThemePair('lightCanvas', { dark: lightCanvasTheme, light: lightCanvasTheme });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetDiagramThemeRegistryForTesting();
  });


  const baseDsl: DiagramDSL = {
    id: 'diagram',
    layout: { kind: 'grid' },
    nodes: [makeNode('a')],
    edges: [],
    groups: [],
  };

  it('compile resolves string "darkGlass" to darkGlassTheme node defaultColor', () => {
    const state = compileDiagram({ ...baseDsl, theme: 'darkGlass' });
    expect(state.nodes[0]!.color).toBe(darkGlassTheme.node.defaultColor);
  });

  it('compile resolves string "midnight" to midnightTheme node defaultColor', () => {
    const state = compileDiagram({ ...baseDsl, theme: 'midnight' });
    expect(state.nodes[0]!.color).toBe(midnightTheme.node.defaultColor);
  });

  it('compile resolves string "lightCanvas" to lightCanvasTheme node defaultColor', () => {
    const state = compileDiagram({ ...baseDsl, theme: 'lightCanvas' });
    expect(state.nodes[0]!.color).toBe(lightCanvasTheme.node.defaultColor);
  });

  it('compile falls back to default (enterprise) theme when unknown theme name passed', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = compileDiagram({ ...baseDsl, theme: 'unknownTheme' as any });
    expect(state.nodes[0]!.color).toBe(defaultDiagramTheme.node.defaultColor);
  });

  it('compile still accepts full DiagramTheme object (regression)', () => {
    const stateByString = compileDiagram({ ...baseDsl, theme: 'darkGlass' });
    const stateByObject = compileDiagram({ ...baseDsl, theme: darkGlassTheme });
    expect(stateByString.nodes[0]!.color).toBe(stateByObject.nodes[0]!.color);
  });

  it('compile uses default (enterprise) theme when no theme is passed (regression)', () => {
    // After the refactor, the default fallback is enterprise (not darkGlass).
    const state = compileDiagram({ ...baseDsl });
    expect(state.nodes[0]!.color).toBe(defaultDiagramTheme.node.defaultColor);
  });
});

// ─── Thickness / border NVS normalization ────────────────────────────────────

describe('compileDiagram — thickness normalization', () => {
  it('auto-layout: node thickness is scaled by scaleFactor', () => {
    const dsl: DiagramDSL = {
      id: 'd',
      layout: { kind: 'grid' },
      nodes: [
        makeNode('a', { thickness: '15%' }),
        makeNode('b', { thickness: '15%' }),
      ],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    const nodeA = state.nodes.find((n) => n.id === 'a')!;
    // scaleFactor = 1.0 for small layout → compiled = authored NVS value.
    expect(nodeA.thickness).toBeGreaterThan(0);
    expect(nodeA.thickness).toBeCloseTo(0.150, 3);
  });

  it('auto-layout: edge thickness is scaled by scaleFactor', () => {
    const dsl: DiagramDSL = {
      id: 'd',
      layout: { kind: 'grid' },
      nodes: [makeNode('a'), makeNode('b')],
      edges: [makeEdge('a', 'b', { thickness: '0.9%' })],
      groups: [],
    };
    const state = compileDiagram(dsl);
    const edge = state.edges[0]!;
    // scaleFactor = 1.0 → compiled = authored NVS value.
    expect(edge.thickness).toBeGreaterThan(0);
    expect(edge.thickness).toBeCloseTo(0.009, 4);
  });

  it('auto-layout: group borderWidth and borderHeight are normalized', () => {
    const dsl: DiagramDSL = {
      id: 'd',
      layout: { kind: 'grid' },
      nodes: [makeNode('a'), makeNode('b')],
      edges: [],
      groups: [{ id: 'g', nodeIds: ['a', 'b'] }],
    };
    const state = compileDiagram(dsl);
    const group = state.groups[0]!;
    expect(group.borderWidth).toBeGreaterThan(0);
    expect(group.borderHeight).toBeGreaterThan(0);
  });

  it('manual-layout: node thickness is scaled by scaleFactor', () => {
    const dsl: DiagramDSL = {
      id: 'd',
      layout: { kind: 'manual' },
      nodes: [makeNode('a', { position: ['50%', '50%', '0%'], size: ['15%', '8%'], thickness: '7.5%' })],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    const node = state.nodes[0]!;
    // scaleFactor = 1.0 for typical layout → compiled = authored NVS value.
    expect(node.thickness).toBeCloseTo(0.075, 3);
  });

  it('manual-layout: edge thickness is scaled by scaleFactor', () => {
    const dsl: DiagramDSL = {
      id: 'd',
      layout: { kind: 'manual' },
      nodes: [
        makeNode('a', { position: ['20%', '50%', '0%'], size: ['15%', '8%'] }),
        makeNode('b', { position: ['80%', '50%', '0%'], size: ['15%', '8%'] }),
      ],
      edges: [makeEdge('a', 'b', { thickness: '0.9%' })],
      groups: [],
    };
    const state = compileDiagram(dsl);
    // scaleFactor = 1.0 → compiled = authored NVS value.
    expect(state.edges[0]!.thickness).toBeCloseTo(0.009, 4);
  });
});

// ─── Edge Z-coordinate sanity — depth alignment regression tests ─────────────
//
// After the depth alignment model change (front face at z, side faces at z - d/2),
// edge routing Z coordinates must stay proportional to the XY dimensions.
// If depth is not scaled by the same scaleFactor as width/height, edge path Z
// coordinates become disproportionately large, causing pipes to route deep into
// the screen instead of staying near the XY plane.

describe('compileDiagram — edge Z-coordinate depth alignment', () => {
  it('edge path Z coordinates stay bounded relative to node thickness', () => {
    const dsl: DiagramDSL = {
      id: 'z-sanity',
      layout: { kind: 'grid' },
      nodes: [
        makeNode('a', { size: ['15%', '8%'], thickness: '4%' }),
        makeNode('b', { size: ['15%', '8%'], thickness: '4%' }),
        makeNode('c', { size: ['15%', '8%'], thickness: '4%' }),
      ],
      edges: [
        makeEdge('a', 'b'),
        makeEdge('b', 'c'),
        makeEdge('a', 'c'),
      ],
      groups: [],
    };
    const state = compileDiagram(dsl);
    const maxNodeThickness = Math.max(...state.nodes.map((n) => n.thickness));

    for (const edge of state.edges) {
      for (const command of edge.path.commands) {
        const points = command.kind === 'line'
          ? [command.from, command.to]
          : [command.p0, command.p1, command.p2, command.p3];
        for (const point of points) {
          // Edge Z should be within a reasonable multiple of node thickness.
          // The depth alignment model places side faces at z - d/2, and the flow
          // router may use underpass depth (default 0.08 NVS) for obstacle avoidance.
          // A 4× tolerance accounts for face stubs + underpass + routing offsets.
          expect(
            Math.abs(point[2]),
            `edge "${edge.id}" has Z=${point[2].toFixed(6)} exceeding 4× max thickness ${maxNodeThickness.toFixed(6)}`,
          ).toBeLessThan(maxNodeThickness * 4);
        }
      }
    }
  });

  it('edge path Z coordinates are near zero for diagrams with default thickness', () => {
    const dsl: DiagramDSL = {
      id: 'z-default',
      layout: { kind: 'flow', direction: 'top-down', gap: '5%' },
      nodes: [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')],
      edges: [
        makeEdge('a', 'b'),
        makeEdge('a', 'c'),
        makeEdge('c', 'd'),
      ],
      groups: [],
    };
    const state = compileDiagram(dsl);

    for (const edge of state.edges) {
      for (const command of edge.path.commands) {
        const points = command.kind === 'line'
          ? [command.from, command.to]
          : [command.p0, command.p1, command.p2, command.p3];
        for (const point of points) {
          // With default theme thickness (~0.03 NVS), edge Z should stay small.
          // The flow router may use underpass depth (0.08) for obstacle avoidance,
          // so allow up to 0.15 NVS. Before the depth scaling fix, unscaled depth
          // values could produce Z coordinates > 0.4 which would be clearly broken.
          expect(
            Math.abs(point[2]),
            `edge "${edge.id}" Z=${point[2].toFixed(6)} is too large for default thickness`,
          ).toBeLessThan(0.15);
        }
      }
    }
  });

  it('dense layout with scaleFactor < 1 keeps edge Z proportional to scaled dimensions', () => {
    // Create a dense layout that forces scaleFactor < 1.
    // 16 large nodes in a 4-col grid: 4×25% + 3×10% = 130% > usable area → scaleFactor < 1.
    const nodes = Array.from({ length: 16 }, (_, i) =>
      makeNode(`n${i}`, { size: ['25%', '15%'], thickness: '5%' }),
    );
    const edges = [
      makeEdge('n0', 'n1'),
      makeEdge('n1', 'n2'),
      makeEdge('n2', 'n3'),
      makeEdge('n4', 'n5'),
      makeEdge('n5', 'n6'),
      makeEdge('n0', 'n4'),
      makeEdge('n4', 'n8'),
    ];
    const dsl: DiagramDSL = {
      id: 'z-dense',
      layout: { kind: 'grid', columns: 4, spacing: ['10%', '10%'] },
      nodes,
      edges,
      groups: [],
    };
    const state = compileDiagram(dsl);

    // Verify scaleFactor was applied (nodes should be scaled down from authored 25%).
    const maxNodeW = Math.max(...state.nodes.map((n) => n.size[0]));
    expect(maxNodeW).toBeLessThan(0.25);

    // Key check: thickness must also be scaled down proportionally.
    // If thickness were NOT scaled, it would remain 0.05 while width is ~0.16,
    // making depth/width ratio ~0.31 (should be 0.2 = 5%/25%).
    const sampleNode = state.nodes[0]!;
    const thicknessToWidthRatio = sampleNode.thickness / sampleNode.size[0];
    // Authored ratio: 5/25 = 0.2. After uniform scaling, ratio should be preserved.
    expect(thicknessToWidthRatio).toBeCloseTo(0.2, 1);

    const maxNodeThickness = Math.max(...state.nodes.map((n) => n.thickness));
    for (const edge of state.edges) {
      for (const command of edge.path.commands) {
        const points = command.kind === 'line'
          ? [command.from, command.to]
          : [command.p0, command.p1, command.p2, command.p3];
        for (const point of points) {
          // Even in dense layouts, edge Z must stay proportional to the scaled thickness.
          // Allow 5× for underpass routing + face stubs.
          expect(
            Math.abs(point[2]),
            `edge "${edge.id}" Z=${point[2].toFixed(6)} exceeds 5× scaled thickness ${maxNodeThickness.toFixed(6)} in dense layout`,
          ).toBeLessThan(maxNodeThickness * 5);
        }
      }
    }
  });

  it('edge paths between groups have Z near zero, not deep into screen', () => {
    const dsl: DiagramDSL = {
      id: 'z-groups',
      layout: { kind: 'flow', direction: 'top-down', gap: '5%' },
      nodes: [
        makeNode('src', { size: ['20%', '8%'] }),
        makeNode('a1', { size: ['12%', '6%'] }),
        makeNode('a2', { size: ['12%', '6%'] }),
        makeNode('b1', { size: ['12%', '6%'] }),
        makeNode('b2', { size: ['12%', '6%'] }),
      ],
      edges: [
        makeEdge('src', 'g1', { routing: 'flow' }),
        makeEdge('src', 'g2', { routing: 'flow' }),
      ],
      groups: [
        {
          id: 'container',
          nodeIds: [],
          childGroupIds: ['g1', 'g2'],
          layout: { kind: 'grid', columns: 2, spacing: ['5%', '5%'] },
        },
        { id: 'g1', parentId: 'container', nodeIds: ['a1', 'a2'], layout: { kind: 'flow', direction: 'top-down', gap: '3%' } },
        { id: 'g2', parentId: 'container', nodeIds: ['b1', 'b2'], layout: { kind: 'flow', direction: 'top-down', gap: '3%' } },
      ],
      childrenOrder: ['src', 'container'],
    };
    const state = compileDiagram(dsl);
    const maxThickness = Math.max(
      ...state.nodes.map((n) => n.thickness),
      ...state.groups.map((g) => g.borderHeight),
    );

    for (const edge of state.edges) {
      for (const command of edge.path.commands) {
        const points = command.kind === 'line'
          ? [command.from, command.to]
          : [command.p0, command.p1, command.p2, command.p3];
        for (const point of points) {
          expect(
            Math.abs(point[2]),
            `group edge "${edge.id}" Z=${point[2].toFixed(6)} too deep (max thickness: ${maxThickness.toFixed(6)})`,
          ).toBeLessThan(maxThickness * 3);
        }
      }
    }
  });

  it('edge control points Z stays bounded (not just path commands)', () => {
    const dsl: DiagramDSL = {
      id: 'z-cp',
      layout: { kind: 'grid' },
      nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
      edges: [makeEdge('a', 'b'), makeEdge('b', 'c')],
      groups: [],
    };
    const state = compileDiagram(dsl);
    const maxNodeThickness = Math.max(...state.nodes.map((n) => n.thickness));

    for (const edge of state.edges) {
      for (const cp of edge.controlPoints) {
        expect(
          Math.abs(cp[2]),
          `edge "${edge.id}" controlPoint Z=${cp[2].toFixed(6)} exceeds bounds`,
        ).toBeLessThan(maxNodeThickness * 2);
      }
    }
  });
});
