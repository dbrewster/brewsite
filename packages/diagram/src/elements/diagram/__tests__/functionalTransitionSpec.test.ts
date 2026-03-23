import { describe, it, expect } from 'vitest';
import { makeSimpleContext } from '@brewsite/core';
import { functionalDiagramTransitionSpec, applyDiagramEnter, applyDiagramExit } from '../compile';
import type { DiagramNodeState, DiagramEdgeState, DiagramGroupState, DiagramState } from '../types';

const makeNode = (id: string, z: number, opacity = 1): DiagramNodeState => ({
  id,
  label: id,
  sublabel: undefined,
  shape: 'flow:rect',
  position: [0, 0, z],
  size: [0.1, 0.05],
  thickness: 0.4,
  color: '#2a2d3e',
  sideColor: '#1f2231',
  borderColor: '#3a3d4f',
  metalness: 0.15,
  roughness: 0.65,
  labelColor: '#ffffff',
  sublabelColor: '#a0a8c0',
  labelPadding: 0,
  opacity,
  clickable: false,
  enabled: true,
  iconUrl: undefined,
  iconScale: 0.6,
  groupId: undefined,
});

const makeEdge = (id: string, controlPoints: ReadonlyArray<readonly [number, number, number]>, opacity = 1): DiagramEdgeState => ({
  id,
  fromId: 'a',
  toId: 'b',
  label: undefined,
  style: 'solid',
  arrowStart: 'none',
  arrowEnd: 'open',
  color: '#555e7a',
  thickness: 0.04,
  path: {
    commands: controlPoints.length >= 2
      ? [{ kind: 'line', from: controlPoints[0]!, to: controlPoints[controlPoints.length - 1]! }]
      : [],
    startTangent: [1, 0, 0],
    endTangent: [-1, 0, 0],

    punctures: [],
  },
  controlPoints,
  opacity,
  flow: 'none',
  flowColor: undefined,
  routing: 'curved',
});

const makeState = (nodes: DiagramNodeState[], edges: DiagramEdgeState[]): DiagramState => ({
  id: 'test',
  nodes,
  edges,
  groups: [],
  viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
  tiltRotation: [0, 0, 0],
  z: 0,
  scale: 1,
  exit: undefined,
  enter: undefined,
  themeConfig: {} as any,
});

describe('functionalDiagramTransitionSpec', () => {
  describe('exitFn', () => {
    it('at t=0 returns fromState opacity unchanged', () => {
      const from = makeState([makeNode('a', 0, 0.8)], []);
      const result = functionalDiagramTransitionSpec.exitFn(from)(makeSimpleContext(0));
      expect(result.nodes[0]!.opacity).toBeCloseTo(0.8);
    });

    it('at t=1 returns opacity 0 on all nodes', () => {
      const from = makeState([makeNode('a', 0, 0.8)], []);
      const result = functionalDiagramTransitionSpec.exitFn(from)(makeSimpleContext(1));
      expect(result.nodes[0]!.opacity).toBeCloseTo(0);
    });
  });

  describe('enterFn', () => {
    it('at t=0 returns opacity 0 on all nodes', () => {
      const to = makeState([makeNode('a', 0, 0.8)], []);
      const result = functionalDiagramTransitionSpec.enterFn(to)(makeSimpleContext(0));
      expect(result.nodes[0]!.opacity).toBeCloseTo(0);
    });

    it('at t=1 returns toState opacity unchanged', () => {
      const to = makeState([makeNode('a', 0, 0.8)], []);
      const result = functionalDiagramTransitionSpec.enterFn(to)(makeSimpleContext(1));
      expect(result.nodes[0]!.opacity).toBeCloseTo(0.8);
    });
  });

  describe('interpolateFn', () => {
    it('at t=0 node position matches fromState z=0', () => {
      const from = makeState([makeNode('a', 0)], []);
      const to = makeState([makeNode('a', -50)], []);
      const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0));
      expect(result.nodes.find((node) => node.id === 'a')!.position[2]).toBe(0);
    });

    it('at t=1 node position matches toState z=-50', () => {
      const from = makeState([makeNode('a', 0)], []);
      const to = makeState([makeNode('a', -50)], []);
      const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(1));
      expect(result.nodes.find((node) => node.id === 'a')!.position[2]).toBe(-50);
    });

    it('at t=0.5 node position is midpoint between from and to', () => {
      const from = makeState([makeNode('a', 0)], []);
      const to = makeState([makeNode('a', -50)], []);
      const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
      expect(result.nodes.find((node) => node.id === 'a')!.position[2]).toBeCloseTo(-25);
    });

    it('node absent from fromState fades in (opacity 0 at t=0, full at t=1)', () => {
      const from = makeState([makeNode('a', 0)], []);
      const to = makeState([makeNode('a', 0), makeNode('b', 0, 0.6)], []);
      const resultStart = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0));
      const resultEnd = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(1));
      expect(resultStart.nodes.find((node) => node.id === 'b')!.opacity).toBeCloseTo(0);
      expect(resultEnd.nodes.find((node) => node.id === 'b')!.opacity).toBeCloseTo(0.6);
    });

    it('node absent from toState fades out (full at t=0, opacity 0 at t=1)', () => {
      const from = makeState([makeNode('a', 0), makeNode('c', 0, 0.7)], []);
      const to = makeState([makeNode('a', 0)], []);
      const resultStart = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0));
      const resultEnd = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(1));
      expect(resultStart.nodes.find((node) => node.id === 'c')!.opacity).toBeCloseTo(0.7);
      expect(resultEnd.nodes.find((node) => node.id === 'c')!.opacity).toBeCloseTo(0);
    });

    it('edge control points track live node positions during interpolation', () => {
      // Node 'b' moves from z=0 to z=-10 during the transition.
      // The edge must track the moving node, not hold a static pre-compiled position.
      const nodeA = { ...makeNode('a', 0), position: [-5, 0, 0] as const };
      const fromB = { ...makeNode('b', 0), position: [5, 0, 0] as const };
      const toB   = { ...makeNode('b', 0), position: [5, 0, -10] as const };
      const edge = makeEdge('a-b-0', [], 1);
      const edgeWithIds = { ...edge, fromId: 'a', toId: 'b' };
      const from = makeState([nodeA, fromB], [edgeWithIds]);
      const to   = makeState([nodeA, toB],   [edgeWithIds]);

      const resultMid = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
      const pts = resultMid.edges[0]!.controlPoints;

      // Live routing should produce at least 2 control points.
      expect(pts.length).toBeGreaterThanOrEqual(2);
      // Start point (near 'a' at [-5,0,0]) should have negative x.
      expect(pts[0]![0]).toBeLessThan(0);
      // End point (near 'b' at [5,0,-5] at t=0.5) should have positive x.
      expect(pts[pts.length - 1]![0]).toBeGreaterThan(0);
      // End point z should reflect node b's interpolated z (-5 at t=0.5, not the
      // pre-compiled 0 or -10).
      expect(pts[pts.length - 1]![2]).toBeLessThan(0);
      expect(pts[pts.length - 1]![2]).toBeGreaterThan(-10);
    });
  });
});

describe('applyDiagramExit', () => {
  it('with no exit config: fades nodes and edges to 0 at t=1', () => {
    const state = makeState([makeNode('a', 0, 0.6)], [makeEdge('e', [[0, 0, 0], [1, 0, 0]], 0.8)]);
    const result = applyDiagramExit(state, 1);
    expect(result.nodes[0]!.opacity).toBeCloseTo(0);
    expect(result.edges[0]!.opacity).toBeCloseTo(0);
  });

  it('with exit config {to, fade:true}: moves viewportBounds center and fades at t=1', () => {
    const state = { ...makeState([makeNode('a', 0)], []), exit: { to: [0.5, 2, 0] as const, fade: true, easing: 'linear' as const } };
    const result = applyDiagramExit(state, 1);
    // Center moves from [0.5, 0.5] toward [0.5, 2] — at t=1 center is at y=2
    const centerY = result.viewportBounds.y + result.viewportBounds.h / 2;
    expect(centerY).toBeCloseTo(2);
    expect(result.nodes[0]!.opacity).toBeCloseTo(0);
  });

  it('with exit config {to, fade:false}: moves viewportBounds but does not fade', () => {
    const state = { ...makeState([makeNode('a', 0, 0.8)], []), exit: { to: [2, 0.5, 0] as const, fade: false, easing: 'linear' as const } };
    const result = applyDiagramExit(state, 1);
    const centerX = result.viewportBounds.x + result.viewportBounds.w / 2;
    expect(centerX).toBeCloseTo(2);
    expect(result.nodes[0]!.opacity).toBeCloseTo(0.8);  // opacity unchanged
  });

  it('at t=0 viewportBounds is unchanged with exit config', () => {
    const state = { ...makeState([makeNode('a', 0)], []), exit: { to: [0.5, 2, 0] as const, fade: false, easing: 'linear' as const } };
    const result = applyDiagramExit(state, 0);
    expect(result.viewportBounds).toEqual(state.viewportBounds);
  });

  it('applies easing: spring produces non-linear t mapping on opacity', () => {
    const state = { ...makeState([makeNode('a', 0, 1)], []), exit: { fade: true, easing: 'spring' as const } };
    const mid = applyDiagramExit(state, 0.5);
    // Spring easing at t=0.5 should NOT equal linear 0.5 — opacity should not be exactly 0.5
    expect(mid.nodes[0]!.opacity).not.toBeCloseTo(0.5, 2);
  });
});

describe('applyDiagramEnter', () => {
  it('with no enter config: fades nodes in from 0 at t=0', () => {
    const state = makeState([makeNode('a', 0, 0.6)], []);
    const result = applyDiagramEnter(state, 0);
    expect(result.nodes[0]!.opacity).toBeCloseTo(0);
  });

  it('with enter config {from}: starts at from position at t=0', () => {
    const state = { ...makeState([makeNode('a', 0)], []), enter: { from: [-1, 0.5, 0] as const, fade: false, easing: 'linear' as const } };
    const result = applyDiagramEnter(state, 0);
    // Center should be at from=[−1, 0.5] at t=0
    const centerX = result.viewportBounds.x + result.viewportBounds.w / 2;
    expect(centerX).toBeCloseTo(-1);
  });

  it('with enter config {from}: reaches declared viewportBounds center at t=1', () => {
    const state = { ...makeState([makeNode('a', 0)], []), enter: { from: [-1, 0.5, 0] as const, fade: false, easing: 'linear' as const } };
    const result = applyDiagramEnter(state, 1);
    expect(result.viewportBounds).toEqual(state.viewportBounds);
  });

  it('with enter config {fade:true}: fades nodes in from 0 at t=0', () => {
    const state = { ...makeState([makeNode('a', 0, 0.7)], []), enter: { fade: true, easing: 'linear' as const } };
    const result = applyDiagramEnter(state, 0);
    expect(result.nodes[0]!.opacity).toBeCloseTo(0);
  });
});

describe('interpolateFn — diagram viewportBounds', () => {
  it('interpolates viewportBounds at t=0.5', () => {
    const from = makeState([makeNode('a', 0)], []);
    const to = { ...makeState([makeNode('a', 0)], []), viewportBounds: { x: 0.5, y: 0, w: 0.5, h: 1 } };
    const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.viewportBounds.x).toBeCloseTo(0.25);
    expect(result.viewportBounds.w).toBeCloseTo(0.75);
  });

  it('interpolates tiltRotation at t=0.5', () => {
    const from = makeState([makeNode('a', 0)], []);
    const to = { ...makeState([makeNode('a', 0)], []), tiltRotation: [0, 0.4, 0] as const };
    const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.tiltRotation[1]).toBeCloseTo(0.2);
  });
});

describe('interpolateFn — group borderOpacity and borderEmissiveIntensity', () => {
  const makeGroup = (id: string, overrides: Partial<DiagramGroupState> = {}): DiagramGroupState => ({
    id,
    label: id,
    variant: 'boundary',
    orientation: 'vertical',
    bounds: { x: 0, y: 0, w: 0.5, h: 0.5, padding: [0, 0, 0, 0] as readonly [number, number, number, number], titleGap: 0 },
    color: '#112233',
    borderColor: '#445566',
    borderWidth: 0.01,
    borderHeight: 0.01,
    borderStyle: 'solid',
    fillOpacity: 0.1,
    borderOpacity: 0.8,
    borderEmissiveColor: '#000000',
    borderEmissiveIntensity: 0,
    labelColor: '#ffffff',
    ...overrides,
  });

  const makeStateWithGroups = (groups: DiagramGroupState[]): DiagramState => ({
    id: 'test',
    nodes: [makeNode('a', 0)],
    edges: [],
    groups,
    viewportBounds: { x: 0, y: 0, w: 1, h: 1 },
    tiltRotation: [0, 0, 0],
    z: 0,
    scale: 1,
    exit: undefined,
    enter: undefined,
    themeConfig: {} as any,
  });

  it('lerps group borderOpacity between from and to at t=0.5', () => {
    const from = makeStateWithGroups([makeGroup('g1', { borderOpacity: 0.2 })]);
    const to = makeStateWithGroups([makeGroup('g1', { borderOpacity: 1.0 })]);
    const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.groups[0]!.borderOpacity).toBeCloseTo(0.6);
  });

  it('lerps group borderEmissiveIntensity between from and to at t=0.5', () => {
    const from = makeStateWithGroups([makeGroup('g1', { borderEmissiveIntensity: 0 })]);
    const to = makeStateWithGroups([makeGroup('g1', { borderEmissiveIntensity: 0.8 })]);
    const result = functionalDiagramTransitionSpec.interpolateFn(from, to)(makeSimpleContext(0.5));
    expect(result.groups[0]!.borderEmissiveIntensity).toBeCloseTo(0.4);
  });
});
