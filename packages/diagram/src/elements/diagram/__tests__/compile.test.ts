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
    expect(points[0][0]).toBeCloseTo(2.06, 5);
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
    expect(points[points.length - 1][0]).toBeCloseTo(7.94, 5);
  });

  it('handles self-loops gracefully (from === to): returns empty control points array', () => {
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const sizes = new Map([['a', [4, 2, 1] as const]]);
    const points = routeEdges([makeEdge('a', 'a')], positions, sizes);
    expect(points.get('a-a-0')).toEqual([]);
  });

  it('handles missing node IDs gracefully: calls onWarn, returns empty control points', () => {
    const warns: Array<{ code: string }> = [];
    const positions = new Map([['a', [0, 0, 0] as const]]);
    const sizes = new Map([['a', [4, 2, 1] as const]]);
    const points = routeEdges([makeEdge('a', 'b')], positions, sizes, 'curved', 'nearest-face', (code) => warns.push({ code })).get('a-b-0')!;
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
    const expectedX = group.bounds.x - borderWidthUnits / 2 - 0.06; // left border-centerline + EDGE_EPSILON outwards
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

describe('viewportBounds', () => {
  it('defaults to full-canvas { x:0, y:0, w:1, h:1 } when not provided', () => {
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

  it('passes through an explicitly-provided viewportBounds', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      viewportBounds: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 },
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

describe('DiagramState NVS fields', () => {
  it('has viewportBounds and tiltRotation, not position/rotation/scale', () => {
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
    expect(state).not.toHaveProperty('position');
    expect(state).not.toHaveProperty('scale');
    expect(state).not.toHaveProperty('rotation');
  });

  it('tilt from DSL is passed through as tiltRotation', () => {
    const dsl: DiagramDSL = {
      id: 'diagram',
      layout: { kind: 'manual' },
      tilt: [0.1, 0.2, 0.3],
      nodes: [makeNode('a', { position: [0.5, 0.5, 0] })],
      edges: [],
      groups: [],
    };
    const state = compileDiagram(dsl);
    expect(state.tiltRotation).toEqual([0.1, 0.2, 0.3]);
  });
});
